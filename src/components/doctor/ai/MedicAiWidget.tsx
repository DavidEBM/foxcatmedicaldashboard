"use client";

import type {
  ClinicalAssessment,
} from "@/types/doctor-ai";
import type { Patient } from "@/types/doctor-patients";

import AiMethodGrid from "./AiMethodGrid";

interface DomainRiskRow {
  label: string;
  values: number[];
}

interface ClinicalCurvePoint {
  x: number;
  y: number;
}

interface MedicAiWidgetProps {
  patient: Patient | null;
  assessment: ClinicalAssessment | null;

  trainingLines: string[];

  domainTimeline: DomainRiskRow[];

  riskDrivers: string[];
  protectiveFactors: string[];

  spo2Curve: ClinicalCurvePoint[];
  respiratoryRateCurve: ClinicalCurvePoint[];

  riskTone: (risk: number) => string;

  renderClinicalCurve: (
    points: ClinicalCurvePoint[],
    title: string,
  ) => React.ReactNode;

  onAction?: (
    action: string,
  ) => void;
}

export default function MedicAiWidget({
  patient,
  assessment,
  trainingLines,
  domainTimeline,
  riskDrivers,
  protectiveFactors,
  spo2Curve,
  respiratoryRateCurve,
  riskTone,
  renderClinicalCurve,
  onAction,
}: MedicAiWidgetProps) {
  if (!patient || !assessment) {
    return (
      <div className="empty-state">
        La IA médica se activa cuando seleccionas un paciente.
        Tomará los datos clínicos actuales y los comparará
        con el perfil base cargado desde la carpeta de
        entrenamiento.
      </div>
    );
  }

  return (
    <div className="ai-hero">
      <div className="ai-summary">
        <strong>{assessment.summary}</strong>

        <p>
          Análisis personalizado para{" "}
          {patient.name} en{" "}
          {assessment.region.label}. Se compara contra la
          base local y se ajusta por altitud, carga
          respiratoria y comorbilidades.
        </p>
      </div>

      <div className="ai-detail-card ai-forecast-card">
        <strong>
          Pronóstico anticipado si no se trata
        </strong>

        <p className="ai-detail">
          {assessment.forecast.deterioration}
        </p>

        <div className="ai-inline">
          <span className="soft-pill">
            Ventana crítica:{" "}
            {assessment.forecast.horizon}
          </span>

          <span className="soft-pill">
            Confianza {assessment.confidence}%
          </span>

          <span className="soft-pill">
            Frente dominante:{" "}
            {assessment.dominantRiskType}
          </span>
        </div>

        <p className="ai-detail">
          {assessment.forecast.watchSignal}
        </p>

        <p className="ai-disclaimer">
          {assessment.forecast.ifUntreated}
        </p>
      </div>

      <div className="domain-risk-panel">
        <div className="domain-risk-head">
          <strong>
            Interpretabilidad por dominio clínico
          </strong>

          <span>
            Cada ventana separa frente respiratorio,
            cardiaco y síntomas de alarma.
          </span>
        </div>

        <div className="domain-risk-table">
          <div className="domain-risk-row domain-risk-header">
            <span>Dominio</span>
            <span>Actual</span>
            <span>24 h</span>
            <span>7 días</span>
            <span>30 días</span>
          </div>

          {domainTimeline.map((row) => (
            <div
              className="domain-risk-row"
              key={row.label}
            >
              <strong>{row.label}</strong>

              {row.values.map((value, index) => (
                <span
                  key={`${row.label}-${index}`}
                >
                  {value}%

                  <small>
                    {riskTone(value).replace(
                      "Riesgo ",
                      "",
                    )}
                  </small>

                  <i
                    style={{
                      ["--risk-width" as string]:
                        `${value}%`,
                    }}
                  />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="explainability-grid">
        <article className="ai-detail-card">
          <strong>
            Factores que aumentan riesgo
          </strong>

          <ul className="ai-detail-list">
            {riskDrivers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="ai-detail-card">
          <strong>
            Factores protectores
          </strong>

          <ul className="ai-detail-list">
            {protectiveFactors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>

      <div className="ai-detail-card">
        <strong>
          Curvas clínicas de sensibilidad
        </strong>

        <p className="ai-detail">
          Muestran cómo cambia el riesgo estimado al
          mover SpO2 o frecuencia respiratoria,
          manteniendo el resto del caso constante.
        </p>

        <div className="clinical-curve-grid">
          {renderClinicalCurve(
            spo2Curve,
            "Riesgo vs SpO2",
          )}

          {renderClinicalCurve(
            respiratoryRateCurve,
            "Riesgo vs FR",
          )}
        </div>
      </div>

      <div className="ai-detail-card">
        <strong>
          Métodos IA aplicados al caso
        </strong>

        <AiMethodGrid
          methods={assessment.aiMethods}
        />
      </div>

      <div className="ai-details-grid">
        <div className="ai-detail-card">
          <strong>
            Detonantes clínicos
          </strong>

          <ul className="ai-detail-list">
            {assessment.triggers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="ai-detail-card">
          <strong>
            Recomendaciones para el médico
          </strong>

          <ul className="ai-detail-list">
            {assessment.recommendations.map(
              (item) => (
                <li key={item}>{item}</li>
              ),
            )}
          </ul>
        </div>
      </div>

      <div className="ai-detail-card">
        <strong>
          Base de calibración
        </strong>

        <div className="ai-inline">
          {trainingLines.map((line) => (
            <span
              className="soft-pill"
              key={line}
            >
              {line}
            </span>
          ))}

          <span className="soft-pill">
            Confianza {assessment.confidence}%
          </span>

          <span className="soft-pill">
            O2 esperada aprox.{" "}
            {Math.round(
              assessment.expectedOxygen,
            )}
            %
          </span>
        </div>

        <p className="ai-detail">
          {assessment.environmentalSummary}
        </p>

        <p className="ai-disclaimer">
          Esta ayuda es orientativa y explicable.
          No sustituye juicio clínico, triage
          presencial ni protocolos institucionales.
        </p>
      </div>

      <div className="ai-actions">
        <button
          type="button"
          className="ai-primary"
          onClick={() => onAction?.("schedule")}
        >
          Agendar cita
        </button>

        <button
          type="button"
          className="ai-secondary"
          onClick={() =>
            onAction?.("alert-patient")
          }
        >
          Mandar alerta al paciente
        </button>

        <select
          id="aiActionSelect"
          className="ai-select"
          defaultValue=""
          onChange={(event) =>
            onAction?.(event.target.value)
          }
        >
          <option value="">
            Menú de acciones útiles
          </option>

          <option value="care-plan">
            Plan sugerido
          </option>

          <option value="remote-monitoring">
            Monitoreo remoto
          </option>

          <option value="quick-history">
            Historial rápido
          </option>

          <option value="calendar-view">
            Calendario
          </option>

          <option value="shift-notes">
            Notas del turno
          </option>
        </select>
      </div>
    </div>
  );
}