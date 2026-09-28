from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .config import (
    CV_FOLDS,
    DEFAULT_DATASET,
    DEFAULT_OUTPUT_DIR,
    TARGET_ALIASES,
    TARGET_LABELS,
)
from .utils import norm


# ============================================================================
# DEFINICIÓN DE TARGETS
# ============================================================================

# Dominio teórico utilizado para auditar la cobertura del dataset.
#
# IMPORTANTE:
# - El dominio NO crea clases artificiales.
# - La ausencia de una clase se reporta.
# - La cobertura incompleta impide considerar un target ordinal completo
#   como ENTRENABLE bajo el criterio metodológico actual.
#
# EPOCCONFIRMADO se mantiene sin dominio aquí porque el dataset actual no
# proporciona una base suficiente para asumir que su escala SI/NO está
# correctamente representada. El target se detecta, pero se audita como
# target sin dominio configurado.

TARGET_DOMAINS: dict[str, dict[str, Any]] = {
    "copd_gold": {
        "type": "ordinal",
        "min": 1,
        "max": 4,
        "expected_values": [1, 2, 3, 4],
        "label": "COPD GOLD (1-4)",
    },
    "history_of_heart_failure": {
        "type": "binary",
        "expected_values": ["SI", "NO"],
        "label": "History of Heart Failure (Si/No)",
    },
    "bodex": {
        "type": "ordinal",
        "min": 0,
        "max": 10,
        "expected_values": list(range(0, 11)),
        "label": "BODEX (0-10)",
    },
    "escala_disnea": {
        "type": "ordinal",
        "min": 0,
        "max": 10,
        "expected_values": list(range(0, 11)),
        "label": "Escala de disnea (0-10)",
    },
    "clasifisui": {
        "type": "ordinal",
        "min": 1,
        "max": 5,
        "expected_values": [1, 2, 3, 4, 5],
        "label": "Clasificación SUI (1-5)",
    },
}


# ============================================================================
# VALORES FALTANTES
# ============================================================================

MISSING_TOKENS: frozenset[str] = frozenset(
    {
        "",
        "na",
        "n/a",
        "nan",
        "none",
        "null",
        "missing",
        "s/d",
        "sd",
        "no disponible",
        "no_data",
        "sin dato",
        "n.a.",
        "n.a",
        "-",
    }
)


# ============================================================================
# UMBRALES METODOLÓGICOS
# ============================================================================

# Mínimo de observaciones por clase para considerar que existe una
# representación mínima para particiones estratificadas.
MIN_SAMPLES_PER_CLASS = 5

# Mínimo global de observaciones válidas para intentar
# train/validation/test.
MIN_VALID_ROWS = 30

# Cobertura mínima del dominio teórico requerida para marcar
# un target con dominio como ENTRENABLE.
MIN_DOMAIN_COVERAGE_FOR_TRAINING = 1.0


# ============================================================================
# UTILIDADES
# ============================================================================

def _normalize_text(value: Any) -> str:
    """Normaliza texto para comparaciones robustas."""
    if value is None:
        return ""

    try:
        if pd.isna(value):
            return ""
    except (TypeError, ValueError):
        pass

    text = str(value).strip().lower()

    replacements = {
        "á": "a",
        "é": "e",
        "í": "i",
        "ó": "o",
        "ú": "u",
        "ü": "u",
        "ñ": "n",
    }

    for source, target in replacements.items():
        text = text.replace(source, target)

    return re.sub(
        r"\s+",
        " ",
        text,
    )


def _is_missing(value: Any) -> bool:
    """Determina si un valor representa ausencia de dato."""
    if value is None:
        return True

    try:
        missing = pd.isna(value)

        if isinstance(
            missing,
            (bool, np.bool_),
        ) and bool(missing):
            return True
    except (TypeError, ValueError):
        pass

    return (
        _normalize_text(value)
        in MISSING_TOKENS
    )


def _canonical_target_key(
    column: str,
) -> str | None:
    """
    Resolve a dataframe column to the canonical target key.

    Comparisons are normalized so that differences in accents, case and
    surrounding whitespace do not prevent target detection.
    """
    normalized_column = norm(column)

    for key, aliases in TARGET_ALIASES.items():
        if normalized_column == norm(key):
            return key

        for alias in aliases:
            if normalized_column == norm(alias):
                return key

    return None


def _detect_targets(
    df: pd.DataFrame,
) -> dict[str, str]:
    """Detect configured target columns."""
    targets: dict[str, str] = {}

    for column in df.columns:
        column_name = str(column)

        key = _canonical_target_key(
            column_name
        )

        if key is None:
            continue

        if key in targets:
            raise ValueError(
                "Se detectaron múltiples columnas para el mismo target "
                f"{key!r}: "
                f"{targets[key]!r} y {column_name!r}."
            )

        targets[key] = column_name

    return targets


def _safe_numeric(
    value: Any,
) -> float | None:
    """Convert a scalar to a finite float when possible."""
    if _is_missing(value):
        return None

    if isinstance(value, bool):
        return float(int(value))

    text = (
        str(value)
        .strip()
        .replace(",", ".")
    )

    try:
        number = float(text)
    except (TypeError, ValueError):
        return None

    if not np.isfinite(number):
        return None

    return number


def _normalize_binary_value(
    value: Any,
) -> str | None:
    """
    Normalize binary values to SI/NO.

    Unrecognized values return None and are NOT silently interpreted
    as either class.
    """
    if _is_missing(value):
        return None

    text = _normalize_text(value)

    true_values = {
        "si",
        "s",
        "yes",
        "y",
        "true",
        "1",
        "positivo",
        "positive",
        "presente",
        "con riesgo",
    }

    false_values = {
        "no",
        "n",
        "false",
        "0",
        "negativo",
        "negative",
        "ausente",
        "sin riesgo",
    }

    if text in true_values:
        return "SI"

    if text in false_values:
        return "NO"

    return None


def _normalize_ordinal_value(
    value: Any,
) -> int | float | None:
    """
    Normalize ordinal numeric values.

    Textual ranges such as '1-3' are deliberately not converted to an
    arbitrary class.
    """
    number = _safe_numeric(value)

    if number is None:
        return None

    if np.isclose(
        number,
        round(number),
    ):
        return int(round(number))

    return number


def _target_normalized_value(
    value: Any,
    target_type: str,
) -> int | float | str | None:
    """Normalize one target value according to its configured type."""
    if target_type == "binary":
        return _normalize_binary_value(value)

    if target_type == "ordinal":
        return _normalize_ordinal_value(value)

    return None


def _target_normalized_values(
    series: pd.Series,
    target_type: str,
) -> list[Any]:
    """Return only successfully normalized target values."""
    values: list[Any] = []

    for value in series:
        normalized = _target_normalized_value(
            value,
            target_type,
        )

        if normalized is not None:
            values.append(normalized)

    return values


def _class_counts(
    values: list[Any],
) -> dict[str, int]:
    """Return deterministic class counts."""
    counts = Counter(
        str(value)
        for value in values
    )

    return dict(
        sorted(
            counts.items(),
            key=lambda item: (
                -item[1],
                item[0],
            ),
        )
    )


def _numeric_summary(
    series: pd.Series,
) -> dict[str, Any]:
    """Return basic numeric statistics."""
    numeric = pd.to_numeric(
        series,
        errors="coerce",
    ).dropna()

    if numeric.empty:
        return {
            "numericCount": 0,
            "min": None,
            "max": None,
            "mean": None,
            "median": None,
            "std": None,
        }

    return {
        "numericCount": int(
            len(numeric)
        ),
        "min": float(
            numeric.min()
        ),
        "max": float(
            numeric.max()
        ),
        "mean": float(
            numeric.mean()
        ),
        "median": float(
            numeric.median()
        ),
        "std": (
            float(
                numeric.std(
                    ddof=1
                )
            )
            if len(numeric) > 1
            else 0.0
        ),
    }


def _contains_range_values(
    series: pd.Series,
) -> bool:
    """Detect textual interval representations."""
    pattern = re.compile(
        r"^\s*"
        r"\d+(?:[.,]\d+)?"
        r"\s*[-–]"
        r"\s*"
        r"\d+(?:[.,]\d+)?"
        r"\s*%?"
        r"\s*$"
    )

    for value in series:
        if pattern.match(
            str(value).strip()
        ):
            return True

    return False


def _infer_column_type(
    series: pd.Series,
) -> str:
    """Infer a basic column type for audit purposes."""
    non_missing = series.loc[
        ~series.map(_is_missing)
    ]

    if non_missing.empty:
        return "empty"

    numeric = pd.to_numeric(
        non_missing,
        errors="coerce",
    )

    if (
        numeric.notna().mean()
        >= 0.95
    ):
        return "numeric"

    if _contains_range_values(
        non_missing
    ):
        return "range_or_interval"

    unique_count = int(
        non_missing.astype(str).nunique()
    )

    if unique_count <= 20:
        return "categorical_low_cardinality"

    return "categorical_or_text"


# ============================================================================
# DOMINIO DE TARGETS
# ============================================================================

def _expected_values(
    key: str,
) -> list[Any]:
    """Return expected values for a configured target."""
    definition = TARGET_DOMAINS.get(key)

    if not definition:
        return []

    return list(
        definition.get(
            "expected_values",
            [],
        )
    )


def _display_value(
    value: Any,
) -> str:
    return str(value)


def _value_key(
    value: Any,
) -> str:
    """
    Build a stable comparison key for domain values.

    Rules:
    - Numeric integer-like values are represented without decimals.
    - Other finite numeric values use their normalized string form.
    - Text values are normalized case-insensitively and without accents.
    - Missing values return an empty key.
    """
    if value is None:
        return ""

    try:
        if pd.isna(value):
            return ""
    except (TypeError, ValueError):
        pass

    if isinstance(
        value,
        (bool, np.bool_),
    ):
        return "1" if bool(value) else "0"

    if isinstance(
        value,
        (int, float, np.integer, np.floating),
    ):
        number = float(value)

        if not np.isfinite(number):
            return ""

        if np.isclose(
            number,
            round(number),
        ):
            return str(
                int(round(number))
            )

        return str(number)

    text = str(value).strip()

    if not text:
        return ""

    return _normalize_text(text)
