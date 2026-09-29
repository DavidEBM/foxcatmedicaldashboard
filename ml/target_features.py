from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Sequence

import pandas as pd


# =============================================================================
# Definición de predictores
# =============================================================================
#
# Las variables son candidatas a predictor mientras:
#
# 1. Existan en el dataset.
# 2. Contengan al menos un valor no nulo.
# 3. No sean el propio target.
# 4. No estén declaradas explícitamente como leakage.
#
# Una asociación clínica con el target NO implica automáticamente leakage.
# La exclusión debe estar respaldada por la definición del target, por la
# metodología de adquisición de los datos o por disponibilidad temporal.
# =============================================================================

TARGET_FEATURES: Dict[str, List[str]] = {
    "copd_gold": [
        "EDAD",
        "Genero Sexo",
        "PackHistory",
        "MWT1",
        "MWT2",
        "MWT1Best",
        "FEV1",
        "FEV1PRED",
        "FVC",
        "FVCPRED",
        "CAT",
        "HAD",
        "SGRQ",
        "smoking",
        "status of smoking",
        "mMRC",
        "Temperature",
        "Respiratory Rate",
        "Heart Rate",
        "Blood pressure",
        "Oxygen Saturation",
        "Sputum",
        "Asma",
        "AtrialFib",
        "BMI,kg/m2 (IMC)",
        "PESO",
        "TALLA(altura ó Height/m)",
        "DISCAPACIDAD",
        "TIPODISCAPAC",
        "OCUPACION",
        "Altura_MSNM",
        "Location",
    ],
    "history_of_heart_failure": [
        "EDAD",
        "Genero Sexo",
        "PackHistory",
        "smoking",
        "status of smoking",
        "AtrialFib",
        "BMI,kg/m2 (IMC)",
        "CAT",
        "HAD",
        "SGRQ",
        "mMRC",
        "Temperature",
        "Respiratory Rate",
        "Heart Rate",
        "Blood pressure",
        "Oxygen Saturation",
        "Sputum",
        "Asma",
        "PESO",
        "TALLA(altura ó Height/m)",
        "DISCAPACIDAD",
        "TIPODISCAPAC",
        "OCUPACION",
        "Altura_MSNM",
        "Location",
        # Señales cardiopulmonares disponibles antes de la predicción.
        "Glucose",
        "Creatinine",
        "BNP",
        "ECG",
        "Coronary History",
        "Arrhythmias",
        "RIESGO CARDIOVASCULAR",
    ],
    "escala_disnea": [
        "EDAD",
        "Genero Sexo",
        "PackHistory",
        "MWT1",
        "MWT2",
        "MWT1Best",
        "FEV1",
        "FEV1PRED",
        "FVC",
        "FVCPRED",
        "CAT",
        "HAD",
        "SGRQ",
        "smoking",
        "status of smoking",
        "Respiratory Rate",
        "Heart Rate",
        "Blood pressure",
        "Oxygen Saturation",
        "Sputum",
        "BMI,kg/m2 (IMC)",
        "PESO",
        "TALLA(altura ó Height/m)",
        "DISCAPACIDAD",
        "TIPODISCAPAC",
        "OCUPACION",
        "Altura_MSNM",
        "Location",
    ],
    "clasifisui": [
        "EDAD",
        "Genero Sexo",
        "BMI,kg/m2 (IMC)",
        "mMRC",
        "CAT",
        "HAD",
        "SGRQ",
        "Temperature",
        "Respiratory Rate",
        "Heart Rate",
        "Blood pressure",
        "Oxygen Saturation",
        "Sputum",
        "Asma",
        "AtrialFib",
        "NOMBRE_DIAG",
        "PESO",
        "TALLA(altura ó Height/m)",
        "DISCAPACIDAD",
        "TIPODISCAPAC",
        "OCUPACION",
        "Altura_MSNM",
        "Location",
    ],
    "bodex": [
        "EDAD",
        "BMI,kg/m2 (IMC)",
        "FEV1",
        "FEV1PRED",
        "MWT1Best",
        "mMRC",
        "PackHistory",
        "smoking",
        "Genero Sexo",
        "PESO",
        "TALLA(altura ó Height/m)",
        "Oxygen Saturation",
        "Altura_MSNM",
    ],
    "epocconfirmado": [
        "EDAD",
        "Genero Sexo",
        "PackHistory",
        "FEV1",
        "FEV1PRED",
        "FVC",
        "FVCPRED",
        "CAT",
        "mMRC",
        "MWT1Best",
        "smoking",
        "status of smoking",
        "Oxygen Saturation",
        "Respiratory Rate",
        "Sputum",
        "BMI,kg/m2 (IMC)",
        "PESO",
        "TALLA(altura ó Height/m)",
        "Altura_MSNM",
        "Location",
    ],
}


# =============================================================================
# Alias de targets
# =============================================================================

TARGET_KEY_ALIASES: Dict[str, str] = {
    "COPD GOLD(1 a 4) (Target)": "copd_gold",
    "History of Heart Failure(Si ó no)(Target)": "history_of_heart_failure",
    "BODEX (0 a 10 puntos) (Target)": "bodex",
    "ESCALA DISNEA (0 a 10 puntos) (Target)": "escala_disnea",
    "EPOCCONFIRMADO(Si ó no)(Target)": "epocconfirmado",
    "EPOCCONFIRMADO(Si ó no) (Target)": "epocconfirmado",
    "CLASIFISUI (1 a 5, clasificacion urgencias)": "clasifisui",
}


# =============================================================================
# Dominios entrenables
# =============================================================================

PRIMARY_TRAINABLE_TARGETS = {
    "copd_gold",
    "history_of_heart_failure",
}


# =============================================================================
# Exclusiones por leakage
# =============================================================================
#
# Solo se incluyen variables cuya exclusión tiene una justificación
# metodológica directa.
#
# COPDSEVERITY:
#   Puede representar una categorización de severidad estrechamente relacionada
#   o equivalente a COPD GOLD.
#
# mMRC:
#   Se excluye de escala_disnea porque puede formar parte de la definición o
#   cálculo directo de la escala objetivo.
#
# El propio target se elimina siempre, independientemente de esta tabla.
# =============================================================================

TARGET_LEAKAGE_EXCLUSIONS: Dict[str, List[str]] = {
    "copd_gold": [
        "COPDSEVERITY",
    ],
    "history_of_heart_failure": [],
    "escala_disnea": [
        "mMRC",
    ],
    "clasifisui": [],
    "bodex": [],
    "epocconfirmado": [],
}


# =============================================================================
# Variables derivadas
# =============================================================================
#
# No se habilitan derivaciones clínicas automáticamente.
#
# Una variable derivada solamente debe agregarse después de documentar:
#
# - fórmula;
# - unidades;
# - variables fuente;
# - momento de disponibilidad;
# - relación con el target;
# - riesgo de leakage.
# =============================================================================

DERIVED_FEATURE_RULES: Dict[str, List[str]] = {
    "copd_gold": [],
    "history_of_heart_failure": [],
    "escala_disnea": [],
    "clasifisui": [],
    "bodex": [],
    "epocconfirmado": [],
}


# =============================================================================
# Resultado de selección
# =============================================================================

@dataclass(frozen=True)
class FeatureSelectionResult:
    """
    Resultado auditable de la selección de variables.
    """

    target_key: str
    target_column: str
    selected: List[str]
    missing: List[str]
    empty: List[str]
    excluded: List[str]
    derived: List[str]


# =============================================================================
# Resolución de target
# =============================================================================

def target_feature_key(target_column: str) -> str:
    """
    Convierte el nombre real de la columna target a su clave interna.
    """
    return TARGET_KEY_ALIASES.get(
        str(target_column),
        str(target_column),
    )


# =============================================================================
# Utilidades
# =============================================================================

def _unique(values: Iterable[str]) -> List[str]:
    """
    Elimina duplicados preservando el orden original.
    """
    return list(
        dict.fromkeys(
            str(value)
            for value in values
        )
    )


def _existing_non_empty(
    df: pd.DataFrame,
    columns: Sequence[str],
) -> tuple[List[str], List[str], List[str]]:
    """
    Clasifica las variables candidatas como:

    selected:
        Existen y contienen al menos un valor no nulo.

    missing:
        No existen en el dataset.

    empty:
        Existen pero están completamente vacías.
    """
    selected: List[str] = []
    missing: List[str] = []
    empty: List[str] = []

    for column in columns:
        if column not in df.columns:
            missing.append(column)
            continue

        if df[column].isna().all():
            empty.append(column)
            continue

        selected.append(column)

    return selected, missing, empty


def _derived_features(
    df: pd.DataFrame,
    target_key: str,
    selected: Sequence[str],
) -> List[str]:
    """
    Devuelve únicamente variables derivadas explícitamente autorizadas.
    """
    del df
    del selected

    allowed = DERIVED_FEATURE_RULES.get(
        target_key,
        [],
    )

    return _unique(allowed)


# =============================================================================
# Selección principal
# =============================================================================

def select_target_features(
    df: pd.DataFrame,
    target_column: str,
    explicit_features: Sequence[str] | None = None,
) -> List[str]:
    """
    Selecciona los predictores utilizables para un target.
    """
    result = select_target_features_detailed(
        df=df,
        target_column=target_column,
        explicit_features=explicit_features,
    )

    return result.selected


# =============================================================================
# Selección auditable
# =============================================================================

def select_target_features_detailed(
    df: pd.DataFrame,
    target_column: str,
    explicit_features: Sequence[str] | None = None,
) -> FeatureSelectionResult:
    """
    Selecciona predictores y conserva el detalle necesario para auditoría.
    """
    if not isinstance(df, pd.DataFrame):
        raise TypeError(
            "df debe ser un pandas.DataFrame."
        )

    if not isinstance(target_column, str) or not target_column.strip():
        raise ValueError(
            "target_column debe ser un nombre de columna válido."
        )

    if target_column not in df.columns:
        raise ValueError(
            f"El target '{target_column}' no existe en el DataFrame."
        )

    target_key = target_feature_key(target_column)

    # -------------------------------------------------------------------------
    # Candidatos
    # -------------------------------------------------------------------------

    if explicit_features is not None:
        candidates = _unique(explicit_features)

        if not candidates:
            raise ValueError(
                f"La lista explícita de predictores para "
                f"'{target_column}' está vacía."
            )

    else:
        configured = TARGET_FEATURES.get(target_key)

        if not configured:
            raise ValueError(
                "No existe una definición de predictores para "
                f"'{target_column}' (key='{target_key}')."
            )

        candidates = _unique(configured)

    # -------------------------------------------------------------------------
    # El target jamás puede ser predictor
    # -------------------------------------------------------------------------

    candidates = [
        column
        for column in candidates
        if column != target_column
    ]

    # -------------------------------------------------------------------------
    # Existencia / valores
    # -------------------------------------------------------------------------

    selected, missing, empty = _existing_non_empty(
        df,
        candidates,
    )

    # -------------------------------------------------------------------------
    # Leakage explícito
    # -------------------------------------------------------------------------

    leakage_exclusions = set(
        TARGET_LEAKAGE_EXCLUSIONS.get(
            target_key,
            [],
        )
    )

    excluded = [
        column
        for column in selected
        if column in leakage_exclusions
    ]

    selected = [
        column
        for column in selected
        if column not in leakage_exclusions
    ]

    # -------------------------------------------------------------------------
    # Variables derivadas
    # -------------------------------------------------------------------------

    derived = _derived_features(
        df=df,
        target_key=target_key,
        selected=selected,
    )

    for feature in derived:
        if (
            feature not in selected
            and feature != target_column
            and feature not in leakage_exclusions
            and feature in df.columns
            and not df[feature].isna().all()
        ):
            selected.append(feature)

    selected = _unique(selected)

    if not selected:
        raise ValueError(
            f"No quedaron predictores utilizables para "
            f"el target '{target_column}'."
        )

    return FeatureSelectionResult(
        target_key=target_key,
        target_column=target_column,
        selected=selected,
        missing=missing,
        empty=empty,
        excluded=excluded,
        derived=derived,
    )


# =============================================================================
# Validación de definiciones
# =============================================================================

def validate_target_feature_definitions(
    df: pd.DataFrame,
    target_columns: Iterable[str] | None = None,
) -> Dict[str, FeatureSelectionResult]:
    """
    Valida todas las definiciones de predictores contra el dataset.

    No entrena modelos.
    """
    if not isinstance(df, pd.DataFrame):
        raise TypeError(
            "df debe ser un pandas.DataFrame."
        )

    if target_columns is None:
        target_columns = TARGET_KEY_ALIASES.keys()

    results: Dict[str, FeatureSelectionResult] = {}

    for target_column in target_columns:
        if target_column not in df.columns:
            continue

        try:
            results[target_column] = select_target_features_detailed(
                df=df,
                target_column=target_column,
            )
        except ValueError:
            # Un target sin predictores válidos no bloquea la auditoría de
            # los demás targets.
            continue

    return results
