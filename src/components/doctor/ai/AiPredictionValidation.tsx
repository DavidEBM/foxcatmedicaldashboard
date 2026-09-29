"use client";

import { useEffect, useState } from "react";

import type {
  AiPrediction,
  AiValidationVerdict,
} from "@/types/doctor-ai-validation";

import type {
  ClinicalAssessment,
  TrainingManifest,
  TrainingProfile,
} from "@/types/doctor-clinical";

import type { Patient } from "@/types/doctor-patients";

import {
  buildPredictionCatalog,
  getRiskClass,
} from "@/lib/doctor/ai-validation/predictions";
import {
  canonicalizePredictionKey,
  subscribeToPatientValidationVerdicts,
  type PatientValidationVerdicts,
} from "@/services/firebase/ai-validation.service";
import { formatHorizon } from "@/lib/doctor/ai-validation/timeline";

import {
  useAiPredictionValidation,
} from "@/hooks/doctor/useAiPredictionValidation";

import PredictionCard from "./PredictionCard";
import PredictionChart from "./PredictionChart";

type AiPanel = "summary" | "validation" | "charts";

const BACKEND_TARGETS_FOR_LOCAL: Record<string, string[]> = {
  "respiratory-risk": ["copd_gold", "respiratory-risk"],
  "cardiac-risk": ["history_of_heart_failure", "cardiac-risk"],
  "danger-symptom-risk": ["danger-symptom-risk"],
};

interface AiPredictionValidationProps {
  patient: Patient | null;
  assessment: ClinicalAssessment | null;

  doctorUid: string | null;

  trainingProfile: TrainingProfile;
  trainingManifest?: TrainingManifest | null;
}

export default function AiPredictionValidation({
  patient,
  assessment,
  doctorUid,
  trainingProfile,
  trainingManifest,
}: AiPredictionValidationProps) {
  const {
    savingPredictionKey,
    validatePrediction,
  } = useAiPredictionValidation({
    doctorUid,
  });

  const [
    selectedVerdicts,
    setSelectedVerdicts,
  ] = useState<
    Record<string, AiValidationVerdict>
  >({});

  const [backendPredictions, setBackendPredictions] = useState<AiPrediction[]>([]);
  const [backendPatientId, setBackendPatientId] = useState<string | null>(null);
  const [persistedVerdicts, setPersistedVerdicts] = useState<PatientValidationVerdicts>({});
  const [activePanel, setActivePanel] = useState<AiPanel>("validation");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToPatientValidationVerdicts(doctorUid, patient?.id ?? null, {
      onData: setPersistedVerdicts,
    });
  }, [doctorUid, patient?.id]);

  useEffect(() => {
    if (!patient || !assessment) {
      return;
    }

    let cancelled = false;
    void fetch("/api/ai-predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patient),
    })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Backend IA no disponible")))
      .then((payload) => {
        if (cancelled) return;
        const predictions = Array.isArray(payload.predictions) ? payload.predictions : [];
        setBackendPredictions(predictions.map((item: Record<string, unknown>) => {
          const probabilities = Array.isArray(item.probabilities) ? item.probabilities.map(Number) : [];
          const hasDirectRisk = item.risk !== null && item.risk !== undefined && item.risk !== "" && Number.isFinite(Number(item.risk));
          const risk = hasDirectRisk
            ? Number(item.risk)
            : probabilities.some(Number.isFinite) ? Math.round(Math.max(...probabilities.filter(Number.isFinite)) * 100) : null;
          if (risk === null) return null;
          return {
            key: String(item.key),
            label: String(item.label),
            risk,
            horizonHours: 24,
            timeline: [{ hours: 24, label: "24 h", risk }],
            source: "backend",
            modelName: String(item.modelName ?? "Modelo ML"),
            artifact: String(item.artifact ?? ""),
            target: String(item.key),
          } satisfies AiPrediction;
        }).filter((prediction: AiPrediction | null): prediction is AiPrediction => prediction !== null));
        setBackendPatientId(patient.id);
      })
      .catch(() => {
        if (!cancelled) setBackendPredictions([]);
      });

    return () => { cancelled = true; };
  }, [patient, assessment]);

  if (!patient || !assessment) {
    return null;
  }

  const localPredictions =
    buildPredictionCatalog(
      patient,
      assessment,
      trainingProfile,
      trainingManifest,
    );

  const patientBackendPredictions = backendPatientId === patient.id
    ? backendPredictions
    : [];
  const localPredictionsNotCovered = localPredictions.filter((localPrediction) =>
    !patientBackendPredictions.some((backendPrediction) =>
      (BACKEND_TARGETS_FOR_LOCAL[localPrediction.target] ?? [localPrediction.target])
        .includes(backendPrediction.target),
    ),
  );
  const predictions = [
    ...patientBackendPredictions,
    ...localPredictionsNotCovered,
  ];

  if (!predictions.length) {
    return null;
  }

  const handleValidate = async (
    prediction: AiPrediction,
    verdict: AiValidationVerdict,
  ) => {
    setValidationMessage(null);

    try {
      await validatePrediction(
        {
          patient,
          prediction,
        },
        verdict,
      );
      setSelectedVerdicts((current) => ({
        ...current,
        [prediction.key]: verdict,
      }));
      setValidationMessage(verdict === "valid"
        ? "Validación guardada como validado."
        : "Validación guardada como no validado.");
    } catch (error) {
      console.error(
        "Error registrando validación IA:",
        error,
      );
      setValidationMessage(error instanceof Error
        ? error.message
        : "No se pudo guardar la validación. Revisa la sesión y los permisos de Firestore.");
    }
  };

  return (
    <section className="ai-validation-widget">
      <div className="ai-validation-header">
        <div className="ai-validation-header-copy">
          <span className="ai-validation-eyebrow">Apoyo a la decisión clínica</span>
          <h3>Validación de predicciones IA</h3>

          <p>
            Revisa las predicciones mostradas
            para {patient.name} y registra si
            consideras que son correctas o
            incorrectas.
          </p>
        </div>

        <span className="ai-validation-badge">Revisión clínica</span>
      </div>

      <div className="ai-validation-disclaimer">
        <span aria-hidden="true">●</span>
        <p>
          Marca cada resultado como válido o incorrecto. Esta acción registra
          la revisión del médico y no modifica el modelo automáticamente.
        </p>
      </div>

      <div className="ai-validation-tabs" role="tablist" aria-label="Secciones del asistente IA">
        <button type="button" className={activePanel === "summary" ? "is-active" : ""} onClick={() => setActivePanel("summary")} role="tab" aria-selected={activePanel === "summary"}>
          <span>Resumen</span>
        </button>
        <button type="button" className={activePanel === "validation" ? "is-active" : ""} onClick={() => setActivePanel("validation")} role="tab" aria-selected={activePanel === "validation"}>
          <span>Validar</span><span>{predictions.length}</span>
        </button>
        <button type="button" className={activePanel === "charts" ? "is-active" : ""} onClick={() => setActivePanel("charts")} role="tab" aria-selected={activePanel === "charts"}>
          <span>Riesgo vs. tiempo</span>
        </button>
      </div>

      {activePanel === "summary" && (
        <div className="ai-validation-summary-panel">
          <div className="ai-validation-summary-hero">
            <span className="ai-validation-summary-kicker">Paciente analizado</span>
            <strong>{patient.name}</strong>
            <span>{patient.condition} · {patient.status}</span>
          </div>
          <div className="ai-validation-summary-metrics">
            <div><span>Predicciones</span><strong>{predictions.length}</strong></div>
            <div><span>Mayor riesgo</span><strong>{Math.max(...predictions.map((item) => item.risk))}%</strong></div>
            <div><span>Motor</span><strong>{predictions[0]?.modelName || "Local"}</strong></div>
          </div>
          <p className="ai-validation-summary-note">Revisa cada resultado antes de incorporarlo a la valoración clínica. La decisión final siempre corresponde al médico.</p>
        </div>
      )}

      {activePanel === "validation" && (
        <>
          <div className="ai-validation-grid">
            {predictions.map((prediction) => (
              <PredictionCard
                key={prediction.key}
                prediction={prediction}
                showChart={false}
                saving={savingPredictionKey === prediction.key}
                selectedVerdict={
                  selectedVerdicts[prediction.key] ??
                  persistedVerdicts[canonicalizePredictionKey(prediction.key)]
                }
                onValidate={handleValidate}
              />
            ))}
          </div>
          {validationMessage && (
            <p className={`ai-validation-result ${Object.keys(selectedVerdicts).length ? "success" : "incorrect"}`} role={Object.keys(selectedVerdicts).length ? "status" : "alert"}>
              {validationMessage}
            </p>
          )}
        </>
      )}

      {activePanel === "charts" && (
        <div className="ai-validation-charts-grid">
          {predictions.map((prediction) => (
            <article className="ai-validation-chart-card" key={`${prediction.key}-chart`}>
              <header>
                <div>
                  <strong>{prediction.label}</strong>
                  <span>{prediction.modelName || "Modelo no especificado"}</span>
                </div>
                <div
                  className={`ai-validation-chart-risk ${getRiskClass(prediction.risk)}`}
                  aria-label={`Riesgo estimado de ${prediction.risk}% en ${formatHorizon(prediction.horizonHours)}`}
                >
                  <span>Riesgo estimado</span>
                  <strong>{prediction.risk}%</strong>
                  <small>en {formatHorizon(prediction.horizonHours)}</small>
                </div>
              </header>
              <PredictionChart timeline={prediction.timeline} />
              <div className="ai-validation-chart-caption">
                El porcentaje indica la probabilidad estimada de este evento
                dentro de la ventana temporal indicada.
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
