"use client";

import type { ConsultationAnalysis } from "@/types/doctor-clinical";

interface ConsultationAnalysisProps {
  analysis: ConsultationAnalysis | null;
  onSchedule?: () => void;
  onSendSummary?: () => void;
}

export default function ConsultationAnalysis({
  analysis,
  onSchedule,
  onSendSummary,
}: ConsultationAnalysisProps) {
  if (!analysis) {
    return (
      <div className="empty-state">
        Selecciona un paciente para ver un resumen condensado de la
        IA, puntos fuertes, débiles y recomendaciones de consulta.
      </div>
    );
  }

  return (
    <div className="consultation-analysis">
      <div className="consultation-hero">
        <strong>{analysis.headline}</strong>
        <p>{analysis.importantSummary}</p>
      </div>

      <article className="consultation-card consultation-time-card">
        <strong>Riesgo en el tiempo</strong>
        <p>{analysis.timeline.summary}</p>
      </article>

      <div className="consultation-grid">
        <article className="consultation-card">
          <strong>Puntos fuertes</strong>

          <ul className="consultation-list">
            {analysis.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="consultation-card">
          <strong>Puntos débiles</strong>

          <ul className="consultation-list">
            {analysis.weaknesses.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>

      <article className="consultation-card">
        <strong>
          Recomendaciones cortas para el medico
        </strong>

        <ul className="consultation-list">
          {analysis.conciseRecommendations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

      <div className="consultation-grid">
        <article className="consultation-card">
          <strong>Tiempo con riesgo muy bajo</strong>
          <p>{analysis.lowRiskWindow}</p>
        </article>

        <article className="consultation-card">
          <strong>
            Cuándo empezaría a ser peligroso
          </strong>

          <p>
            Si no cumple recomendaciones,{" "}
            {analysis.dangerStart}.
          </p>
        </article>
      </div>

      <article className="consultation-card">
        <strong>Posibles afectaciones futuras</strong>

        <ul className="consultation-list">
          {analysis.futureEffects.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

      <div className="consultation-actions">
        <button
          type="button"
          className="ai-primary"
          onClick={onSchedule}
        >
          Agendar Cita
        </button>

        <button
          type="button"
          className="ai-secondary"
          onClick={onSendSummary}
        >
          Mandar Resumen al paciente
        </button>
      </div>
    </div>
  );
}