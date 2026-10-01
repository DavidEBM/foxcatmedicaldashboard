from __future__ import annotations

from ml.train import parse_args


def test_web_training_arguments_are_accepted() -> None:
    args = parse_args(
        [
            "--output-dir", "ml/outputs/SavedModels",
            "--algorithms", "XGBoost", "LightGBM", "CatBoost", "RandomForest",
            "ExtraTrees", "LogisticRegression", "SVM", "DeepLearningMLP",
            "--targets", "copd_gold", "history_of_heart_failure",
            "--firebase-dataset", "ml/datasets/runtime/firebase-patients.json",
        ]
    )

    assert args.output_dir == "ml/outputs/SavedModels"
    assert args.algorithms == [
        "XGBoost", "LightGBM", "CatBoost", "RandomForest",
        "ExtraTrees", "LogisticRegression", "SVM", "DeepLearningMLP",
    ]
    assert args.targets == ["copd_gold", "history_of_heart_failure"]
    assert args.firebase_dataset == "ml/datasets/runtime/firebase-patients.json"


def test_training_arguments_keep_defaults_when_omitted() -> None:
    args = parse_args([])
    assert args.algorithms is None
    assert args.targets is None
    assert args.features is None
    assert args.firebase_dataset is None
