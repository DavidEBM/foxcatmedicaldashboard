from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import joblib
import numpy as np
import pandas as pd

from .config import RANDOM_STATE, TARGET_LABELS
from .diagnostics import (
    _bootstrap_ci,
    export_target_diagnostics,
    feature_importance,
)
from .model_common import (
    build_pipeline,
    evaluate,
    normalized_quality,
)
from .utils import json_safe, norm, utc_now


# ============================================================================
# RESULTADO DEL TARGET
# ============================================================================


@dataclass
class TargetResult:
    """
    Resultado completo del entrenamiento de un target.

    Metodología:

        TRAIN
          ↓
        CV
          ↓
        VALIDATION
          ↓
        selección del modelo
          ↓
        TRAIN + VALIDATION
          ↓
        TEST

    TEST se utiliza únicamente para la evaluación final del modelo
    seleccionado.
    """

    key: str
    column: str
    label: str
    selected: Optional[str]
    artifact: Optional[str]
    candidates: list[dict[str, Any]]
    test: dict[str, Any]
    threshold_met: bool
    split: dict[str, int]

    testClassDistribution: dict[str, int] = field(
        default_factory=dict
    )

    risk_pipeline: Any = None

    feature_columns: list[str] = field(
        default_factory=list
    )


# ============================================================================
# UTILIDADES DEL PIPELINE
# ============================================================================


def _pipeline_classes(
    pipeline: Any,
    fallback: Any,
) -> np.ndarray:
    """
    Obtiene las clases del estimador final de un Pipeline.

    El pipeline actual utiliza el step:
        "estimator"

    Se conserva "model" como fallback para artefactos antiguos.
    """

    estimator = pipeline

    if hasattr(
        pipeline,
        "named_steps",
    ):
        named_steps = pipeline.named_steps

        if "estimator" in named_steps:
            estimator = named_steps["estimator"]

        elif "model" in named_steps:
            estimator = named_steps["model"]

    classes = getattr(
        estimator,
        "classes_",
        None,
    )

    if classes is None:
        return np.asarray(
            np.unique(fallback)
        )

    return np.asarray(classes)


def _benchmark_latency(
    pipeline: Any,
    X: pd.DataFrame,
    repeats: int = 8,
) -> list[float]:
    """
    Mide el tiempo de predict() sobre un lote.

    Unidad:
        milisegundos por lote.

    Es un benchmark técnico y no una métrica clínica.
    """

    if X is None or len(X) == 0:
        return []

    repeats = max(
        1,
        int(repeats),
    )

    # Descarta el coste de inicialización de la primera llamada.
    pipeline.predict(X.iloc[:1])

    samples: list[float] = []

    for _ in range(repeats):
        start = time.perf_counter()

        pipeline.predict(X)

        elapsed = (
            time.perf_counter()
            - start
        )

        samples.append(
            max(
                elapsed * 1000.0,
                np.finfo(float).eps,
            )
        )

    return samples


def _safe_feature_importance(
    pipeline: Any,
    X: pd.DataFrame,
    y: pd.Series,
    model_name: str,
) -> Any:
    """
    Obtiene importancia de variables sin interrumpir la publicación.
    """

    try:
        return feature_importance(
            pipeline,
            X,
            y,
            model_name,
        )

    except Exception as exc:
        return {
            "available": False,
            "error": str(exc),
        }


def _safe_bootstrap_ci(
    y: pd.Series,
    pred: np.ndarray,
    prob: np.ndarray,
    classes: np.ndarray,
) -> dict[str, Any]:
    """
    Calcula intervalos bootstrap de forma defensiva.
    """

    try:
        return _bootstrap_ci(
            y,
            pred,
            prob,
            binary=len(classes) == 2,
            classes=list(classes),
            n_boot=200,
            seed=RANDOM_STATE,
        )

    except Exception as exc:
        return {
            "available": False,
            "error": str(exc),
        }


def _learning_curve(
    pipeline: Any,
) -> Optional[list[dict[str, float]]]:
    """
    Extrae loss_curve_ cuando el estimador final la proporciona.

    Actualmente aplica principalmente a MLP.
    """

    if not hasattr(
        pipeline,
        "named_steps",
    ):
        return None

    estimator = pipeline.named_steps.get(
        "estimator"
    )

    if estimator is None:
        estimator = pipeline.named_steps.get(
            "model"
        )

    if estimator is None:
        return None

    values = getattr(
        estimator,
        "loss_curve_",
        None,
    )

    if values is None:
        return None

    try:
        return [
            {
                "epoch": index + 1,
                "loss": float(value),
            }
            for index, value in enumerate(values)
        ]

    except Exception:
        return None


def _test_class_distribution(
    y_test: pd.Series,
) -> dict[str, int]:
    """
    Distribución observada de clases en TEST.
    """

    return {
        str(key): int(value)
        for key, value in y_test.value_counts().items()
    }


# ============================================================================
# SELECCIÓN DE CANDIDATOS
# ============================================================================


def _candidate_is_available(
    candidate: dict[str, Any],
) -> bool:
    """
    Determina si un candidato puede participar en la selección.

    La selección utiliza exclusivamente resultados de:
        CV + VALIDATION
    """

    if not candidate.get(
        "available"
    ):
        return False

    score = candidate.get(
        "validationScore",
        np.nan,
    )

    try:
        return bool(
            np.isfinite(
                float(score)
            )
        )

    except (
        TypeError,
        ValueError,
        OverflowError,
    ):
        return False


def _candidate_selection_key(
    candidate: dict[str, Any],
) -> tuple[float, float, float]:
    """
    Clave determinista de selección.

    Prioridad:

        1. validationScore mayor.
        2. menor variabilidad CV.
        3. CV mean mayor.

    TEST no interviene.
    """

    validation_score = candidate.get(
        "validationScore",
        -np.inf,
    )

    cv_std = candidate.get(
        "cvStdScore",
        np.inf,
    )

    cv_mean = candidate.get(
        "cvMeanScore",
        -np.inf,
    )

    try:
        validation_score = float(
            validation_score
        )

    except (
        TypeError,
        ValueError,
        OverflowError,
    ):
        validation_score = -np.inf

    try:
        cv_std = float(
            cv_std
        )

        if not np.isfinite(
            cv_std
        ):
            cv_std = np.inf

    except (
        TypeError,
        ValueError,
        OverflowError,
    ):
        cv_std = np.inf

    try:
        cv_mean = float(
            cv_mean
        )

    except (
        TypeError,
        ValueError,
        OverflowError,
    ):
        cv_mean = -np.inf

    return (
        validation_score,
        -cv_std,
        cv_mean,
    )


def _select_candidate(
    candidates: list[dict[str, Any]],
) -> tuple[
    Optional[dict[str, Any]],
    bool,
]:
    """
    Selecciona el candidato exclusivamente con CV + VALIDATION.

    Si ningún candidato cumple los umbrales, conserva el mejor
    candidato disponible para diagnóstico.

    En ese caso threshold_met permanece en False.
    """

    available = [
        candidate
        for candidate in candidates
        if _candidate_is_available(
            candidate
        )
    ]

    if not available:
        return None, False

    eligible = [
        candidate
        for candidate in available
        if candidate.get(
            "thresholdMet",
            False,
        )
    ]

    pool = (
        eligible
        if eligible
        else available
    )

    selected = max(
        pool,
        key=_candidate_selection_key,
    )

    return (
        selected,
        bool(
            selected.get(
                "thresholdMet",
                False,
            )
        ),
    )


# ============================================================================
# ENTRENAMIENTO FINAL DEL MODELO SELECCIONADO
# ============================================================================


def _fit_final_candidate(
    candidate: dict[str, Any],
    X_final: pd.DataFrame,
    y_final: pd.Series,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    key: str,
    column: str,
    label: str,
    thresholds: dict[str, float],
    all_dir: Path,
) -> Optional[dict[str, Any]]:
    """
    Entrena exclusivamente el candidato seleccionado sobre
    TRAIN + VALIDATION y realiza la evaluación final sobre TEST.

    TEST no se utiliza para:
        - selección,
        - comparación entre candidatos,
        - ajuste de hiperparámetros,
        - cálculo de validationScore,
        - cálculo de CV.

    El modelo final es el único modelo que consume TEST.
    """

    name = candidate.get(
        "model"
    )

    estimator_factory = candidate.get(
        "estimatorFactory"
    )

    if not name:
        return None

    if estimator_factory is None:
        candidate["finalArtifact"] = None

        candidate["testMetrics"] = {
            "available": False,
            "error": (
                "El candidato no contiene estimatorFactory."
            ),
        }

        candidate["testCI95"] = {}

        return None

    try:
        # ------------------------------------------------------------------
        # Crear estimador
        # ------------------------------------------------------------------

        estimator = estimator_factory(
            int(
                y_final.nunique()
            )
        )

        # ------------------------------------------------------------------
        # Construir pipeline
        # ------------------------------------------------------------------

        final = build_pipeline(
            X=X_final,
            name=name,
            estimator=estimator,
        )

        # ------------------------------------------------------------------
        # Entrenamiento final
        # ------------------------------------------------------------------

        final.fit(
            X_final,
            y_final,
        )

        # ------------------------------------------------------------------
        # Evaluación TEST
        # ------------------------------------------------------------------

        metrics = evaluate(
            final,
            X_test,
            y_test,
        )

        metrics[
            "normalizedQualityPercent"
        ] = (
            normalized_quality(
                metrics
            )
            * 100.0
        )

        # ------------------------------------------------------------------
        # Latencia
        # ------------------------------------------------------------------

        batch_latency_samples = _benchmark_latency(
            final,
            X_test,
            repeats=8,
        )

        record_latency_samples = _benchmark_latency(
            final,
            X_test.iloc[:1],
            repeats=8,
        )

        if record_latency_samples:
            latency_mean = float(
                np.mean(
                    record_latency_samples
                )
            )

            latency_std = (
                float(
                    np.std(
                        record_latency_samples,
                        ddof=1,
                    )
                )
                if len(record_latency_samples) > 1
                else 0.0
            )

            metrics[
                "predictionLatencyMs"
            ] = latency_mean

            metrics[
                "predictionLatencyStdMs"
            ] = latency_std

            metrics[
                "responseTimeMsPerRecord"
            ] = (
                latency_mean
            )

            response_time = metrics[
                "responseTimeMsPerRecord"
            ]

            metrics[
                "predictionsPerSecond"
            ] = (
                1000.0 / response_time
                if response_time > 0
                else np.inf
            )

        if batch_latency_samples:
            batch_mean = float(np.mean(batch_latency_samples))
            metrics["predictionBatchLatencyMs"] = batch_mean
            metrics["batchPredictionsPerSecond"] = (
                len(X_test) * 1000.0 / batch_mean
                if batch_mean > 0
                else np.inf
            )

        # ------------------------------------------------------------------
        # Predicciones
        # ------------------------------------------------------------------

        pred = np.asarray(
            final.predict(
                X_test
            )
        )

        # ------------------------------------------------------------------
        # Probabilidades
        # ------------------------------------------------------------------

        probabilities_available = hasattr(
            final,
            "predict_proba",
        )

        if probabilities_available:
            prob = np.asarray(
                final.predict_proba(
                    X_test
                ),
                dtype=float,
            )
        else:
            prob = np.empty(
                (
                    len(X_test),
                    0,
                ),
                dtype=float,
            )

        # ------------------------------------------------------------------
        # Clases
        # ------------------------------------------------------------------

        classes = _pipeline_classes(
            final,
            y_test,
        )

        # ------------------------------------------------------------------
        # Intervalos de confianza
        # ------------------------------------------------------------------

        if prob.size > 0:
            ci = _safe_bootstrap_ci(
                y_test,
                pred,
                prob,
                classes,
            )
        else:
            ci = {
                "available": False,
                "error": (
                    "El modelo no proporciona predict_proba()."
                ),
            }

        # ------------------------------------------------------------------
        # Importancia de variables
        # ------------------------------------------------------------------

        importance = _safe_feature_importance(
            final,
            X_test,
            y_test,
            name,
        )

        # ------------------------------------------------------------------
        # Curva de aprendizaje
        # ------------------------------------------------------------------

        learning_curve = _learning_curve(
            final
        )

        # ------------------------------------------------------------------
        # Artefacto individual
        #
        # Este artefacto corresponde al único modelo final evaluado
        # sobre TEST.
        # ------------------------------------------------------------------

        artifact_path = (
            all_dir
            / f"{norm(name)}.joblib"
        )

        artifact_payload = {
            "pipeline": final,

            "targetKey": key,

            "targetColumn": column,

            "targetLabel": label,

            "featureColumns": list(
                X_final.columns
            ),

            "model": name,

            "selectedModel": name,

            "randomState": RANDOM_STATE,

            "trainedAt": utc_now(),

            "thresholds": dict(
                thresholds
            ),

            "selection": {
                "selectedBy": (
                    "CV + VALIDATION"
                ),

                "validationScore": candidate.get(
                    "validationScore"
                ),

                "validationThresholdMet": candidate.get(
                    "thresholdMet",
                    False,
                ),

                "testUsedForSelection": False,
            },

            "finalTraining": {
                "rows": len(X_final),

                "source": (
                    "TRAIN + VALIDATION"
                ),
            },

            "testMetrics": metrics,

            "testCI95": ci,

            "hyperparameters": candidate.get(
                "hyperparameters",
                {},
            ),

            "probabilityOutput": (
                "predict_proba es una probabilidad "
                "estimada por el modelo; no es una "
                "probabilidad clínica validada."
            ),
        }

        joblib.dump(
            artifact_payload,
            artifact_path,
            compress=3,
        )

        # ------------------------------------------------------------------
        # Payload interno
        # ------------------------------------------------------------------

        payload = {
            "model": name,

            "available": True,

            "metrics": metrics,

            "ci": ci,

            "predictions": pred,

            "probabilities": prob,

            "classes": list(classes),

            "latencySamplesMs": record_latency_samples,

            "latencyBatchSamplesMs": batch_latency_samples,

            "featureImportance": importance,

            "hyperparameters": candidate.get(
                "hyperparameters",
                {},
            ),

            "learningCurve": learning_curve,

            "artifact": str(
                artifact_path
            ),

            "finalPipeline": final,
        }

        candidate["testMetrics"] = metrics

        candidate["testCI95"] = ci

        candidate["finalArtifact"] = str(
            artifact_path
        )

        return payload

    except Exception as exc:
        candidate["testMetrics"] = {
            "available": False,
            "error": str(exc),
        }

        candidate["testCI95"] = {}

        candidate["finalArtifact"] = None

        return None


# ============================================================================
# PUBLICACIÓN DEL MEJOR MODELO
# ============================================================================


def publish_best_model(
    X_train,
    y_train,
    X_validation,
    y_validation,
    X_test,
    y_test,
    key,
    column,
    candidates,
    thresholds,
    output_dir,
    split_info=None,
) -> TargetResult:
    """
    Selecciona, reentrena, evalúa y publica el modelo de un target.

    Flujo metodológico:

        TRAIN
            ↓
        StratifiedKFold CV
            ↓
        VALIDATION
            ↓
        Selección del modelo
            ↓
        TRAIN + VALIDATION
            ↓
        TEST
            ↓
        Evaluación final

    TEST solamente participa en la evaluación final del modelo
    seleccionado.
    """

    label = TARGET_LABELS.get(
        key,
        str(column)
        .replace(
            "(Target)",
            "",
        )
        .strip(),
    )

    # ------------------------------------------------------------------
    # Validación de datasets
    # ------------------------------------------------------------------

    datasets = (
        (
            X_train,
            y_train,
            "X_train",
            "y_train",
        ),
        (
            X_validation,
            y_validation,
            "X_validation",
            "y_validation",
        ),
        (
            X_test,
            y_test,
            "X_test",
            "y_test",
        ),
    )

    for (
        X,
        y,
        x_name,
        y_name,
    ) in datasets:

        if len(X) != len(y):
            raise ValueError(
                f"{x_name} y {y_name} deben tener el mismo "
                "número de filas."
            )

        if len(X) == 0:
            raise ValueError(
                f"{x_name} está vacío."
            )

    # ------------------------------------------------------------------
    # Selección
    #
    # TEST todavía no se utiliza.
    # ------------------------------------------------------------------

    (
        selected_candidate,
        selected_threshold_met,
    ) = _select_candidate(
        candidates
    )

    selected = (
        selected_candidate.get(
            "model"
        )
        if selected_candidate is not None
        else None
    )

    # ------------------------------------------------------------------
    # Directorios
    # ------------------------------------------------------------------

    output = Path(
        output_dir
    )

    output.mkdir(
        parents=True,
        exist_ok=True,
    )

    all_dir = (
        output
        / "Models_All"
        / norm(key)
    )

    all_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    # ------------------------------------------------------------------
    # TRAIN + VALIDATION
    # ------------------------------------------------------------------

    final_x = pd.concat(
        [
            X_train,
            X_validation,
        ],
        axis=0,
        ignore_index=True,
    )

    final_y = pd.concat(
        [
            y_train,
            y_validation,
        ],
        axis=0,
        ignore_index=True,
    )

    # ------------------------------------------------------------------
    # Entrenamiento final
    #
    # SOLAMENTE el modelo seleccionado consume TEST.
    # ------------------------------------------------------------------

    selected_payload: Optional[
        dict[str, Any]
    ] = None

    if selected_candidate is not None:
        selected_payload = _fit_final_candidate(
            candidate=selected_candidate,
            X_final=final_x,
            y_final=final_y,
            X_test=X_test,
            y_test=y_test,
            key=key,
            column=column,
            label=label,
            thresholds=thresholds,
            all_dir=all_dir,
        )

    # ------------------------------------------------------------------
    # Preparar resultado TEST
    # ------------------------------------------------------------------

    artifact: Optional[str] = None

    test: dict[str, Any] = {
        "available": False,
        "error": (
            "No hubo modelo seleccionado."
        ),
    }

    if (
        selected is not None
        and selected_payload is None
    ):
        test = {
            "available": False,
            "error": (
                "El modelo seleccionado no pudo "
                "completarse durante el entrenamiento final."
            ),
        }

    elif selected_payload is not None:

        test = selected_payload[
            "metrics"
        ]

        # --------------------------------------------------------------
        # Artefacto principal
        # --------------------------------------------------------------

        main_artifact = (
            output
            / f"{norm(key)}-{norm(selected)}.joblib"
        )

        main_payload = {
            "pipeline": selected_payload[
                "finalPipeline"
            ],

            "targetKey": key,

            "targetColumn": column,

            "targetLabel": label,

            "featureColumns": list(
                final_x.columns
            ),

            "model": selected,

            "selectedModel": selected,

            "randomState": RANDOM_STATE,

            "trainedAt": utc_now(),

            "thresholds": dict(
                thresholds
            ),

            "validationThresholdMet": (
                selected_threshold_met
            ),

            "selection": {
                "method": (
                    "StratifiedKFold CV + validation holdout"
                ),

                "selectedModel": selected,

                "validationScore": (
                    selected_candidate.get(
                        "validationScore"
                    )
                    if selected_candidate
                    else None
                ),

                "cvMeanScore": (
                    selected_candidate.get(
                        "cvMeanScore"
                    )
                    if selected_candidate
                    else None
                ),

                "cvStdScore": (
                    selected_candidate.get(
                        "cvStdScore"
                    )
                    if selected_candidate
                    else None
                ),

                "selectionUsesTest": False,
            },

            "finalTraining": {
                "rows": len(final_x),

                "source": (
                    "TRAIN + VALIDATION"
                ),
            },

            "testMetrics": test,

            "testCI95": selected_payload[
                "ci"
            ],

            "probabilityOutput": (
                "predict_proba es una probabilidad "
                "estimada por el modelo; no es una "
                "probabilidad clínica validada."
            ),
        }

        joblib.dump(
            main_payload,
            main_artifact,
            compress=3,
        )

        artifact = str(
            main_artifact
        )

    # ------------------------------------------------------------------
    # Limpiar información TEST de candidatos no seleccionados
    #
    # Esto evita presentar métricas TEST como si fueran parte de la
    # comparación entre algoritmos.
    # ------------------------------------------------------------------

    for candidate in candidates:

        candidate_name = candidate.get(
            "model"
        )

        if (
            selected is None
            or candidate_name != selected
        ):
            candidate["testMetrics"] = {}

            candidate["testCI95"] = {}

            candidate["finalArtifact"] = None

    # ------------------------------------------------------------------
    # Información de split
    # ------------------------------------------------------------------

    split_info = (
        split_info
        or {
            "train": len(X_train),
            "validation": len(
                X_validation
            ),
            "test": len(X_test),
        }
    )

    split_info = {
        "train": int(
            split_info.get(
                "train",
                len(X_train),
            )
        ),

        "validation": int(
            split_info.get(
                "validation",
                len(X_validation),
            )
        ),

        "test": int(
            split_info.get(
                "test",
                len(X_test),
            )
        ),
    }

    # ------------------------------------------------------------------
    # Diagnósticos
    #
    # Solo se entrega a diagnostics el payload del modelo seleccionado,
    # porque TEST no debe utilizarse para comparar candidatos.
    # ------------------------------------------------------------------

    diagnostic_payloads: list[
        dict[str, Any]
    ] = []

    if selected_payload is not None:
        diagnostic_payloads.append(
            selected_payload
        )

    try:
        export_target_diagnostics(
            output,
            key,
            label,
            candidates,
            diagnostic_payloads,
            X_test,
            y_test,
            split_info,
        )

    except Exception as exc:
        diagnostic_error = {
            "available": False,
            "error": str(exc),
        }

        for candidate in candidates:
            candidate.setdefault(
                "diagnostics",
                diagnostic_error,
            )

    # ------------------------------------------------------------------
    # Resultado
    # ------------------------------------------------------------------

    result = TargetResult(
        key=key,

        column=column,

        label=label,

        selected=selected,

        artifact=artifact,

        candidates=candidates,

        test=test,

        threshold_met=bool(
            selected
            and artifact
            and selected_threshold_met
        ),

        split=split_info,

        testClassDistribution=(
            _test_class_distribution(
                y_test
            )
        ),

        risk_pipeline=(
            selected_payload[
                "finalPipeline"
            ]
            if selected_payload is not None
            else None
        ),

        feature_columns=list(
            final_x.columns
        ),
    )

    return result


# ============================================================================
# MANIFIESTO
# ============================================================================


def export_manifest(
    output_dir,
    source,
    targets,
    features,
    split,
    results,
    thresholds,
    skipped_targets=None,
):
    """
    Exporta el manifiesto reproducible del entrenamiento.

    El manifiesto distingue entre:

        - resultados de CV + VALIDATION usados para selección;
        - evaluación TEST del modelo seleccionado.

    No presenta TEST como criterio de comparación entre algoritmos.
    """

    data = {
        "generatedAt": utc_now(),

        "sourceDataset": Path(
            source
        ).as_posix(),

        "randomState": RANDOM_STATE,

        "methodology": {
            "selection": (
                "StratifiedKFold CV + validation holdout"
            ),

            "finalFit": (
                "TRAIN + VALIDATION"
            ),

            "testUsage": (
                "TEST reserved exclusively for final evaluation "
                "of the selected model"
            ),

            "missingData": (
                "Missing values are imputed inside each "
                "training pipeline/fold."
            ),

            "selectionDoesNotUseTest": True,

            "selectionFallback": (
                "If no candidate meets thresholds, "
                "the best available candidate is retained "
                "for diagnostic purposes and thresholdMet remains false."
            ),
        },

        "splitTotals": {
            "train": int(
                split["train"]
            ),

            "validation": int(
                split["validation"]
            ),

            "test": int(
                split["test"]
            ),
        },

        "targets": dict(
            targets
        ),

        "skippedTargets": (
            skipped_targets or {}
        ),

        "featureColumnsByTarget": {
            key: list(columns)
            for key, columns in features.items()
        },

        "minimumThresholds": dict(
            thresholds
        ),

        "models": {},
    }

    for key, result in results.items():

        algorithms_tested: list[
            dict[str, Any]
        ] = []

        for candidate in result.candidates:

            candidate_model = candidate.get(
                "model"
            )

            is_selected = (
                candidate_model
                == result.selected
            )

            algorithms_tested.append(
                {
                    "model": candidate_model,

                    "available": candidate.get(
                        "available",
                        False,
                    ),

                    # --------------------------------------------------
                    # MÉTRICAS DE SELECCIÓN
                    # --------------------------------------------------

                    "validationScore": candidate.get(
                        "validationScore"
                    ),

                    "cvMeanScore": candidate.get(
                        "cvMeanScore"
                    ),

                    "cvStdScore": candidate.get(
                        "cvStdScore"
                    ),

                    "validationThresholdMet": candidate.get(
                        "thresholdMet",
                        False,
                    ),

                    "validationMetrics": candidate.get(
                        "validationMetrics",
                        {},
                    ),

                    # --------------------------------------------------
                    # TEST
                    #
                    # Solo el modelo seleccionado tiene evaluación TEST.
                    # --------------------------------------------------

                    "testEvaluationAvailable": (
                        is_selected
                        and bool(
                            candidate.get(
                                "testMetrics"
                            )
                        )
                    ),

                    "testMetrics": (
                        candidate.get(
                            "testMetrics",
                            {},
                        )
                        if is_selected
                        else {}
                    ),

                    "testCI95": (
                        candidate.get(
                            "testCI95",
                            {},
                        )
                        if is_selected
                        else {}
                    ),

                    # --------------------------------------------------
                    # OTROS DATOS
                    # --------------------------------------------------

                    "hyperparameters": candidate.get(
                        "hyperparameters",
                        {},
                    ),

                    "artifact": (
                        candidate.get(
                            "finalArtifact"
                        )
                        if is_selected
                        else None
                    ),
                }
            )

        data["models"][key] = {
            "targetColumn": result.column,

            "targetLabel": result.label,

            "selectedModel": result.selected,

            "artifact": result.artifact,

            "thresholdMet": result.threshold_met,

            "split": result.split,

            "testClassDistribution": (
                result.testClassDistribution
            ),

            "testMetrics": result.test,

            "algorithmsTested": algorithms_tested,
        }

    path = (
        Path(output_dir)
        / "training-manifest.json"
    )

    path.write_text(
        json.dumps(
            json_safe(data),
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    return path
