from __future__ import annotations

from typing import Any

from sklearn.ensemble import ExtraTreesClassifier

from .algorithm_common import train_algorithm
from .config import CV_FOLDS, RANDOM_STATE


def create_model(n_classes: int = 2) -> ExtraTreesClassifier:
    """
    Crea el clasificador Extra Trees.

    n_classes se conserva para compatibilidad con el contrato común de
    los entrenadores. ExtraTreesClassifier determina las clases durante fit().
    """
    del n_classes

    return ExtraTreesClassifier(
        n_estimators=200,
        min_samples_leaf=2,
        max_features="sqrt",
        class_weight="balanced",
        bootstrap=False,
        n_jobs=-1,
        random_state=RANDOM_STATE,
    )


def train_extra_trees(
    X_train: Any,
    y_train: Any,
    X_validation: Any,
    y_validation: Any,
    thresholds: dict[str, float],
) -> dict[str, Any]:
    """
    Entrena y evalúa Extra Trees mediante el flujo común.

    La selección utiliza exclusivamente CV/VALIDATION.
    TEST permanece aislado hasta la evaluación final.
    """

    return train_algorithm(
        algorithm="ExtraTrees",
        estimator=create_model(),
        X_train=X_train,
        y_train=y_train,
        X_validation=X_validation,
        y_validation=y_validation,
        thresholds=thresholds,
        cv_folds=CV_FOLDS,
        random_state=RANDOM_STATE,
    )

