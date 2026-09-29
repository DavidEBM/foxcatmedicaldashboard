from __future__ import annotations

from typing import Any

import pandas as pd
from catboost import CatBoostClassifier
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.utils.validation import check_is_fitted

from .algorithm_common import train_algorithm
from .config import CV_FOLDS, RANDOM_STATE


class CatBoostSklearnAdapter(BaseEstimator, ClassifierMixin):
    """
    Adaptador sklearn-compatible para CatBoost.

    El adaptador mantiene la configuración necesaria para que CatBoost pueda
    trabajar dentro del flujo común de entrenamiento.

    `cat_features` contiene los índices de las columnas categóricas del
    DataFrame que recibe directamente CatBoost.
    """

    def __init__(
        self,
        iterations: int = 200,
        depth: int = 6,
        learning_rate: float = 0.05,
        l2_leaf_reg: float = 3.0,
        random_strength: float = 1.0,
        cat_features: list[int] | None = None,
    ) -> None:
        self.iterations = iterations
        self.depth = depth
        self.learning_rate = learning_rate
        self.l2_leaf_reg = l2_leaf_reg
        self.random_strength = random_strength
        self.cat_features = cat_features

    def _build(self, n_classes: int) -> CatBoostClassifier:
        """Construye una instancia CatBoost sin entrenarla."""
        is_binary = n_classes == 2

        return CatBoostClassifier(
            iterations=self.iterations,
            depth=self.depth,
            learning_rate=self.learning_rate,
            l2_leaf_reg=self.l2_leaf_reg,
            random_strength=self.random_strength,
            loss_function="Logloss" if is_binary else "MultiClass",
            eval_metric="AUC" if is_binary else "MultiClass",
            random_seed=RANDOM_STATE,
            verbose=False,
            allow_writing_files=False,
            thread_count=-1,
            cat_features=self.cat_features,
        )

    def fit(
        self,
        X: Any,
        y: Any,
    ) -> "CatBoostSklearnAdapter":
        """Entrena CatBoost y conserva sus clases."""
        if X is None:
            raise ValueError("X no puede ser None.")

        if y is None:
            raise ValueError("y no puede ser None.")

        if len(X) == 0:
            raise ValueError("No se puede entrenar CatBoost con X vacío.")

        if len(X) != len(y):
            raise ValueError(
                f"X e y tienen longitudes diferentes: {len(X)} != {len(y)}."
            )

        if self.cat_features is None and hasattr(X, "dtypes"):
            self.cat_features = [
                index
                for index, dtype in enumerate(X.dtypes)
                if not pd.api.types.is_numeric_dtype(dtype)
            ]

        classes = list(dict.fromkeys(y))

        if len(classes) < 2:
            raise ValueError(
                "CatBoost requiere al menos dos clases para clasificación."
            )

        self.n_classes_ = len(classes)
        self.model_ = self._build(self.n_classes_)

        self.model_.fit(X, y)

        self.classes_ = self.model_.classes_

        return self

    def predict(self, X: Any) -> Any:
        """Genera las clases predichas."""
        check_is_fitted(self, attributes=["model_", "classes_"])

        prediction = self.model_.predict(X)

        return prediction.reshape(-1)

    def predict_proba(self, X: Any) -> Any:
        """Genera probabilidades por clase."""
        check_is_fitted(self, attributes=["model_", "classes_"])

        return self.model_.predict_proba(X)

    @property
    def feature_importances_(self) -> Any:
        """Expone las importancias calculadas por CatBoost."""
        check_is_fitted(self, attributes=["model_"])

        return self.model_.feature_importances_

    def get_feature_importance(self, *args: Any, **kwargs: Any) -> Any:
        """Expone la API de importancia de CatBoost cuando sea necesaria."""
        check_is_fitted(self, attributes=["model_"])

        return self.model_.get_feature_importance(*args, **kwargs)

    def get_params(self, deep: bool = True) -> dict[str, Any]:
        """
        Parámetros sklearn del adaptador.

        BaseEstimator ya proporciona esta funcionalidad, pero se mantiene
        explícita para dejar claro qué parámetros forman parte del modelo.
        """
        return {
            "iterations": self.iterations,
            "depth": self.depth,
            "learning_rate": self.learning_rate,
            "l2_leaf_reg": self.l2_leaf_reg,
            "random_strength": self.random_strength,
            "cat_features": self.cat_features,
        }

    def set_params(self, **params: Any) -> "CatBoostSklearnAdapter":
        """Actualiza parámetros siguiendo la convención sklearn."""
        valid_params = {
            "iterations",
            "depth",
            "learning_rate",
            "l2_leaf_reg",
            "random_strength",
            "cat_features",
        }

        unknown = set(params) - valid_params

        if unknown:
            raise ValueError(
                f"Parámetros desconocidos para CatBoostSklearnAdapter: "
                f"{sorted(unknown)}"
            )

        for key, value in params.items():
            setattr(self, key, value)

        return self


def create_model(n_classes: int = 2) -> CatBoostSklearnAdapter:
    """
    Crea el adaptador CatBoost.

    n_classes se conserva para compatibilidad con el contrato común.
    El número real de clases se determina durante fit().
    """
    del n_classes

    return CatBoostSklearnAdapter(
        iterations=200,
        depth=6,
        learning_rate=0.05,
        l2_leaf_reg=3.0,
        random_strength=1.0,
    )


def train_catboost(
    X_train: Any,
    y_train: Any,
    X_validation: Any,
    y_validation: Any,
    thresholds: dict[str, float],
    groups: Any | None = None,
) -> dict[str, Any]:
    """
    Entrena y evalúa CatBoost mediante el flujo común.

    La selección utiliza CV/VALIDATION.
    TEST permanece aislado hasta la evaluación final.
    """
    return train_algorithm(
        algorithm="CatBoost",
        estimator=create_model(),
        X_train=X_train,
        y_train=y_train,
        X_validation=X_validation,
        y_validation=y_validation,
        thresholds=thresholds,
        cv_folds=CV_FOLDS,
        random_state=RANDOM_STATE,
        groups=groups,
    )
