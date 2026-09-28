from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.base import BaseEstimator, ClassifierMixin
from xgboost import XGBClassifier

from .algorithm_common import train_algorithm
from .config import CV_FOLDS, RANDOM_STATE


class XGBoostLabelAdapter(
    BaseEstimator,
    ClassifierMixin,
):
    """
    Adaptador de XGBoost para targets con etiquetas arbitrarias.

    XGBoost requiere etiquetas enteras consecutivas comenzando en 0.
    Este adaptador transforma internamente las etiquetas y las restaura
    automáticamente al ejecutar predict().
    """

    def __init__(
        self,
        n_estimators: int = 120,
        max_depth: int = 6,
        learning_rate: float = 0.05,
        subsample: float = 0.90,
        colsample_bytree: float = 0.90,
        min_child_weight: float = 2.0,
        reg_lambda: float = 1.0,
        random_state: int = RANDOM_STATE,
        n_jobs: int = -1,
    ) -> None:
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate
        self.subsample = subsample
        self.colsample_bytree = colsample_bytree
        self.min_child_weight = min_child_weight
        self.reg_lambda = reg_lambda
        self.random_state = random_state
        self.n_jobs = n_jobs

    def fit(
        self,
        X: Any,
        y: Any,
    ) -> "XGBoostLabelAdapter":
        """
        Entrena XGBoost codificando internamente las etiquetas.
        """

        original = np.asarray(y)

        if original.ndim != 1:
            original = original.ravel()

        if original.size == 0:
            raise ValueError(
                "XGBoost recibió un conjunto de entrenamiento vacío."
            )

        if np.any(pd_is_missing(original)):
            raise ValueError(
                "XGBoost recibió etiquetas faltantes en y."
            )

        self.classes_ = np.unique(original)

        if self.classes_.size < 2:
            raise ValueError(
                "XGBoost requiere al menos dos clases."
            )

        self._encode = {
            label: index
            for index, label in enumerate(self.classes_)
        }

        encoded = np.asarray(
            [self._encode[label] for label in original],
            dtype=np.int32,
        )

        n_classes = len(self.classes_)

        if n_classes == 2:
            objective = "binary:logistic"
            eval_metric = "logloss"
        else:
            objective = "multi:softprob"
            eval_metric = "mlogloss"

        model_params: dict[str, Any] = {
            "objective": objective,
            "eval_metric": eval_metric,
            "n_estimators": self.n_estimators,
            "max_depth": self.max_depth,
            "learning_rate": self.learning_rate,
            "subsample": self.subsample,
            "colsample_bytree": self.colsample_bytree,
            "min_child_weight": self.min_child_weight,
            "reg_lambda": self.reg_lambda,
            "tree_method": "hist",
            "n_jobs": self.n_jobs,
            "random_state": self.random_state,
        }

        if n_classes > 2:
            model_params["num_class"] = n_classes

        self.model_ = XGBClassifier(**model_params)

        self.model_.fit(
            X,
            encoded,
        )

        return self

    def predict(self, X: Any) -> np.ndarray:
        """
        Genera predicciones utilizando las etiquetas originales.
        """

        encoded = np.asarray(
            self.model_.predict(X),
            dtype=np.int64,
        )

        if np.any(encoded < 0) or np.any(
            encoded >= len(self.classes_)
        ):
            raise RuntimeError(
                "XGBoost produjo una clase fuera del rango esperado."
            )

        return self.classes_[encoded]

    def predict_proba(
        self,
        X: Any,
    ) -> np.ndarray:
        """
        Devuelve las probabilidades de cada clase.

        El orden de las columnas corresponde a self.classes_.
        """

        probabilities = np.asarray(
            self.model_.predict_proba(X),
            dtype=float,
        )

        if probabilities.ndim != 2:
            raise RuntimeError(
                "XGBoost devolvió probabilidades con una dimensión "
                "inesperada."
            )

        if probabilities.shape[1] != len(self.classes_):
            raise RuntimeError(
                "El número de probabilidades no coincide con el número "
                "de clases del modelo."
            )

        return probabilities

    @property
    def feature_importances_(self) -> np.ndarray:
        """
        Importancia de las variables calculada por XGBoost.
        """

        return self.model_.feature_importances_

    @property
    def n_classes_(self) -> int:
        """
        Número de clases aprendidas durante fit().
        """

        return len(self.classes_)

    def get_params(
        self,
        deep: bool = True,
    ) -> dict[str, Any]:
        """
        Parámetros compatibles con scikit-learn.
        """

        del deep

        return {
            "n_estimators": self.n_estimators,
            "max_depth": self.max_depth,
            "learning_rate": self.learning_rate,
            "subsample": self.subsample,
            "colsample_bytree": self.colsample_bytree,
            "min_child_weight": self.min_child_weight,
            "reg_lambda": self.reg_lambda,
            "random_state": self.random_state,
            "n_jobs": self.n_jobs,
        }

    def set_params(
        self,
        **params: Any,
    ) -> "XGBoostLabelAdapter":
        """
        Actualiza parámetros del estimador.
        """

        valid_params = set(self.get_params())

        unknown_params = set(params) - valid_params

        if unknown_params:
            raise ValueError(
                "Parámetros desconocidos para "
                f"XGBoostLabelAdapter: {sorted(unknown_params)}"
            )

        for key, value in params.items():
            setattr(self, key, value)

        return self


def pd_is_missing(
    values: np.ndarray,
) -> np.ndarray:
    """
    Detecta valores faltantes en las etiquetas sin depender de pandas.
    """

    result = np.zeros(
        values.shape,
        dtype=bool,
    )

    for index, value in enumerate(values):
        try:
            missing = (
                value is None
                or bool(np.isnan(value))
            )
        except (TypeError, ValueError):
            missing = False

        result[index] = missing

    return result


def create_model(
    n_classes: int | None = None,
) -> XGBoostLabelAdapter:
    """
    Crea una instancia del adaptador XGBoost.

    n_classes se mantiene por compatibilidad con el pipeline.
    El número real de clases se determina durante fit().
    """

    del n_classes

    return XGBoostLabelAdapter()


def train_xgboost(
    X_train: Any,
    y_train: Any,
    X_validation: Any,
    y_validation: Any,
    thresholds: dict[str, float],
):
    """
    Entrena y evalúa XGBoost utilizando el pipeline común.
    """

    return train_algorithm(
        algorithm="XGBoost",
        estimator=create_model(),
        X_train=X_train,
        y_train=y_train,
        X_validation=X_validation,
        y_validation=y_validation,
        thresholds=thresholds,
        cv_folds=CV_FOLDS,
        random_state=RANDOM_STATE,
    )
