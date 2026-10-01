"""Lightweight CatBoost inference adapter used only by Vercel."""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from catboost import CatBoostClassifier, Pool

ROOT = Path(__file__).resolve().parent
MODELS = ROOT / "outputs" / "SavedModels"
TARGETS = ("copd_gold", "history_of_heart_failure")


def _qualifies(metrics: object, thresholds: dict[str, float]) -> bool:
    if not isinstance(metrics, dict):
        return False
    for key, threshold in thresholds.items():
        try:
            value = float(metrics[key])
        except (KeyError, TypeError, ValueError):
            return False
        if not math.isfinite(value) or value < threshold:
            return False
    return True


def _thresholds(target: str) -> dict[str, float]:
    values = {"accuracy": 0.70, "f1": 0.70, "mcc": 0.40, "kappa": 0.40, "auc": 0.70}
    if target == "history_of_heart_failure":
        values.update({"accuracy": 0.60, "f1": 0.60, "auc": 0.60})
    return values


def _load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}
    return value if isinstance(value, dict) else {}


def patient_features(patient: dict[str, Any]) -> dict[str, Any]:
    return {
        "EDAD": patient.get("age"),
        "PackHistory": patient.get("packHistory"),
        "FEV1": patient.get("fev1"),
        "FEV1PRED": patient.get("fev1Pred"),
        "Respiratory Rate": patient.get("respiratoryRate"),
        "Heart Rate": patient.get("pulse"),
        "Blood pressure": patient.get("bloodPressureSystolic"),
        "Oxygen Saturation": patient.get("oxygenSaturation"),
        "BMI,kg/m2 (IMC)": patient.get("bmi"),
        "Altura_MSNM": patient.get("locationElevationM"),
        "Location": patient.get("locationCity"),
        "status of smoking": patient.get("smokingStatus"),
        "AtrialFib": 1 if str(patient.get("arrhythmias", "")).lower() in {"si", "sÃ­", "yes", "true", "1"} else 0,
        "history_of_heart_failure": patient.get("heartFailureHistory"),
    }


def _number(value: Any) -> float:
    if value is None or value == "":
        return float("nan")
    try:
        return float(value)
    except (TypeError, ValueError):
        return float("nan")


def _safe(value: Any) -> Any:
    return value.item() if hasattr(value, "item") else value


def _approved_models() -> tuple[dict[str, tuple[Path, dict[str, Any]]], dict[str, str]]:
    manifest = _load_json(MODELS / "training-manifest.json")
    specs = _load_json(MODELS / "vercel-models.json")
    models = manifest.get("models", {})
    approved: dict[str, tuple[Path, dict[str, Any]]] = {}
    blocked: dict[str, str] = {}

    for target in TARGETS:
        report = models.get(target, {})
        selected = report.get("selectedModel")
        metrics = report.get("publishedValidationMetrics")
        if not isinstance(metrics, dict):
            metrics = next(
                (
                    candidate.get("validationMetrics", {})
                    for candidate in report.get("algorithmsTested", [])
                    if candidate.get("model") == selected
                ),
                {},
            )
        spec = specs.get(target, {})
        if not selected or not _qualifies(metrics, _thresholds(target)):
            blocked[target] = "No hay un modelo publicado que cumpla los umbrales de validaciÃ³n."
        elif not isinstance(spec, dict) or spec.get("selectedModel") != selected:
            blocked[target] = f"El metadato Vercel no coincide con el modelo publicado para {target}."
        else:
            path = MODELS / str(spec.get("file", ""))
            if path.is_file():
                approved[target] = (path, spec)
            else:
                blocked[target] = f"No se encontrÃ³ el artefacto Vercel para {selected}."
    return approved, blocked


def predict(patient: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, str]]:
    row = patient_features(patient)
    approved, blocked = _approved_models()
    results: list[dict[str, Any]] = []

    for target, (path, spec) in approved.items():
        categorical = set(spec.get("categoricalColumns", []))
        values = []
        for column in spec.get("featureColumns", []):
            value = row.get(column)
            if column in categorical:
                values.append("__MISSING__" if value is None or str(value).strip() == "" else str(value))
            else:
                values.append(_number(value))

        model = CatBoostClassifier()
        model.load_model(str(path))
        pool = Pool(
            np.asarray([values], dtype=object),
            cat_features=[int(index) for index in spec.get("categoricalIndices", [])],
        )
        prediction = _safe(model.predict(pool)[0])
        probabilities = [_safe(item) for item in model.predict_proba(pool)[0]]
        classes = list(spec.get("classes", []))

        risk = None
        if target == "copd_gold":
            index = next((i for i, item in enumerate(classes) if str(item).strip() == "4"), None)
            if index is not None:
                risk = round(probabilities[index] * 100)
        else:
            index = next(
                (i for i, item in enumerate(classes) if str(item).strip().lower() in {"si", "sÃ­", "yes", "true", "1"}),
                None,
            )
            if index is not None:
                risk = round(probabilities[index] * 100)

        results.append({
            "key": target,
            "label": spec.get("targetLabel", target),
            "prediction": prediction,
            "probabilities": probabilities,
            "classes": classes,
            "risk": risk,
            "modelName": spec.get("selectedModel", "CatBoost"),
            "artifact": str(path.relative_to(ROOT.parent)),
            "source": "backend",
        })

    return results, blocked
