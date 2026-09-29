"""Small JSON stdin/stdout adapter used by the Next.js inference route."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent))

import joblib
import pandas as pd

MODELS = ROOT / "outputs" / "SavedModels"
MANIFEST = MODELS / "training-manifest.json"

TARGETS = {
    "copd_gold": MODELS / "copd_gold-xgboost.joblib",
    "history_of_heart_failure": MODELS / "history_of_heart_failure-logisticregression.joblib",
}


def patient_features(patient: dict) -> dict:
    """Map the dashboard patient schema to the trained feature names."""
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
        "AtrialFib": 1 if str(patient.get("arrhythmias", "")).lower() in {"si", "sí", "yes", "true", "1"} else 0,
        "history_of_heart_failure": patient.get("heartFailureHistory"),
    }


def approved_targets() -> tuple[set[str], dict[str, str]]:
    """Devuelve únicamente modelos que superaron VALIDATION."""
    try:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return set(TARGETS), {}

    approved: set[str] = set()
    blocked: dict[str, str] = {}
    models = manifest.get("models", {})

    for target in TARGETS:
        report = models.get(target, {})
        if report.get("thresholdMet") is True:
            approved.add(target)
        else:
            blocked[target] = (
                "El modelo no superó los umbrales de VALIDATION y requiere "
                "más datos o revisión clínica."
            )

    return approved, blocked


def predict(patient: dict) -> tuple[list[dict], dict[str, str]]:
    row = patient_features(patient)
    results = []
    approved, blocked = approved_targets()
    for target, path in TARGETS.items():
        if target not in approved or not path.exists():
            continue
        artifact = joblib.load(path)
        features = artifact.get("featureColumns") or list(row)
        frame = pd.DataFrame([{name: row.get(name) for name in features}])
        pipeline = artifact["pipeline"]
        value = pipeline.predict(frame)[0]
        probabilities = None
        if hasattr(pipeline, "predict_proba"):
            probabilities = pipeline.predict_proba(frame)[0].tolist()
        classes = getattr(pipeline, "classes_", None)
        if classes is None and hasattr(pipeline, "named_steps"):
            estimator = pipeline.named_steps.get("estimator") or pipeline.named_steps.get("model")
            classes = getattr(estimator, "classes_", None)
        class_values = classes.tolist() if hasattr(classes, "tolist") else classes
        risk = None
        if probabilities and class_values:
            if target == "copd_gold":
                # GOLD 4 is the most severe class.
                severe_class_index = next(
                    (index for index, item in enumerate(class_values) if str(item).strip() == "4"),
                    None,
                )
                if severe_class_index is not None and severe_class_index < len(probabilities):
                    risk = round(probabilities[severe_class_index] * 100)
            elif target == "history_of_heart_failure":
                positive_labels = {"si", "sí", "yes", "true", "1"}
                positive = next(
                    (index for index, item in enumerate(class_values) if str(item).strip().lower() in positive_labels),
                    None,
                )
                if positive is not None and positive < len(probabilities):
                    risk = round(probabilities[positive] * 100)
        results.append({
            "key": target,
            "label": artifact.get("targetLabel", target),
            "prediction": value.item() if hasattr(value, "item") else value,
            "probabilities": probabilities,
            "classes": class_values,
            "risk": risk,
            "modelName": artifact.get("selectedModel", artifact.get("model", "ML")),
            "artifact": str(path.relative_to(ROOT.parent)),
            "source": "backend",
        })
    return results, blocked


if __name__ == "__main__":
    try:
        predictions, blocked_models = predict(json.load(sys.stdin))
        print(
            json.dumps(
                {
                    "predictions": predictions,
                    "blockedModels": blocked_models,
                },
                ensure_ascii=False,
            )
        )
    except Exception as error:  # pragma: no cover - surfaced to the API caller
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
        raise SystemExit(1)
