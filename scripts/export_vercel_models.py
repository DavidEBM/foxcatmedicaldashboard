"""Export the selected CatBoost estimators without the training pipeline.

The generated .cbm files are the production inference artifacts. The source
joblib files remain available for local training and backwards compatibility.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
MODELS = ROOT / "ml" / "outputs" / "SavedModels"
TARGETS = ("copd_gold", "history_of_heart_failure")


def main() -> None:
    specs: dict[str, dict[str, object]] = {}
    for target in TARGETS:
        source = MODELS / f"{target}-catboost.joblib"
        artifact = joblib.load(source)
        pipeline = artifact["pipeline"]
        preprocessor = pipeline.named_steps["preprocessor"]
        estimator = pipeline.named_steps["estimator"].model_
        output_name = f"{target}-catboost.cbm"
        estimator.save_model(str(MODELS / output_name))
        specs[target] = {
            "file": output_name,
            "featureColumns": list(preprocessor.feature_columns_),
            "categoricalColumns": list(preprocessor.categorical_columns_),
            "categoricalIndices": list(preprocessor.categorical_indices_),
            "classes": estimator.classes_.tolist(),
            "targetLabel": artifact.get("targetLabel", target),
            "selectedModel": artifact.get("selectedModel", "CatBoost"),
        }

    (MODELS / "vercel-models.json").write_text(
        json.dumps(specs, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
