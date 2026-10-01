from __future__ import annotations

import os
from pathlib import Path
from typing import Final


# ---------------------------------------------------------------------------
# Utilidades internas de configuración
# ---------------------------------------------------------------------------

def _env_int(name: str, default: int) -> int:
    """Obtiene una variable de entorno como entero."""
    raw = os.getenv(name, str(default)).strip()

    try:
        return int(raw)
    except ValueError as exc:
        raise ValueError(
            f"La variable de entorno {name!r} debe ser un entero; "
            f"valor recibido={raw!r}."
        ) from exc


def _env_float(name: str, default: float) -> float:
    """Obtiene una variable de entorno como float."""
    raw = os.getenv(name, str(default)).strip()

    try:
        return float(raw)
    except ValueError as exc:
        raise ValueError(
            f"La variable de entorno {name!r} debe ser numérica; "
            f"valor recibido={raw!r}."
        ) from exc


def _env_str(name: str, default: str) -> str:
    """Obtiene una variable de entorno como texto no vacío."""
    value = os.getenv(name, default).strip()

    if not value:
        raise ValueError(
            f"La variable de entorno {name!r} no puede estar vacía."
        )

    return value


# ---------------------------------------------------------------------------
# Reproducibilidad
# ---------------------------------------------------------------------------

RANDOM_STATE: Final[int] = _env_int(
    "ML_RANDOM_STATE",
    42,
)


# ---------------------------------------------------------------------------
# Particiones del dataset
# ---------------------------------------------------------------------------

TRAIN_SIZE: Final[float] = _env_float(
    "ML_TRAIN_SIZE",
    0.70,
)

VALIDATION_SIZE: Final[float] = _env_float(
    "ML_VALIDATION_SIZE",
    0.15,
)

TEST_SIZE: Final[float] = _env_float(
    "ML_TEST_SIZE",
    0.15,
)


# ---------------------------------------------------------------------------
# Validación cruzada
# ---------------------------------------------------------------------------

CV_FOLDS: Final[int] = _env_int(
    "CV_FOLDS",
    3,
)


# ---------------------------------------------------------------------------
# Rutas
# ---------------------------------------------------------------------------

# Las rutas son relativas al directorio desde el que se ejecuta el proyecto,
# salvo que se proporcione una ruta absoluta mediante variables de entorno.
#
# Ejemplo:
#
#   HARMONIZED_DATASET_PATH=/ruta/dataset.csv
#
#   AI_OUTPUT_DIR=/ruta/SavedModels

DEFAULT_DATASET: Final[str] = _env_str(
    "HARMONIZED_DATASET_PATH",
    "ml/datasets/dataset_final_armonizado.csv",
)

DEFAULT_OUTPUT_DIR: Final[str] = _env_str(
    "AI_OUTPUT_DIR",
    "ml/outputs/SavedModels",
)


# ---------------------------------------------------------------------------
# Umbrales mínimos de publicación
# ---------------------------------------------------------------------------

DEFAULT_THRESHOLDS: Final[dict[str, float]] = {
    "accuracy": 0.70,
    "f1": 0.70,
    "mcc": 0.40,
    "kappa": 0.40,
    "auc": 0.70,
}

def thresholds_for_target(
    target_key: str,
    base_thresholds: dict[str, float] | None = None,
) -> dict[str, float]:
    """Devuelve los cinco umbrales obligatorios, idénticos para todo target."""
    del target_key, base_thresholds
    return dict(DEFAULT_THRESHOLDS)


# ---------------------------------------------------------------------------
# Targets
# ---------------------------------------------------------------------------

TARGET_ALIASES: Final[dict[str, tuple[str, ...]]] = {
    "copd_gold": (
        "COPD GOLD(1 a 4) (Target)",
    ),
    "history_of_heart_failure": (
        "History of Heart Failure(Si ó no)(Target)",
    ),
    "bodex": (
        "BODEX (0 a 10 puntos) (Target)",
    ),
    "escala_disnea": (
        "ESCALA DISNEA (0 a 10 puntos) (Target)",
    ),
    "epocconfirmado": (
        "EPOCCONFIRMADO(Si ó no)(Target)",
        "EPOCCONFIRMADO(Si ó no) (Target)",
    ),
    "clasifisui": (
        "CLASIFISUI (1 a 5, clasificacion urgencias) (Target)",
    ),
}


TARGET_LABELS: Final[dict[str, str]] = {
    "copd_gold": "COPD GOLD (1–4)",
    "history_of_heart_failure": (
        "Antecedente de insuficiencia cardiaca"
    ),
    "bodex": "BODEX (0–10)",
    "escala_disnea": "Escala de disnea (0–10)",
    "epocconfirmado": "EPOC confirmado",
    "clasifisui": "Clasificación SUI (urgencias)",
}


# ---------------------------------------------------------------------------
# Columnas que nunca deben utilizarse como predictores
# ---------------------------------------------------------------------------

NON_FEATURE_EXACT: Final[frozenset[str]] = frozenset(
    {
        "patient_id",
        "paciente_id",
        "pacienteid",
        "id_paciente",
        "id",
        "unnamed_0",
        "tipo_muestra",
        "dataset_origen",
        "fecha",
        "date",
        "timestamp",
        "created_at",
        "updated_at",
    }
)


NON_FEATURE_CONTAINS: Final[tuple[str, ...]] = (
    "target",
    "label",
    "resultado",
    "outcome",
    "desenlace",
)


# ---------------------------------------------------------------------------
# Valores booleanos
# ---------------------------------------------------------------------------

TRUE_VALUES: Final[frozenset[str]] = frozenset(
    {
        "1",
        "true",
        "t",
        "yes",
        "y",
        "si",
        "sí",
        "s",
        "positivo",
        "positive",
        "presente",
        "con riesgo",
    }
)


FALSE_VALUES: Final[frozenset[str]] = frozenset(
    {
        "0",
        "false",
        "f",
        "no",
        "n",
        "negativo",
        "negative",
        "ausente",
        "sin riesgo",
    }
)


# ---------------------------------------------------------------------------
# Métricas
# ---------------------------------------------------------------------------

METRICS: Final[tuple[str, ...]] = (
    "accuracy",
    "f1",
    "mcc",
    "kappa",
    "auc",
    "balancedAccuracy",
    "precision",
    "recallSensitivity",
    "predictionLatencyMs",
    "responseTimeMsPerRecord",
    "predictionsPerSecond",
)


# ---------------------------------------------------------------------------
# Validación de configuración
# ---------------------------------------------------------------------------

def validate_config() -> None:
    """
    Valida la configuración global antes de iniciar un entrenamiento.

    Esta función debe ejecutarse desde el entry point antes de cargar
    el dataset o iniciar el entrenamiento de modelos.
    """

    if RANDOM_STATE < 0:
        raise ValueError(
            "RANDOM_STATE debe ser un entero >= 0; "
            f"valor actual={RANDOM_STATE}."
        )

    for name, value in (
        ("TRAIN_SIZE", TRAIN_SIZE),
        ("VALIDATION_SIZE", VALIDATION_SIZE),
        ("TEST_SIZE", TEST_SIZE),
    ):
        if not 0.0 < value < 1.0:
            raise ValueError(
                f"{name} debe estar estrictamente entre 0 y 1; "
                f"valor actual={value}."
            )

    split_total = (
        TRAIN_SIZE
        + VALIDATION_SIZE
        + TEST_SIZE
    )

    if not abs(split_total - 1.0) <= 1e-9:
        raise ValueError(
            "TRAIN_SIZE + VALIDATION_SIZE + TEST_SIZE "
            f"debe ser 1.0; valor actual={split_total:.10f}."
        )

    if CV_FOLDS < 2:
        raise ValueError(
            f"CV_FOLDS debe ser >= 2; valor actual={CV_FOLDS}."
        )

    for metric, threshold in DEFAULT_THRESHOLDS.items():
        if not 0.0 <= threshold <= 1.0:
            raise ValueError(
                f"El umbral de {metric} debe estar entre 0 y 1; "
                f"valor actual={threshold}."
            )

# ---------------------------------------------------------------------------
# Resolución de rutas
# ---------------------------------------------------------------------------

def resolve_dataset_path(
    path: str | os.PathLike[str],
) -> Path:
    """
    Resuelve una ruta de dataset de forma independiente del sistema operativo.

    No crea el archivo ni la carpeta. Únicamente expande '~' y convierte
    la ruta en absoluta.
    """
    resolved = Path(path).expanduser().resolve()

    return resolved


def resolve_output_dir(
    path: str | os.PathLike[str],
) -> Path:
    """
    Resuelve la carpeta de salida.

    No crea físicamente la carpeta; esa responsabilidad corresponde al
    componente que escribe los artefactos.
    """
    resolved = Path(path).expanduser().resolve()

    return resolved

