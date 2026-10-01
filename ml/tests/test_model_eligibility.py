from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from ml.config import DEFAULT_THRESHOLDS, thresholds_for_target
from ml import inference
from ml.model_common import evaluate, qualifies
from ml.model_publisher import _select_candidate, publish_best_model


class FixedClassifier:
    def __init__(self, classes: list[object], predictions: list[object]) -> None:
        self.classes_ = np.asarray(classes)
        self._predictions = np.asarray(predictions)

    def predict(self, X: object) -> np.ndarray:
        return self._predictions[: len(X)]

    def predict_proba(self, X: object) -> np.ndarray:
        probabilities = np.zeros((len(X), len(self.classes_)))
        for row, prediction in enumerate(self.predict(X)):
            probabilities[row, list(self.classes_).index(prediction)] = 1.0
        return probabilities


def eligible_metrics(**overrides: float) -> dict[str, float]:
    metrics = {
        "accuracy": 0.75,
        "f1": 0.75,
        "mcc": 0.45,
        "kappa": 0.45,
        "auc": 0.75,
    }
    metrics.update(overrides)
    return metrics


def candidate(name: str, metrics: dict[str, float], **extra: object) -> dict[str, object]:
    return {
        "model": name,
        "available": True,
        "validationMetrics": metrics,
        "validationScore": 1.0 - metrics["f1"],
        "normalizedQuality": 1.0 - metrics["f1"],
        "thresholdMet": True,
        **extra,
    }


def test_required_thresholds_are_fixed_for_gold_and_heart_failure() -> None:
    expected = {"accuracy": 0.70, "f1": 0.70, "mcc": 0.40, "kappa": 0.40, "auc": 0.70}
    assert DEFAULT_THRESHOLDS == expected
    assert thresholds_for_target("copd_gold", {**expected, "modelQuality": 0.99}) == expected
    assert thresholds_for_target("history_of_heart_failure", {}) == expected


def test_all_five_thresholds_are_required_including_boundary_values() -> None:
    assert qualifies(
        {"accuracy": 0.70, "f1": 0.70, "mcc": 0.40, "kappa": 0.40, "auc": 0.70},
        DEFAULT_THRESHOLDS,
    )
    for metric, failing_value in (
        ("accuracy", 0.699),
        ("f1", 0.699),
        ("mcc", 0.399),
        ("kappa", 0.399),
        ("auc", 0.699),
    ):
        assert not qualifies(eligible_metrics(**{metric: failing_value}), DEFAULT_THRESHOLDS)
    assert not qualifies(
        eligible_metrics(accuracy=0.69),
        {metric: 0.0 for metric in DEFAULT_THRESHOLDS},
    )


def test_missing_and_non_finite_required_metrics_are_ineligible() -> None:
    missing_auc = eligible_metrics()
    del missing_auc["auc"]
    assert not qualifies(missing_auc, DEFAULT_THRESHOLDS)
    assert not qualifies(eligible_metrics(auc=float("nan")), DEFAULT_THRESHOLDS)


def test_selection_is_f1_first_then_auc_mcc_kappa_accuracy() -> None:
    candidates = [
        candidate("F1Champion", eligible_metrics(f1=0.91, auc=0.70), validationScore=-999),
        candidate("AucChampion", eligible_metrics(f1=0.90, auc=0.90), normalizedQuality=999),
        candidate("MccChampion", eligible_metrics(f1=0.90, auc=0.90, mcc=0.80)),
        candidate("KappaChampion", eligible_metrics(f1=0.90, auc=0.90, mcc=0.80, kappa=0.80)),
        candidate("AccuracyChampion", eligible_metrics(f1=0.90, auc=0.90, mcc=0.80, kappa=0.80, accuracy=0.95)),
    ]
    selected, eligible = _select_candidate(candidates, DEFAULT_THRESHOLDS)
    assert eligible
    assert selected is candidates[0]

    tie_breakers = candidates[1:]
    selected, eligible = _select_candidate(tie_breakers, DEFAULT_THRESHOLDS)
    assert eligible
    assert selected is tie_breakers[-1]


def test_no_eligible_model_means_no_selected_candidate() -> None:
    only_candidate = candidate("HighQualityButFails", eligible_metrics(f1=0.69), thresholdMet=True)
    selected, eligible = _select_candidate([only_candidate], DEFAULT_THRESHOLDS)
    assert selected is None
    assert not eligible


def test_no_eligible_candidate_is_not_published(tmp_path) -> None:
    X = pd.DataFrame({"feature": [0.0, 1.0, 2.0, 3.0]})
    y = pd.Series([1, 2, 3, 4])
    invalid = candidate("FailsF1", eligible_metrics(f1=0.69))

    result = publish_best_model(
        X_train=X.iloc[:2],
        y_train=y.iloc[:2],
        X_validation=X.iloc[2:3],
        y_validation=y.iloc[2:3],
        X_test=X.iloc[3:],
        y_test=y.iloc[3:],
        key="copd_gold",
        column="COPD GOLD(1 a 4) (Target)",
        candidates=[invalid],
        thresholds=DEFAULT_THRESHOLDS,
        output_dir=tmp_path,
    )

    assert result.run_selected is None
    assert result.selected is None
    assert result.artifact is None
    assert not result.threshold_met
    assert not list(tmp_path.glob("copd_gold-*.joblib"))
    assert (tmp_path / "Model_Reports" / "copd_gold" / "calidad_normalizada_validacion.png").is_file()


def test_inference_uses_selected_model_only_when_required_metrics_pass(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    models_dir = tmp_path / "SavedModels"
    models_dir.mkdir()
    selected_artifact = models_dir / "copd_gold-random_forest.joblib"
    selected_artifact.touch()
    manifest_path = models_dir / "training-manifest.json"
    manifest_path.write_text(
        '{"models":{"copd_gold":{"selectedModel":"Random Forest","thresholdMet":false,'
        '"algorithmsTested":[{"model":"Random Forest","validationMetrics":'
        '{"accuracy":0.8,"f1":0.69,"mcc":0.5,"kappa":0.5,"auc":0.8,"normalizedQuality":1.0}}],'
        '"publishedValidationMetrics":{"accuracy":0.8,"f1":0.8,"mcc":0.5,"kappa":0.5,"auc":0.8,"normalizedQuality":0.01}},'
        '"history_of_heart_failure":{"selectedModel":"Logistic Regression","thresholdMet":true,'
        '"algorithmsTested":[{"model":"Logistic Regression","validationMetrics":'
        '{"accuracy":0.8,"f1":0.8,"mcc":0.5,"kappa":0.5,"auc":0.8,"normalizedQuality":1.0}}],'
        '"publishedValidationMetrics":{"accuracy":0.8,"f1":0.8,"mcc":0.5,"kappa":0.5,"auc":0.69,"normalizedQuality":1.0}}}}',
        encoding="utf-8",
    )
    monkeypatch.setattr(inference, "MODELS", models_dir)
    monkeypatch.setattr(inference, "MANIFEST", manifest_path)

    approved, blocked = inference.approved_targets()

    assert approved == {"copd_gold": selected_artifact}
    assert "history_of_heart_failure" in blocked


def test_gold_keeps_multiclass_macro_metrics() -> None:
    y_true = np.asarray([1, 2, 3, 4])
    model = FixedClassifier([1, 2, 3, 4], [1, 2, 4, 4])
    metrics = evaluate(model, np.zeros((4, 1)), y_true)
    assert metrics["positiveLabel"] is None
    assert metrics["classes"] == ["1", "2", "3", "4"]
    assert metrics["f1"] == pytest.approx((1.0 + 1.0 + 0.0 + 2 / 3) / 4)
    assert metrics["confusionMatrix"] == [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 1],
        [0, 0, 0, 1],
    ]


def test_heart_failure_keeps_binary_si_positive_label_metrics() -> None:
    y_true = np.asarray(["SI", "SI", "NO", "NO"])
    model = FixedClassifier(["NO", "SI"], ["SI", "NO", "NO", "NO"])
    metrics = evaluate(model, np.zeros((4, 1)), y_true)
    assert metrics["positiveLabel"] == "SI"
    assert metrics["classes"] == ["NO", "SI"]
    assert metrics["f1"] == pytest.approx(2 / 3)
    assert metrics["accuracy"] == pytest.approx(0.75)
