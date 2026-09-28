from __future__ import annotations

from typing import Any

from sklearn.svm import SVC

from .algorithm_common import train_algorithm
from .config import CV_FOLDS, RANDOM_STATE


def create_model(n_classes: int = 2) -> SVC:
    """
    Crea el clasificador SVM utilizado por el pipeline.

    n_classes se mantiene en la firma para compatibilidad con el contrato
    común de los entrenadores. SVC determina automáticamente el número
    de clases durante fit().
    """
    del n_classes

    return SVC(
        C=1.0,
        kernel="rbf",
        gamma="scale",
        probability=True,
        class_weight="balanced",
        random_state=RANDOM_STATE,
        cache_size=512,
    )


def train_svm(
    X_train: Any,
    y_train: Any,
    X_validation: Any,
    y_validation: Any,
    thresholds: dict[str, float],
) -> dict[str, Any]:
    """
    Entrena y evalúa SVM utilizando el flujo común.

    La selección se realiza exclusivamente con TRAIN/CV y VALIDATION.
    El conjunto TEST no entra en esta función.
    """

    return train_algorithm(
        algorithm="SVM",
        estimator=create_model(),
        X_train=X_train,
        y_train=y_train,
        X_validation=X_validation,
        y_validation=y_validation,
        thresholds=thresholds,
        cv_folds=CV_FOLDS,
        random_state=RANDOM_STATE,
    )

