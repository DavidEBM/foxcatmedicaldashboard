from __future__ import annotations

import copy
import time
from typing import Any, Callable

import numpy as np
import pandas as pd

from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    cohen_kappa_score,
    confusion_matrix,
    f1_score,
    matthews_corrcoef,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedGroupKFold, StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder, StandardScaler

from .config import CV_FOLDS, RANDOM_STATE


# ============================================================================
# IMPUTADORES SEGUROS
# ============================================================================


class SafeMostFrequentImputer(SimpleImputer):
    """
    Imputador categórico mediante la categoría más frecuente.
    """

    def __init__(self) -> None:
        super().__init__(
            strategy="most_frequent",
            missing_values=np.nan,
        )


class SafeMedianImputer(SimpleImputer):
    """
    Imputador numérico mediante la mediana.
    """

    def __init__(self) -> None:
        super().__init__(
            strategy="median",
            missing_values=np.nan,
        )


# ============================================================================
# PREPROCESAMIENTO
# ============================================================================


def _is_numeric_dtype(
    series: pd.Series,
) -> bool:
    """
    Determina si una serie es numérica.
    """

    return pd.api.types.is_numeric_dtype(
        series
    )


def _column_groups(
    X: Any,
) -> tuple[list[str], list[str]]:
    """
    Separa las columnas de un DataFrame en:

        - variables numéricas
        - variables categóricas
    """

    if not isinstance(
        X,
        pd.DataFrame,
    ):
        raise TypeError(
            "El preprocesamiento requiere X como pandas.DataFrame."
        )

    numeric_columns: list[str] = []
    categorical_columns: list[str] = []

    for column in X.columns:
        series = X[column]

        # Una columna completamente vacía no aporta información y hace que
        # SimpleImputer elimine silenciosamente una variable durante fit().
        if not series.notna().any():
            continue

        if _is_numeric_dtype(
            series
        ):
            numeric_columns.append(
                column
            )
        else:
            categorical_columns.append(
                column
            )

    return (
        numeric_columns,
        categorical_columns,
    )


def _make_one_hot_encoder() -> OneHotEncoder:
    """
    Construye OneHotEncoder compatible con distintas versiones
    de scikit-learn.
    """

    try:
        return OneHotEncoder(
            handle_unknown="ignore",
            sparse_output=False,
        )

    except TypeError:
        return OneHotEncoder(
            handle_unknown="ignore",
            sparse=False,
        )


def _categorical_to_strings(data: Any) -> Any:
    """Homogeneiza categorías mixtas procedentes de CSV y Firestore."""
    frame = pd.DataFrame(data).copy()

    def normalize(value: Any) -> Any:
        if value is None:
            return np.nan
        try:
            if bool(pd.isna(value)):
                return np.nan
        except (TypeError, ValueError):
            pass
        return str(value).strip()

    return frame.apply(lambda column: column.map(normalize))


def preprocessor(
    X: Any,
) -> ColumnTransformer:
    """
    Construye el preprocesador principal.

    Variables numéricas:
        mediana + StandardScaler.

    Variables categóricas:
        moda + OneHotEncoder.
    """

    (
        numeric_columns,
        categorical_columns,
    ) = _column_groups(
        X
    )

    numeric_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SafeMedianImputer(),
            ),
            (
                "scaler",
                StandardScaler(),
            ),
        ]
    )

    categorical_pipeline = Pipeline(
        steps=[
            (
                "strings",
                FunctionTransformer(_categorical_to_strings),
            ),
            (
                "imputer",
                SafeMostFrequentImputer(),
            ),
            (
                "encoder",
                _make_one_hot_encoder(),
            ),
        ]
    )

    transformers: list[
        tuple[str, Any, list[str]]
    ] = []

    if numeric_columns:
        transformers.append(
            (
                "numeric",
                numeric_pipeline,
                numeric_columns,
            )
        )

    if categorical_columns:
        transformers.append(
            (
                "categorical",
                categorical_pipeline,
                categorical_columns,
            )
        )

    if not transformers:
        raise ValueError(
            "No se encontraron variables utilizables para construir "
            "el preprocesador."
        )

    return ColumnTransformer(
        transformers=transformers,
        remainder="drop",
        sparse_threshold=0.0,
    )


# ============================================================================
# PREPROCESAMIENTO ESPECÍFICO PARA CATBOOST
# ============================================================================


class NativeCatBoostPreprocessor(
    BaseEstimator,
    ClassifierMixin,
):
    """
    Preprocesador específico para CatBoost.

    Conserva las variables categóricas en formato compatible con
    CatBoost en lugar de aplicar one-hot encoding.
    """

    def __init__(self) -> None:
        self.feature_columns_: list[str] = []
        self.categorical_columns_: list[str] = []
        self.categorical_indices_: list[int] = []

    def fit(
        self,
        X: Any,
        y: Any = None,
    ) -> "NativeCatBoostPreprocessor":

        if not isinstance(
            X,
            pd.DataFrame,
        ):
            raise TypeError(
                "NativeCatBoostPreprocessor requiere un DataFrame."
            )

        self.feature_columns_ = [
            column
            for column in X.columns
            if X[column].notna().any()
        ]

        (
            _,
            categorical_columns,
        ) = _column_groups(
            X
        )

        self.categorical_columns_ = (
            categorical_columns
        )

        self.categorical_indices_ = [
            self.feature_columns_.index(
                column
            )
            for column in categorical_columns
        ]

        return self

    def transform(
        self,
        X: Any,
    ) -> pd.DataFrame:

        if not isinstance(
            X,
            pd.DataFrame,
        ):
            raise TypeError(
                "NativeCatBoostPreprocessor requiere un DataFrame."
            )

        result = X.copy()

        # Mantener exactamente las columnas observadas durante fit.
        for column in self.feature_columns_:
            if column not in result.columns:
                result[column] = np.nan

        result = result[
            self.feature_columns_
        ].copy()

        # CatBoost requiere valores categóricos no nulos.
        for column in self.categorical_columns_:
            result[column] = (
                result[column]
                .where(
                    result[column].notna(),
                    "__MISSING__",
                )
                .astype(str)
            )

        return result

    def fit_transform(
        self,
        X: Any,
        y: Any = None,
        **fit_params: Any,
    ) -> pd.DataFrame:

        del fit_params

        self.fit(
            X,
            y,
        )

        return self.transform(
            X
        )


# ============================================================================
# PIPELINES
# ============================================================================


def build_pipeline(
    *,
    X: Any,
    name: str,
    estimator: Any,
) -> Pipeline:
    """
    Construye el Pipeline correspondiente al algoritmo.

    Todos los algoritmos utilizan:

        preprocessor
            ↓
        estimator

    CatBoost utiliza su preprocesador nativo.
    """

    normalized_name = str(
        name
    ).strip().lower()

    if normalized_name in {
        "catboost",
        "catboostclassifier",
    }:
        preprocessing = (
            NativeCatBoostPreprocessor()
        )

    else:
        preprocessing = preprocessor(
            X
        )

    return Pipeline(
        steps=[
            (
                "preprocessor",
                preprocessing,
            ),
            (
                "estimator",
                estimator,
            ),
        ]
    )


def prepare_estimator_for_pipeline(
    *,
    pipeline: Pipeline,
    name: str,
) -> Pipeline:
    """
    Punto de extensión para ajustes posteriores al entrenamiento.

    Actualmente no modifica el pipeline.
    """

    del name

    return pipeline


# ============================================================================
# UTILIDADES DE ETIQUETAS
# ============================================================================


def _normalize_label(
    value: Any,
) -> str:
    """
    Normaliza una etiqueta para comparaciones robustas.
    """

    if value is None:
        return ""

    if isinstance(
        value,
        float,
    ) and np.isnan(value):
        return ""

    return str(
        value
    ).strip().upper()


def _resolve_positive_label(
    classes: Any,
) -> Any:
    """
    Determina la clase positiva para targets binarios.

    Prioridad:

        1. SI
        2. TRUE / VERDADERO / YES / Y
        3. 1 / 1.0
        4. última clase ordenada como fallback
    """

    class_list = list(
        classes
    )

    if len(class_list) != 2:
        raise ValueError(
            "La resolución de clase positiva requiere exactamente "
            "dos clases."
        )

    for candidate in class_list:
        if _normalize_label(
            candidate
        ) == "SI":
            return candidate

    for candidate in class_list:
        if _normalize_label(
            candidate
        ) in {
            "TRUE",
            "VERDADERO",
            "YES",
            "Y",
        }:
            return candidate

    for candidate in class_list:
        if _normalize_label(
            candidate
        ) in {
            "1",
            "1.0",
        }:
            return candidate

    try:
        ordered = sorted(
            class_list,
            key=lambda value: str(
                value
            ),
        )

        return ordered[-1]

    except Exception:
        return class_list[-1]


def _binary_target(
    y_true: Any,
    positive_label: Any,
) -> np.ndarray:
    """
    Convierte un target binario arbitrario a 0/1.
    """

    values = np.asarray(
        y_true
    )

    positive_normalized = (
        _normalize_label(
            positive_label
        )
    )

    return np.asarray(
        [
            1
            if _normalize_label(
                value
            )
            == positive_normalized
            else 0
            for value in values
        ],
        dtype=int,
    )


# ============================================================================
# AUC ROBUSTO
# ============================================================================


def _safe_auc(
    y_true: Any,
    probabilities: Any,
    classes: Any,
) -> float:
    """
    Calcula AUC de forma robusta para clasificación binaria
    o multiclase.
    """

    try:
        class_list = list(
            classes
        )

        if len(class_list) < 2:
            return float("nan")

        probabilities_array = np.asarray(
            probabilities,
            dtype=float,
        )

        # --------------------------------------------------------------
        # Binario
        # --------------------------------------------------------------

        if len(class_list) == 2:

            positive_label = (
                _resolve_positive_label(
                    class_list
                )
            )

            positive_index = (
                class_list.index(
                    positive_label
                )
            )

            y_binary = _binary_target(
                y_true,
                positive_label,
            )

            if len(
                np.unique(
                    y_binary
                )
            ) < 2:
                return float("nan")

            if probabilities_array.ndim == 1:

                positive_probability = (
                    probabilities_array
                )

            elif probabilities_array.ndim == 2:

                if (
                    probabilities_array.shape[1]
                    <= positive_index
                ):
                    return float("nan")

                positive_probability = (
                    probabilities_array[
                        :,
                        positive_index,
                    ]
                )

            else:
                return float("nan")

            return float(
                roc_auc_score(
                    y_binary,
                    positive_probability,
                )
            )

        # --------------------------------------------------------------
        # Multiclase
        # --------------------------------------------------------------

        y_array = np.asarray(
            y_true
        )

        if probabilities_array.ndim != 2:
            return float("nan")

        if (
            probabilities_array.shape[1]
            != len(class_list)
        ):
            return float("nan")

        return float(
            roc_auc_score(
                y_array,
                probabilities_array,
                multi_class="ovr",
                average="macro",
                labels=class_list,
            )
        )

    except Exception:
        return float("nan")


# ============================================================================
# EVALUACIÓN
# ============================================================================


def _get_pipeline_classes(
    pipeline: Any,
    y_fallback: Any,
) -> list[Any]:
    """
    Obtiene las clases del estimador final.

    Orden de búsqueda:

        1. pipeline.classes_
        2. step "estimator".classes_
        3. step "model".classes_
        4. clases observadas en y
    """

    classes: Any = None

    try:
        classes = getattr(
            pipeline,
            "classes_",
            None,
        )
    except Exception:
        classes = None

    if classes is not None:
        return list(
            classes
        )

    if hasattr(
        pipeline,
        "named_steps",
    ):
        named_steps = (
            pipeline.named_steps
        )

        estimator = (
            named_steps.get(
                "estimator"
            )
        )

        if estimator is None:
            estimator = (
                named_steps.get(
                    "model"
                )
            )

        if estimator is not None:
            classes = getattr(
                estimator,
                "classes_",
                None,
            )

            if classes is not None:
                return list(
                    classes
                )

    return list(
        np.unique(
            np.asarray(
                y_fallback
            )
        )
    )


def evaluate(
    pipeline: Any,
    X: Any,
    y: Any,
) -> dict[str, Any]:
    """
    Evalúa un pipeline entrenado.

    Para clasificación binaria se normalizan internamente las
    etiquetas a 0/1 para calcular F1, MCC y kappa de forma
    consistente incluso cuando las clases originales son SI/NO.

    Las etiquetas originales se conservan en "classes".
    """

    if pipeline is None:
        raise ValueError(
            "El pipeline no puede ser None."
        )

    if X is None or y is None:
        raise ValueError(
            "X e y no pueden ser None."
        )

    y_true = np.asarray(
        y
    )

    if len(y_true) == 0:
        raise ValueError(
            "El conjunto de evaluación está vacío."
        )

    try:
        y_pred = pipeline.predict(
            X
        )

    except Exception as exc:
        raise RuntimeError(
            f"No fue posible generar predicciones: {exc}"
        ) from exc

    y_pred = np.asarray(
        y_pred
    )

    if len(y_pred) != len(y_true):
        raise ValueError(
            "El número de predicciones no coincide con el número "
            "de observaciones reales."
        )

    classes = _get_pipeline_classes(
        pipeline,
        y_true,
    )

    binary = len(classes) == 2

    # ------------------------------------------------------------------
    # Métricas binarias
    # ------------------------------------------------------------------

    if binary:

        positive_label = (
            _resolve_positive_label(
                classes
            )
        )

        y_true_binary = _binary_target(
            y_true,
            positive_label,
        )

        y_pred_binary = _binary_target(
            y_pred,
            positive_label,
        )

        accuracy = float(
            accuracy_score(
                y_true_binary,
                y_pred_binary,
            )
        )

        f1 = float(
            f1_score(
                y_true_binary,
                y_pred_binary,
                average="binary",
                pos_label=1,
                zero_division=0,
            )
        )

        mcc = float(
            matthews_corrcoef(
                y_true_binary,
                y_pred_binary,
            )
        )

        kappa = float(
            cohen_kappa_score(
                y_true_binary,
                y_pred_binary,
            )
        )

        precision = float(
            precision_score(
                y_true_binary,
                y_pred_binary,
                average="binary",
                pos_label=1,
                zero_division=0,
            )
        )

        recall = float(
            recall_score(
                y_true_binary,
                y_pred_binary,
                average="binary",
                pos_label=1,
                zero_division=0,
            )
        )

        balanced_accuracy = float(
            balanced_accuracy_score(
                y_true_binary,
                y_pred_binary,
            )
        )

    # ------------------------------------------------------------------
    # Métricas multiclase
    # ------------------------------------------------------------------

    else:

        positive_label = None

        accuracy = float(
            accuracy_score(
                y_true,
                y_pred,
            )
        )

        f1 = float(
            f1_score(
                y_true,
                y_pred,
                average="macro",
                zero_division=0,
            )
        )

        mcc = float(
            matthews_corrcoef(
                y_true,
                y_pred,
            )
        )

        kappa = float(
            cohen_kappa_score(
                y_true,
                y_pred,
            )
        )

        precision = float(
            precision_score(
                y_true,
                y_pred,
                average="macro",
                zero_division=0,
            )
        )

        recall = float(
            recall_score(
                y_true,
                y_pred,
                average="macro",
                zero_division=0,
            )
        )

        balanced_accuracy = float(
            balanced_accuracy_score(
                y_true,
                y_pred,
            )
        )

    # ------------------------------------------------------------------
    # Probabilidades y AUC
    # ------------------------------------------------------------------

    probabilities: Any = None

    try:
        if hasattr(
            pipeline,
            "predict_proba",
        ):
            probabilities = (
                pipeline.predict_proba(
                    X
                )
            )

    except Exception:
        probabilities = None

    if probabilities is None:
        auc = float("nan")

    else:
        auc = _safe_auc(
            y_true,
            probabilities,
            classes,
        )

    # ------------------------------------------------------------------
    # Matriz de confusión
    # ------------------------------------------------------------------

    try:
        matrix = confusion_matrix(
            y_true,
            y_pred,
            labels=classes,
        )

        confusion = matrix.tolist()

    except Exception:
        confusion = []

    result = {
        "accuracy": accuracy,
        "f1": f1,
        "mcc": mcc,
        "kappa": kappa,
        "auc": auc,
        "precision": precision,
        "recallSensitivity": recall,
        "balancedAccuracy": balanced_accuracy,

        "classes": [
            str(value)
            for value in classes
        ],

        "positiveLabel": (
            str(
                positive_label
            )
            if positive_label is not None
            else None
        ),

        "confusionMatrix": confusion,
    }

    result["normalizedMetrics"] = normalized_metrics(result)
    result["normalizedQuality"] = normalized_quality(result)

    return result


# ============================================================================
# UTILIDADES DE MÉTRICAS
# ============================================================================


def _finite_metric(
    metrics: dict[str, Any],
    key: str,
    default: float = 0.0,
) -> float:
    """
    Obtiene una métrica numérica finita.

    Evita errores cuando el valor es None, NaN o no numérico.
    """

    raw_value: Any = metrics.get(
        key,
        default,
    )

    if raw_value is None:
        return default

    try:
        value = float(
            raw_value
        )

    except (
        TypeError,
        ValueError,
        OverflowError,
    ):
        return default

    if not np.isfinite(
        value
    ):
        return default

    return value


# ============================================================================
# SCORE COMPUESTO
# ============================================================================


def score(
    metrics: dict[str, Any],
) -> float:
    """
    Calcula el score compuesto utilizado durante CV y selección.

    Ponderaciones:

        Accuracy         : 20 %
        Balanced accuracy: 20 %
        F1               : 20 %
        MCC              : 15 %
        Kappa            : 15 %
        AUC              : 10 %

    El score queda en una escala aproximada de 0 a 1.
    """

    accuracy = _finite_metric(
        metrics,
        "accuracy",
    )

    f1 = _finite_metric(
        metrics,
        "f1",
    )

    mcc = _finite_metric(
        metrics,
        "mcc",
    )

    kappa = _finite_metric(
        metrics,
        "kappa",
    )

    auc = _finite_metric(
        metrics,
        "auc",
        default=0.0,
    )

    balanced_accuracy = _finite_metric(
        metrics,
        "balancedAccuracy",
        default=accuracy,
    )

    return float(
        (
            0.20 * accuracy
            + 0.20 * balanced_accuracy
            + 0.20 * f1
            + 0.15 * mcc
            + 0.15 * kappa
            + 0.10 * auc
        )
    )


# ============================================================================
# CALIDAD NORMALIZADA
# ============================================================================


def normalized_quality(
    metrics: dict[str, Any],
) -> float:
    """
    Calcula una calidad normalizada entre 0 y 1.

    Accuracy, F1 y AUC ya están conceptualmente en [0, 1].

    MCC y kappa tienen rango teórico [-1, 1] y se transforman
    mediante:

        normalized = (metric + 1) / 2

    Finalmente todos los valores se limitan a [0, 1].
    """

    values = normalized_metrics(metrics)
    normalized_values = list(values.values())

    if not normalized_values:
        return 0.0

    return float(
        np.mean(
            normalized_values
        )
    )


def normalized_metrics(
    metrics: dict[str, Any],
) -> dict[str, float]:
    """Devuelve cada métrica disponible en una escala común [0, 1]."""

    result: dict[str, float] = {}

    for key in (
        "accuracy",
        "balancedAccuracy",
        "f1",
        "precision",
        "recallSensitivity",
        "auc",
    ):
        value = _finite_metric(
            metrics,
            key,
            default=float("nan"),
        )

        if np.isfinite(value):
            result[key] = float(np.clip(value, 0.0, 1.0))

    for key in ("mcc", "kappa"):
        value = _finite_metric(
            metrics,
            key,
            default=float("nan"),
        )

        if np.isfinite(value):
            result[key] = float(
                np.clip((value + 1.0) / 2.0, 0.0, 1.0)
            )

    return result


# ============================================================================
# UMBRALES
# ============================================================================


def qualifies(
    metrics: dict[str, Any],
    thresholds: dict[str, float],
) -> bool:
    """
    Determina si un modelo cumple todos los umbrales definidos.

    Los umbrales se aplican sobre las métricas de evaluación
    correspondientes.
    """

    if not thresholds:
        return True

    threshold_mapping = {
        "accuracy": "accuracy",
        "f1": "f1",
        "mcc": "mcc",
        "kappa": "kappa",
        "auc": "auc",
    }

    checks: list[
        bool
    ] = []

    for (
        threshold_key,
        metric_key,
    ) in threshold_mapping.items():

        if threshold_key not in thresholds:
            continue

        threshold_raw: Any = (
            thresholds.get(
                threshold_key
            )
        )

        if threshold_raw is None:
            continue

        try:
            threshold = float(
                threshold_raw
            )

        except (
            TypeError,
            ValueError,
            OverflowError,
        ):
            continue

        value = _finite_metric(
            metrics,
            metric_key,
            default=float("nan"),
        )

        if not np.isfinite(
            value
        ):
            return False

        checks.append(
            value >= threshold
        )

    if not checks:
        return True

    return all(
        checks
    )


# ============================================================================
# VALIDACIÓN CRUZADA
# ============================================================================


def _effective_cv_folds(
    y: Any,
) -> int:
    """
    Determina el número efectivo de folds.

    El número de folds no puede superar la cantidad de observaciones
    disponibles en la clase minoritaria.
    """

    values = np.asarray(
        y
    )

    if len(values) == 0:
        raise ValueError(
            "No hay observaciones para Cross-Validation."
        )

    _classes, counts = np.unique(
        values,
        return_counts=True,
    )

    if len(counts) < 2:
        raise ValueError(
            "Cross-Validation requiere al menos dos clases."
        )

    minimum_class_count = int(
        np.min(
            counts
        )
    )

    folds = min(
        int(CV_FOLDS),
        minimum_class_count,
    )

    if folds < 2:
        raise ValueError(
            "No hay suficientes observaciones por clase para realizar "
            "Cross-Validation estratificada."
        )

    return folds


def cross_validate(
    *,
    name: str,
    estimator_factory: Callable[
        [int],
        Any,
    ],
    X: Any,
    y: Any,
    groups: Any | None = None,
) -> tuple[
    float,
    float,
    list[dict[str, Any]],
]:
    """
    Realiza Cross-Validation exclusivamente sobre TRAIN.

    Retorna:

        cv_mean_score
        cv_std_score
        detalles por fold

    Cada fold construye y ajusta su propio pipeline, evitando que
    imputación, escalado o codificación aprendidos en un fold se
    filtren hacia otro fold.
    """

    if X is None or y is None:
        raise ValueError(
            "X/y no pueden ser None."
        )

    if len(X) != len(y):
        raise ValueError(
            "X e y tienen diferente número de observaciones."
        )

    if groups is not None and len(groups) != len(y):
        raise ValueError(
            "X, y y groups tienen diferente número de observaciones."
        )

    folds = _effective_cv_folds(
        y
    )

    y_array = np.asarray(
        y
    )

    if groups is not None:
        groups_array = np.asarray(groups)
        group_counts = [
            np.unique(groups_array[y_array == label]).size
            for label in np.unique(y_array)
        ]
        if not group_counts or min(group_counts) < 2:
            raise ValueError(
                "No hay suficientes pacientes independientes por clase "
                "para Cross-Validation agrupada."
            )
        folds = min(folds, min(group_counts))
        splitter = StratifiedGroupKFold(
            n_splits=folds,
            shuffle=True,
            random_state=RANDOM_STATE,
        )
        split_arguments = (X, y_array, groups_array)
    else:
        splitter = StratifiedKFold(
            n_splits=folds,
            shuffle=True,
            random_state=RANDOM_STATE,
        )
        split_arguments = (X, y_array)

    fold_scores: list[
        float
    ] = []

    details: list[
        dict[str, Any]
    ] = []

    for (
        fold_number,
        (
            train_indices,
            validation_indices,
        ),
    ) in enumerate(
        splitter.split(*split_arguments),
        start=1,
    ):

        if hasattr(
            X,
            "iloc",
        ):
            X_fold_train = X.iloc[
                train_indices
            ]

            X_fold_validation = X.iloc[
                validation_indices
            ]

        else:
            X_fold_train = X[
                train_indices
            ]

            X_fold_validation = X[
                validation_indices
            ]

        y_fold_train = y_array[
            train_indices
        ]

        y_fold_validation = y_array[
            validation_indices
        ]

        fold_classes = len(
            np.unique(
                y_fold_train
            )
        )

        if fold_classes < 2:

            details.append(
                {
                    "fold": fold_number,
                    "score": None,
                    "error": (
                        "El fold de entrenamiento contiene "
                        "una sola clase."
                    ),
                }
            )

            continue

        fold_start = time.perf_counter()

        try:
            estimator = estimator_factory(
                fold_classes
            )

            pipeline = build_pipeline(
                X=X_fold_train,
                name=name,
                estimator=estimator,
            )

            pipeline.fit(
                X_fold_train,
                y_fold_train,
            )

            fold_metrics = evaluate(
                pipeline,
                X_fold_validation,
                y_fold_validation,
            )

            fold_score = score(
                fold_metrics
            )

            elapsed = (
                time.perf_counter()
                - fold_start
            )

            if not np.isfinite(
                fold_score
            ):
                raise ValueError(
                    "El score del fold no es finito."
                )

            fold_scores.append(
                float(
                    fold_score
                )
            )

            details.append(
                {
                    "fold": fold_number,

                    "score": float(
                        fold_score
                    ),

                    "accuracy": fold_metrics.get(
                        "accuracy"
                    ),

                    "f1": fold_metrics.get(
                        "f1"
                    ),

                    "mcc": fold_metrics.get(
                        "mcc"
                    ),

                    "kappa": fold_metrics.get(
                        "kappa"
                    ),

                    "auc": fold_metrics.get(
                        "auc"
                    ),

                    "seconds": float(
                        elapsed
                    ),

                    "error": None,
                }
            )

        except Exception as exc:

            elapsed = (
                time.perf_counter()
                - fold_start
            )

            details.append(
                {
                    "fold": fold_number,

                    "score": None,

                    "seconds": float(
                        elapsed
                    ),

                    "error": str(
                        exc
                    ),
                }
            )

    if not fold_scores:
        raise RuntimeError(
            f"El algoritmo '{name}' no pudo completar ningún fold "
            "válido de Cross-Validation."
        )

    return (
        float(
            np.mean(
                fold_scores
            )
        ),

        float(
            np.std(
                fold_scores
            )
        ),

        details,
    )


# ============================================================================
# UTILIDADES DE COMPATIBILIDAD
# ============================================================================


def clone_estimator(
    estimator: Any,
) -> Any:
    """
    Clona un estimador.

    Primero intenta utilizar sklearn.clone(), que es la opción
    adecuada para estimadores compatibles con scikit-learn.

    Si falla, utiliza deepcopy como fallback.
    """

    try:
        from sklearn.base import clone

        return clone(
            estimator
        )

    except Exception:
        return copy.deepcopy(
            estimator
        )


def is_fitted(
    estimator: Any,
) -> bool:
    """
    Comprueba si un estimador parece estar ajustado.
    """

    try:
        from sklearn.utils.validation import (
            check_is_fitted,
        )

        check_is_fitted(
            estimator
        )

        return True

    except Exception:
        return False
