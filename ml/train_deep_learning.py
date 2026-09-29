from __future__ import annotations

from typing import Any

from sklearn.neural_network import MLPClassifier

from .algorithm_common import train_algorithm
from .config import CV_FOLDS, RANDOM_STATE


def create_model(n_classes: int = 2) -> MLPClassifier:
    """
    Crea el clasificador neuronal MLP.

    n_classes se conserva para compatibilidad con el contrato común de
    los entrenadores. MLPClassifier determina las clases durante fit().
    """
    del n_classes

    return MLPClassifier(
        hidden_layer_sizes=(128, 64, 32),
        activation="relu",
        solver="adam",
        alpha=1e-4,
        batch_size="auto",
        learning_rate="adaptive",
        learning_rate_init=1e-3,
        max_iter=300,
        early_stopping=False,
        random_state=RANDOM_STATE,
    )


def train_deep_learning(
    X_train: Any,
    y_train: Any,
    X_validation: Any,
    y_validation: Any,
    thresholds: dict[str, float],
    groups: Any | None = None,
) -> dict[str, Any]:
    """
    Entrena y evalúa el MLP mediante el flujo común.

    La selección utiliza CV/VALIDATION.
    TEST permanece aislado hasta la evaluación final.
    """
    return train_algorithm(
        algorithm="DeepLearningMLP",
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
