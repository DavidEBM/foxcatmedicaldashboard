"""Carga, armoniza y deduplica pacientes procedentes de Firebase.

Los documentos de Firestore usan el esquema del dashboard, mientras que el
dataset histórico usa nombres de columnas clínicos. Este módulo convierte
ambos orígenes a un único DataFrame y conserva una clave de paciente para que
las particiones de evaluación no separen al mismo paciente entre conjuntos.
"""

from __future__ import annotations

import hashlib
import json
import math
import unicodedata
from pathlib import Path
from typing import Any, Iterable, Mapping

import numpy as np
import pandas as pd

from .config import TARGET_ALIASES
from .utils import norm


TARGET_COLUMNS = {
    key: aliases[0]
    for key, aliases in TARGET_ALIASES.items()
}


FIREBASE_FIELD_ALIASES: dict[str, tuple[str, ...]] = {
    "EDAD": ("age", "edad"),
    "Genero Sexo": ("gender", "sex", "genero", "sexo"),
    "PackHistory": ("packHistory", "packYears", "pack_history"),
    "COPDSEVERITY": ("copdSeverity", "copd_severity"),
    "MWT1": ("mwt1",),
    "MWT2": ("mwt2",),
    "MWT1Best": ("mwt1Best", "mwt1_best"),
    "FEV1": ("fev1",),
    "FEV1PRED": ("fev1Pred", "fev1_pred"),
    "FVC": ("fvc",),
    "FVCPRED": ("fvcPred", "fvc_pred"),
    "CAT": ("cat", "catScore", "cat_score"),
    "HAD": ("had", "hadScore", "had_score"),
    "SGRQ": ("sgrq",),
    "smoking": ("smoking", "smokingDaily"),
    "status of smoking": ("smokingStatus", "smoking_status"),
    "AtrialFib": ("atrialFib", "atrial_fibrillation"),
    "BMI,kg/m2 (IMC)": ("bmi",),
    "mMRC": ("mmrc", "mMRC", "dyspneaScale"),
    "Temperature": ("temperature",),
    "Respiratory Rate": ("respiratoryRate",),
    "Heart Rate": ("heartRate", "pulse"),
    "Blood pressure": (
        "bloodPressure",
        "bloodPressureSystolic",
        "systolicBP",
    ),
    "Oxygen Saturation": ("oxygenSaturation",),
    "Sputum": ("sputum",),
    "Asma": ("asthma",),
    "NOMBRE_DIAG": (
        "diagnosisName",
        "diagnosis",
        "condition",
    ),
    "PESO": ("weight",),
    "TALLA(altura ó Height/m)": ("height",),
    "DISCAPACIDAD": ("disability",),
    "TIPODISCAPAC": ("disabilityType",),
    "OCUPACION": ("occupation",),
    "Altura_MSNM": ("locationElevationM", "altitude"),
    "Location": ("locationCity", "location", "city"),
    "Glucose": ("glucose",),
    "Creatinine": ("creatinine",),
    "BNP": ("bnp",),
    "ECG": ("ecg",),
    "Coronary History": ("coronaryHistory", "coronary_history"),
    "Arrhythmias": ("arrhythmias", "arrhythmia"),
    "RIESGO CARDIOVASCULAR": (
        "cardiovascularRisk",
        "cardiovascular_risk",
    ),
}


TARGET_FIELD_ALIASES: dict[str, tuple[str, ...]] = {
    TARGET_COLUMNS["copd_gold"]: (
        "copdGold",
        "copd_gold",
    ),
    TARGET_COLUMNS["history_of_heart_failure"]: (
        "heartFailureHistory",
        "historyOfHeartFailure",
        "history_of_heart_failure",
    ),
    TARGET_COLUMNS["bodex"]: ("bodex",),
    TARGET_COLUMNS["escala_disnea"]: (
        "dyspneaScale",
        "dyspneaScore",
        "escalaDisnea",
    ),
    TARGET_COLUMNS["epocconfirmado"]: (
        "copdConfirmed",
        "copd_confirmed",
    ),
    TARGET_COLUMNS["clasifisui"]: (
        "emergencyClassification",
        "emergency_classification",
    ),
}


FINGERPRINT_COLUMNS = (
    "EDAD",
    "Genero Sexo",
    "PackHistory",
    "FEV1",
    "FEV1PRED",
    "FVC",
    "FVCPRED",
    "CAT",
    "HAD",
    "SGRQ",
    "mMRC",
    "BMI,kg/m2 (IMC)",
    "Heart Rate",
    "Oxygen Saturation",
    "Blood pressure",
    "Location",
)

# Firma más amplia para los registros del dataset clínico general. No se usa
# como variable del modelo: únicamente ayuda a reconocer una copia de una
# importación entre el archivo histórico y Firebase. La coincidencia exige
# varios campos y siempre se limita al mismo origen declarado.
IMPORT_MATCH_COLUMNS = (
    "EDAD",
    "Genero Sexo",
    "BMI,kg/m2 (IMC)",
    "NOMBRE_DIAG",
    "PESO",
    "TALLA(altura ó Height/m)",
    "DISCAPACIDAD",
    "TIPODISCAPAC",
    "OCUPACION",
    "Altura_MSNM",
    "Location",
    "RIESGO CARDIOVASCULAR",
)


def _get_nested(record: Mapping[str, Any], path: str) -> Any:
    current: Any = record

    for part in path.split("."):
        if not isinstance(current, Mapping) or part not in current:
            return None
        current = current[part]

    return current


def _first_value(record: Mapping[str, Any], keys: Iterable[str]) -> Any:
    for key in keys:
        value = _get_nested(record, key)
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return value

    return None


def _missing(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, (list, dict, tuple, set)):
        return len(value) == 0

    try:
        return bool(pd.isna(value))
    except (TypeError, ValueError):
        return False


def _key_value(value: Any) -> str:
    if _missing(value):
        return ""

    if isinstance(value, (float, np.floating)) and math.isfinite(float(value)):
        if float(value).is_integer():
            return str(int(value))

    text = str(value).strip().casefold()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(char for char in text if not unicodedata.combining(char))
    return norm(text)


def _external_id(record: Mapping[str, Any]) -> str:
    value = _first_value(
        record,
        (
            "documentId",
            "document_id",
            "patientId",
            "patient_id",
            "identificationNumber",
            "cedula",
            "importMetadata.documentId",
        ),
    )
    return _key_value(value)


def _origin(record: Mapping[str, Any], default: str) -> str:
    value = _first_value(
        record,
        (
            "datasetOrigin",
            "dataset_origen",
            "sourceFile",
            "importMetadata.sourceFile",
        ),
    )
    return str(value).strip() if not _missing(value) else default


def _fingerprint(row: Mapping[str, Any]) -> str | None:
    values = {
        column: _key_value(row.get(column))
        for column in FINGERPRINT_COLUMNS
        if not _missing(row.get(column))
    }

    if len(values) < 4:
        return None

    payload = json.dumps(values, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:24]


def _signature(
    row: Mapping[str, Any],
    columns: Iterable[str],
    *,
    minimum_values: int,
) -> str | None:
    """Genera una firma de importación, nunca una identidad clínica absoluta."""
    values = {
        column: _key_value(row.get(column))
        for column in columns
        if not _missing(row.get(column))
    }

    if len(values) < minimum_values:
        return None

    payload = json.dumps(values, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:24]


def _match_signatures(row: Mapping[str, Any]) -> tuple[str, ...]:
    """Devuelve firmas conservadoras para cotejar una importación conocida."""
    signatures: list[str] = []

    clinical = _signature(
        row,
        FINGERPRINT_COLUMNS,
        minimum_values=8,
    )
    if clinical:
        signatures.append(f"clinical:{clinical}")

    broad = _signature(
        row,
        IMPORT_MATCH_COLUMNS,
        minimum_values=8,
    )
    if broad:
        signatures.append(f"import:{broad}")

    return tuple(signatures)


def _full_row_fingerprint(row: Mapping[str, Any]) -> str | None:
    values = {
        str(column): _key_value(value)
        for column, value in row.items()
        if not str(column).startswith("_")
        and str(column) not in {"ID", "dataset_origen"}
        and not _missing(value)
    }

    if len(values) < 4:
        return None

    payload = json.dumps(values, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:24]


def _patient_key(
    row: Mapping[str, Any],
    *,
    external_id: str = "",
    origin: str = "",
    firestore_id: str = "",
) -> str:
    if external_id and origin:
        return f"source-id:{norm(origin)}:{external_id}"

    if external_id:
        return f"id:{external_id}"

    if firestore_id:
        return f"firebase-doc:{_key_value(firestore_id)}"

    fingerprint = _full_row_fingerprint(row)
    if fingerprint:
        return f"fingerprint:{fingerprint}"

    return "row:" + hashlib.sha256(
        repr(sorted(row.items())).encode("utf-8", errors="replace")
    ).hexdigest()[:24]


def annotate_patient_keys(frame: pd.DataFrame) -> pd.DataFrame:
    """Añade una clave reproducible para evitar solapamiento por paciente."""
    result = frame.copy()
    keys: list[str] = []
    fingerprints: list[str] = []

    for _, row in result.iterrows():
        record = row.to_dict()
        external_id = _key_value(record.get("ID"))
        origin = str(record.get("dataset_origen") or "").strip()
        fingerprint = _fingerprint(record) or ""
        keys.append(
            _patient_key(
                record,
                external_id=external_id,
                origin=origin,
            )
        )
        fingerprints.append(fingerprint)

    result["_patient_key"] = keys
    result["_patient_fingerprint"] = fingerprints
    result["_source_record"] = "local"
    return result


def _firebase_row(
    record: Mapping[str, Any],
    firestore_id: str,
) -> dict[str, Any]:
    row: dict[str, Any] = {}

    for column, aliases in FIREBASE_FIELD_ALIASES.items():
        value = _first_value(record, aliases)
        if not _missing(value):
            row[column] = value

    for column, aliases in TARGET_FIELD_ALIASES.items():
        value = _first_value(record, aliases)
        if not _missing(value):
            row[column] = value

    external_id = _external_id(record)
    origin = _origin(record, "firebase_patients")

    row["ID"] = external_id or firestore_id
    row["dataset_origen"] = origin
    row["_source_record"] = "firebase"
    row["_patient_fingerprint"] = _fingerprint(row) or ""
    row["_patient_key"] = _patient_key(
        row,
        external_id=external_id,
        origin=origin if external_id else "",
        firestore_id=firestore_id if not external_id else "",
    )

    return row


def load_firebase_records(path: str | Path) -> pd.DataFrame:
    """Carga el snapshot JSON generado por el servidor Next/Firebase."""
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    records = payload.get("patients", []) if isinstance(payload, Mapping) else payload

    if not isinstance(records, list):
        raise ValueError("El snapshot de Firebase no contiene una lista de pacientes.")

    rows = []
    for item in records:
        if not isinstance(item, Mapping):
            continue
        firestore_id = str(item.get("__firestoreId", "")).strip()
        rows.append(_firebase_row(item, firestore_id))

    return pd.DataFrame(rows)


def _completeness(row: pd.Series) -> int:
    return int(sum(not _missing(value) for value in row.to_dict().values()))


def _coalesce_target_columns(frame: pd.DataFrame) -> pd.DataFrame:
    """Une variantes de nombre/acentos de una misma columna target."""
    result = frame.copy()

    for key, aliases in TARGET_ALIASES.items():
        canonical = aliases[0]
        normalized_aliases = {norm(alias) for alias in aliases}
        matches = [
            column
            for column in result.columns
            if norm(column) in normalized_aliases
        ]
        if not matches:
            continue

        values = result[matches].bfill(axis=1).iloc[:, 0]
        result[canonical] = values
        drop_columns = [column for column in matches if column != canonical]
        if drop_columns:
            result = result.drop(columns=drop_columns)

    return result


def merge_with_firebase(
    local: pd.DataFrame,
    firebase_path: str | Path | None,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Fusiona el dataset histórico con Firebase y elimina duplicados."""
    local_frame = annotate_patient_keys(local)
    local_frame["_source_record"] = "local"
    firebase = (
        load_firebase_records(firebase_path)
        if firebase_path is not None
        else pd.DataFrame()
    )

    combined = pd.concat(
        [local_frame, firebase],
        ignore_index=True,
        sort=False,
    )
    combined = _coalesce_target_columns(combined)
    combined["_completeness"] = combined.apply(_completeness, axis=1)
    target_columns = [
        column
        for column in TARGET_COLUMNS.values()
        if column in combined.columns
    ]
    combined["_target_completeness"] = combined[target_columns].notna().sum(axis=1)
    combined["_source_priority"] = (
        combined["_source_record"].eq("firebase").astype(int)
    )

    parent = list(range(len(combined)))

    def find(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(left: int, right: int) -> None:
        left_root = find(left)
        right_root = find(right)
        if left_root != right_root:
            parent[right_root] = left_root

    # La clave de paciente (ID de origen o huella de la fila completa) sí
    # puede deduplicar registros dentro de un mismo origen. La huella clínica
    # parcial no se usa aquí: pacientes distintos pueden compartir edad, sexo,
    # IMC y ubicación.
    identity_owner: dict[str, int] = {}
    for index, row in combined.iterrows():
        identity = f"patient:{row['_patient_key']}"
        previous = identity_owner.get(identity)
        if previous is not None:
            union(index, previous)
        else:
            identity_owner[identity] = index

    combined["_dedup_group"] = [find(index) for index in range(len(combined))]

    target_conflicts = 0
    conflict_columns_by_index: dict[int, set[str]] = {}

    def mark_conflicts(indices: Iterable[int]) -> int:
        index_list = list(indices)
        conflicts = 0
        for column in TARGET_COLUMNS.values():
            if column not in combined.columns:
                continue
            values = {
                _key_value(combined.at[index, column])
                for index in index_list
                if not _missing(combined.at[index, column])
            }
            if len(values) <= 1:
                continue
            conflicts += 1
            for index in index_list:
                conflict_columns_by_index.setdefault(index, set()).add(column)
        return conflicts

    for _, group in combined.groupby("_dedup_group", dropna=False):
        target_conflicts += mark_conflicts(group.index.tolist())

    # Cotejo entre local y Firebase. Se exige el mismo dataset de origen y una
    # firma fuerte. Para grupos repetidos se elimina como máximo el mismo
    # número de filas que ya existe localmente; los pacientes nuevos quedan.
    signature_groups: dict[str, dict[str, list[int]]] = {}
    for index, row in combined.iterrows():
        origin = _key_value(row.get("dataset_origen")) or "unknown"
        source = str(row["_source_record"])
        for signature in _match_signatures(row.to_dict()):
            token = f"{origin}:{signature}"
            signature_groups.setdefault(
                token,
                {"local": [], "firebase": []},
            )[source].append(int(index))

    matched_local: set[int] = set()
    matched_firebase: set[int] = set()
    drop_firebase: set[int] = set()

    def signature_order(token: str) -> tuple[int, str]:
        return (0 if ":clinical:" in token else 1, token)

    for token in sorted(signature_groups, key=signature_order):
        group = signature_groups[token]
        local_indices = [
            index for index in group["local"] if index not in matched_local
        ]
        firebase_indices = [
            index
            for index in group["firebase"]
            if index not in matched_firebase
        ]
        if not local_indices or not firebase_indices:
            continue

        target_conflicts += mark_conflicts(local_indices + firebase_indices)
        match_count = min(len(local_indices), len(firebase_indices))
        matched_local.update(local_indices[:match_count])
        matched_firebase.update(firebase_indices[:match_count])
        drop_firebase.update(firebase_indices[:match_count])

    # Una etiqueta discordante se deja sin valor en todas las copias
    # conservadas para que no contamine el entrenamiento.
    for index, columns in conflict_columns_by_index.items():
        for column in columns:
            combined.at[index, column] = pd.NA

    exact_mixed_groups = {
        int(group["_dedup_group"].iloc[0])
        for _, group in combined.groupby("_dedup_group", dropna=False)
        if group["_source_record"].nunique() > 1
    }
    cross_roots = {find(index) for index in drop_firebase}
    matched_existing = len(matched_firebase) + len(
        exact_mixed_groups - cross_roots
    )

    combined["_drop_cross_source"] = [
        index in drop_firebase for index in range(len(combined))
    ]
    eligible = combined.loc[~combined["_drop_cross_source"]].copy()

    deduplicated = (
        eligible.sort_values(
            [
                "_dedup_group",
                "_target_completeness",
                "_completeness",
                "_source_priority",
            ],
            ascending=[True, False, False, False],
            kind="mergesort",
        )
        .drop_duplicates("_dedup_group", keep="first")
        .drop(
            columns=[
                "_completeness",
                "_target_completeness",
                "_source_priority",
                "_drop_cross_source",
                "_dedup_group",
            ]
        )
        .reset_index(drop=True)
    )

    return deduplicated, {
        "firebaseIncluded": firebase_path is not None,
        "localRows": int(len(local_frame)),
        "firebaseRows": int(len(firebase)),
        "rowsAfterDeduplication": int(len(deduplicated)),
        "duplicatesRemoved": int(len(combined) - len(deduplicated)),
        "matchedExistingPatients": matched_existing,
        "targetConflicts": int(target_conflicts),
    }


__all__ = [
    "annotate_patient_keys",
    "load_firebase_records",
    "merge_with_firebase",
]
