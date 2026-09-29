from __future__ import annotations

from typing import Any

from lightgbm import LGBMClassifier

from .algorithm_common import train_algorithm
from .config import CV_FOLDS, RANDOM_STATE


def create_model(n_classes: int = 2) -> LGBMClassifier:
    """
    Crea el clasificador LightGBM.

    n_classes se conserva para compatibilidad con el contrato común de
    los entrenadores. LightGBM determina las clases durante fit().
    """
    del n_classes

    return LGBMClassifier(
        n_estimators=200,
        learning_rate=0.05,
        num_leaves=31,
        max_depth=-1,
        min_child_samples=15,
        subsample=0.90,
        subsample_freq=1,
        colsample_bytree=0.90,
        reg_lambda=1.0,
        verbosity=-1,
        n_jobs=-1,
        random_state=RANDOM_STATE,
    )


def train_lightgbm(
    X_train: Any,
    y_train: Any,
    X_validation: Any,
    y_validation: Any,
    thresholds: dict[str, float],
    groups: Any | None = None,
) -> dict[str, Any]:
    """
    Entrena y evalúa LightGBM mediante el flujo común.

    La selección utiliza CV/VALIDATION.
    TEST permanece aislado hasta la evaluación final.
    """

    return train_algorithm(
        algorithm="LightGBM",
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
