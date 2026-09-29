from __future__ import annotations

from typing import Any

from sklearn.linear_model import LogisticRegression

from .algorithm_common import train_algorithm
from .config import CV_FOLDS, RANDOM_STATE


def create_model(n_classes: int = 2) -> LogisticRegression:
    """
    Crea el clasificador de regresión logística.

    n_classes se conserva para mantener compatibilidad con el contrato
    común de los entrenadores. LogisticRegression determina las clases
    durante fit().
    """
    del n_classes

    return LogisticRegression(
        max_iter=3000,
        class_weight="balanced",
        solver="lbfgs",
        random_state=RANDOM_STATE,
    )


def train_logistic_regression(
    X_train: Any,
    y_train: Any,
    X_validation: Any,
    y_validation: Any,
    thresholds: dict[str, float],
    groups: Any | None = None,
) -> dict[str, Any]:
    """
    Entrena y evalúa Logistic Regression mediante el flujo común.

    La selección se realiza mediante CV/VALIDATION.
    TEST permanece completamente aislado hasta la evaluación final.
    """

    return train_algorithm(
        algorithm="LogisticRegression",
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

