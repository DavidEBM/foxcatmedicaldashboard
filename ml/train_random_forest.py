from __future__ import annotations

from typing import Any

from sklearn.ensemble import RandomForestClassifier

from .algorithm_common import train_algorithm
from .config import CV_FOLDS, RANDOM_STATE


def create_model(n_classes: int = 2) -> RandomForestClassifier:
    """
    Crea el clasificador Random Forest.

    n_classes se conserva para mantener compatibilidad con el contrato
    común de los entrenadores. RandomForestClassifier determina las clases
    durante fit().
    """
    del n_classes

    return RandomForestClassifier(
        n_estimators=200,
        min_samples_leaf=2,
        class_weight="balanced",
        max_features="sqrt",
        bootstrap=True,
        n_jobs=-1,
        random_state=RANDOM_STATE,
    )


def train_random_forest(
    X_train: Any,
    y_train: Any,
    X_validation: Any,
    y_validation: Any,
    thresholds: dict[str, float],
    groups: Any | None = None,
) -> dict[str, Any]:
    """
    Entrena y evalúa Random Forest mediante el flujo común.

    La selección del modelo utiliza únicamente CV/VALIDATION.
    TEST permanece aislado hasta la evaluación final.
    """

    return train_algorithm(
        algorithm="RandomForest",
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
