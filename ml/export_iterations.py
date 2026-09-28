from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping, Sequence, cast

import numpy as np
import pandas as pd
from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter

from .utils import excel_cell


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------


def _algorithm_family(name: str) -> str:
    """Clasifica el algoritmo como ML o DL para el reporte."""
    name = str(name)
    return "DL" if name.startswith("Deep") or name == "LSTM" else "ML"


def _safe_json(value: Any) -> str:
    """Serializa valores complejos sin romper el Excel."""
    try:
        return json.dumps(
            value,
            ensure_ascii=False,
            default=str,
        )
    except Exception:
        return str(value)


def style_sheet(ws: Any) -> None:
    """
    Aplica formato común a una hoja de Excel.

    La función es tolerante con hojas vacías y limita el cálculo de ancho
    para evitar costes innecesarios en hojas muy grandes.
    """
    if ws.max_row < 1 or ws.max_column < 1:
        return

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions

    for cell in ws[1]:
        cell.font = Font(bold=True)
        cell.alignment = Alignment(
            horizontal="center",
            vertical="center",
            wrap_text=True,
        )

    for column_cells in ws.iter_cols():
        if not column_cells:
            continue

        letter = get_column_letter(column_cells[0].column)

        values = column_cells[:250]

        max_length = max(
            (
                len(str(cell.value))
                if cell.value is not None
                else 0
            )
            for cell in values
        )

        ws.column_dimensions[letter].width = min(
            max(max_length + 2, 10),
            48,
        )


def _append_row(
    ws: Any,
    columns: Sequence[str],
    row: Mapping[str, Any],
) -> None:
    """Añade una fila normalizando valores para Excel."""
    ws.append(
        [
            excel_cell(row.get(column, ""))
            for column in columns
        ]
    )


def _write_sheet(
    wb: Workbook,
    name: str,
    columns: Sequence[str],
    rows: Sequence[Mapping[str, Any]],
) -> Any:
    """
    Crea y formatea una hoja tabular.

    Se utiliza Sequence en lugar de list para evitar la invariancia
    de list durante las comprobaciones de tipos de Pylance.
    """
    ws = wb.create_sheet(name)
    ws.append(list(columns))

    for row in rows:
        _append_row(
            ws,
            columns,
            row,
        )

    style_sheet(ws)
    return ws


def _candidate_test_available(
    candidate: Mapping[str, Any],
) -> bool:
    """
    Indica si un candidato tiene evaluación TEST final.

    Por diseño metodológico, únicamente el modelo seleccionado debe
    contener métricas TEST.
    """
    metrics = candidate.get(
        "testMetrics",
        {},
    )

    return bool(
        isinstance(metrics, Mapping)
        and metrics.get("available")
    )


def _pandas_row_to_mapping(row: Any) -> dict[str, Any]:
    """
    Convierte una fila de pandas en un Mapping con claves str.

    pandas puede tipar las claves de Series.to_dict() como Hashable.
    El reporte, sin embargo, trabaja exclusivamente con nombres de
    columnas string.
    """
    raw = row.to_dict()

    return {
        str(key): value
        for key, value in raw.items()
    }


# ---------------------------------------------------------------------------
# Exportación principal
# ---------------------------------------------------------------------------


def export_training_excel(
    output_dir: str | Path,
    split: Mapping[str, int],
    results: Mapping[str, Any],
    thresholds: Mapping[str, float],
    skipped_targets: Mapping[str, Any] | None = None,
) -> Path:
    """
    Exporta el reporte consolidado del entrenamiento.

    El archivo contiene:

    - comparación CV / VALIDATION / TEST_FINAL;
    - partición de datos y metodología;
    - hiperparámetros;
    - variables relevantes;
    - tiempos de predicción;
    - targets omitidos;
    - resumen por target;
    - detalle de CV;
    - variables seleccionadas;
    - distribución de clases;
    - datos auxiliares para gráficos.

    TEST se reporta exclusivamente como evaluación final.
    Esta función no participa en la selección del modelo.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    wb = Workbook()

    default_sheet = wb.active

    if default_sheet is not None:
        wb.remove(default_sheet)

    # -----------------------------------------------------------------------
    # 1. Comparación completa de modelos
    # -----------------------------------------------------------------------

    comparison_columns = [
        "target",
        "targetLabel",
        "algorithm",
        "family",
        "phase",
        "selected",
        "thresholdMet",
        "validationScore",
        "cvMeanScore",
        "cvStdScore",
        "precision",
        "accuracy",
        "recallSensitivity",
        "f1",
        "auc",
        "mcc",
        "kappa",
        "balancedAccuracy",
        "normalizedQualityPercent",
        "precisionCI95Low",
        "precisionCI95High",
        "accuracyCI95Low",
        "accuracyCI95High",
        "recallSensitivityCI95Low",
        "recallSensitivityCI95High",
        "f1CI95Low",
        "f1CI95High",
        "aucCI95Low",
        "aucCI95High",
        "mccCI95Low",
        "mccCI95High",
        "predictionLatencyMs",
        "predictionLatencyStdMs",
        "responseTimeMsPerRecord",
        "predictionsPerSecond",
        "trainingTimeSeconds",
        "trainRows",
        "validationRows",
        "testRows",
        "error",
    ]

    comparison_ws = wb.create_sheet(
        "Comparacion_Modelos"
    )

    comparison_ws.append(
        comparison_columns
    )

    for result in results.values():
        for candidate in result.candidates:
            algorithm = str(
                candidate.get(
                    "model",
                    "",
                )
            )

            family = _algorithm_family(
                algorithm
            )

            base: dict[str, Any] = {
                "target": result.key,
                "targetLabel": result.label,
                "algorithm": algorithm,
                "family": family,
                "selected": (
                    "SI"
                    if algorithm == result.selected
                    else "NO"
                ),
                "thresholdMet": (
                    "SI"
                    if candidate.get("thresholdMet")
                    else "NO"
                ),
                "validationScore": candidate.get(
                    "validationScore",
                    np.nan,
                ),
                "cvMeanScore": candidate.get(
                    "cvMeanScore",
                    np.nan,
                ),
                "cvStdScore": candidate.get(
                    "cvStdScore",
                    np.nan,
                ),
                "trainRows": result.split.get(
                    "train",
                    split.get("train", 0),
                ),
                "validationRows": result.split.get(
                    "validation",
                    split.get("validation", 0),
                ),
                "testRows": result.split.get(
                    "test",
                    split.get("test", 0),
                ),
            }

            validation_metrics = candidate.get(
                "validationMetrics",
                {},
            )

            if not isinstance(
                validation_metrics,
                Mapping,
            ):
                validation_metrics = {}

            _append_row(
                comparison_ws,
                comparison_columns,
                {
                    **base,
                    "phase": "VALIDATION",
                    **dict(validation_metrics),
                },
            )

            # TEST_FINAL solo existe para el modelo seleccionado.
            if _candidate_test_available(candidate):
                test_metrics = candidate.get(
                    "testMetrics",
                    {},
                )

                test_ci = candidate.get(
                    "testCI95",
                    {},
                )

                if not isinstance(
                    test_metrics,
                    Mapping,
                ):
                    test_metrics = {}

                if not isinstance(
                    test_ci,
                    Mapping,
                ):
                    test_ci = {}

                _append_row(
                    comparison_ws,
                    comparison_columns,
                    {
                        **base,
                        "phase": "TEST_FINAL",
                        **dict(test_metrics),
                        **dict(test_ci),
                    },
                )

    style_sheet(comparison_ws)

    # -----------------------------------------------------------------------
    # 2. Partición de datos y metodología
    # -----------------------------------------------------------------------

    partition_columns = [
        "target",
        "targetLabel",
        "trainRows",
        "validationRows",
        "testRows",
        "trainPercent",
        "validationPercent",
        "testPercent",
        "crossValidation",
        "selectionMethod",
        "testPolicy",
    ]

    partition_rows: list[dict[str, Any]] = []

    for result in results.values():
        target_split = result.split

        train_rows = int(
            target_split.get(
                "train",
                split.get("train", 0),
            )
        )

        validation_rows = int(
            target_split.get(
                "validation",
                split.get("validation", 0),
            )
        )

        test_rows = int(
            target_split.get(
                "test",
                split.get("test", 0),
            )
        )

        total_rows = (
            train_rows
            + validation_rows
            + test_rows
        )

        if total_rows > 0:
            train_pct = (
                train_rows
                / total_rows
                * 100
            )

            validation_pct = (
                validation_rows
                / total_rows
                * 100
            )

            test_pct = (
                test_rows
                / total_rows
                * 100
            )
        else:
            train_pct = np.nan
            validation_pct = np.nan
            test_pct = np.nan

        partition_rows.append(
            {
                "target": result.key,
                "targetLabel": result.label,
                "trainRows": train_rows,
                "validationRows": validation_rows,
                "testRows": test_rows,
                "trainPercent": train_pct,
                "validationPercent": validation_pct,
                "testPercent": test_pct,
                "crossValidation": (
                    "StratifiedKFold adaptativo, "
                    "shuffle=True, random_state configurable"
                ),
                "selectionMethod": (
                    "CV + VALIDATION; score compuesto de calidad"
                ),
                "testPolicy": (
                    "TEST no interviene en selección; "
                    "solo evaluación final del modelo seleccionado"
                ),
            }
        )

    _write_sheet(
        wb,
        "Particion_Datos",
        partition_columns,
        partition_rows,
    )

    # -----------------------------------------------------------------------
    # 3. Hiperparámetros
    # -----------------------------------------------------------------------

    hyperparameter_columns = [
        "target",
        "targetLabel",
        "algorithm",
        "family",
        "hyperparameters",
    ]

    hyperparameter_rows: list[dict[str, Any]] = []

    for result in results.values():
        for candidate in result.candidates:
            algorithm = str(
                candidate.get(
                    "model",
                    "",
                )
            )

            hyperparameter_rows.append(
                {
                    "target": result.key,
                    "targetLabel": result.label,
                    "algorithm": algorithm,
                    "family": _algorithm_family(
                        algorithm
                    ),
                    "hyperparameters": _safe_json(
                        candidate.get(
                            "hyperparameters",
                            {},
                        )
                    ),
                }
            )

    _write_sheet(
        wb,
        "Hiperparametros",
        hyperparameter_columns,
        hyperparameter_rows,
    )

    # -----------------------------------------------------------------------
    # 4. Importancia de variables
    # -----------------------------------------------------------------------

    importance_columns = [
        "target",
        "algorithm",
        "feature",
        "importance",
        "importanceStd",
        "method",
    ]

    importance_rows: list[dict[str, Any]] = []

    for result in results.values():
        importance_path = (
            output_dir
            / "Model_Reports"
            / result.key
            / "feature_importance.csv"
        )

        if not importance_path.exists():
            continue

        try:
            importance_df = pd.read_csv(
                importance_path
            )

            for _, row in importance_df.iterrows():
                importance_rows.append(
                    _pandas_row_to_mapping(row)
                )

        except Exception:
            # El reporte principal no debe fallar porque falte
            # un archivo diagnóstico.
            continue

    _write_sheet(
        wb,
        "Variables_Relevantes",
        importance_columns,
        importance_rows,
    )

    # -----------------------------------------------------------------------
    # 5. Tiempos de predicción
    # -----------------------------------------------------------------------

    timing_columns = [
        "target",
        "targetLabel",
        "algorithm",
        "latencyMeanMs",
        "latencyStdMs",
        "latencyPerRecordMs",
    ]

    timing_rows: list[dict[str, Any]] = []

    for result in results.values():
        for candidate in result.candidates:
            test_metrics = candidate.get(
                "testMetrics",
                {},
            )

            if not isinstance(
                test_metrics,
                Mapping,
            ):
                continue

            if not test_metrics.get(
                "available"
            ):
                continue

            timing_rows.append(
                {
                    "target": result.key,
                    "targetLabel": result.label,
                    "algorithm": str(
                        candidate.get(
                            "model",
                            "",
                        )
                    ),
                    "latencyMeanMs": test_metrics.get(
                        "predictionLatencyMs",
                        np.nan,
                    ),
                    "latencyStdMs": test_metrics.get(
                        "predictionLatencyStdMs",
                        np.nan,
                    ),
                    "latencyPerRecordMs": test_metrics.get(
                        "responseTimeMsPerRecord",
                        np.nan,
                    ),
                }
            )

    _write_sheet(
        wb,
        "Tiempos_Prediccion",
        timing_columns,
        timing_rows,
    )

    # -----------------------------------------------------------------------
    # 6. Targets omitidos
    # -----------------------------------------------------------------------

    if skipped_targets:
        skipped_columns = [
            "target",
            "column",
            "reason",
            "validRows",
            "classes",
            "classDistribution",
        ]

        skipped_rows: list[dict[str, Any]] = []

        for key, info in skipped_targets.items():
            if isinstance(info, Mapping):
                skipped_rows.append(
                    {
                        "target": key,
                        **dict(info),
                    }
                )
            else:
                skipped_rows.append(
                    {
                        "target": key,
                        "reason": str(info),
                    }
                )

        _write_sheet(
            wb,
            "Targets_Omitidos",
            skipped_columns,
            skipped_rows,
        )

    # -----------------------------------------------------------------------
    # 7. Resumen final
    # -----------------------------------------------------------------------

    summary_columns = [
        "target",
        "targetLabel",
        "selectedAlgorithm",
        "selectionThresholdMet",
        "testAccuracy",
        "testPrecision",
        "testRecall",
        "testF1",
        "testROCAUC",
        "testMCC",
        "normalizedQualityPercent",
        "artifact",
    ]

    summary_rows: list[dict[str, Any]] = []

    for result in results.values():
        test_metrics = result.test or {}

        if not isinstance(
            test_metrics,
            Mapping,
        ):
            test_metrics = {}

        summary_rows.append(
            {
                "target": result.key,
                "targetLabel": result.label,
                "selectedAlgorithm": (
                    result.selected or ""
                ),
                "selectionThresholdMet": (
                    "SI"
                    if result.threshold_met
                    else "NO"
                ),
                "testAccuracy": test_metrics.get(
                    "accuracy",
                    np.nan,
                ),
                "testPrecision": test_metrics.get(
                    "precision",
                    np.nan,
                ),
                "testRecall": test_metrics.get(
                    "recallSensitivity",
                    np.nan,
                ),
                "testF1": test_metrics.get(
                    "f1",
                    np.nan,
                ),
                "testROCAUC": test_metrics.get(
                    "auc",
                    np.nan,
                ),
                "testMCC": test_metrics.get(
                    "mcc",
                    np.nan,
                ),
                "normalizedQualityPercent": test_metrics.get(
                    "normalizedQualityPercent",
                    np.nan,
                ),
                "artifact": result.artifact or "",
            }
        )

    _write_sheet(
        wb,
        "Resumen",
        summary_columns,
        summary_rows,
    )

    # -----------------------------------------------------------------------
    # 8. Detalle de validación cruzada
    # -----------------------------------------------------------------------

    cv_columns = [
        "target",
        "targetLabel",
        "algorithm",
        "fold",
        "accuracy",
        "precision",
        "recallSensitivity",
        "f1",
        "auc",
        "mcc",
        "kappa",
        "balancedAccuracy",
        "trainingTimeSeconds",
        "trainRows",
        "validationRows",
        "error",
    ]

    cv_rows: list[dict[str, Any]] = []

    for result in results.values():
        for candidate in result.candidates:
            fold_metrics = candidate.get(
                "cvFoldMetrics",
                [],
            )

            if not isinstance(
                fold_metrics,
                Sequence,
            ):
                continue

            for fold_number, metrics in enumerate(
                fold_metrics,
                start=1,
            ):
                if isinstance(
                    metrics,
                    Mapping,
                ):
                    metric_mapping = dict(metrics)
                else:
                    metric_mapping = {
                        "error": str(metrics)
                    }

                cv_rows.append(
                    {
                        "target": result.key,
                        "targetLabel": result.label,
                        "algorithm": str(
                            candidate.get(
                                "model",
                                "",
                            )
                        ),
                        "fold": fold_number,
                        **metric_mapping,
                    }
                )

    _write_sheet(
        wb,
        "CV_Detallado",
        cv_columns,
        cv_rows,
    )

    # -----------------------------------------------------------------------
    # 9. Variables seleccionadas
    # -----------------------------------------------------------------------

    variable_columns = [
        "target",
        "targetLabel",
        "feature",
        "tipo_seleccion",
        "descripcion",
    ]

    descriptions = {
        "EDAD": "Edad del paciente en años.",
        "Genero Sexo": "Sexo/género registrado en el dataset.",
        "PackHistory": (
            "Antecedente de exposición acumulada al tabaco "
            "expresado como pack-history."
        ),
        "COPDSEVERITY": (
            "Categoría clínica de severidad de EPOC; "
            "no se usa para evitar fuga del target GOLD."
        ),
        "MWT1": (
            "Distancia del primer test de marcha de 6 minutos, "
            "cuando está disponible."
        ),
        "MWT2": (
            "Distancia del segundo test de marcha de 6 minutos."
        ),
        "MWT1Best": (
            "Mejor distancia registrada en el test de marcha."
        ),
        "FEV1": (
            "Volumen espiratorio forzado en el primer segundo "
            "o categoría porcentual registrada."
        ),
        "FEV1PRED": (
            "FEV1 expresado como porcentaje del valor predicho."
        ),
        "FVC": "Capacidad vital forzada.",
        "FVCPRED": (
            "FVC expresada como porcentaje del valor predicho."
        ),
        "CAT": "Puntaje del COPD Assessment Test.",
        "HAD": "Puntaje de escala HAD registrado.",
        "SGRQ": (
            "Puntaje del St George's Respiratory Questionnaire."
        ),
        "smoking": (
            "Variable codificada de antecedente de tabaquismo."
        ),
        "AtrialFib": (
            "Indicador registrado de fibrilación auricular."
        ),
        "BMI,kg/m2 (IMC)": (
            "Índice de masa corporal o categoría de IMC."
        ),
        "Location": "Ubicación geográfica registrada.",
        "mMRC": (
            "Escala modificada del Medical Research Council "
            "para disnea."
        ),
        "status of smoking": (
            "Estado actual/antecedente de tabaquismo."
        ),
        "Temperature": (
            "Temperatura o categoría térmica registrada."
        ),
        "Respiratory Rate": (
            "Frecuencia respiratoria registrada."
        ),
        "Heart Rate": (
            "Frecuencia cardiaca o categoría registrada."
        ),
        "Blood pressure": (
            "Presión arterial registrada o categoría."
        ),
        "Oxygen Saturation": (
            "Saturación periférica de oxígeno registrada."
        ),
        "Sputum": (
            "Características/presencia del esputo."
        ),
        "Asma": (
            "Antecedente/indicador de asma cuando existe información."
        ),
        "NOMBRE_DIAG": (
            "Diagnóstico registrado en la fuente clínica."
        ),
        "PESO": (
            "Peso corporal en la unidad registrada."
        ),
        "TALLA(altura ó Height/m)": (
            "Estatura del paciente; se conserva como predictor."
        ),
        "DISCAPACIDAD": (
            "Indicador de discapacidad registrado."
        ),
        "TIPODISCAPAC": (
            "Tipo de discapacidad registrada."
        ),
        "OCUPACION": (
            "Ocupación registrada del paciente."
        ),
        "Altura_MSNM": (
            "Altitud del lugar de atención/localización "
            "en metros sobre el nivel del mar."
        ),
        "CLIN_FEV1_PERCENT_NUMERIC": (
            "FEV1 porcentual normalizado desde formatos "
            "textuales del dataset."
        ),
        "CLIN_FEV1_FVC_RATIO": (
            "Relación FEV1/FVC derivada."
        ),
        "CLIN_O2_DESATURATION": (
            "Complemento 100 - saturación registrada; "
            "representa desaturación observada en la escala disponible."
        ),
        "CLIN_BMI_DERIVED": (
            "IMC derivado de peso y talla cuando ambos "
            "están disponibles."
        ),
        "CLIN_SBP": (
            "Presión arterial sistólica extraída de una "
            "presión con formato sistólica/diastólica."
        ),
        "CLIN_DBP": (
            "Presión arterial diastólica extraída de una "
            "presión con formato sistólica/diastólica."
        ),
        "CLIN_MAP": (
            "Presión arterial media aproximada: "
            "(sistólica + 2×diastólica)/3."
        ),
    }

    variable_rows: list[dict[str, Any]] = []

    for result in results.values():
        feature_columns = getattr(
            result,
            "feature_columns",
            [],
        )

        if not isinstance(
            feature_columns,
            Sequence,
        ):
            continue

        for feature in feature_columns:
            variable_rows.append(
                {
                    "target": result.key,
                    "targetLabel": result.label,
                    "feature": str(feature),
                    "tipo_seleccion": "seleccionado_por_target",
                    "descripcion": descriptions.get(
                        str(feature),
                        (
                            "Variable predictora disponible en "
                            "el dataset; revisar definición de origen."
                        ),
                    ),
                }
            )

    _write_sheet(
        wb,
        "Variables_Seleccionadas",
        variable_columns,
        variable_rows,
    )

    # -----------------------------------------------------------------------
    # 10. Distribución de clases
    # -----------------------------------------------------------------------

    class_columns = [
        "target",
        "targetLabel",
        "clase",
        "n",
        "porcentaje",
    ]

    class_rows: list[dict[str, Any]] = []

    for result in results.values():
        distribution = (
            result.testClassDistribution or {}
        )

        if not isinstance(
            distribution,
            Mapping,
        ):
            continue

        total = sum(
            float(count)
            for count in distribution.values()
            if isinstance(
                count,
                (int, float, np.integer, np.floating),
            )
        )

        total = total or 1.0

        for cls, count in distribution.items():
            class_rows.append(
                {
                    "target": result.key,
                    "targetLabel": result.label,
                    "clase": str(cls),
                    "n": count,
                    "porcentaje": float(
                        count / total
                    ),
                }
            )

    _write_sheet(
        wb,
        "Distribucion_Targets",
        class_columns,
        class_rows,
    )

    # -----------------------------------------------------------------------
    # 11. Hoja de gráficos
    # -----------------------------------------------------------------------

    chart_ws = wb.create_sheet(
        "Graficos"
    )

    chart_ws["A1"] = "Artefactos gráficos"

    chart_ws["A1"].font = Font(
        bold=True,
        size=14,
    )

    chart_ws["A3"] = (
        "Los gráficos detallados por target se exportan "
        "como PNG en Model_Reports/<target>/."
    )

    chart_ws["A4"] = (
        "Incluyen ROC comparativa, matrices de confusión, "
        "métricas, latencia y curvas de aprendizaje cuando corresponda."
    )

    # -----------------------------------------------------------------------
    # 12. Datos auxiliares para gráfico de métricas
    # -----------------------------------------------------------------------

    chart_data_columns = [
        "target",
        "algorithm",
        "precision",
        "accuracy",
        "recallSensitivity",
        "f1",
        "auc",
    ]

    chart_data_rows: list[dict[str, Any]] = []

    for result in results.values():
        for candidate in result.candidates:
            test_metrics = candidate.get(
                "testMetrics",
                {},
            )

            if not isinstance(
                test_metrics,
                Mapping,
            ):
                continue

            if not test_metrics.get(
                "available"
            ):
                continue

            chart_data_rows.append(
                {
                    "target": result.key,
                    "algorithm": str(
                        candidate.get(
                            "model",
                            "",
                        )
                    ),
                    "precision": test_metrics.get(
                        "precision",
                        np.nan,
                    ),
                    "accuracy": test_metrics.get(
                        "accuracy",
                        np.nan,
                    ),
                    "recallSensitivity": test_metrics.get(
                        "recallSensitivity",
                        np.nan,
                    ),
                    "f1": test_metrics.get(
                        "f1",
                        np.nan,
                    ),
                    "auc": test_metrics.get(
                        "auc",
                        np.nan,
                    ),
                }
            )

    if chart_data_rows:
        chart_data_ws = _write_sheet(
            wb,
            "Datos_Grafico_Metricas",
            chart_data_columns,
            chart_data_rows,
        )

        chart = BarChart()

        chart.title = (
            "Métricas TEST del modelo seleccionado"
        )

        chart.y_axis.title = "Valor"
        chart.x_axis.title = "Algoritmo"

        chart.add_data(
            Reference(
                chart_data_ws,
                min_col=3,
                max_col=7,
                min_row=1,
                max_row=chart_data_ws.max_row,
            ),
            titles_from_data=True,
        )

        chart.set_categories(
            Reference(
                chart_data_ws,
                min_col=2,
                min_row=2,
                max_row=chart_data_ws.max_row,
            )
        )

        chart.height = 9
        chart.width = 20

        chart_ws.add_chart(
            chart,
            "A6",
        )

    # -----------------------------------------------------------------------
    # 13. Metadatos del reporte
    # -----------------------------------------------------------------------

    metadata_ws = wb.create_sheet(
        "Metadatos"
    )

    metadata = [
        (
            "Tipo de reporte",
            "Resultados de entrenamiento ML",
        ),
        (
            "Selección",
            "CV + VALIDATION; TEST reservado para evaluación final",
        ),
        (
            "Umbrales",
            _safe_json(
                dict(thresholds)
            ),
        ),
        (
            "Train global",
            split.get(
                "train",
                0,
            ),
        ),
        (
            "Validation global",
            split.get(
                "validation",
                0,
            ),
        ),
        (
            "Test global",
            split.get(
                "test",
                0,
            ),
        ),
        (
            "Uso de TEST",
            "Exclusivamente evaluación final del modelo seleccionado; "
            "no participa en selección, ranking ni ajuste de hiperparámetros",
        ),
        (
            "Score de selección",
            "Score compuesto definido por el proyecto; "
            "no corresponde a una métrica clínica estándar",
        ),
    ]

    metadata_ws.append(
        [
            "campo",
            "valor",
        ]
    )

    for field, value in metadata:
        metadata_ws.append(
            [
                excel_cell(field),
                excel_cell(value),
            ]
        )

    style_sheet(metadata_ws)

    # -----------------------------------------------------------------------
    # Guardado
    # -----------------------------------------------------------------------

    output_path = (
        output_dir
        / "training_metrics_report.xlsx"
    )

    wb.save(
        output_path
    )

    return output_path
