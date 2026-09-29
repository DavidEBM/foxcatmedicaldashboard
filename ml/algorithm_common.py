from __future__ import annotations

import copy
import time
from typing import Any

import numpy as np

from . import model_common


def _hyperparameters(
    estimator: Any,
) -> dict[str, Any]:
    """
    Obtiene los hiperparámetros del estimador de forma segura.

    Los valores complejos se convierten a una representación serializable
    para poder incluirlos en manifests y resultados de entrenamiento.
    """
    try:
        params = estimator.get_params(
            deep=False,
        )
    except Exception:
        return {}

    result: dict[str, Any] = {}

    for key, value in params.items():
        try:
            if isinstance(
                value,
                (str, int, float, bool, type(None)),
            ):
                result[key] = value

            elif isinstance(
                value,
                (list, tuple),
            ):
                result[key] = [
                    item
                    if isinstance(
                        item,
                        (
                            str,
                            int,
                            float,
                            bool,
                            type(None),
                        ),
                    )
                    else repr(item)
                    for item in value
                ]

            else:
                result[key] = repr(value)

        except Exception:
            result[key] = repr(value)

    return result


def _clone_estimator(
    estimator: Any,
) -> Any:
    """
    Crea una copia independiente del estimador.

    Se utiliza durante la validación cruzada para evitar que los folds
    compartan estado o parámetros ajustados.
    """
    try:
        from sklearn.base import clone

        return clone(estimator)

    except Exception:
        return copy.deepcopy(estimator)


def _failure_result(
    *,
    algorithm: str,
    estimator: Any,
    error: Exception,
    cv_mean: float | None = None,
    cv_std: float | None = None,
    elapsed_seconds: float | None = None,
) -> dict[str, Any]:
    """
    Construye un resultado homogéneo cuando un candidato falla.

    TEST nunca se utiliza ni se registra en esta función.
    """
    return {
        "algorithm": algorithm,
        "model": algorithm,
        "available": False,
        "estimatorFactory": None,
        "cvMean": cv_mean,
        "cvStd": cv_std,
        "validation": {},
        "thresholdMet": False,
        "normalizedQuality": 0.0,
        "score": float("-inf"),
        "trainSeconds": elapsed_seconds,
        "validationSeconds": 0.0,
        "error": str(error),
        "hyperparameters": _hyperparameters(estimator),
        "cvDetails": [],
        "validationScore": None,
        "cvMeanScore": cv_mean,
        "cvStdScore": cv_std,
        "validationMetrics": {},
    }


def train_algorithm(
    *,
    algorithm: str,
    estimator: Any,
    X_train: Any,
    y_train: Any,
    X_validation: Any,
    y_validation: Any,
    thresholds: dict[str, float],
    cv_folds: int | None = None,
    random_state: int | None = None,
    groups: Any | None = None,
) -> dict[str, Any]:
    """
    Entrena y evalúa un algoritmo candidato.

    Flujo metodológico:

        TRAIN
          |
          +--> Cross-validation
          |
          +--> Entrenamiento final del candidato
                    |
                    v
              VALIDATION
                    |
                    v
              qualification
                    |
                    v
                 scoring

    TEST no participa en esta función.

    La evaluación final sobre TEST debe realizarse únicamente después
    de seleccionar el modelo candidato final.
    """

    # Los entrenadores conservan estos argumentos en su contrato público.
    # La implementación común toma los valores validados desde config.py.
    del cv_folds, random_state

    # ------------------------------------------------------------------
    # Validación de entradas
    # ------------------------------------------------------------------

    try:
        if X_train is None or y_train is None:
            raise ValueError(
                "X_train/y_train no pueden ser None."
            )

        if (
            X_validation is None
            or y_validation is None
        ):
            raise ValueError(
                "X_validation/y_validation no pueden ser None."
            )

        if len(X_train) == 0 or len(y_train) == 0:
            raise ValueError(
                "El conjunto TRAIN está vacío."
            )

        if (
            len(X_validation) == 0
            or len(y_validation) == 0
        ):
            raise ValueError(
                "El conjunto VALIDATION está vacío."
            )

        if len(X_train) != len(y_train):
            raise ValueError(
                "X_train e y_train tienen diferente número de filas."
            )

        if (
            len(X_validation)
            != len(y_validation)
        ):
            raise ValueError(
                "X_validation e y_validation tienen diferente número "
                "de filas."
            )

        unique_classes = np.unique(
            np.asarray(y_train),
        )

        if len(unique_classes) < 2:
            raise ValueError(
                "El target de TRAIN contiene una sola clase; "
                "no es posible entrenar un clasificador."
            )

    except Exception as exc:
        return _failure_result(
            algorithm=algorithm,
            estimator=estimator,
            error=exc,
        )

    # ------------------------------------------------------------------
    # Cross-validation sobre TRAIN
    # ------------------------------------------------------------------

    def estimator_factory(
        _fold_classes: int,
    ) -> Any:
        """
        Devuelve una instancia independiente del estimador.

        _fold_classes se conserva en la firma porque cross_validate()
        puede proporcionar el número de clases del fold a adaptadores
        especializados.
        """
        return _clone_estimator(
            estimator,
        )

    try:
        (
            cv_mean,
            cv_std,
            cv_details,
        ) = model_common.cross_validate(
            name=algorithm,
            estimator_factory=estimator_factory,
            X=X_train,
            y=y_train,
            groups=groups,
        )

        if not np.isfinite(cv_mean):
            cv_mean = None

        if not np.isfinite(cv_std):
            cv_std = None

    except Exception as exc:
        return _failure_result(
            algorithm=algorithm,
            estimator=estimator,
            error=exc,
        )

    # ------------------------------------------------------------------
    # Entrenamiento del candidato sobre TRAIN completo
    # ------------------------------------------------------------------

    try:
        pipeline = model_common.build_pipeline(
            X=X_train,
            name=algorithm,
            estimator=_clone_estimator(
                estimator,
            ),
        )

    except Exception as exc:
        return _failure_result(
            algorithm=algorithm,
            estimator=estimator,
            error=exc,
            cv_mean=cv_mean,
            cv_std=cv_std,
        )

    train_start = time.perf_counter()

    try:
        pipeline.fit(
            X_train,
            y_train,
        )

    except Exception as exc:
        elapsed = (
            time.perf_counter()
            - train_start
        )

        return _failure_result(
            algorithm=algorithm,
            estimator=estimator,
            error=exc,
            cv_mean=cv_mean,
            cv_std=cv_std,
            elapsed_seconds=elapsed,
        )

    train_seconds = (
        time.perf_counter()
        - train_start
    )

    # ------------------------------------------------------------------
    # Evaluación sobre VALIDATION
    # ------------------------------------------------------------------

    validation_start = time.perf_counter()

    try:
        validation_metrics = model_common.evaluate(
            pipeline,
            X_validation,
            y_validation,
        )

    except Exception as exc:
        validation_seconds = (
            time.perf_counter()
            - validation_start
        )

        result = _failure_result(
            algorithm=algorithm,
            estimator=estimator,
            error=exc,
            cv_mean=cv_mean,
            cv_std=cv_std,
            elapsed_seconds=train_seconds,
        )

        result["validationSeconds"] = (
            validation_seconds
        )
        result["cvDetails"] = cv_details

        return result

    validation_seconds = (
        time.perf_counter()
        - validation_start
    )

    # ------------------------------------------------------------------
    # Verificación de umbrales
    # ------------------------------------------------------------------

    try:
        threshold_met = model_common.qualifies(
            validation_metrics,
            thresholds,
        )

    except Exception as exc:
        result = _failure_result(
            algorithm=algorithm,
            estimator=estimator,
            error=exc,
            cv_mean=cv_mean,
            cv_std=cv_std,
            elapsed_seconds=train_seconds,
        )

        result["validation"] = (
            validation_metrics
        )
        result["validationSeconds"] = (
            validation_seconds
        )
        result["cvDetails"] = cv_details

        return result

    # ------------------------------------------------------------------
    # Métricas auxiliares para selección
    # ------------------------------------------------------------------

    try:
        quality = model_common.normalized_quality(
            validation_metrics,
        )

        if not np.isfinite(quality):
            quality = 0.0

    except Exception:
        quality = 0.0

    model_quality_threshold = thresholds.get("modelQuality")
    if model_quality_threshold is not None:
        try:
            threshold_met = bool(
                threshold_met
                and quality >= float(model_quality_threshold)
            )
        except (TypeError, ValueError, OverflowError):
            threshold_met = False

    try:
        composite_score = model_common.score(
            validation_metrics,
        )

    except Exception:
        composite_score = float("-inf")

    if not np.isfinite(
        composite_score,
    ):
        composite_score = float("-inf")

    # ------------------------------------------------------------------
    # Resultado del candidato
    # ------------------------------------------------------------------

    return {
        "algorithm": algorithm,
        "model": algorithm,
        "available": True,
        "estimatorFactory": (
            lambda _n_classes: _clone_estimator(estimator)
        ),
        "trainedPipeline": pipeline,
        "cvMean": cv_mean,
        "cvStd": cv_std,
        "validation": validation_metrics,
        "validationMetrics": validation_metrics,
        "thresholdMet": bool(threshold_met),
        "normalizedQuality": float(
            quality,
        ),
        "score": float(
            composite_score,
        ),
        "validationScore": float(composite_score),
        "cvMeanScore": cv_mean,
        "cvStdScore": cv_std,
        "trainSeconds": float(
            train_seconds,
        ),
        "validationSeconds": float(
            validation_seconds,
        ),
        "error": None,
        "hyperparameters": _hyperparameters(
            estimator,
        ),
        "cvDetails": cv_details,
    }


__all__ = [
    "train_algorithm",
]
