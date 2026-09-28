from __future__ import annotations

import importlib
import json
from pathlib import Path
from typing import Any, Mapping, Sequence

import matplotlib

matplotlib.use("Agg", force=True)

import matplotlib.pyplot as plt
from matplotlib.figure import Figure
import numpy as np
import pandas as pd
from sklearn.inspection import permutation_importance
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    matthews_corrcoef,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)


# ============================================================
# SHAP OPCIONAL
# ============================================================

shap: Any = None

try:
    shap = importlib.import_module("shap")
except Exception:
    shap = None


METRIC_COLUMNS = [
    "precision",
    "accuracy",
    "recallSensitivity",
    "f1",
    "auc",
    "mcc",
    "kappa",
]

ROC_RANDOM_STATE = 42

BOOTSTRAP_DEFAULTS = {
    "n_boot": 200,
    "seed": 42,
}

CSV_ENCODING = "utf-8-sig"


# ============================================================
# UTILIDADES
# ============================================================

def _safe(value: Any) -> float:
    """Convierte un valor a float finito o devuelve NaN."""
    if value is None:
        return np.nan

    try:
        result = float(value)
    except (TypeError, ValueError):
        return np.nan

    return result if np.isfinite(result) else np.nan


def _get_model(pipeline: Any) -> Any:
    """
    Obtiene el estimador final de un sklearn Pipeline.

    La arquitectura actual utiliza:
        preprocessor -> estimator

    Se mantiene compatibilidad con artefactos antiguos que utilizaran
    un paso llamado 'model'.
    """
    if hasattr(pipeline, "named_steps"):
        named_steps = pipeline.named_steps

        if "estimator" in named_steps:
            return named_steps["estimator"]

        if "model" in named_steps:
            return named_steps["model"]

    return pipeline


def _get_preprocessor(pipeline: Any) -> Any:
    """Obtiene el preprocesador de un sklearn Pipeline."""
    if hasattr(pipeline, "named_steps"):
        return pipeline.named_steps.get("preprocessor")

    return None


def _get_classes(
    pipeline: Any,
    fallback: Any = None,
) -> list[Any]:
    """Obtiene las clases del estimador final."""
    model = _get_model(pipeline)

    classes = getattr(model, "classes_", None)

    if classes is None and hasattr(pipeline, "classes_"):
        classes = getattr(
            pipeline,
            "classes_",
            None,
        )

    if classes is None and fallback is not None:
        classes = fallback

    if classes is None:
        return []

    try:
        return list(classes)
    except Exception:
        return []


def _feature_names(pipeline: Any) -> list[str]:
    """
    Obtiene nombres de variables después del preprocesamiento.

    Para ColumnTransformer se utilizan los nombres generados por sklearn.
    Para preprocesadores nativos, como CatBoost, se utiliza columns_.
    """
    prep = _get_preprocessor(pipeline)

    if prep is None:
        return []

    try:
        names = prep.get_feature_names_out()

        return [
            str(name)
            for name in names
        ]

    except Exception:
        pass

    columns = getattr(
        prep,
        "columns_",
        None,
    )

    if columns is not None:
        try:
            return [
                str(column)
                for column in columns
            ]
        except Exception:
            pass

    return []


def _safe_json(value: Any) -> str:
    """Serializa estructuras arbitrarias de forma segura."""
    try:
        return json.dumps(
            value,
            ensure_ascii=False,
            default=str,
        )
    except Exception:
        return "{}"


def _as_float_array(value: Any) -> np.ndarray:
    """
    Convierte cualquier estructura numérica compatible a ndarray float.

    Ayuda a evitar conflictos de tipado entre pandas, numpy y Matplotlib.
    """
    try:
        return np.asarray(
            value,
            dtype=float,
        )
    except Exception:
        return np.asarray(
            [],
            dtype=float,
        )


# ============================================================
# AUC
# ============================================================

def _macro_observed_auc(
    y_true: Any,
    probabilities: Any,
    classes: Sequence[Any],
) -> float:
    """
    Calcula AUC OVR macro únicamente para clases observadas.

    Esto evita que una clase ausente en una réplica bootstrap invalide
    toda la métrica multiclasificación.
    """
    y_arr = np.asarray(y_true)
    prob = np.asarray(probabilities)

    if (
        prob.ndim != 2
        or prob.shape[0] != len(y_arr)
    ):
        return np.nan

    values: list[float] = []

    for index, cls in enumerate(classes):
        if index >= prob.shape[1]:
            break

        binary_y = (
            y_arr == cls
        ).astype(int)

        if binary_y.min() == binary_y.max():
            continue

        try:
            value = roc_auc_score(
                binary_y,
                prob[:, index],
            )
        except Exception:
            continue

        if np.isfinite(value):
            values.append(
                float(value)
            )

    if not values:
        return np.nan

    return float(
        np.mean(values)
    )


def _bootstrap_ci(
    y_true: Any,
    pred: Any,
    prob: Any,
    binary: bool = True,
    classes: Sequence[Any] | None = None,
    n_boot: int = BOOTSTRAP_DEFAULTS["n_boot"],
    seed: int = BOOTSTRAP_DEFAULTS["seed"],
) -> dict[str, float]:
    """
    Estima IC95% bootstrap para las métricas principales.

    El remuestreo se realiza a nivel de paciente, con reemplazo.
    Las réplicas degeneradas, sin al menos dos clases, se descartan.
    """
    y = np.asarray(y_true)
    predictions = np.asarray(pred)
    probabilities = np.asarray(prob)

    if len(y) == 0:
        return {}

    if len(predictions) != len(y):
        return {}

    if (
        probabilities.ndim != 2
        or probabilities.shape[0] != len(y)
    ):
        return {}

    if n_boot < 1:
        return {}

    class_values = (
        list(classes)
        if classes is not None
        else list(np.unique(y))
    )

    if not class_values:
        return {}

    rng = np.random.default_rng(seed)
    n_samples = len(y)

    rows: list[dict[str, float]] = []

    average = (
        "binary"
        if binary
        else "macro"
    )

    for _ in range(int(n_boot)):
        indices = rng.integers(
            0,
            n_samples,
            size=n_samples,
        )

        yy = y[indices]
        pp = predictions[indices]
        pr = probabilities[indices]

        positive_class = (
            _resolve_positive_class(class_values, yy)
            if binary
            else None
        )

        metric_y = (
            (yy == positive_class).astype(int)
            if binary
            else yy
        )
        metric_pred = (
            (pp == positive_class).astype(int)
            if binary
            else pp
        )

        if len(np.unique(yy)) < 2:
            continue

        try:
            row = {
                "precision": float(
                    precision_score(
                        metric_y,
                        metric_pred,
                        average=average,
                        zero_division=0,
                    )
                ),
                "accuracy": float(
                    accuracy_score(
                        metric_y,
                        metric_pred,
                    )
                ),
                "recallSensitivity": float(
                    recall_score(
                        metric_y,
                        metric_pred,
                        average=average,
                        zero_division=0,
                    )
                ),
                "f1": float(
                    f1_score(
                        metric_y,
                        metric_pred,
                        average=average,
                        zero_division=0,
                    )
                ),
                "mcc": float(
                    matthews_corrcoef(
                        metric_y,
                        metric_pred,
                    )
                ),
            }

            if binary:
                if pr.shape[1] < 2:
                    continue

                try:
                    positive_index = class_values.index(
                        positive_class
                    )
                except ValueError:
                    positive_index = 1

                if positive_index >= pr.shape[1]:
                    continue

                binary_y = (
                    yy == positive_class
                ).astype(int)

                if binary_y.min() == binary_y.max():
                    continue

                row["auc"] = float(
                    roc_auc_score(
                        binary_y,
                        pr[:, positive_index],
                    )
                )

            else:
                row["auc"] = _macro_observed_auc(
                    yy,
                    pr,
                    class_values,
                )

            rows.append(row)

        except Exception:
            continue

    if not rows:
        return {}

    bootstrap = pd.DataFrame(rows)
    result: dict[str, float] = {}

    for metric in METRIC_COLUMNS:
        if metric not in bootstrap.columns:
            continue

        values = pd.to_numeric(
            bootstrap[metric],
            errors="coerce",
        ).dropna()

        if values.empty:
            continue

        result[
            f"{metric}CI95Low"
        ] = float(
            values.quantile(0.025)
        )

        result[
            f"{metric}CI95High"
        ] = float(
            values.quantile(0.975)
        )

    result[
        "bootstrapReplicates"
    ] = float(
        len(bootstrap)
    )

    return result


# ============================================================
# ROC
# ============================================================

def _resolve_positive_class(
    classes: Sequence[Any],
    y_true: Any,
) -> Any:
    """
    Resuelve la clase positiva para clasificación binaria.

    Para SI/NO se prioriza SI. Para otros targets se utiliza la última
    clase del vector de clases.
    """
    class_values = list(classes)

    preferred = (
        "SI",
        "SÍ",
        "YES",
        "TRUE",
        "VERDADERO",
        "1",
        "1.0",
    )

    for preferred_value in preferred:
        for cls in class_values:
            normalized = str(
                cls
            ).strip().upper()

            if normalized == preferred_value:
                return cls

    observed = list(
        np.unique(
            np.asarray(y_true)
        )
    )

    if len(class_values) >= 2:
        return class_values[-1]

    if observed:
        return observed[-1]

    return None


def _binary_roc_data(
    y_true: Any,
    probabilities: Any,
    classes: Sequence[Any],
) -> tuple[np.ndarray, np.ndarray] | None:
    """Construye datos ROC para clasificación binaria."""
    y_arr = np.asarray(y_true)
    prob = np.asarray(probabilities)

    if (
        prob.ndim != 2
        or prob.shape[0] != len(y_arr)
    ):
        return None

    if (
        prob.shape[1] < 2
        or len(classes) != 2
    ):
        return None

    observed = np.unique(y_arr)

    if len(observed) != 2:
        return None

    positive_class = _resolve_positive_class(
        classes,
        y_arr,
    )

    if positive_class is None:
        return None

    try:
        class_index = list(classes).index(
            positive_class
        )
    except ValueError:
        return None

    if class_index >= prob.shape[1]:
        return None

    binary_y = (
        y_arr == positive_class
    ).astype(int)

    if binary_y.min() == binary_y.max():
        return None

    try:
        fpr, tpr, _ = roc_curve(
            binary_y,
            prob[:, class_index],
        )
    except Exception:
        return None

    return fpr, tpr


def _macro_roc_data(
    y_true: Any,
    probabilities: Any,
    classes: Sequence[Any],
) -> tuple[np.ndarray, np.ndarray] | None:
    """Construye una curva ROC OVR macro para clases observadas."""
    y_arr = np.asarray(y_true)
    prob = np.asarray(probabilities)

    if (
        prob.ndim != 2
        or prob.shape[0] != len(y_arr)
    ):
        return None

    curves: list[
        tuple[np.ndarray, np.ndarray]
    ] = []

    for index, cls in enumerate(classes):
        if index >= prob.shape[1]:
            break

        binary_y = (
            y_arr == cls
        ).astype(int)

        if binary_y.min() == binary_y.max():
            continue

        try:
            fpr, tpr, _ = roc_curve(
                binary_y,
                prob[:, index],
            )
        except Exception:
            continue

        curves.append(
            (fpr, tpr)
        )

    if not curves:
        return None

    all_fpr = np.unique(
        np.concatenate(
            [
                curve[0]
                for curve in curves
            ]
        )
    )

    mean_tpr = np.zeros_like(
        all_fpr
    )

    for fpr, tpr in curves:
        mean_tpr += np.interp(
            all_fpr,
            fpr,
            tpr,
        )

    mean_tpr /= len(curves)

    return (
        all_fpr,
        mean_tpr,
    )


# ============================================================
# IMPORTANCIA DE VARIABLES
# ============================================================

def feature_importance(
    pipeline: Any,
    X: pd.DataFrame,
    y: pd.Series,
    model_name: str,
    top_n: int = 30,
) -> pd.DataFrame:
    """
    Calcula importancia de variables.

    Prioridad:
        1. feature_importances_
        2. coef_
        3. permutation importance

    La importancia se devuelve ordenada y limitada a top_n.
    """
    if top_n < 1:
        raise ValueError(
            "top_n debe ser >= 1."
        )

    model = _get_model(
        pipeline
    )

    names = _feature_names(
        pipeline
    )

    values: np.ndarray | None = None
    method = "permutation"

    # ---------------------------------------------------------
    # Árboles
    # ---------------------------------------------------------
    if hasattr(
        model,
        "feature_importances_",
    ):
        try:
            raw = np.asarray(
                model.feature_importances_,
                dtype=float,
            )

            if raw.ndim == 1:
                values = np.abs(raw)

            elif (
                names
                and raw.shape[-1]
                == len(names)
            ):
                axes = tuple(
                    range(
                        raw.ndim - 1
                    )
                )

                values = np.mean(
                    np.abs(raw),
                    axis=axes,
                )

            elif (
                names
                and raw.shape[0]
                == len(names)
            ):
                axes = tuple(
                    range(
                        1,
                        raw.ndim,
                    )
                )

                values = np.mean(
                    np.abs(raw),
                    axis=axes,
                )

            if values is not None:
                method = (
                    "feature_importance"
                )

        except Exception:
            values = None

    # ---------------------------------------------------------
    # Modelos lineales
    # ---------------------------------------------------------
    if (
        values is None
        and hasattr(model, "coef_")
    ):
        try:
            coef = np.asarray(
                model.coef_,
                dtype=float,
            )

            if coef.ndim == 1:
                values = np.abs(coef)

            elif (
                names
                and coef.shape[-1]
                == len(names)
            ):
                axes = tuple(
                    range(
                        coef.ndim - 1
                    )
                )

                values = np.mean(
                    np.abs(coef),
                    axis=axes,
                )

            if values is not None:
                method = (
                    "absolute_coefficient"
                )

        except Exception:
            values = None

    # ---------------------------------------------------------
    # Importancia nativa válida
    # ---------------------------------------------------------
    if (
        values is not None
        and names
        and len(values) == len(names)
    ):
        frame = pd.DataFrame(
            {
                "feature": names,
                "importance": np.asarray(
                    values,
                    dtype=float,
                ),
                "method": method,
                "model": model_name,
            }
        )

        frame = (
            frame
            .replace(
                [np.inf, -np.inf],
                np.nan,
            )
            .dropna(
                subset=["importance"]
            )
        )

        return (
            frame
            .sort_values(
                "importance",
                ascending=False,
            )
            .head(top_n)
            .reset_index(drop=True)
        )

    # ---------------------------------------------------------
    # Fallback: permutation importance
    # ---------------------------------------------------------
    try:
        if X is None or X.empty:
            raise ValueError(
                "X está vacío."
            )

        if y is None or len(y) != len(X):
            raise ValueError(
                "X e y deben tener el mismo número de filas."
            )

        scoring = (
            "roc_auc"
            if y.nunique(
                dropna=True
            ) == 2
            else "accuracy"
        )

        # Pylance puede inferir incorrectamente el retorno de
        # permutation_importance como dict[str, Bunch].
        # Se usa Any únicamente en esta frontera tipada de sklearn.
        permutation_result: Any = permutation_importance(
            pipeline,
            X,
            y,
            scoring=scoring,
            n_repeats=3,
            random_state=ROC_RANDOM_STATE,
            n_jobs=1,
        )

        importances_mean = np.asarray(
            getattr(
                permutation_result,
                "importances_mean",
                [],
            ),
            dtype=float,
        )

        importances_std = np.asarray(
            getattr(
                permutation_result,
                "importances_std",
                [],
            ),
            dtype=float,
        )

        input_names = [
            str(column)
            for column in X.columns
        ]

        if (
            len(importances_mean)
            != len(input_names)
        ):
            raise ValueError(
                "El número de importancias no coincide "
                "con las columnas originales."
            )

        frame = pd.DataFrame(
            {
                "feature": input_names,
                "importance": importances_mean,
                "importanceStd": importances_std,
                "method": (
                    "permutation_importance"
                ),
                "model": model_name,
            }
        )

        return (
            frame
            .sort_values(
                "importance",
                ascending=False,
            )
            .head(top_n)
            .reset_index(drop=True)
        )

    except Exception as exc:
        return pd.DataFrame(
            [
                {
                    "feature": "No disponible",
                    "importance": np.nan,
                    "importanceStd": np.nan,
                    "method": f"error: {exc}",
                    "model": model_name,
                }
            ]
        )


# ============================================================
# SHAP
# ============================================================

def try_shap(
    pipeline: Any,
    X: pd.DataFrame,
    model_name: str,
    out_csv: str | Path,
) -> bool:
    """
    Intenta generar importancia SHAP.

    SHAP es opcional. Las incompatibilidades del explainer no interrumpen
    los diagnósticos principales.
    """
    if shap is None:
        return False

    if X is None or X.empty:
        return False

    model = _get_model(
        pipeline
    )

    prep = _get_preprocessor(
        pipeline
    )

    try:
        sample = X.sample(
            n=min(100, len(X)),
            random_state=ROC_RANDOM_STATE,
        )

        transformed = (
            prep.transform(sample)
            if prep is not None
            else sample
        )

        # Algunas transformaciones de sklearn devuelven matrices
        # dispersas. Se convierten únicamente si toarray es invocable.
        toarray_method = getattr(
            transformed,
            "toarray",
            None,
        )

        if callable(toarray_method):
            transformed = toarray_method()

        explainer = shap.Explainer(
            model,
            transformed,
        )

        shap_values = explainer(
            transformed
        )

        values = np.asarray(
            shap_values.values
        )

        if values.ndim == 3:
            values = np.mean(
                np.abs(values),
                axis=2,
            )
        else:
            values = np.abs(values)

        if values.ndim != 2:
            return False

        importance = np.mean(
            values,
            axis=0,
        )

        names = _feature_names(
            pipeline
        )

        if (
            not names
            or len(names)
            != len(importance)
        ):
            return False

        output_path = Path(
            out_csv
        )

        output_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        frame = pd.DataFrame(
            {
                "feature": names,
                "meanAbsSHAP": importance,
                "model": model_name,
            }
        )

        frame = (
            frame
            .replace(
                [np.inf, -np.inf],
                np.nan,
            )
            .dropna(
                subset=["meanAbsSHAP"]
            )
            .sort_values(
                "meanAbsSHAP",
                ascending=False,
            )
        )

        frame.to_csv(
            output_path,
            index=False,
            encoding=CSV_ENCODING,
        )

        return True

    except Exception:
        return False



# ============================================================
# FIGURAS
# ============================================================

def _save_figure(
    fig: Figure,
    path: Path,
    dpi: int = 220,
) -> None:
    """Guarda y cierra una figura de forma consistente."""
    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    fig.tight_layout()

    fig.savefig(
        path,
        dpi=dpi,
        bbox_inches="tight",
    )

    plt.close(fig)


# ============================================================
# TABLAS DE DIAGNÓSTICO
# ============================================================

def _metric_rows(
    target_key: str,
    target_label: str,
    test_payloads: Sequence[
        Mapping[str, Any]
    ],
) -> tuple[
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[pd.DataFrame],
]:
    """Construye las tablas principales de diagnóstico."""
    algorithm_rows: list[
        dict[str, Any]
    ] = []

    metric_rows: list[
        dict[str, Any]
    ] = []

    time_rows: list[
        dict[str, Any]
    ] = []

    importance_rows: list[
        pd.DataFrame
    ] = []

    for payload in test_payloads:
        name = str(
            payload.get(
                "model",
                "Unknown",
            )
        )

        metrics = dict(
            payload.get(
                "metrics",
                {},
            )
        )

        hyperparameters = payload.get(
            "hyperparameters",
            {},
        )

        algorithm_rows.append(
            {
                "target": target_key,
                "targetLabel": target_label,
                "algorithm": name,
                "family": (
                    "DL"
                    if (
                        name.startswith("Deep")
                        or name == "LSTM"
                    )
                    else "ML"
                ),
                "hyperparameters": _safe_json(
                    hyperparameters
                ),
            }
        )

        ci = dict(
            payload.get(
                "ci",
                {},
            )
        )

        metric_rows.append(
            {
                "target": target_key,
                "targetLabel": target_label,
                "algorithm": name,
                **{
                    metric: metrics.get(
                        metric,
                        np.nan,
                    )
                    for metric in METRIC_COLUMNS
                },
                "balancedAccuracy": metrics.get(
                    "balancedAccuracy",
                    np.nan,
                ),
                "normalizedQualityPercent": metrics.get(
                    "normalizedQualityPercent",
                    np.nan,
                ),
                **{
                    f"normalized{metric[0].upper()}{metric[1:]}" : metrics.get(
                        "normalizedMetrics",
                        {},
                    ).get(metric, np.nan)
                    for metric in (
                        "accuracy",
                        "balancedAccuracy",
                        "f1",
                        "precision",
                        "recallSensitivity",
                        "auc",
                        "mcc",
                        "kappa",
                    )
                },
                **ci,
            }
        )

        time_rows.append(
            {
                "target": target_key,
                "targetLabel": target_label,
                "algorithm": name,
                "latencyMeanMs": metrics.get(
                    "predictionLatencyMs",
                    np.nan,
                ),
                "latencyStdMs": metrics.get(
                    "predictionLatencyStdMs",
                    np.nan,
                ),
                "latencyPerRecordMs": metrics.get(
                    "responseTimeMsPerRecord",
                    np.nan,
                ),
                "predictionsPerSecond": metrics.get(
                    "predictionsPerSecond",
                    np.nan,
                ),
                "batchLatencyMeanMs": metrics.get(
                    "predictionBatchLatencyMs",
                    np.nan,
                ),
                "batchPredictionsPerSecond": metrics.get(
                    "batchPredictionsPerSecond",
                    np.nan,
                ),
            }
        )

        importance = payload.get(
            "featureImportance"
        )

        if isinstance(
            importance,
            pd.DataFrame,
        ):
            frame = importance.copy()

            frame["target"] = (
                target_key
            )

            frame["algorithm"] = (
                name
            )

            importance_rows.append(
                frame
            )

    return (
        algorithm_rows,
        metric_rows,
        time_rows,
        importance_rows,
    )


def _export_csv(
    frame: pd.DataFrame,
    path: Path,
) -> None:
    """Exporta CSV usando encoding compatible con Excel."""
    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    frame.to_csv(
        path,
        index=False,
        encoding=CSV_ENCODING,
    )


# ============================================================
# ROC COMPARATIVA
# ============================================================

def _plot_roc_comparison(
    base: Path,
    target_label: str,
    test_payloads: Sequence[
        Mapping[str, Any]
    ],
    y_test: pd.Series,
) -> None:
    """Genera ROC comparativa."""
    fig, ax = plt.subplots(
        figsize=(10, 7)
    )

    plotted = False
    y_arr = np.asarray(
        y_test
    )

    for payload in test_payloads:
        if not payload.get(
            "available",
            True,
        ):
            continue

        probabilities = payload.get(
            "probabilities"
        )

        classes = payload.get(
            "classes"
        )

        if (
            probabilities is None
            or classes is None
        ):
            continue

        classes = list(
            classes
        )

        try:
            if len(classes) == 2:
                roc_data = _binary_roc_data(
                    y_arr,
                    probabilities,
                    classes,
                )
            else:
                roc_data = _macro_roc_data(
                    y_arr,
                    probabilities,
                    classes,
                )

            if roc_data is None:
                continue

            fpr, tpr = roc_data

            metrics = dict(
                payload.get(
                    "metrics",
                    {},
                )
            )

            auc_value = _safe(
                metrics.get("auc")
            )

            if np.isfinite(
                auc_value
            ):
                label = (
                    f"{payload['model']} "
                    f"(AUC={auc_value:.3f})"
                )
            else:
                label = str(
                    payload.get(
                        "model",
                        "Unknown",
                    )
                )

            ax.plot(
                fpr,
                tpr,
                linewidth=2,
                label=label,
            )

            plotted = True

        except Exception:
            continue

    ax.plot(
        [0, 1],
        [0, 1],
        linestyle="--",
        linewidth=1,
    )

    ax.set_xlabel(
        "False Positive Rate"
    )

    ax.set_ylabel(
        "True Positive Rate"
    )

    ax.set_title(
        f"Curvas ROC - evaluación TEST - "
        f"{target_label}"
    )

    if plotted:
        ax.legend()

    _save_figure(
        fig,
        base / "roc_comparativa.png",
        dpi=180,
    )


# ============================================================
# MATRICES DE CONFUSIÓN
# ============================================================

def _plot_confusion_matrices(
    base: Path,
    test_payloads: Sequence[
        Mapping[str, Any]
    ],
    y_test: pd.Series,
) -> None:
    """Genera matrices de confusión absolutas y normalizadas."""
    for payload in test_payloads:
        if not payload.get(
            "available",
            True,
        ):
            continue

        predictions = payload.get(
            "predictions"
        )

        if predictions is None:
            continue

        pred = np.asarray(
            predictions
        )

        if len(pred) != len(y_test):
            continue

        labels = list(
            payload.get(
                "classes",
                np.unique(y_test),
            )
        )

        if not labels:
            continue

        try:
            cm = confusion_matrix(
                y_test,
                pred,
                labels=labels,
            )
        except Exception:
            continue

        row_totals = cm.sum(
            axis=1,
            keepdims=True,
        )

        cm_normalized = np.divide(
            cm,
            row_totals,
            out=np.zeros_like(
                cm,
                dtype=float,
            ),
            where=row_totals != 0,
        )

        model_name = str(
            payload.get(
                "model",
                "Unknown",
            )
        )

        # -----------------------------------------------------
        # Matriz absoluta
        # -----------------------------------------------------
        fig, ax = plt.subplots(
            figsize=(7, 6)
        )

        image = ax.imshow(
            cm,
            interpolation="nearest",
            aspect="auto",
        )

        ax.set_title(
            f"Matriz de confusión - "
            f"{model_name}"
        )

        ax.set_xlabel(
            "Predicción"
        )

        ax.set_ylabel(
            "Real"
        )

        labels_text = [
            str(label)
            for label in labels
        ]

        ax.set_xticks(
            np.arange(
                len(labels)
            ),
            labels_text,
        )

        ax.set_yticks(
            np.arange(
                len(labels)
            ),
            labels_text,
        )

        for (
            row,
            column,
        ), value in np.ndenumerate(cm):
            ax.text(
                column,
                row,
                (
                    f"{int(value)}\n"
                    f"{cm_normalized[row, column]:.0%}"
                ),
                ha="center",
                va="center",
                fontsize=9,
            )

        fig.colorbar(
            image,
            ax=ax,
            label="Pacientes",
        )

        _save_figure(
            fig,
            base
            / f"confusion_{model_name}.png",
        )

        # -----------------------------------------------------
        # Matriz normalizada
        # -----------------------------------------------------
        fig, ax = plt.subplots(
            figsize=(7, 6)
        )

        image = ax.imshow(
            cm_normalized,
            interpolation="nearest",
            aspect="auto",
            vmin=0,
            vmax=1,
        )

        ax.set_title(
            f"Matriz de confusión normalizada - "
            f"{model_name}"
        )

        ax.set_xlabel(
            "Predicción"
        )

        ax.set_ylabel(
            "Real"
        )

        ax.set_xticks(
            np.arange(
                len(labels)
            ),
            labels_text,
        )

        ax.set_yticks(
            np.arange(
                len(labels)
            ),
            labels_text,
        )

        for (
            row,
            column,
        ), value in np.ndenumerate(
            cm_normalized
        ):
            ax.text(
                column,
                row,
                f"{value:.0%}",
                ha="center",
                va="center",
                fontsize=9,
            )

        fig.colorbar(
            image,
            ax=ax,
            label="Proporción",
        )

        _save_figure(
            fig,
            base
            / (
                "confusion_normalizada_"
                f"{model_name}.png"
            ),
        )


# ============================================================
# PREDICCIÓN VS REAL
# ============================================================

def _plot_binary_prediction_vs_real(
    base: Path,
    payload: Mapping[str, Any],
    y_test: pd.Series,
) -> None:
    """Grafica probabilidad predicha frente al resultado observado."""
    probabilities = payload.get(
        "probabilities"
    )

    if probabilities is None:
        return

    prob = np.asarray(
        probabilities,
        dtype=float,
    )

    if (
        prob.ndim != 2
        or prob.shape[1] != 2
        or prob.shape[0] != len(y_test)
    ):
        return

    classes = list(
        payload.get(
            "classes",
            [],
        )
    )

    if len(classes) != 2:
        return

    positive_class = _resolve_positive_class(
        classes,
        y_test,
    )

    if positive_class is None:
        return

    try:
        positive_index = classes.index(
            positive_class
        )
    except ValueError:
        return

    model_name = str(
        payload.get(
            "model",
            "Unknown",
        )
    )

    x = np.arange(
        len(y_test),
        dtype=float,
    )

    observed_binary = (
        np.asarray(y_test)
        == positive_class
    ).astype(float)

    predicted_probability = np.asarray(
        prob[:, positive_index],
        dtype=float,
    )

    fig, ax = plt.subplots(
        figsize=(9, 5)
    )

    ax.scatter(
        x,
        observed_binary,
        label="Real",
        alpha=0.7,
    )

    ax.scatter(
        x,
        predicted_probability,
        label="Probabilidad predicha",
        alpha=0.7,
    )

    ax.set_xlabel(
        "Paciente en TEST"
    )

    ax.set_ylabel(
        "Resultado / probabilidad"
    )

    ax.set_title(
        f"Predicción vs. valor observado - "
        f"{model_name}"
    )

    ax.legend()

    _save_figure(
        fig,
        base
        / (
            "prediccion_vs_real_"
            f"{model_name}.png"
        ),
        dpi=180,
    )


# ============================================================
# COMPARACIÓN DE MÉTRICAS
# ============================================================

def _plot_metric_comparison(
    base: Path,
    target_label: str,
    metric_rows: Sequence[
        Mapping[str, Any]
    ],
) -> None:
    """Genera barras, heatmap e IC95% de las métricas TEST."""
    metrics_df = pd.DataFrame(
        metric_rows
    )

    if metrics_df.empty:
        return

    plot_columns = [
        "precision",
        "accuracy",
        "recallSensitivity",
        "f1",
        "auc",
        "balancedAccuracy",
    ]

    available_columns = [
        column
        for column in plot_columns
        if (
            column in metrics_df.columns
            and metrics_df[column]
            .notna()
            .any()
        )
    ]

    if not available_columns:
        return

    metric_matrix = (
        metrics_df
        .set_index("algorithm")
        [available_columns]
    )

    # ---------------------------------------------------------
    # Barras
    # ---------------------------------------------------------
    fig, ax = plt.subplots(
        figsize=(13, 7)
    )

    matrix_values = metric_matrix.to_numpy(
        dtype=float
    )

    n_models = matrix_values.shape[0]
    n_metrics = matrix_values.shape[1]

    x = np.arange(
        n_models,
        dtype=float,
    )

    width = (
        0.8 / max(n_metrics, 1)
    )

    for metric_index, metric in enumerate(
        available_columns
    ):
        offsets = (
            x
            + (
                metric_index
                - (n_metrics - 1) / 2
            )
            * width
        )

        ax.bar(
            offsets,
            matrix_values[:, metric_index],
            width=width,
            label=metric,
        )

    ax.set_ylabel(
        "Valor (0–1)"
    )

    ax.set_title(
        f"Métricas TEST - "
        f"{target_label}"
    )

    ax.set_ylim(
        0,
        1.05,
    )

    ax.grid(
        axis="y",
        alpha=0.25,
    )

    ax.set_xticks(
        x,
        [
            str(value)
            for value
            in metric_matrix.index
        ],
    )

    plt.setp(
        ax.get_xticklabels(),
        rotation=30,
        ha="right",
    )

    ax.legend(
        loc="lower left",
        bbox_to_anchor=(0, 1.01),
        ncol=3,
    )

    _save_figure(
        fig,
        base / "metricas_barras.png",
    )

    # ---------------------------------------------------------
    # Heatmap
    # ---------------------------------------------------------
    matrix = metric_matrix.to_numpy(
        dtype=float
    )

    fig, ax = plt.subplots(
        figsize=(
            11,
            max(
                4,
                0.65
                * len(metric_matrix)
                + 2,
            ),
        )
    )

    image = ax.imshow(
        matrix,
        aspect="auto",
        vmin=0,
        vmax=1,
    )

    ax.set_xticks(
        np.arange(
            len(available_columns)
        )
    )

    ax.set_xticklabels(
        available_columns,
        rotation=35,
        ha="right",
    )

    ax.set_yticks(
        np.arange(
            len(metric_matrix.index)
        )
    )

    ax.set_yticklabels(
        metric_matrix.index
    )

    for row in range(
        matrix.shape[0]
    ):
        for column in range(
            matrix.shape[1]
        ):
            value = matrix[
                row,
                column,
            ]

            if np.isfinite(value):
                ax.text(
                    column,
                    row,
                    f"{value:.2f}",
                    ha="center",
                    va="center",
                    fontsize=9,
                )

    ax.set_title(
        f"Mapa de métricas TEST - "
        f"{target_label}"
    )

    fig.colorbar(
        image,
        ax=ax,
        label="Valor",
    )

    _save_figure(
        fig,
        base / "metricas_heatmap.png",
    )

    # ---------------------------------------------------------
    # Metricas normalizadas
    # ---------------------------------------------------------
    normalized_columns = [
        column
        for column in (
            "normalizedAccuracy",
            "normalizedBalancedAccuracy",
            "normalizedF1",
            "normalizedPrecision",
            "normalizedRecallSensitivity",
            "normalizedAuc",
            "normalizedMcc",
            "normalizedKappa",
        )
        if column in metrics_df.columns
        and metrics_df[column].notna().any()
    ]

    if normalized_columns:
        normalized_matrix = (
            metrics_df
            .set_index("algorithm")
            [normalized_columns]
            .to_numpy(dtype=float)
        )

        fig, ax = plt.subplots(figsize=(13, 7))
        x = np.arange(normalized_matrix.shape[0], dtype=float)
        width = 0.8 / max(len(normalized_columns), 1)

        for index, column in enumerate(normalized_columns):
            ax.bar(
                x + (index - (len(normalized_columns) - 1) / 2) * width,
                normalized_matrix[:, index],
                width=width,
                label=column.replace("normalized", ""),
            )

        ax.set_ylabel("Valor normalizado (0-1)")
        ax.set_title(f"Metricas normalizadas TEST - {target_label}")
        ax.set_ylim(0, 1.05)
        ax.set_xticks(x, [str(value) for value in metric_matrix.index])
        plt.setp(ax.get_xticklabels(), rotation=30, ha="right")
        ax.grid(axis="y", alpha=0.25)
        ax.legend(loc="lower left", bbox_to_anchor=(0, 1.01), ncol=3)
        _save_figure(fig, base / "metricas_normalizadas.png")

    # ---------------------------------------------------------
    # Intervalos de confianza
    # ---------------------------------------------------------
    ci_metrics = [
        "accuracy",
        "precision",
        "recallSensitivity",
        "f1",
        "auc",
    ]

    fig, ax = plt.subplots(
        figsize=(13, 7)
    )

    x = np.arange(
        len(metrics_df.index),
        dtype=float,
    )

    width = 0.15
    plotted = False

    for (
        metric_index,
        metric,
    ) in enumerate(ci_metrics):
        if metric not in metrics_df.columns:
            continue

        values = pd.to_numeric(
            metrics_df[metric],
            errors="coerce",
        ).to_numpy(
            dtype=float
        )

        low_column = (
            f"{metric}CI95Low"
        )

        high_column = (
            f"{metric}CI95High"
        )

        lows_series = metrics_df.get(
            low_column
        )

        highs_series = metrics_df.get(
            high_column
        )

        if isinstance(
            lows_series,
            pd.Series,
        ):
            lows = pd.to_numeric(
                lows_series,
                errors="coerce",
            ).to_numpy(
                dtype=float
            )
        else:
            lows = np.full(
                len(metrics_df),
                np.nan,
                dtype=float,
            )

        if isinstance(
            highs_series,
            pd.Series,
        ):
            highs = pd.to_numeric(
                highs_series,
                errors="coerce",
            ).to_numpy(
                dtype=float
            )
        else:
            highs = np.full(
                len(metrics_df),
                np.nan,
                dtype=float,
            )

        valid = np.isfinite(
            values
        )

        if not valid.any():
            continue

        x_values = (
            x[valid]
            + (
                metric_index - 2
            )
            * width
        )

        lower = np.zeros(
            int(valid.sum()),
            dtype=float,
        )

        upper = np.zeros(
            int(valid.sum()),
            dtype=float,
        )

        valid_low = (
            valid
            & np.isfinite(lows)
        )

        valid_high = (
            valid
            & np.isfinite(highs)
        )

        valid_indices = np.flatnonzero(
            valid
        )

        for (
            position,
            original_index,
        ) in enumerate(
            valid_indices
        ):
            if valid_low[
                original_index
            ]:
                lower[position] = max(
                    0.0,
                    (
                        values[
                            original_index
                        ]
                        - lows[
                            original_index
                        ]
                    ),
                )

            if valid_high[
                original_index
            ]:
                upper[position] = max(
                    0.0,
                    (
                        highs[
                            original_index
                        ]
                        - values[
                            original_index
                        ]
                    ),
                )

        ax.errorbar(
            x_values,
            values[valid],
            yerr=[
                lower,
                upper,
            ],
            fmt="o",
            capsize=3,
            label=metric,
        )

        plotted = True

    ax.set_xticks(x)

    ax.set_xticklabels(
        [
            str(value)
            for value
            in metrics_df["algorithm"].tolist()
        ],
        rotation=30,
        ha="right",
    )

    ax.set_ylim(
        0,
        1.05,
    )

    ax.set_ylabel(
        "Valor"
    )

    ax.set_title(
        f"Métricas TEST con IC 95% bootstrap - "
        f"{target_label}"
    )

    ax.grid(
        axis="y",
        alpha=0.25,
    )

    if plotted:
        ax.legend(
            ncol=3
        )

    _save_figure(
        fig,
        base / "metricas_ic95.png",
    )


# ============================================================
# DISTRIBUCIÓN DE CLASES
# ============================================================

def _plot_class_distribution(
    base: Path,
    target_label: str,
    y_test: pd.Series,
) -> None:
    """Grafica distribución de clases en TEST."""
    class_counts = (
        pd.Series(y_test)
        .value_counts()
        .sort_index()
    )

    if class_counts.empty:
        return

    labels = [
        str(value)
        for value
        in class_counts.index
    ]

    heights = _as_float_array(
        class_counts.to_numpy()
    )

    fig, ax = plt.subplots(
        figsize=(8, 5)
    )

    bars = ax.bar(
        labels,
        heights,
    )

    ax.set_title(
        f"Distribución de clases en TEST - "
        f"{target_label}"
    )

    ax.set_xlabel(
        "Clase"
    )

    ax.set_ylabel(
        "Pacientes"
    )

    ax.grid(
        axis="y",
        alpha=0.25,
    )

    for (
        bar,
        value,
    ) in zip(
        bars,
        heights,
    ):
        ax.text(
            bar.get_x()
            + bar.get_width() / 2,
            float(value),
            str(int(value)),
            ha="center",
            va="bottom",
            fontsize=9,
        )

    _save_figure(
        fig,
        base
        / "distribucion_clases_test.png",
        dpi=180,
    )


# ============================================================
# LATENCIA
# ============================================================

def _plot_latency(
    base: Path,
    target_label: str,
    test_payloads: Sequence[
        Mapping[str, Any]
    ],
) -> None:
    """Genera boxplot de latencia de predicción."""
    rows: list[
        dict[str, Any]
    ] = []

    for payload in test_payloads:
        algorithm = str(
            payload.get(
                "model",
                "Unknown",
            )
        )

        values = payload.get(
            "latencySamplesMs",
            [],
        )

        if not values:
            continue

        for value in values:
            numeric = _safe(
                value
            )

            if np.isfinite(numeric):
                rows.append(
                    {
                        "algorithm": algorithm,
                        "latencyMs": numeric,
                    }
                )

    if not rows:
        return

    frame = pd.DataFrame(
        rows
    )

    fig, ax = plt.subplots(
        figsize=(11, 6)
    )

    groups: list[np.ndarray] = []

    labels: list[str] = []

    for name, group in frame.groupby(
        "algorithm",
        sort=False,
    ):
        values = _as_float_array(
            group["latencyMs"].to_numpy()
        )

        if values.size == 0:
            continue

        groups.append(values)
        labels.append(str(name))

    if not groups:
        plt.close(fig)
        return

    ax.boxplot(
        groups,
    )

    ax.set_xticks(
        np.arange(
            1,
            len(labels) + 1,
        )
    )

    ax.set_xticklabels(
        labels,
    )

    ax.set_title(
        f"Boxplot de tiempos de predicción - "
        f"{target_label}"
    )

    ax.set_xlabel(
        "Algoritmo"
    )

    ax.set_ylabel(
        "ms"
    )

    plt.setp(
        ax.get_xticklabels(),
        rotation=30,
        ha="right",
    )

    _save_figure(
        fig,
        base
        / "boxplot_tiempos_prediccion.png",
        dpi=180,
    )


# ============================================================
# CURVAS DE APRENDIZAJE
# ============================================================

def _export_learning_curves(
    base: Path,
    test_payloads: Sequence[
        Mapping[str, Any]
    ],
) -> None:
    """Exporta curvas de aprendizaje disponibles."""
    for payload in test_payloads:
        curve = payload.get(
            "learningCurve"
        )

        if not curve:
            continue

        model_name = str(
            payload.get(
                "model",
                "Unknown",
            )
        )

        try:
            frame = pd.DataFrame(
                curve
            )

            if frame.empty:
                continue

            csv_path = (
                base
                / (
                    f"learning_curve_"
                    f"{model_name}.csv"
                )
            )

            _export_csv(
                frame,
                csv_path,
            )

            if "epoch" not in frame.columns:
                continue

            # Conversión explícita de Series pandas a ndarray.
            # Esto evita que Pylance interprete frame["epoch"],
            # frame["loss"] o frame["accuracy"] como objetos
            # potencialmente invocables.
            epochs = pd.to_numeric(
                frame.loc[:, "epoch"],
                errors="coerce",
            ).to_numpy(
                dtype=float
            )

            if epochs.size == 0:
                continue

            fig, ax = plt.subplots(
                figsize=(9, 5)
            )

            plotted = False

            if "loss" in frame.columns:
                loss_values = pd.to_numeric(
                    frame.loc[:, "loss"],
                    errors="coerce",
                ).to_numpy(
                    dtype=float
                )

                if (
                    loss_values.size
                    == epochs.size
                ):
                    valid = (
                        np.isfinite(epochs)
                        & np.isfinite(loss_values)
                    )

                    if valid.any():
                        ax.plot(
                            epochs[valid],
                            loss_values[valid],
                            label="loss",
                        )

                        plotted = True

            if "accuracy" in frame.columns:
                accuracy_values = pd.to_numeric(
                    frame.loc[:, "accuracy"],
                    errors="coerce",
                ).to_numpy(
                    dtype=float
                )

                if (
                    accuracy_values.size
                    == epochs.size
                ):
                    valid = (
                        np.isfinite(epochs)
                        & np.isfinite(accuracy_values)
                    )

                    if valid.any():
                        ax.plot(
                            epochs[valid],
                            accuracy_values[valid],
                            label="accuracy",
                        )

                        plotted = True

            if not plotted:
                plt.close(fig)
                continue

            ax.set_xlabel(
                "Época"
            )

            ax.set_ylabel(
                "Valor"
            )

            ax.set_title(
                f"Curva de aprendizaje - "
                f"{model_name}"
            )

            ax.legend()

            _save_figure(
                fig,
                base
                / (
                    f"learning_curve_"
                    f"{model_name}.png"
                ),
                dpi=180,
            )

        except Exception:
            continue


# ============================================================
# EXPORTACIÓN PRINCIPAL
# ============================================================

def export_target_diagnostics(
    output_dir: Path,
    target_key: str,
    target_label: str,
    candidates: Sequence[
        Mapping[str, Any]
    ],
    test_payloads: Sequence[
        Mapping[str, Any]
    ],
    X_test: pd.DataFrame,
    y_test: pd.Series,
    split_info: Mapping[str, int],
) -> Path:
    """
    Exporta los diagnósticos finales de un target.

    TEST se utiliza exclusivamente para la evaluación final del modelo
    seleccionado y para generar sus reportes diagnósticos.

    `candidates` se conserva en la firma para compatibilidad con el
    publicador, aunque los diagnósticos TEST se generan únicamente a
    partir de `test_payloads`.
    """
    del candidates

    base = (
        Path(output_dir)
        / "Model_Reports"
        / str(target_key)
    )

    base.mkdir(
        parents=True,
        exist_ok=True,
    )

    # ---------------------------------------------------------
    # TEST permitido únicamente para payloads explícitamente
    # disponibles.
    # ---------------------------------------------------------
    payloads = [
        payload
        for payload in test_payloads
        if payload.get(
            "available",
            True,
        )
    ]

    (
        algorithm_rows,
        metric_rows,
        time_rows,
        importance_rows,
    ) = _metric_rows(
        target_key,
        target_label,
        payloads,
    )

    # ---------------------------------------------------------
    # 1. Algoritmos e hiperparámetros
    # ---------------------------------------------------------
    _export_csv(
        pd.DataFrame(
            algorithm_rows,
            columns=[
                "target",
                "targetLabel",
                "algorithm",
                "family",
                "hyperparameters",
            ],
        ),
        base
        / "algoritmos_hiperparametros.csv",
    )

    # ---------------------------------------------------------
    # 2. Métricas comparativas
    # ---------------------------------------------------------
    metric_columns = [
        "target",
        "targetLabel",
        "algorithm",
        *METRIC_COLUMNS,
        "balancedAccuracy",
        "normalizedQualityPercent",
        "normalizedAccuracy",
        "normalizedBalancedAccuracy",
        "normalizedF1",
        "normalizedPrecision",
        "normalizedRecallSensitivity",
        "normalizedAuc",
        "normalizedMcc",
        "normalizedKappa",
    ]

    ci_columns = sorted(
        {
            key
            for row in metric_rows
            for key in row
            if "CI95" in key
        }
    )

    _export_csv(
        pd.DataFrame(
            metric_rows,
            columns=(
                metric_columns
                + ci_columns
            ),
        ),
        base
        / "metricas_comparativas.csv",
    )

    # ---------------------------------------------------------
    # 3. Tiempos de predicción
    # ---------------------------------------------------------
    _export_csv(
        pd.DataFrame(
            time_rows,
            columns=[
                "target",
                "targetLabel",
                "algorithm",
                "latencyMeanMs",
                "latencyStdMs",
                "latencyPerRecordMs",
                "predictionsPerSecond",
                "batchLatencyMeanMs",
                "batchPredictionsPerSecond",
            ],
        ),
        base
        / "tiempos_prediccion.csv",
    )

    # ---------------------------------------------------------
    # 4. Importancia de variables
    # ---------------------------------------------------------
    if importance_rows:
        importance_frame = pd.concat(
            importance_rows,
            ignore_index=True,
        )
    else:
        importance_frame = pd.DataFrame(
            columns=[
                "feature",
                "importance",
                "importanceStd",
                "method",
                "model",
                "target",
                "algorithm",
            ]
        )

    _export_csv(
        importance_frame,
        base
        / "feature_importance.csv",
    )

    # ---------------------------------------------------------
    # 5. Partición de datos
    # ---------------------------------------------------------
    train_rows = int(
        split_info.get(
            "train",
            0,
        )
    )

    validation_rows = int(
        split_info.get(
            "validation",
            0,
        )
    )

    test_rows = int(
        split_info.get(
            "test",
            0,
        )
    )

    total_rows = (
        train_rows
        + validation_rows
        + test_rows
    )

    if total_rows > 0:
        train_percent = (
            train_rows
            / total_rows
            * 100
        )

        validation_percent = (
            validation_rows
            / total_rows
            * 100
        )

        test_percent = (
            test_rows
            / total_rows
            * 100
        )

    else:
        train_percent = np.nan
        validation_percent = np.nan
        test_percent = np.nan

    partition_row = {
        "target": target_key,
        "targetLabel": target_label,
        "trainRows": train_rows,
        "validationRows": validation_rows,
        "testRows": test_rows,
        "trainPercent": train_percent,
        "validationPercent": validation_percent,
        "testPercent": test_percent,
        "crossValidation": (
            "StratifiedKFold, hasta 5 folds, "
            "shuffle=True, random_state=42"
        ),
        "selectionRule": (
            "CV + VALIDATION; TEST reservado "
            "para evaluación final"
        ),
    }

    _export_csv(
        pd.DataFrame(
            [partition_row]
        ),
        base
        / "particion_datos.csv",
    )

    # ---------------------------------------------------------
    # 6. ROC
    # ---------------------------------------------------------
    _plot_roc_comparison(
        base,
        target_label,
        payloads,
        y_test,
    )

    # ---------------------------------------------------------
    # 7. Matrices de confusión
    # ---------------------------------------------------------
    _plot_confusion_matrices(
        base,
        payloads,
        y_test,
    )

    # ---------------------------------------------------------
    # 8. Predicción vs. real
    # ---------------------------------------------------------
    for payload in payloads:
        _plot_binary_prediction_vs_real(
            base,
            payload,
            y_test,
        )

    # ---------------------------------------------------------
    # 9. Métricas visuales
    # ---------------------------------------------------------
    _plot_metric_comparison(
        base,
        target_label,
        metric_rows,
    )

    # ---------------------------------------------------------
    # 10. Distribución de clases
    # ---------------------------------------------------------
    _plot_class_distribution(
        base,
        target_label,
        y_test,
    )

    # ---------------------------------------------------------
    # 11. Latencias
    # ---------------------------------------------------------
    _plot_latency(
        base,
        target_label,
        payloads,
    )

    # ---------------------------------------------------------
    # 12. Curvas de aprendizaje
    # ---------------------------------------------------------
    _export_learning_curves(
        base,
        payloads,
    )

    # ---------------------------------------------------------
    # 13. SHAP opcional
    # ---------------------------------------------------------
    for payload in payloads:
        pipeline = payload.get(
            "finalPipeline"
        )

        if pipeline is None:
            continue

        model_name = str(
            payload.get(
                "model",
                "Unknown",
            )
        )

        try_shap(
            pipeline=pipeline,
            X=X_test,
            model_name=model_name,
            out_csv=(
                base
                / (
                    f"shap_"
                    f"{model_name}.csv"
                )
            ),
        )

    return base
