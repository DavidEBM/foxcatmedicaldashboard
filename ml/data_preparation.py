from __future__ import annotations

import math
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from .clinical_features import add_clinical_features
from .config import (
    FALSE_VALUES,
    NON_FEATURE_EXACT,
    RANDOM_STATE,
    TARGET_ALIASES,
    TEST_SIZE,
    TRAIN_SIZE,
    TRUE_VALUES,
    VALIDATION_SIZE,
)
from .target_features import select_target_features
from .utils import norm, resolve


# =============================================================================
# Configuración de dominios teóricos de los targets
# =============================================================================

TARGET_DOMAINS: Dict[str, Dict[str, Any]] = {
    "copd_gold": {
        "type": "ordinal",
        "expected_values": [1, 2, 3, 4],
        "label": "COPD GOLD (1–4)",
    },
    "history_of_heart_failure": {
        "type": "binary",
        "expected_values": ["SI", "NO"],
        "label": "Antecedente de insuficiencia cardiaca",
    },
    "bodex": {
        "type": "ordinal",
        "expected_values": list(range(0, 11)),
        "label": "BODEX (0–10)",
    },
    "escala_disnea": {
        "type": "ordinal",
        "expected_values": list(range(0, 11)),
        "label": "Escala de disnea (0–10)",
    },
    "clasifisui": {
        "type": "ordinal",
        "expected_values": [1, 2, 3, 4, 5],
        "label": "Clasificación SUI (urgencias)",
    },
}


MIN_SAMPLES_PER_CLASS = 5
MIN_VALID_ROWS = 30

# Mantiene la política actual del proyecto:
# para considerar un target formalmente entrenable, debe cubrir
# completamente su dominio teórico.
MIN_DOMAIN_COVERAGE_FOR_TRAINING = 1.0


# =============================================================================
# Carga del dataset
# =============================================================================

SUPPORTED_EXTENSIONS = {
    ".csv",
    ".xlsx",
    ".xls",
    ".parquet",
}


def load_dataset(path: str | Path) -> pd.DataFrame:
    """
    Carga el dataset desde CSV, Excel o Parquet.
    """
    dataset_path = Path(path)

    if not dataset_path.exists():
        raise FileNotFoundError(
            f"No existe el dataset: {dataset_path.resolve()}"
        )

    if not dataset_path.is_file():
        raise ValueError(
            f"La ruta del dataset no es un archivo: {dataset_path}"
        )

    suffix = dataset_path.suffix.lower()

    if suffix not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            "Formato no soportado. Usa CSV, XLSX/XLS o Parquet."
        )

    if suffix == ".csv":
        df = pd.read_csv(dataset_path)

    elif suffix in {".xlsx", ".xls"}:
        df = pd.read_excel(dataset_path)

    elif suffix == ".parquet":
        df = pd.read_parquet(dataset_path)

    else:
        raise ValueError(
            f"Extensión no soportada: {suffix}"
        )

    if df.empty:
        raise ValueError(
            "El dataset está vacío."
        )

    if df.columns.duplicated().any():
        duplicated = df.columns[
            df.columns.duplicated()
        ].tolist()

        raise ValueError(
            f"Columnas duplicadas: {duplicated}"
        )

    df = df.replace(
        [np.inf, -np.inf],
        np.nan,
    )

    return df


# =============================================================================
# Utilidades de normalización
# =============================================================================

def _normalize_text(value: Any) -> str:
    """
    Normaliza texto para comparaciones categóricas.

    Ejemplos:
        ' Sí ' -> 'SI'
        'sí'   -> 'SI'
        'SÍ'   -> 'SI'
        ' No ' -> 'NO'
    """
    if value is None:
        return ""

    try:
        if pd.isna(value):
            return ""
    except (TypeError, ValueError):
        pass

    text = str(value).strip().upper()

    if not text:
        return ""

    text = unicodedata.normalize(
        "NFKD",
        text,
    )

    text = "".join(
        character
        for character in text
        if not unicodedata.combining(character)
    )

    return " ".join(
        text.split()
    )


# =============================================================================
# Normalización de valores binarios
# =============================================================================

def parse_binary(
    value: Any,
) -> int | None:
    """
    Convierte representaciones binarias frecuentes a 0/1.

    Se mantiene para compatibilidad con código existente.

    Para targets binarios se utiliza `_parse_binary_label()`, que devuelve
    las clases canónicas 'SI'/'NO'.
    """
    if value is None:
        return None

    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass

    if isinstance(
        value,
        (bool, np.bool_),
    ):
        return int(value)

    if isinstance(
        value,
        (int, np.integer, float, np.floating),
    ):
        try:
            numeric = float(value)

            if not np.isfinite(numeric):
                return None

            if numeric in (0.0, 1.0):
                return int(numeric)

        except (TypeError, ValueError):
            pass

    normalized_text = _normalize_text(
        value
    )

    true_values = {
        _normalize_text(item)
        for item in TRUE_VALUES
    }

    false_values = {
        _normalize_text(item)
        for item in FALSE_VALUES
    }

    if normalized_text in true_values:
        return 1

    if normalized_text in false_values:
        return 0

    if normalized_text in {
        "SI",
        "YES",
        "Y",
        "TRUE",
    }:
        return 1

    if normalized_text in {
        "NO",
        "N",
        "FALSE",
    }:
        return 0

    try:
        numeric = float(
            normalized_text.replace(",", ".")
        )

        if (
            np.isfinite(numeric)
            and numeric in (0.0, 1.0)
        ):
            return int(numeric)

    except (TypeError, ValueError):
        pass

    return None


def _parse_binary_label(
    value: Any,
) -> str | None:
    """
    Convierte un valor binario a la representación canónica:

        SI
        NO

    Esto evita convertir el target a 0/1 cuando el dominio teórico está
    definido explícitamente como SI/NO.
    """
    if value is None:
        return None

    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass

    if isinstance(
        value,
        (bool, np.bool_),
    ):
        return "SI" if bool(value) else "NO"

    if isinstance(
        value,
        (int, np.integer, float, np.floating),
    ):
        try:
            numeric = float(value)

            if not np.isfinite(numeric):
                return None

            if numeric == 1.0:
                return "SI"

            if numeric == 0.0:
                return "NO"

        except (TypeError, ValueError):
            return None

    normalized_text = _normalize_text(
        value
    )

    true_values = {
        _normalize_text(item)
        for item in TRUE_VALUES
    }

    false_values = {
        _normalize_text(item)
        for item in FALSE_VALUES
    }

    if normalized_text in true_values:
        return "SI"

    if normalized_text in false_values:
        return "NO"

    if normalized_text in {
        "SI",
        "YES",
        "Y",
        "TRUE",
    }:
        return "SI"

    if normalized_text in {
        "NO",
        "N",
        "FALSE",
    }:
        return "NO"

    return None


# =============================================================================
# Normalización de targets
# =============================================================================

def normalize_target(
    series: pd.Series,
    name: str,
) -> pd.Series:
    """
    Normaliza un target según su dominio teórico.

    Binary:
        SI / NO

    Ordinal:
        enteros.

    No se crean clases ausentes.
    """
    if not isinstance(
        series,
        pd.Series,
    ):
        raise TypeError(
            "series debe ser un pandas.Series."
        )

    if series.dropna().empty:
        raise ValueError(
            f"El target '{name}' está completamente vacío."
        )

    domain = TARGET_DOMAINS.get(
        name
    )

    # -------------------------------------------------------------------------
    # Targets binarios
    # -------------------------------------------------------------------------

    if (
        domain is not None
        and domain["type"] == "binary"
    ):
        normalized = series.map(
            _parse_binary_label
        )

        return pd.Series(
            normalized,
            index=series.index,
            dtype="string",
        )

    # -------------------------------------------------------------------------
    # Targets ordinales
    # -------------------------------------------------------------------------

    if (
        domain is not None
        and domain["type"] == "ordinal"
    ):
        numeric = pd.to_numeric(
            series,
            errors="coerce",
        )

        result = pd.Series(
            pd.NA,
            index=series.index,
            dtype="Int64",
        )

        valid_numeric = numeric.notna()

        if valid_numeric.any():
            numeric_values = numeric.loc[
                valid_numeric
            ].to_numpy()

            integer_like = np.isclose(
                numeric_values,
                np.round(
                    numeric_values
                ),
            )

            valid_indices = numeric.loc[
                valid_numeric
            ].index[
                integer_like
            ]

            result.loc[
                valid_indices
            ] = numeric.loc[
                valid_indices
            ].round().astype(
                "int64"
            )

        return result

    # -------------------------------------------------------------------------
    # Target sin dominio conocido.
    # -------------------------------------------------------------------------

    numeric = pd.to_numeric(
        series,
        errors="coerce",
    )

    observed_numeric = numeric.dropna()

    observed_count = int(
        series.notna().sum()
    )

    if (
        not observed_numeric.empty
        and len(observed_numeric) == observed_count
    ):
        values = numeric.astype(
            float
        )

        numeric_array = observed_numeric.to_numpy()

        if np.all(
            np.isclose(
                numeric_array,
                np.round(
                    numeric_array
                ),
            )
        ):
            return values.astype(
                "Int64"
            )

        return values

    binary = series.map(
        parse_binary
    )

    observed_binary = binary.dropna()

    if (
        not observed_binary.empty
        and len(observed_binary) == observed_count
    ):
        return binary.astype(
            "Int64"
        )

    return series.map(
        lambda value: (
            pd.NA
            if pd.isna(value)
            else str(value).strip()
        )
    )


# =============================================================================
# Normalización para comparación con dominio teórico
# =============================================================================

def _normalize_domain_value(
    value: Any,
    expected_type: str,
) -> Any:
    """
    Normaliza un valor para compararlo con el dominio teórico.
    """
    if value is None:
        return None

    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass

    if expected_type == "ordinal":
        try:
            numeric = float(
                str(value)
                .strip()
                .replace(",", ".")
            )

            if not np.isfinite(numeric):
                return None

            if not np.isclose(
                numeric,
                round(numeric),
            ):
                return None

            return int(
                round(numeric)
            )

        except (TypeError, ValueError):
            return None

    if expected_type == "binary":
        normalized = _normalize_text(
            value
        )

        if normalized == "SI":
            return "SI"

        if normalized == "NO":
            return "NO"

        if normalized == "1":
            return "SI"

        if normalized == "0":
            return "NO"

        return None

    return str(value).strip()


def _normalized_observed_values(
    series: pd.Series,
    expected_type: str,
) -> List[Any]:
    """
    Obtiene los valores observados normalizados.
    """
    values: List[Any] = []

    for value in series.dropna():
        normalized = _normalize_domain_value(
            value,
            expected_type,
        )

        if normalized is not None:
            values.append(
                normalized
            )

    return list(
        dict.fromkeys(values)
    )


# =============================================================================
# Validación del dominio de un target
# =============================================================================

def validate_target_domain(
    series: pd.Series,
    target_key: str,
    target_column: str,
) -> Dict[str, Any]:
    """
    Evalúa el dominio teórico y la entrenabilidad del target.

    Para targets con dominio explícito se informa:

    - clases esperadas;
    - clases observadas;
    - clases faltantes;
    - valores fuera del dominio;
    - cobertura del dominio;
    - distribución de clases;
    - soporte mínimo por clase;
    - decisión de entrenabilidad.

    La política actual exige cobertura completa del dominio teórico
    (`MIN_DOMAIN_COVERAGE_FOR_TRAINING = 1.0`) para considerar el target
    formalmente entrenable.
    """
    domain = TARGET_DOMAINS.get(
        target_key
    )

    # -------------------------------------------------------------------------
    # Target sin dominio explícitamente configurado.
    # -------------------------------------------------------------------------

    if domain is None:
        normalized = series.dropna()

        observed_values = list(
            dict.fromkeys(
                normalized.tolist()
            )
        )

        raw_class_counts = normalized.value_counts(
            dropna=True
        )

        class_counts: Dict[str, int] = {
            str(index): int(value)
            for index, value
            in raw_class_counts.items()
        }

        minimum_class_count = (
            int(
                raw_class_counts.min()
            )
            if not raw_class_counts.empty
            else 0
        )

        trainable = (
            len(raw_class_counts) >= 2
            and len(normalized) >= MIN_VALID_ROWS
            and minimum_class_count >= MIN_SAMPLES_PER_CLASS
        )

        return {
            "targetKey": target_key,
            "targetColumn": target_column,
            "targetLabel": target_key,
            "expectedType": "unknown",
            "theoreticalRange": None,
            "expectedValues": [],
            "observedValues": observed_values,
            "missingExpectedValues": [],
            "unexpectedValues": [],
            "domainCoverage": None,
            "domainComplete": None,
            "validRows": int(
                len(normalized)
            ),
            "classCounts": class_counts,
            "minimumClassCount": minimum_class_count,
            "trainable": bool(
                trainable
            ),
            "status": (
                "ENTRENABLE"
                if trainable
                else "NO_ENTRENABLE"
            ),
            "reasons": [
                "no existe un dominio teórico configurado "
                "para este target"
            ],
        }

    expected_type = str(
        domain["type"]
    )

    expected_values = list(
        domain["expected_values"]
    )

    # -------------------------------------------------------------------------
    # Normalización.
    # -------------------------------------------------------------------------

    normalized_values = series.map(
        lambda value: _normalize_domain_value(
            value,
            expected_type,
        )
    )

    valid_mask = normalized_values.notna()

    normalized_valid = normalized_values.loc[
        valid_mask
    ]

    observed_values = _normalized_observed_values(
        series,
        expected_type,
    )

    expected_set = set(
        expected_values
    )

    observed_set = set(
        observed_values
    )

    # -------------------------------------------------------------------------
    # Cobertura.
    # -------------------------------------------------------------------------

    missing_expected = [
        value
        for value in expected_values
        if value not in observed_set
    ]

    unexpected_values = [
        value
        for value in observed_values
        if value not in expected_set
    ]

    observed_class_count = len(
        observed_set & expected_set
    )

    expected_class_count = len(
        expected_values
    )

    domain_coverage = (
        observed_class_count
        / expected_class_count
        if expected_class_count > 0
        else 0.0
    )

    domain_complete = (
        len(missing_expected) == 0
        and len(unexpected_values) == 0
    )

    # -------------------------------------------------------------------------
    # Distribución.
    # -------------------------------------------------------------------------

    raw_class_counts = normalized_valid.value_counts(
        dropna=True
    )

    class_counts: Dict[str, int] = {}

    for expected_value in expected_values:
        class_counts[
            str(expected_value)
        ] = int(
            raw_class_counts.get(
                expected_value,
                0,
            )
        )

    for value in unexpected_values:
        class_counts[
            str(value)
        ] = int(
            raw_class_counts.get(
                value,
                0,
            )
        )

    # -------------------------------------------------------------------------
    # Estadísticas.
    # -------------------------------------------------------------------------

    valid_rows = int(
        len(normalized_valid)
    )

    minimum_class_count = min(
        (
            class_counts.get(
                str(value),
                0,
            )
            for value in expected_values
        ),
        default=0,
    )

    insufficient_classes = [
        value
        for value in expected_values
        if class_counts.get(
            str(value),
            0,
        ) < MIN_SAMPLES_PER_CLASS
    ]

    observed_class_total = len(
        observed_set
    )

    # -------------------------------------------------------------------------
    # Razones.
    # -------------------------------------------------------------------------

    reasons: List[str] = []

    if observed_class_total < 2:
        reasons.append(
            "existe una sola clase observada; "
            "no es posible entrenar un clasificador"
        )

    if valid_rows < MIN_VALID_ROWS:
        reasons.append(
            f"hay {valid_rows} filas válidas; "
            f"se requieren al menos {MIN_VALID_ROWS}"
        )

    if missing_expected:
        reasons.append(
            "faltan clases del dominio teórico: "
            + ", ".join(
                str(value)
                for value in missing_expected
            )
        )

    if unexpected_values:
        reasons.append(
            "existen valores fuera del dominio teórico: "
            + ", ".join(
                str(value)
                for value in unexpected_values
            )
        )

    if (
        domain_coverage
        < MIN_DOMAIN_COVERAGE_FOR_TRAINING
    ):
        reasons.append(
            "cobertura del dominio="
            f"{domain_coverage:.2%} < "
            f"{MIN_DOMAIN_COVERAGE_FOR_TRAINING:.2%}"
        )

    if insufficient_classes:
        present_but_insufficient = [
            value
            for value in insufficient_classes
            if value in observed_set
        ]

        if present_but_insufficient:
            details = ", ".join(
                (
                    f"{value}="
                    f"{class_counts[str(value)]}"
                )
                for value in present_but_insufficient
            )

            reasons.append(
                "clases con representación insuficiente: "
                + details
            )

    # -------------------------------------------------------------------------
    # Decisión.
    # -------------------------------------------------------------------------

    trainable = len(reasons) == 0

    if trainable:
        status = "ENTRENABLE"
    elif observed_class_total < 2:
        status = "NO_ENTRENABLE"
    else:
        status = "LIMITADO"

    # -------------------------------------------------------------------------
    # Rango teórico.
    # -------------------------------------------------------------------------

    theoretical_range: str | None

    if expected_type == "ordinal":
        theoretical_range = (
            f"{expected_values[0]}-"
            f"{expected_values[-1]}"
            if expected_values
            else None
        )

    elif expected_type == "binary":
        theoretical_range = "SI / NO"

    else:
        theoretical_range = None

    return {
        "targetKey": target_key,
        "targetColumn": target_column,
        "targetLabel": domain.get(
            "label",
            target_key,
        ),
        "expectedType": expected_type,
        "theoreticalRange": theoretical_range,
        "expectedValues": expected_values,
        "observedValues": observed_values,
        "missingExpectedValues": missing_expected,
        "unexpectedValues": unexpected_values,
        "domainCoverage": float(
            domain_coverage
        ),
        "domainComplete": bool(
            domain_complete
        ),
        "validRows": valid_rows,
        "classCounts": class_counts,
        "minimumClassCount": int(
            minimum_class_count
        ),
        "trainable": bool(
            trainable
        ),
        "status": status,
        "reasons": reasons,
    }


# =============================================================================
# Detección de targets
# =============================================================================

def _canonical_target_key(
    column: str,
) -> str:
    """
    Obtiene la clave canónica de un target.
    """
    for key, aliases in TARGET_ALIASES.items():
        if column in aliases:
            return key

    return norm(column)


def detect_targets(
    df: pd.DataFrame,
    explicit: Optional[Sequence[str]],
) -> Dict[str, str]:
    """
    Detecta los targets disponibles en el dataset.
    """
    if not isinstance(
        df,
        pd.DataFrame,
    ):
        raise TypeError(
            "df debe ser un pandas.DataFrame."
        )

    if explicit:
        explicit_unique = list(
            dict.fromkeys(
                explicit
            )
        )

        resolved_columns: list[str] = []
        missing: list[str] = []

        for requested in explicit_unique:
            if requested in df.columns:
                resolved_columns.append(requested)
                continue

            canonical = _canonical_target_key(requested)
            matches = [
                str(column)
                for column in df.columns
                if _canonical_target_key(str(column)) == canonical
            ]

            if len(matches) == 1:
                resolved_columns.append(matches[0])
            else:
                missing.append(requested)

        if missing:
            raise ValueError(
                f"Targets no encontrados: {missing}"
            )

        result: Dict[str, str] = {}

        for column in resolved_columns:
            canonical = _canonical_target_key(
                column
            )

            if canonical in result:
                raise ValueError(
                    "Hay más de una columna asociada al "
                    f"mismo target canónico '{canonical}': "
                    f"'{result[canonical]}' y '{column}'."
                )

            result[canonical] = column

        return result

    marked: List[str] = []

    for column in df.columns:
        normalized = norm(column)
        lowered = str(column).lower()

        if (
            "(target)" in lowered
            or "[target]" in lowered
            or normalized.endswith("_target")
        ):
            marked.append(column)

    if marked:
        result: Dict[str, str] = {}

        for column in marked:
            canonical = _canonical_target_key(
                column
            )

            if canonical in result:
                raise ValueError(
                    "Se detectaron múltiples columnas para "
                    f"el target canónico '{canonical}'."
                )

            result[canonical] = column

        return result

    resolved: Dict[str, str] = {}

    for key, aliases in TARGET_ALIASES.items():
        column = resolve(
            df.columns,
            aliases,
        )

        if column:
            resolved[key] = column

    if resolved:
        return resolved

    raise ValueError(
        "No se encontraron targets. "
        "Use columnas con '(Target)' o especifique --targets."
    )


# =============================================================================
# Selección de features
# =============================================================================

def feature_columns(
    df: pd.DataFrame,
    targets: Mapping[str, str],
    explicit: Optional[Sequence[str]],
) -> Dict[str, List[str]]:
    """
    Obtiene los predictores para cada target.
    """
    if not isinstance(
        df,
        pd.DataFrame,
    ):
        raise TypeError(
            "df debe ser un pandas.DataFrame."
        )

    result: Dict[str, List[str]] = {}

    forbidden = (
        set(targets.values())
        | set(NON_FEATURE_EXACT)
    )

    for key, target_column in targets.items():
        columns = select_target_features(
            df,
            target_column,
            explicit,
        )

        if not columns:
            raise ValueError(
                f"No quedaron variables predictoras para "
                f"'{target_column}'."
            )

        cleaned: List[str] = []

        for column in columns:
            if column not in df.columns:
                continue

            if column in forbidden:
                continue

            normalized = norm(column)

            if (
                "(target)" in str(column).lower()
                or "[target]" in str(column).lower()
                or normalized.endswith("_target")
            ):
                continue

            cleaned.append(column)

        cleaned = list(
            dict.fromkeys(
                cleaned
            )
        )

        if not cleaned:
            raise ValueError(
                f"No quedaron variables predictoras válidas para "
                f"'{target_column}' después de aplicar las restricciones."
            )

        result[key] = cleaned

    return result


# =============================================================================
# Preparación general
# =============================================================================

def prepare(
    df: pd.DataFrame,
    explicit_targets: Optional[Sequence[str]] = None,
    explicit_features: Optional[Sequence[str]] = None,
) -> Tuple[
    pd.DataFrame,
    Dict[str, str],
    Dict[str, List[str]],
    Dict[str, Dict[str, Any]],
]:
    """
    Prepara el dataset para entrenamiento.

    Solo pasan a entrenamiento los targets cuyo dominio teórico esté completo
    y cuyas clases tengan soporte suficiente.
    """
    if not isinstance(
        df,
        pd.DataFrame,
    ):
        raise TypeError(
            "df debe ser un pandas.DataFrame."
        )

    work = add_clinical_features(
        df.copy()
    )

    detected_targets = detect_targets(
        work,
        explicit_targets,
    )

    valid_targets: Dict[str, str] = {}

    skipped_targets: Dict[
        str,
        Dict[str, Any],
    ] = {}

    for key, column in detected_targets.items():
        normalized = normalize_target(
            work[column],
            key,
        )

        audit = validate_target_domain(
            normalized,
            key,
            column,
        )

        work[column] = normalized

        if not audit["trainable"]:
            skipped_targets[key] = {
                "column": column,
                "reason": (
                    " | ".join(
                        audit["reasons"]
                    )
                    if audit["reasons"]
                    else "target no entrenable"
                ),
                "validRows": audit[
                    "validRows"
                ],
                "classes": int(
                    len(
                        audit["observedValues"]
                    )
                ),
                "classDistribution": audit[
                    "classCounts"
                ],
                "status": audit[
                    "status"
                ],
                "domainCoverage": audit[
                    "domainCoverage"
                ],
                "domainComplete": audit[
                    "domainComplete"
                ],
                "expectedValues": audit[
                    "expectedValues"
                ],
                "observedValues": audit[
                    "observedValues"
                ],
                "missingExpectedValues": audit[
                    "missingExpectedValues"
                ],
                "unexpectedValues": audit[
                    "unexpectedValues"
                ],
            }

            reason_text = " | ".join(
                audit["reasons"]
            )

            print(
                f"[INFO] Se omite el target '{column}': "
                f"{audit['status']}"
                + (
                    f" — {reason_text}"
                    if reason_text
                    else ""
                )
            )

            continue

        valid_targets[key] = column

    if not valid_targets:
        details = "; ".join(
            (
                f"{info['column']}: "
                f"{info['reason']}"
            )
            for info in skipped_targets.values()
        )

        raise ValueError(
            "Ningún target es entrenable. "
            f"{details}"
        )

    features = feature_columns(
        work,
        valid_targets,
        explicit_features,
    )

    return (
        work,
        valid_targets,
        features,
        skipped_targets,
    )


# =============================================================================
# Dataset específico por target
# =============================================================================

def target_dataset(
    df: pd.DataFrame,
    target_column: str,
    features: Sequence[str],
) -> Tuple[
    pd.DataFrame,
    pd.Series,
]:
    """
    Devuelve las filas etiquetadas para un target.

    Los valores faltantes de las features no se eliminan.
    """
    if not isinstance(
        df,
        pd.DataFrame,
    ):
        raise TypeError(
            "df debe ser un pandas.DataFrame."
        )

    if target_column not in df.columns:
        raise ValueError(
            f"El target '{target_column}' no existe en el dataset."
        )

    features = list(
        dict.fromkeys(
            features
        )
    )

    missing_features = [
        column
        for column in features
        if column not in df.columns
    ]

    if missing_features:
        raise ValueError(
            f"Features no encontradas para '{target_column}': "
            f"{missing_features}"
        )

    if not features:
        raise ValueError(
            f"No se definieron features para '{target_column}'."
        )

    columns = [
        *features,
        target_column,
    ]

    subset = df.loc[
        df[target_column].notna(),
        columns,
    ].copy()

    if subset.empty:
        raise ValueError(
            f"El target '{target_column}' "
            "no tiene filas etiquetadas."
        )

    target_series = subset[
        target_column
    ]

    # Los targets ordinales ya son Int64.
    if pd.api.types.is_integer_dtype(
        target_series.dtype
    ):
        subset[target_column] = (
            target_series.astype(int)
        )

    # Los targets binarios se mantienen como SI/NO.
    elif pd.api.types.is_string_dtype(
        target_series.dtype
    ):
        subset[target_column] = (
            target_series.astype(str)
        )

    all_features_missing = (
        subset[features]
        .isna()
        .all(axis=1)
    )

    if all_features_missing.any():
        subset = subset.loc[
            ~all_features_missing
        ].copy()

    if subset.empty:
        raise ValueError(
            f"El target '{target_column}' "
            "no conserva filas con al menos una feature disponible."
        )

    y = subset[target_column]

    if y.nunique(
        dropna=True
    ) < 2:
        raise ValueError(
            f"El target '{target_column}' "
            "no tiene al menos dos clases después del filtrado."
        )

    return (
        subset[features],
        y,
    )


# =============================================================================
# Estratificación
# =============================================================================

def stratify_target(
    y: pd.Series | pd.DataFrame,
    *,
    minimum_count: int = 2,
) -> pd.Series | None:
    """
    Devuelve la serie para estratificación cuando es segura.
    """
    series = (
        y.iloc[:, 0]
        if isinstance(
            y,
            pd.DataFrame,
        )
        else y
    )

    counts: pd.Series = series.value_counts(
        dropna=True
    )

    if len(counts) < 2:
        return None

    minimum_observed = int(
        counts.min()
    )

    if minimum_observed < minimum_count:
        return None

    return series


# =============================================================================
# Validación del split
# =============================================================================

def _validate_split_sizes() -> None:
    """
    Verifica que TRAIN + VALIDATION + TEST sumen 1.
    """
    total = (
        TRAIN_SIZE
        + VALIDATION_SIZE
        + TEST_SIZE
    )

    if not math.isclose(
        total,
        1.0,
        rel_tol=1e-9,
        abs_tol=1e-9,
    ):
        raise ValueError(
            "Split inválido: "
            f"TRAIN_SIZE={TRAIN_SIZE}, "
            f"VALIDATION_SIZE={VALIDATION_SIZE}, "
            f"TEST_SIZE={TEST_SIZE}; "
            f"la suma debe ser 1.0 y actualmente es {total}."
        )

    if not (
        0 < TRAIN_SIZE < 1
        and 0 < VALIDATION_SIZE < 1
        and 0 < TEST_SIZE < 1
    ):
        raise ValueError(
            "TRAIN_SIZE, VALIDATION_SIZE y TEST_SIZE "
            "deben estar estrictamente entre 0 y 1."
        )


# =============================================================================
# División train / validation / test
# =============================================================================

def split_indices(
    y: pd.Series,
) -> Tuple[
    np.ndarray,
    np.ndarray,
    np.ndarray,
]:
    """
    Divide los índices en TRAIN / VALIDATION / TEST.

    Intenta mantener la distribución de clases mediante estratificación.

    Si la estratificación no es posible para un split concreto, se utiliza
    una partición aleatoria reproducible sin estratificación.
    """
    _validate_split_sizes()

    if not isinstance(
        y,
        pd.Series,
    ):
        y = pd.Series(y)

    n = len(y)

    if n < 4:
        raise ValueError(
            "No hay suficientes filas etiquetadas para dividir "
            f"el dataset: {n} filas."
        )

    if y.isna().any():
        raise ValueError(
            "split_indices() requiere un target sin valores faltantes."
        )

    if y.nunique() < 2:
        raise ValueError(
            "split_indices() requiere al menos dos clases."
        )

    # -------------------------------------------------------------------------
    # TRAIN / TEMP
    # -------------------------------------------------------------------------

    temp_size = (
        VALIDATION_SIZE
        + TEST_SIZE
    )

    strat = stratify_target(
        y,
        minimum_count=2,
    )

    try:
        train_idx, temp_idx = train_test_split(
            np.arange(n),
            test_size=temp_size,
            random_state=RANDOM_STATE,
            stratify=strat,
        )

    except ValueError:
        train_idx, temp_idx = train_test_split(
            np.arange(n),
            test_size=temp_size,
            random_state=RANDOM_STATE,
            stratify=None,
        )

    # -------------------------------------------------------------------------
    # VALIDATION / TEST
    # -------------------------------------------------------------------------

    temp_y = y.iloc[
        temp_idx
    ]

    strat_temp = stratify_target(
        temp_y,
        minimum_count=2,
    )

    relative_test_size = (
        TEST_SIZE / temp_size
    )

    try:
        validation_idx, test_idx = train_test_split(
            temp_idx,
            test_size=relative_test_size,
            random_state=RANDOM_STATE,
            stratify=strat_temp,
        )

    except ValueError:
        validation_idx, test_idx = train_test_split(
            temp_idx,
            test_size=relative_test_size,
            random_state=RANDOM_STATE,
            stratify=None,
        )

    # -------------------------------------------------------------------------
    # Orden reproducible.
    # -------------------------------------------------------------------------

    train_idx = np.sort(
        np.asarray(
            train_idx,
            dtype=int,
        )
    )

    validation_idx = np.sort(
        np.asarray(
            validation_idx,
            dtype=int,
        )
    )

    test_idx = np.sort(
        np.asarray(
            test_idx,
            dtype=int,
        )
    )

    # -------------------------------------------------------------------------
    # Validaciones finales.
    # -------------------------------------------------------------------------

    if (
        len(train_idx)
        + len(validation_idx)
        + len(test_idx)
        != n
    ):
        raise RuntimeError(
            "El split no conserva el número total de observaciones."
        )

    train_set = set(
        train_idx.tolist()
    )

    validation_set = set(
        validation_idx.tolist()
    )

    test_set = set(
        test_idx.tolist()
    )

    if (
        train_set & validation_set
        or train_set & test_set
        or validation_set & test_set
    ):
        raise RuntimeError(
            "El split produjo índices solapados entre particiones."
        )

    if (
        train_set
        | validation_set
        | test_set
    ) != set(
        range(n)
    ):
        raise RuntimeError(
            "El split no cubre exactamente todas las observaciones."
        )

    return (
        train_idx,
        validation_idx,
        test_idx,
    )

