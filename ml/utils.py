from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Optional, Sequence

import numpy as np
import pandas as pd


_NORMALIZE_PATTERN = re.compile(r"[^a-z0-9_]+")


def norm(value: Any) -> str:
    """
    Normaliza un valor para facilitar la comparación de nombres
    de columnas y aliases.

    Ejemplos:
        "Edad del Paciente" -> "edad_del_paciente"
        "Presión-Arterial" -> "presion_arterial"
        "Diabetes (Sí/No)" -> "diabetes_sino"
    """

    if value is None:
        return ""

    text = str(value).strip().lower()

    # Elimina diacríticos de forma general.
    text = unicodedata.normalize("NFKD", text)
    text = "".join(
        char
        for char in text
        if not unicodedata.combining(char)
    )

    # Normalización específica.
    text = text.replace("ñ", "n")
    text = text.replace(" ", "_")
    text = text.replace("-", "_")

    # Evita múltiples underscores consecutivos.
    text = re.sub(r"_+", "_", text)

    return _NORMALIZE_PATTERN.sub("", text).strip("_")


def resolve(
    columns: Iterable[str],
    aliases: Sequence[str],
) -> Optional[str]:
    """
    Devuelve el nombre original de una columna que coincida
    con alguno de los aliases normalizados.

    La comparación es case-insensitive y tolera diferencias
    de espacios, guiones y acentos.
    """

    normalized_columns = {
        norm(column): column
        for column in columns
    }

    for alias in aliases:
        normalized_alias = norm(alias)

        if normalized_alias in normalized_columns:
            return normalized_columns[normalized_alias]

    return None


def json_safe(value: Any) -> Any:
    """
    Convierte valores NumPy/Pandas y estructuras anidadas
    a tipos compatibles con JSON.

    Valores no finitos como NaN e infinito se convierten en None.
    """

    if value is None:
        return None

    if isinstance(value, (np.integer,)):
        return int(value)

    if isinstance(value, (np.floating,)):
        return (
            float(value)
            if np.isfinite(value)
            else None
        )

    if isinstance(value, float):
        return value if np.isfinite(value) else None

    if isinstance(value, (np.bool_,)):
        return bool(value)

    if isinstance(value, np.ndarray):
        return [
            json_safe(item)
            for item in value.tolist()
        ]

    if isinstance(value, Path):
        return str(value)

    if isinstance(value, dict):
        return {
            str(key): json_safe(item)
            for key, item in value.items()
        }

    if isinstance(value, (list, tuple, set)):
        return [
            json_safe(item)
            for item in value
        ]

    if isinstance(value, (pd.Timestamp, datetime)):
        if pd.isna(value):
            return None

        return value.isoformat()

    if value is pd.NA or value is pd.NaT:
        return None

    try:
        missing = pd.isna(value)

        if isinstance(missing, (bool, np.bool_)):
            return None if missing else value

    except (TypeError, ValueError):
        pass

    # Último intento: convertir tipos NumPy/Pandas
    # mediante el método estándar correspondiente.
    if hasattr(value, "item"):
        try:
            return json_safe(value.item())
        except (ValueError, TypeError):
            pass

    return value


def finite(value: Any) -> float:
    """
    Convierte un valor a float si es finito.

    Devuelve np.nan cuando el valor no puede convertirse
    o representa infinito/NaN.
    """

    try:
        result = float(value)
    except (TypeError, ValueError):
        return np.nan

    return result if np.isfinite(result) else np.nan


def utc_now() -> str:
    """Devuelve la fecha y hora actual en UTC en formato ISO-8601."""

    return datetime.now(timezone.utc).isoformat()


def risk_class(percent: float) -> str:
    """
    Clasifica un porcentaje de riesgo.

    Rangos:
        <20   -> Bajo
        <40   -> Leve
        <60   -> Moderado
        <80   -> Alto
        >=80  -> Inminente
    """

    value = finite(percent)

    if np.isnan(value):
        return "Desconocido"

    if value < 20:
        return "Bajo"

    if value < 40:
        return "Leve"

    if value < 60:
        return "Moderado"

    if value < 80:
        return "Alto"

    return "Inminente"


def excel_cell(value: Any) -> Any:
    """
    Convierte un valor a un tipo compatible con celdas de Excel.
    """

    if value is None:
        return None

    if isinstance(value, (np.floating, float)):
        return (
            float(value)
            if np.isfinite(value)
            else None
        )

    if isinstance(value, (np.integer,)):
        return int(value)

    if isinstance(value, (np.bool_,)):
        return bool(value)

    if isinstance(value, (dict, list, tuple, set)):
        return json.dumps(
            json_safe(value),
            ensure_ascii=False,
        )

    if isinstance(value, (pd.Timestamp, datetime)):
        return (
            None
            if pd.isna(value)
            else value.to_pydatetime()
            if isinstance(value, pd.Timestamp)
            else value
        )

    if value is pd.NA or value is pd.NaT:
        return None

    try:
        missing = pd.isna(value)

        if isinstance(missing, (bool, np.bool_)) and missing:
            return None

    except (TypeError, ValueError):
        pass

    return value
