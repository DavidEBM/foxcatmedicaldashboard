from __future__ import annotations

import re
from typing import Any, Optional, cast

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Utilidades de conversión
# ---------------------------------------------------------------------------

def _is_missing(value: Any) -> bool:
    """Return True only when a scalar value is missing."""
    if value is None:
        return True

    result = pd.isna(cast(Any, value))

    if isinstance(result, (bool, np.bool_)):
        return bool(result)

    return False


def _to_float(value: Any) -> Optional[float]:
    """Convert a scalar value to finite float when possible."""
    if _is_missing(value):
        return None

    if isinstance(value, str):
        text = value.strip()

        if not text:
            return None

        text = text.replace(",", ".")

        try:
            number = float(text)
        except ValueError:
            return None
    else:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None

    if not np.isfinite(number):
        return None

    return number


# ---------------------------------------------------------------------------
# Porcentajes
# ---------------------------------------------------------------------------

def _parse_percentage(value: Any) -> Optional[float]:
    """
    Parse a percentage value.

    Only values explicitly containing %, percent or porcentaje are treated
    as percentages. This avoids interpreting values such as 1.96 as 1.96%.
    """
    if _is_missing(value):
        return None

    if not isinstance(value, str):
        return None

    text = value.strip().lower()

    if not text:
        return None

    has_percentage_marker = (
        "%"
        in text
        or "percent" in text
        or "porcentaje" in text
    )

    if not has_percentage_marker:
        return None

    cleaned = (
        text.replace("%", "")
        .replace("percent", "")
        .replace("porcentaje", "")
        .strip()
        .replace(",", ".")
    )

    return _to_float(cleaned)


def _parse_fev1_percent(value: Any) -> Optional[float]:
    """
    Parse FEV1 percentage representations such as:

    - 30-49%
    - 50-79%
    - >80%
    - >=80%
    - 65%
    """
    if _is_missing(value):
        return None

    if not isinstance(value, str):
        return None

    text = value.strip().lower()

    if not text:
        return None

    if (
        "%"
        not in text
        and "percent" not in text
        and "porcentaje" not in text
    ):
        return None

    text = (
        text.replace("%", "")
        .replace("percent", "")
        .replace("porcentaje", "")
        .strip()
    )

    # Intervalo: 30-49%
    if "-" in text:
        parts = text.split("-")

        if len(parts) == 2:
            first = _to_float(parts[0])
            second = _to_float(parts[1])

            if (
                first is not None
                and second is not None
                and 0.0 <= first <= 150.0
                and 0.0 <= second <= 150.0
            ):
                return (first + second) / 2.0

    # Valores con desigualdad: >80%, >=80%, <50%, <=50%
    for prefix in (">=", "<=", ">", "<"):
        if text.startswith(prefix):
            number = _to_float(
                text[len(prefix):]
            )

            if (
                number is not None
                and 0.0 <= number <= 150.0
            ):
                return number

    number = _to_float(text)

    if (
        number is not None
        and 0.0 <= number <= 150.0
    ):
        return number

    return None


# ---------------------------------------------------------------------------
# Series numéricas
# ---------------------------------------------------------------------------

def _numeric_series(
    df: pd.DataFrame,
    column: str,
) -> Optional[pd.Series]:
    """Return a numeric Series if the requested column exists."""
    if column not in df.columns:
        return None

    return pd.to_numeric(
        df[column],
        errors="coerce",
    )


# ---------------------------------------------------------------------------
# BMI
# ---------------------------------------------------------------------------

def _parse_bmi_text(value: Any) -> Optional[float]:
    """
    Parse BMI strings such as:

    - '<21 kg/m2'
    - '>30 kg/m2'
    - '25.4'
    """
    if _is_missing(value):
        return None

    if not isinstance(value, str):
        return _to_float(value)

    text = value.strip().lower()

    if not text:
        return None

    match = re.search(
        r"(\d+(?:[.,]\d+)?)",
        text,
    )

    if not match:
        return None

    number = _to_float(
        match.group(1)
    )

    if number is None:
        return None

    # Para intervalos abiertos se utiliza una aproximación conservadora.
    if "<" in text:
        return number - 0.5

    if ">" in text:
        return number + 0.5

    return number


def _derive_bmi(df: pd.DataFrame) -> pd.Series:
    """
    Derive BMI from:

    1. Numeric BMI column.
    2. Text BMI representations.
    3. Weight and height.

    Original BMI values have priority over calculated BMI.
    """
    result = pd.Series(
        np.nan,
        index=df.index,
        dtype=float,
    )

    bmi_column = "BMI,kg/m2 (IMC)"

    if bmi_column in df.columns:
        numeric_bmi = pd.to_numeric(
            df[bmi_column],
            errors="coerce",
        )

        # BMI fisiológicamente no válido se descarta.
        valid_numeric_bmi = numeric_bmi.between(
            5.0,
            100.0,
        )

        result.loc[
            valid_numeric_bmi
        ] = numeric_bmi.loc[
            valid_numeric_bmi
        ]

        unresolved = result.isna()

        if unresolved.any():
            parsed = df.loc[
                unresolved,
                bmi_column,
            ].map(_parse_bmi_text)

            parsed_numeric = pd.to_numeric(
                parsed,
                errors="coerce",
            )

            valid_parsed = parsed_numeric.between(
                5.0,
                100.0,
            )

            result.loc[
                unresolved & valid_parsed.reindex(
                    result.index,
                    fill_value=False,
                )
            ] = parsed_numeric.loc[
                valid_parsed
            ]

    weight = _numeric_series(
        df,
        "PESO",
    )

    height = _numeric_series(
        df,
        "TALLA(altura ó Height/m)",
    )

    if weight is not None and height is not None:
        valid_weight = weight > 0
        valid_height = height > 0

        height_m = height.copy()

        # Valores > 3 se interpretan como centímetros.
        cm_mask = valid_height & (height_m > 3)

        height_m.loc[cm_mask] = (
            height_m.loc[cm_mask] / 100.0
        )

        valid_height_m = height_m.between(
            0.5,
            2.8,
        )

        valid = (
            valid_weight
            & valid_height_m
        )

        derived = pd.Series(
            np.nan,
            index=df.index,
            dtype=float,
        )

        derived.loc[valid] = (
            weight.loc[valid]
            / (
                height_m.loc[valid] ** 2
            )
        )

        derived = derived.where(
            derived.between(
                5.0,
                100.0,
            ),
            np.nan,
        )

        unresolved = result.isna()

        result.loc[
            unresolved
        ] = derived.loc[
            unresolved
        ]

    return result.astype(float)


# ---------------------------------------------------------------------------
# FEV1
# ---------------------------------------------------------------------------

def _derive_fev1_percent(
    df: pd.DataFrame,
) -> pd.Series:
    """
    Derive a normalized FEV1 percentage feature.

    Priority:

    1. Explicit percentage in FEV1PRED.
    2. Numeric FEV1PRED values in the plausible 0–150 range.
    3. Explicit percentage representation in FEV1.
    """
    result = pd.Series(
        np.nan,
        index=df.index,
        dtype=float,
    )

    if "FEV1PRED" in df.columns:
        parsed = df["FEV1PRED"].map(
            _parse_percentage
        )

        parsed_numeric = pd.to_numeric(
            parsed,
            errors="coerce",
        )

        parsed_numeric = parsed_numeric.where(
            parsed_numeric.between(
                0.0,
                150.0,
            ),
            np.nan,
        )

        result.loc[:] = parsed_numeric

        numeric = pd.to_numeric(
            df["FEV1PRED"],
            errors="coerce",
        )

        unresolved = result.isna()

        plausible = numeric.between(
            0.0,
            150.0,
        )

        result.loc[
            unresolved & plausible
        ] = numeric.loc[
            unresolved & plausible
        ]

    if "FEV1" in df.columns:
        parsed_fev1 = df["FEV1"].map(
            _parse_fev1_percent
        )

        parsed_fev1_numeric = pd.to_numeric(
            parsed_fev1,
            errors="coerce",
        )

        parsed_fev1_numeric = parsed_fev1_numeric.where(
            parsed_fev1_numeric.between(
                0.0,
                150.0,
            ),
            np.nan,
        )

        unresolved = result.isna()

        result.loc[
            unresolved
        ] = parsed_fev1_numeric.loc[
            unresolved
        ]

    return result.astype(float)


def _derive_fev1_fvc_ratio(
    df: pd.DataFrame,
) -> pd.Series:
    """
    Calculate FEV1/FVC only when both measurements are numeric and valid.

    Values outside the interval [0, 1.5] are discarded as likely data-quality
    or unit errors.
    """
    result = pd.Series(
        np.nan,
        index=df.index,
        dtype=float,
    )

    fev1 = _numeric_series(
        df,
        "FEV1",
    )

    fvc = _numeric_series(
        df,
        "FVC",
    )

    if fev1 is None or fvc is None:
        return result

    valid = (
        (fev1 > 0)
        & (fvc > 0)
    )

    ratio = pd.Series(
        np.nan,
        index=df.index,
        dtype=float,
    )

    ratio.loc[valid] = (
        fev1.loc[valid]
        / fvc.loc[valid]
    )

    valid_ratio = ratio.between(
        0.0,
        1.5,
    )

    result.loc[
        valid_ratio
    ] = ratio.loc[
        valid_ratio
    ]

    return result.astype(float)


# ---------------------------------------------------------------------------
# Oxigenación
# ---------------------------------------------------------------------------

def _derive_oxygen_deficit(
    df: pd.DataFrame,
) -> pd.Series:
    """Calculate oxygen saturation deficit as 100 - SpO2."""
    result = pd.Series(
        np.nan,
        index=df.index,
        dtype=float,
    )

    saturation = _numeric_series(
        df,
        "Oxygen Saturation",
    )

    if saturation is None:
        return result

    valid = saturation.between(
        0.0,
        100.0,
    )

    result.loc[valid] = (
        100.0
        - saturation.loc[valid]
    )

    return result.astype(float)


# ---------------------------------------------------------------------------
# Variables clínicas simples
# ---------------------------------------------------------------------------

def _derive_altitude(
    df: pd.DataFrame,
) -> pd.Series:
    """Return altitude above mean sea level."""
    result = pd.Series(
        np.nan,
        index=df.index,
        dtype=float,
    )

    altitude = _numeric_series(
        df,
        "Altura_MSNM",
    )

    if altitude is not None:
        result = altitude.astype(float)

    return result


def _derive_walk_test(
    df: pd.DataFrame,
) -> pd.Series:
    """
    Derive the best available six-minute walk distance.

    Priority:
    MWT1Best -> MWT2 -> MWT1
    """
    result = pd.Series(
        np.nan,
        index=df.index,
        dtype=float,
    )

    for column in (
        "MWT1Best",
        "MWT2",
        "MWT1",
    ):
        values = _numeric_series(
            df,
            column,
        )

        if values is None:
            continue

        unresolved = result.isna()

        result.loc[
            unresolved
        ] = values.loc[
            unresolved
        ]

    return result.astype(float)


def _derive_pack_history(
    df: pd.DataFrame,
) -> pd.Series:
    """Return pack-year history when available."""
    result = pd.Series(
        np.nan,
        index=df.index,
        dtype=float,
    )

    values = _numeric_series(
        df,
        "PackHistory",
    )

    if values is not None:
        result = values.astype(float)

    return result


def _derive_respiratory_rate(
    df: pd.DataFrame,
) -> pd.Series:
    """Return respiratory rate."""
    result = pd.Series(
        np.nan,
        index=df.index,
        dtype=float,
    )

    values = _numeric_series(
        df,
        "Respiratory Rate",
    )

    if values is not None:
        result = values.astype(float)

    return result


def _derive_heart_rate(
    df: pd.DataFrame,
) -> pd.Series:
    """Return heart rate."""
    result = pd.Series(
        np.nan,
        index=df.index,
        dtype=float,
    )

    values = _numeric_series(
        df,
        "Heart Rate",
    )

    if values is not None:
        result = values.astype(float)

    return result


# ---------------------------------------------------------------------------
# Presión arterial
# ---------------------------------------------------------------------------

def _parse_blood_pressure(
    value: Any,
) -> Optional[float]:
    """
    Parse blood pressure represented as systolic/diastolic.

    Example:
        120/80 -> 93.33 mmHg

    Returns mean arterial pressure (MAP).
    """
    if _is_missing(value):
        return None

    text = str(value).strip()

    if not text:
        return None

    match = re.search(
        r"(\d+(?:[.,]\d+)?)\s*/\s*(\d+(?:[.,]\d+)?)",
        text,
    )

    if not match:
        return None

    systolic = _to_float(
        match.group(1)
    )

    diastolic = _to_float(
        match.group(2)
    )

    if (
        systolic is None
        or diastolic is None
    ):
        return None

    # Basic physiological/data-quality validation.
    if not (
        50.0 <= systolic <= 300.0
        and 20.0 <= diastolic <= 200.0
        and systolic >= diastolic
    ):
        return None

    return (
        systolic
        + 2.0 * diastolic
    ) / 3.0


def _derive_map(
    df: pd.DataFrame,
) -> pd.Series:
    """
    Derive mean arterial pressure from a Blood pressure column.

    Expected representation:
        systolic/diastolic

    Example:
        120/80 -> approximately 93.3 mmHg

    Numeric values without a pressure pair are not interpreted as MAP because
    the source column is explicitly named 'Blood pressure'.
    """
    result = pd.Series(
        np.nan,
        index=df.index,
        dtype=float,
    )

    if "Blood pressure" not in df.columns:
        return result

    parsed = df["Blood pressure"].map(
        _parse_blood_pressure
    )

    parsed_numeric = pd.to_numeric(
        parsed,
        errors="coerce",
    )

    result.loc[:] = parsed_numeric

    return result.astype(float)


# ---------------------------------------------------------------------------
# Derivación principal
# ---------------------------------------------------------------------------

def derive_clinical_features(
    df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Add derived clinical features without modifying the original columns.

    The original dataframe is copied before adding any derived variables.
    Existing source columns are therefore preserved unchanged.
    """
    if not isinstance(df, pd.DataFrame):
        raise TypeError(
            "df debe ser un pandas.DataFrame."
        )

    result = df.copy()

    result["CLIN_BMI_DERIVED"] = (
        _derive_bmi(result)
    )

    result["CLIN_FEV1_PERCENT"] = (
        _derive_fev1_percent(result)
    )

    result["CLIN_FEV1_FVC_RATIO"] = (
        _derive_fev1_fvc_ratio(result)
    )

    result["CLIN_O2_SATURATION_DEFICIT"] = (
        _derive_oxygen_deficit(result)
    )

    result["CLIN_ALTITUDE_MSNM"] = (
        _derive_altitude(result)
    )

    result["CLIN_WALK_TEST_BEST"] = (
        _derive_walk_test(result)
    )

    result["CLIN_PACK_HISTORY"] = (
        _derive_pack_history(result)
    )

    result["CLIN_RESPIRATORY_RATE"] = (
        _derive_respiratory_rate(result)
    )

    result["CLIN_HEART_RATE"] = (
        _derive_heart_rate(result)
    )

    result["CLIN_MAP"] = (
        _derive_map(result)
    )

    return result


def add_clinical_features(
    df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Backward-compatible alias used by data_preparation.py.
    """
    return derive_clinical_features(df)


def get_clinical_feature_names() -> list[str]:
    """Return the names of all derived clinical features."""
    return [
        "CLIN_BMI_DERIVED",
        "CLIN_FEV1_PERCENT",
        "CLIN_FEV1_FVC_RATIO",
        "CLIN_O2_SATURATION_DEFICIT",
        "CLIN_ALTITUDE_MSNM",
        "CLIN_WALK_TEST_BEST",
        "CLIN_PACK_HISTORY",
        "CLIN_RESPIRATORY_RATE",
        "CLIN_HEART_RATE",
        "CLIN_MAP",
    ]


__all__ = [
    "add_clinical_features",
    "derive_clinical_features",
    "get_clinical_feature_names",
]

