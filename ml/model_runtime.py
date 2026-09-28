from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Carga de modelos
# ---------------------------------------------------------------------------

def load_trained_model(
    path: str | Path,
) -> dict[str, Any]:
    """
    Carga un artefacto .joblib generado por model_publisher.py.

    El artefacto debe contener al menos:

        {
            "pipeline": ...
        }

    La validación se realiza antes de devolverlo para evitar errores
    posteriores y poco descriptivos durante inferencia.
    """
    model_path = Path(path)

    if not model_path.exists():
        raise FileNotFoundError(
            f"No existe el archivo de modelo: {model_path}"
        )

    if not model_path.is_file():
        raise ValueError(
            f"La ruta del modelo no es un archivo: {model_path}"
        )

    try:
        artifact = joblib.load(model_path)
    except Exception as exc:
        raise ValueError(
            f"No se pudo cargar el modelo: {model_path}"
        ) from exc

    if not isinstance(artifact, dict):
        raise ValueError(
            f"Archivo de modelo inválido: {model_path}. "
            "El artefacto debe ser un diccionario."
        )

    if "pipeline" not in artifact:
        raise ValueError(
            f"Archivo de modelo inválido: {model_path}. "
            "Falta la clave 'pipeline'."
        )

    if artifact["pipeline"] is None:
        raise ValueError(
            f"Archivo de modelo inválido: {model_path}. "
            "El pipeline es None."
        )

    return artifact


# ---------------------------------------------------------------------------
# Inferencia
# ---------------------------------------------------------------------------

def predict(
    path: str | Path,
    data: pd.DataFrame,
) -> dict[str, Any]:
    """
    Carga un modelo y ejecuta inferencia.

    Para múltiples predicciones sobre el mismo modelo, utilizar
    load_trained_model() una sola vez y llamar posteriormente a
    predict_loaded_model().
    """
    artifact = load_trained_model(path)

    return predict_loaded_model(
        artifact,
        data,
    )


def predict_loaded_model(
    artifact: dict[str, Any],
    data: pd.DataFrame,
) -> dict[str, Any]:
    """
    Ejecuta inferencia utilizando un artefacto ya cargado.

    Evita cargar el .joblib repetidamente cuando se realizan múltiples
    predicciones con el mismo modelo.
    """
    if not isinstance(artifact, dict):
        raise TypeError(
            "artifact debe ser un diccionario."
        )

    pipeline = artifact.get("pipeline")

    if pipeline is None:
        raise ValueError(
            "El artefacto no contiene un pipeline válido."
        )

    if data is None:
        raise ValueError(
            "data no puede ser None."
        )

    if not isinstance(data, pd.DataFrame):
        raise TypeError(
            "data debe ser un pandas.DataFrame."
        )

    if data.empty:
        raise ValueError(
            "No se puede ejecutar inferencia sobre un DataFrame vacío."
        )

    # -----------------------------------------------------------------------
    # Validación de columnas
    # -----------------------------------------------------------------------

    feature_columns = artifact.get(
        "featureColumns"
    )

    if feature_columns:
        required_columns = [
            str(column)
            for column in feature_columns
        ]

        missing_columns = [
            column
            for column in required_columns
            if column not in data.columns
        ]

        if missing_columns:
            raise ValueError(
                "Faltan columnas requeridas para la inferencia: "
                f"{missing_columns}"
            )

        X = data[
            required_columns
        ].copy()

    else:
        # Si el artefacto no registra featureColumns, se mantiene
        # compatibilidad utilizando directamente el DataFrame recibido.
        X = data.copy()

    # -----------------------------------------------------------------------
    # Predicción
    # -----------------------------------------------------------------------

    try:
        prediction = pipeline.predict(X)
    except Exception as exc:
        raise ValueError(
            "No se pudo ejecutar predict() con el modelo cargado."
        ) from exc

    result: dict[str, Any] = {
        "targetKey": artifact.get(
            "targetKey"
        ),
        "targetColumn": artifact.get(
            "targetColumn"
        ),
        "targetLabel": artifact.get(
            "targetLabel"
        ),
        "model": artifact.get(
            "selectedModel",
            artifact.get("model"),
        ),
        "prediction": np.asarray(
            prediction
        ).tolist(),
    }

    # -----------------------------------------------------------------------
    # Probabilidades
    # -----------------------------------------------------------------------

    if hasattr(
        pipeline,
        "predict_proba",
    ):
        try:
            probabilities = np.asarray(
                pipeline.predict_proba(X)
            )

            result["probabilities"] = (
                probabilities.tolist()
            )

        except Exception as exc:
            # La predicción de clase sigue siendo válida aunque
            # el modelo no pueda producir probabilidades.
            result["probabilities"] = None
            result["probabilityError"] = str(exc)

    else:
        result["probabilities"] = None

    # -----------------------------------------------------------------------
    # Clases
    # -----------------------------------------------------------------------

    classes = _get_pipeline_classes(
        pipeline
    )

    if classes is not None:
        result["classes"] = classes.tolist()

    # -----------------------------------------------------------------------
    # Metadatos útiles para el consumidor
    # -----------------------------------------------------------------------

    if "featureColumns" in artifact:
        result["featureColumns"] = list(
            artifact["featureColumns"]
        )

    if "probabilityOutput" in artifact:
        result["probabilityOutput"] = artifact[
            "probabilityOutput"
        ]

    if "trainedAt" in artifact:
        result["trainedAt"] = artifact[
            "trainedAt"
        ]

    if "randomState" in artifact:
        result["randomState"] = artifact[
            "randomState"
        ]

    return result


# ---------------------------------------------------------------------------
# Clases del modelo
# ---------------------------------------------------------------------------

def _get_pipeline_classes(
    pipeline: Any,
) -> np.ndarray | None:
    """
    Obtiene las clases aprendidas por el estimador final.

    La arquitectura actual utiliza el step `estimator`.
    Se conserva `model` como fallback para artefactos antiguos.

    No se asume que Pipeline exponga classes_ directamente en todas
    las versiones de scikit-learn.
    """
    estimator = pipeline

    if hasattr(
        pipeline,
        "named_steps",
    ):
        named_steps = pipeline.named_steps

        if "estimator" in named_steps:
            estimator = named_steps["estimator"]

        elif "model" in named_steps:
            estimator = named_steps["model"]

    classes = getattr(
        estimator,
        "classes_",
        None,
    )

    if classes is None:
        classes = getattr(
            pipeline,
            "classes_",
            None,
        )

    if classes is None:
        return None

    try:
        return np.asarray(classes)
    except Exception:
        return None
