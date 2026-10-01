from __future__ import annotations

from pathlib import Path

from ml.diagnostics import _export_validation_model_comparisons


def test_validation_comparison_exports_all_candidates_when_one_is_eligible(tmp_path: Path) -> None:
    candidates = [
        {
            "model": "CatBoost",
            "available": True,
            "validationMetrics": {
                "accuracy": 0.82,
                "f1": 0.84,
                "mcc": 0.70,
                "kappa": 0.68,
                "auc": 0.91,
            },
        },
        {
            "model": "RandomForest",
            "available": True,
            "validationMetrics": {
                "accuracy": 0.76,
                "f1": 0.66,
                "mcc": 0.52,
                "kappa": 0.49,
                "auc": 0.84,
            },
        },
    ]

    _export_validation_model_comparisons(candidates, tmp_path, "COPD GOLD")

    eligibility_chart = tmp_path / "validacion_modelos_elegibilidad.png"
    mcc_chart = tmp_path / "validacion_modelos_mcc.png"
    assert eligibility_chart.is_file() and eligibility_chart.stat().st_size > 0
    assert mcc_chart.is_file() and mcc_chart.stat().st_size > 0
