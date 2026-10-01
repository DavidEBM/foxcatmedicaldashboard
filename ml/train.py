from __future__ import annotations

import argparse
import time
import warnings
from pathlib import Path
from typing import Any, Sequence

import numpy as np

from .algorithms import TRAINERS, get_trainers
from .config import (
    DEFAULT_DATASET,
    DEFAULT_OUTPUT_DIR,
    DEFAULT_THRESHOLDS,
    RANDOM_STATE,
    TARGET_LABELS,
    thresholds_for_target,
    validate_config,
)
from .data_preparation import (
    load_dataset,
    prepare,
    split_indices,
    target_dataset,
)
from .firebase_dataset import merge_with_firebase
from .export_iterations import export_training_excel
from .model_publisher import (
    TargetResult,
    export_manifest,
    publish_best_model,
)
from .risk_projection import export_risk_projections


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    """
    Procesa los argumentos de línea de comandos.
    """
    parser = argparse.ArgumentParser(
        description=(
            "Entrenamiento ML/DL con partición 70/15/15, "
            "validación cruzada, métricas, diagnóstico y publicación."
        )
    )

    parser.add_argument(
        "--dataset",
        default=DEFAULT_DATASET,
        help="Ruta al dataset de entrada.",
    )

    parser.add_argument(
        "--output-dir",
        default=DEFAULT_OUTPUT_DIR,
        help="Directorio donde se publican los modelos y reportes.",
    )

    parser.add_argument(
        "--algorithms",
        nargs="+",
        default=None,
        help="Algoritmos a ejecutar. Si se omite, se ejecutan todos.",
    )

    parser.add_argument(
        "--targets",
        nargs="+",
        default=None,
        help="Targets a entrenar. Si se omite, se detectan del dataset.",
    )

    parser.add_argument(
        "--features",
        nargs="+",
        default=None,
        help="Features explícitas, opcionales.",
    )

    parser.add_argument(
        "--firebase-dataset",
        default=None,
        help=(
            "Snapshot JSON de pacientes de Firebase. Se fusiona con el "
            "dataset histórico y se deduplica antes del split."
        ),
    )


    return parser.parse_args(argv)


def validate_thresholds(
    thresholds: dict[str, float],
) -> None:
    """
    Valida los umbrales utilizados para la selección.

    Los umbrales representan mínimos de calidad y se expresan
    en el intervalo [0, 1].

    MCC y Kappa pueden ser negativos como métricas reales, pero
    el umbral de selección se interpreta como una calidad mínima
    no negativa.
    """
    for key, value in thresholds.items():
        try:
            numeric_value = float(value)
        except (
            TypeError,
            ValueError,
        ) as exc:
            raise ValueError(
                f"Umbral inválido para {key}: {value!r}"
            ) from exc

        if not np.isfinite(numeric_value):
            raise ValueError(
                f"Umbral no finito para {key}: {value!r}"
            )

        if not 0.0 <= numeric_value <= 1.0:
            raise ValueError(
                f"Umbral inválido para {key}: "
                f"{numeric_value}. Debe estar entre 0 y 1."
            )


def _safe_metric(
    metrics: dict[str, Any],
    key: str,
) -> float:
    """
    Obtiene una métrica de forma segura para impresión.
    """
    value = metrics.get(
        key,
        np.nan,
    )

    try:
        return float(value)
    except (
        TypeError,
        ValueError,
    ):
        return float("nan")


def _format_metric(
    metrics: dict[str, Any],
    key: str,
) -> str:
    """
    Formatea una métrica para la salida de consola.
    """
    value = _safe_metric(
        metrics,
        key,
    )

    if np.isfinite(value):
        return f"{value:.4f}"

    return "NA"


def _print_validation_result(
    candidate: dict[str, Any],
) -> None:
    """
    Imprime el resultado de VALIDATION de un candidato.

    La estructura esperada es la producida por
    common.train_algorithm().
    """
    algorithm = str(
        candidate.get(
            "algorithm",
            candidate.get(
                "model",
                "Unknown",
            ),
        )
    )

    error = candidate.get(
        "error",
    )

    if error:
        print(
            f"     ERROR: {error}"
        )
        return

    validation_metrics = candidate.get(
        "validation",
        {},
    )

    if not isinstance(
        validation_metrics,
        dict,
    ):
        validation_metrics = {}

    print(
        "     VALIDATION: "
        f"Acc={_format_metric(validation_metrics, 'accuracy')} "
        f"F1={_format_metric(validation_metrics, 'f1')} "
        f"MCC={_format_metric(validation_metrics, 'mcc')} "
        f"Kappa={_format_metric(validation_metrics, 'kappa')} "
        f"AUC={_format_metric(validation_metrics, 'auc')} "
        "| CV="
        f"{_format_metric(candidate, 'cvMean')} "
        "| Umbral="
        f"{'SI' if candidate.get('thresholdMet', False) else 'NO'}"
    )

    score = candidate.get(
        "score",
        np.nan,
    )

    try:
        score_value = float(score)
    except (
        TypeError,
        ValueError,
    ):
        score_value = float("nan")

    if np.isfinite(score_value):
        print(
            f"     Score={score_value:.4f}"
        )

    print(
        f"     Algoritmo={algorithm}"
    )


def train_target(
    X: Any,
    y: Any,
    key: str,
    column: str,
    tr: Any,
    va: Any,
    te: Any,
    output_dir: Path,
    thresholds: dict[str, float],
    groups: Any | None = None,
    trainers: Sequence[tuple[str, Any]] = TRAINERS,
) -> TargetResult:
    """
    Entrena todos los candidatos para un target.

    Flujo:

        TRAIN
          |
          +--> CV
          |
          +--> entrenamiento del candidato
                    |
                    v
              VALIDATION
                    |
                    v
               selección
                    |
                    v
             TRAIN + VALIDATION
                    |
                    v
                  TEST

    TEST no participa en el benchmark ni en la selección.
    publish_best_model() es responsable de la evaluación final
    sobre TEST.
    """
    X_train = X.iloc[tr].copy()
    X_validation = X.iloc[va].copy()
    X_test = X.iloc[te].copy()

    y_train = y.iloc[tr].copy()
    y_validation = y.iloc[va].copy()
    y_test = y.iloc[te].copy()

    candidates: list[dict[str, Any]] = []

    for algorithm_name, trainer in trainers:
        print(
            f"  -> {algorithm_name}"
        )

        try:
            candidate = trainer(
                X_train=X_train,
                y_train=y_train,
                X_validation=X_validation,
                y_validation=y_validation,
                thresholds=thresholds,
                groups=groups,
            )

            if not isinstance(
                candidate,
                dict,
            ):
                raise TypeError(
                    f"El trainer '{algorithm_name}' "
                    "no devolvió un dict."
                )

            candidate.setdefault(
                "algorithm",
                algorithm_name,
            )

        except Exception as exc:
            candidate = {
                "algorithm": algorithm_name,
                "model": None,
                "cvMean": None,
                "cvStd": None,
                "validation": {},
                "thresholdMet": False,
                "normalizedQuality": 0.0,
                "score": float("-inf"),
                "trainSeconds": None,
                "validationSeconds": None,
                "error": (
                    "Error no controlado durante "
                    f"el entrenamiento: {exc}"
                ),
                "hyperparameters": {},
                "cvDetails": [],
            }

        candidates.append(
            candidate
        )

        _print_validation_result(
            candidate
        )

    return publish_best_model(
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
        {
            "train": len(tr),
            "validation": len(va),
            "test": len(te),
        },
    )


def _print_target_result(
    result: TargetResult,
) -> None:
    """
    Imprime el resumen final de un target.
    """
    if result.artifact:
        metrics = result.test
        status = (
            "PUBLICADO"
            if result.published_this_run
            else "CONSERVADO"
        )

        print(
            f"{status}: "
            f"{result.selected} | "
            f"Accuracy={_format_metric(metrics, 'accuracy')} "
            f"F1={_format_metric(metrics, 'f1')} "
            f"MCC={_format_metric(metrics, 'mcc')} "
            f"Kappa={_format_metric(metrics, 'kappa')} "
            f"AUC={_format_metric(metrics, 'auc')}"
        )

        print(
            "           "
            f"Umbrales VALIDATION="
            f"{'SI' if result.threshold_met else 'NO'}"
        )

        print(
            "           "
            f"Archivo: {result.artifact}"
        )

        if not result.published_this_run:
            print(
                "           "
                "Candidato de esta corrida no mejoró al modelo actual; "
                "se conserva el artefacto vigente."
            )

    else:
        error = result.test.get(
            "error",
            "sin detalle",
        )

        print(
            "SIN MODELO PUBLICABLE: "
            f"{error}"
        )


def _normalize_split_info(
    split_info: dict[str, Any],
) -> dict[str, int]:
    """
    Normaliza los tamaños de las particiones.
    """
    return {
        "train": int(
            split_info.get(
                "train",
                0,
            )
        ),
        "validation": int(
            split_info.get(
                "validation",
                0,
            )
        ),
        "test": int(
            split_info.get(
                "test",
                0,
            )
        ),
    }


def main() -> int:
    """
    Punto de entrada principal del entrenamiento.
    """
    args = parse_args()

    # ------------------------------------------------------------------
    # Configuración
    # ------------------------------------------------------------------

    validate_config()

    warnings.filterwarnings(
        "ignore",
        message=(
            "X does not have valid feature names"
        ),
    )

    np.random.seed(
        RANDOM_STATE
    )

    thresholds = dict(DEFAULT_THRESHOLDS)

    validate_thresholds(
        thresholds
    )

    try:
        trainers = get_trainers(args.algorithms)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    print(
        "Algoritmos seleccionados: "
        + ", ".join(name for name, _ in trainers)
    )

    source = Path(
        args.dataset
    )

    output_dir = Path(
        args.output_dir
    )

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    start_total = time.perf_counter()

    # ------------------------------------------------------------------
    # Dataset
    # ------------------------------------------------------------------

    print(
        f"Dataset: {source.as_posix()}"
    )

    raw = load_dataset(
        source
    )

    raw, data_sources = merge_with_firebase(
        raw,
        args.firebase_dataset,
    )

    if data_sources["firebaseIncluded"]:
        print(
            "Fuentes fusionadas: "
            f"local={data_sources['localRows']} | "
            f"firebase={data_sources['firebaseRows']} | "
            f"deduplicadas={data_sources['duplicatesRemoved']} | "
            f"filas finales={data_sources['rowsAfterDeduplication']}"
        )

    (
        df,
        targets,
        features,
        skipped_targets,
    ) = prepare(
        raw,
        args.targets,
        args.features,
    )

    # ------------------------------------------------------------------
    # Resumen de features
    # ------------------------------------------------------------------

    print(
        "Predictores por target:"
    )

    for key, columns in features.items():
        print(
            f"  - {key}: "
            f"{len(columns)} variables"
        )

    if targets:
        print(
            "Targets entrenables: "
            + ", ".join(
                targets.values()
            )
        )
    else:
        print(
            "Targets entrenables: ninguno"
        )

    if skipped_targets:
        print(
            "Targets omitidos por datos insuficientes:"
        )

        for info in skipped_targets.values():
            print(
                f"  - {info.get('column', 'desconocido')}: "
                f"{info.get('reason', 'sin motivo')} | "
                f"filas validas={info.get('validRows', 0)} | "
                f"clases={info.get('classes', 0)}"
            )

    # ------------------------------------------------------------------
    # Entrenamiento por target
    # ------------------------------------------------------------------

    results: dict[
        str,
        TargetResult,
    ] = {}

    split_totals = {
        "train": 0,
        "validation": 0,
        "test": 0,
    }

    thresholds_by_target = {
        key: thresholds_for_target(key, thresholds)
        for key in targets
    }

    for key, column in targets.items():
        print(
            f"\n=== {TARGET_LABELS.get(key, column)} ==="
        )

        target_thresholds = thresholds_by_target[key]
        print(
            "  Requisitos de elegibilidad: "
            + ", ".join(
                f"{name} ≥ {value:.0%}"
                for name, value in target_thresholds.items()
            )
        )

        target_start = time.perf_counter()

        try:
            target_features = features.get(
                key,
                [],
            )

            if not target_features:
                raise ValueError(
                    f"No existen features seleccionadas para "
                    f"el target '{key}'."
                )

            X_target, y_target, groups_target = target_dataset(
                df,
                column,
                target_features,
                include_groups=True,
            )

            tr, va, te = split_indices(
                y_target,
                groups=groups_target,
            )

        except ValueError as exc:
            print(
                f"  TARGET OMITIDO: {exc}"
            )

            target_series = df[column]

            skipped_targets[key] = {
                "column": column,
                "reason": str(exc),
                "validRows": int(
                    target_series.notna().sum()
                ),
                "classes": int(
                    target_series
                    .dropna()
                    .nunique()
                ),
            }

            continue

        except Exception as exc:
            print(
                f"  ERROR PREPARANDO TARGET: {exc}"
            )

            target_series = df[column]

            skipped_targets[key] = {
                "column": column,
                "reason": (
                    "Error inesperado durante preparación: "
                    f"{exc}"
                ),
                "validRows": int(
                    target_series.notna().sum()
                ),
                "classes": int(
                    target_series
                    .dropna()
                    .nunique()
                ),
            }

            continue

        split_totals["train"] += len(tr)
        split_totals["validation"] += len(va)
        split_totals["test"] += len(te)

        print(
            "  Split: "
            f"TRAIN={len(tr)} | "
            f"VALIDATION={len(va)} | "
            f"TEST={len(te)}"
        )

        try:
            result = train_target(
                X_target,
                y_target,
                key,
                column,
                tr,
                va,
                te,
                output_dir,
                target_thresholds,
                groups=groups_target.iloc[tr]
                if groups_target is not None
                else None,
                trainers=trainers,
            )

        except Exception as exc:
            print(
                "  ERROR ENTRENANDO TARGET: "
                f"{exc}"
            )

            skipped_targets[key] = {
                "column": column,
                "reason": (
                    "Error durante entrenamiento/publicación: "
                    f"{exc}"
                ),
                "validRows": len(
                    y_target
                ),
                "classes": int(
                    y_target.nunique()
                ),
            }

            continue

        results[key] = result

        _print_target_result(
            result
        )

        elapsed_target = (
            time.perf_counter()
            - target_start
        )

        print(
            f"  Tiempo target: "
            f"{elapsed_target:.2f} s"
        )

    # ------------------------------------------------------------------
    # Normalización de particiones
    # ------------------------------------------------------------------

    split_totals = _normalize_split_info(
        split_totals
    )

    # ------------------------------------------------------------------
    # Exportación Excel
    # ------------------------------------------------------------------

    try:
        excel = export_training_excel(
            output_dir,
            split_totals,
            results,
            thresholds_by_target,
            skipped_targets,
        )

        print(
            f"\nExcel: {excel}"
        )

    except Exception as exc:
        print(
            f"\nERROR exportando Excel: {exc}"
        )

    # ------------------------------------------------------------------
    # Proyección de riesgos
    # ------------------------------------------------------------------

    try:
        risk_xlsx = export_risk_projections(
            output_dir,
            df,
            results,
            {
                key: list(columns)
                for key, columns in features.items()
            },
        )

        if risk_xlsx:
            print(
                f"Riesgos: {risk_xlsx}"
            )

    except Exception as exc:
        print(
            f"ERROR exportando riesgos: {exc}"
        )

    # ------------------------------------------------------------------
    # Manifest
    # ------------------------------------------------------------------

    try:
        manifest = export_manifest(
            output_dir,
            source,
            targets,
            features,
            split_totals,
            results,
            thresholds,
            skipped_targets,
            data_sources=data_sources,
            thresholds_by_target=thresholds_by_target,
        )

        print(
            f"Manifest: {manifest}"
        )

    except Exception as exc:
        print(
            f"ERROR exportando manifest: {exc}"
        )

    # ------------------------------------------------------------------
    # Resumen final
    # ------------------------------------------------------------------

    elapsed_total = (
        time.perf_counter()
        - start_total
    )

    updated_count = sum(
        bool(
            result.artifact
            and result.published_this_run
        )
        for result in results.values()
    )

    current_count = sum(
        bool(result.artifact)
        for result in results.values()
    )

    total_results = len(
        results
    )

    print(
        "\n=============================="
    )
    print(
        "RESUMEN DEL ENTRENAMIENTO"
    )
    print(
        "=============================="
    )

    print(
        f"Targets procesados: "
        f"{total_results}"
    )

    print(
        f"Modelos actualizados: "
        f"{updated_count}/{total_results}"
    )

    print(
        f"Modelos vigentes: "
        f"{current_count}/{total_results}"
    )

    print(
        f"Targets omitidos: "
        f"{len(skipped_targets)}"
    )

    print(
        f"Tiempo total: "
        f"{elapsed_total:.2f} s"
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(
        main()
    )
