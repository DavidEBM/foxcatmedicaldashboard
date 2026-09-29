from __future__ import annotations

from .train_xgboost import train_xgboost
from .train_lightgbm import train_lightgbm
from .train_catboost import train_catboost
from .train_random_forest import train_random_forest
from .train_extra_trees import train_extra_trees
from .train_logistic_regression import train_logistic_regression
from .train_svm import train_svm
from .train_deep_learning import train_deep_learning


# ---------------------------------------------------------------------------
# Registry central de algoritmos
# ---------------------------------------------------------------------------
#
# Cada entrenador expone la misma interfaz pública y delega la lógica común
# de entrenamiento en algorithm_common.train_algorithm().
#
# La selección final del modelo no se realiza aquí.
# Este módulo únicamente define qué algoritmos participan en el benchmark.
#
# Orden de evaluación:
#
#   XGBoost
#   LightGBM
#   CatBoost
#   RandomForest
#   ExtraTrees
#   LogisticRegression
#   SVM
#   DeepLearningMLP
#
# El orden no representa una clasificación de rendimiento.
# ---------------------------------------------------------------------------

TRAINERS = (
    ("XGBoost", train_xgboost),
    ("LightGBM", train_lightgbm),
    ("CatBoost", train_catboost),
    ("RandomForest", train_random_forest),
    ("ExtraTrees", train_extra_trees),
    ("LogisticRegression", train_logistic_regression),
    ("SVM", train_svm),
    ("DeepLearningMLP", train_deep_learning),
)


def get_trainers(
    requested: list[str] | tuple[str, ...] | None = None,
) -> tuple[tuple[str, object], ...]:
    """Devuelve el registro de algoritmos solicitado de forma segura.

    El entrenamiento no acepta nombres arbitrarios desde la interfaz web:
    únicamente puede ejecutar algoritmos registrados aquí.
    """
    if not requested:
        return TRAINERS

    by_name = {
        name.casefold(): (name, trainer)
        for name, trainer in TRAINERS
    }
    selected: list[tuple[str, object]] = []
    seen: set[str] = set()

    for value in requested:
        key = str(value).strip().casefold()
        if not key:
            continue
        if key not in by_name:
            available = ", ".join(name for name, _ in TRAINERS)
            raise ValueError(
                f"Algoritmo no permitido: {value!r}. "
                f"Disponibles: {available}."
            )
        if key not in seen:
            selected.append(by_name[key])
            seen.add(key)

    if not selected:
        raise ValueError("Debe seleccionarse al menos un algoritmo.")

    return tuple(selected)


__all__ = [
    "TRAINERS",
    "get_trainers",
]
