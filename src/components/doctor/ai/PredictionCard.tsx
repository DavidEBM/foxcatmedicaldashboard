"use client";

import type {
  AiPrediction,
  AiValidationVerdict,
} from "@/types/doctor-ai-validation";

import {
  getRiskClass,
  getRiskLabel,
} from "@/lib/doctor/ai-validation/predictions";

import { formatHorizon } from "@/lib/doctor/ai-validation/timeline";

import PredictionChart from "./PredictionChart";

interface PredictionCardProps {
  prediction: AiPrediction;
  saving: boolean;
  selectedVerdict?: AiValidationVerdict;
  onValidate: (
    prediction: AiPrediction,
    verdict: AiValidationVerdict,
  ) => void;
  showChart?: boolean;
}

export default function PredictionCard({
  prediction,
  saving,
  selectedVerdict,
  onValidate,
  showChart = true,
}: PredictionCardProps) {
  const riskClass = getRiskClass(
    prediction.risk,
  );

  const riskLabel = getRiskLabel(
    prediction.risk,
  );

  const sourceLabel =
    prediction.source === "backend"
      ? "Modelo de inferencia"
      : "Estimación local";

  return (
    <article className="ai-validation-card">
      <div className="ai-validation-card-head">
        <div className="ai-validation-card-title">
          <strong>{prediction.label}</strong>

          <span className="ai-validation-source">
            {sourceLabel}
          </span>
        </div>

        <div
          className={`ai-validation-risk ${riskClass}`}
        >
          <span>Riesgo actual</span>
          <strong>{prediction.risk}<small>%</small></strong>
          <span>{riskLabel}</span>
        </div>
      </div>

      <div className="ai-validation-current">
        <span>Predicción inicial</span>

        <strong>
          {prediction.risk}% ·{" "}
          {formatHorizon(
            prediction.horizonHours,
          )}
        </strong>
      </div>

      {showChart && (
        <PredictionChart
          timeline={prediction.timeline}
        />
      )}

      <div className="ai-validation-timeline" aria-label="Valores de riesgo por ventana temporal">
        {prediction.timeline.map(
          (point) => (
            <div
              className="ai-validation-point"
              key={`${prediction.key}-${point.hours}`}
            >
              <span>{point.label}</span>
              <strong>
                {point.risk}%
              </strong>
            </div>
          ),
        )}
      </div>

      <div className="ai-validation-actions">
        <button
          type="button"
          className={`ai-validation-button ai-validation-button-valid ${
            selectedVerdict === "valid"
              ? "selected"
              : ""
          }`}
          aria-pressed={selectedVerdict === "valid"}
          disabled={saving}
          onClick={() =>
            onValidate(
              prediction,
              "valid",
            )
          }
        >
          {saving &&
          selectedVerdict === "valid"
            ? "Guardando..."
            : "Validar predicción"}
        </button>

        <button
          type="button"
          className={`ai-validation-button ai-validation-button-incorrect ${
            selectedVerdict === "incorrect"
              ? "selected"
              : ""
          }`}
          aria-pressed={selectedVerdict === "incorrect"}
          disabled={saving}
          onClick={() =>
            onValidate(
              prediction,
              "incorrect",
            )
          }
        >
          {saving &&
          selectedVerdict === "incorrect"
            ? "Guardando..."
            : "Marcar incorrecta"}
        </button>
      </div>

      {selectedVerdict && (
        <div
          className={`ai-validation-result ${
            selectedVerdict === "valid"
              ? "success"
              : "incorrect"
          }`}
          aria-live="polite"
        >
          {selectedVerdict === "valid"
            ? "Predicción marcada como válida."
            : "Predicción marcada como incorrecta."}
        </div>
      )}
    </article>
  );
}
