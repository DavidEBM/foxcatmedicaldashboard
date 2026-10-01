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
  "respiratory-risk": ["respiratory-risk"],
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
  const [blockedModels, setBlockedModels] = useState<Record<string, string>>({});
  const [backendError, setBackendError] = useState<string | null>(null);
  const [persistedVerdicts, setPersistedVerdicts] = useState<PatientValidationVerdicts>({});
  const [activePanel, setActivePanel] = useState<AiPanel>("validation");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [goldValidationMessage, setGoldValidationMessage] = useState<string | null>(null);

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
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(typeof payload.error === "string" ? payload.error : "Backend IA no disponible");
        }
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        const rawBlockedModels = payload.blockedModels;
        setBlockedModels(rawBlockedModels && typeof rawBlockedModels === "object"
          ? Object.fromEntries(Object.entries(rawBlockedModels).map(([target, reason]) => [target, String(reason)]))
          : {});
        setBackendError(null);
        const predictions = Array.isArray(payload.predictions) ? payload.predictions : [];
        setBackendPredictions(predictions.map((item: Record<string, unknown>) => {
          const probabilities = Array.isArray(item.probabilities) ? item.probabilities.map(Number) : [];
          const hasDirectRisk = item.risk !== null && item.risk !== undefined && item.risk !== "" && Number.isFinite(Number(item.risk));
          const target = String(item.key ?? "");
          const isGoldClassification = target === "copd_gold" && item.prediction !== null && item.prediction !== undefined;
          const normalizeClass = (value: unknown) => {
            const text = String(value).trim();
            const numeric = Number(text);
            return text && Number.isFinite(numeric) ? String(numeric) : text;
          };
          const classes = Array.isArray(item.classes) ? item.classes.map(normalizeClass) : [];
          const predictedValue = isGoldClassification ? normalizeClass(item.prediction) : undefined;
          const predictedClassIndex = predictedValue === undefined ? -1 : classes.findIndex((value) => value === predictedValue);
          const confidence = predictedClassIndex >= 0 && Number.isFinite(probabilities[predictedClassIndex])
            ? Math.round(probabilities[predictedClassIndex] * 100)
            : undefined;
          const risk = hasDirectRisk
            ? Number(item.risk)
            : confidence ?? (probabilities.some(Number.isFinite) ? Math.round(Math.max(...probabilities.filter(Number.isFinite)) * 100) : null);
          if (risk === null && !isGoldClassification) return null;
          const normalizedRisk = risk ?? 0;
          return {
            key: target,
            label: String(item.label),
            risk: normalizedRisk,
            ...(predictedValue !== undefined ? { predictedValue, clinicalValue: patient.copdGold > 0 ? String(patient.copdGold) : "" } : {}),
            ...(confidence !== undefined ? { confidence } : {}),
            horizonHours: 24,
            timeline: [{ hours: 24, label: "24 h", risk: normalizedRisk }],
            source: "backend",
            modelName: String(item.modelName ?? "Modelo ML"),
            artifact: String(item.artifact ?? ""),
            target: String(item.key),
          } satisfies AiPrediction;
        }).filter((prediction: AiPrediction | null): prediction is AiPrediction => prediction !== null));
        setBackendPatientId(patient.id);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setBackendPredictions([]);
          setBlockedModels({});
          setBackendError(cause instanceof Error
            ? cause.message
            : "No se pudo conectar con el motor de predicción. Intenta de nuevo o revisa el servicio de IA.");
          setBackendPatientId(patient.id);
        }
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
  const patientBlockedModels = backendPatientId === patient.id ? blockedModels : {};
  const patientBackendError = backendPatientId === patient.id ? backendError : null;
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
  const goldPrediction = patientBackendPredictions.find((prediction) => prediction.target === "copd_gold");
  const riskPredictions = predictions.filter((prediction) =>
    prediction.target !== "copd_gold" && !prediction.predictedValue,
  );

  if (!predictions.length) {
    return null;
  }

  const handleValidate = async (
    prediction: AiPrediction,
    verdict: AiValidationVerdict,
  ) => {
    const isGoldPrediction = prediction.target === "copd_gold";
    if (isGoldPrediction) setGoldValidationMessage(null);
    else setValidationMessage(null);

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
      const message = verdict === "valid"
        ? "Validación guardada como validado."
        : "Validación guardada como no validado.";
      if (isGoldPrediction) setGoldValidationMessage(message);
      else setValidationMessage(message);
    } catch (error) {
      console.error(
        "Error registrando validación IA:",
        error,
      );
      const message = error instanceof Error
        ? error.message
        : "No se pudo guardar la validación. Revisa la sesión y los permisos de Firestore.";
      if (isGoldPrediction) setGoldValidationMessage(message);
      else setValidationMessage(message);
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
          la Validacion del médico y no modifica el modelo automáticamente.
        </p>
      </div>

      {(patientBackendError || Object.keys(patientBlockedModels).length > 0) && (
        <div className={`ai-model-availability ${patientBackendError ? "is-error" : "is-blocked"}`} role={patientBackendError ? "alert" : "status"}>
          <strong>{patientBackendError ? "Motor de IA no disponible" : "No hay una predicción de modelo aprobada"}</strong>
          <p>
            {patientBackendError
              ?? Object.entries(patientBlockedModels)
                .map(([target, reason]) => `${target === "copd_gold" ? "Nivel GOLD" : target === "history_of_heart_failure" ? "Insuficiencia cardíaca" : target}: ${reason}`)
                .join(" ")}
          </p>
          {riskPredictions.some((prediction) => prediction.source === "local-estimate") && (
            <small>Los riesgos locales mostrados son estimaciones auxiliares; no son predicciones generadas por un modelo ML aprobado.</small>
          )}
        </div>
      )}

      <section className="ai-gold-comparison" aria-label="Comparación de clasificación GOLD">
        <header className="ai-gold-comparison-header">
          <div>
            <span>Clasificación EPOC</span>
            <h4>Nivel GOLD del paciente</h4>
          </div>
          <span className={`ai-gold-status ${goldPrediction ? "" : "is-unavailable"}`}>
            {goldPrediction ? "Resultado IA · por validar" : patientBlockedModels.copd_gold ? "Modelo GOLD no aprobado" : "Resultado IA no disponible"}
          </span>
        </header>
        <div className="ai-gold-comparison-values">
          <div className="ai-gold-value ai-gold-value-ai">
            <span>Generado por IA</span>
            <strong>{goldPrediction?.predictedValue ? `GOLD ${goldPrediction.predictedValue}` : backendPatientId === patient.id ? "No disponible" : "Calculando…"}</strong>
            {goldPrediction?.confidence !== undefined && <small>Confianza del modelo: {goldPrediction.confidence}%</small>}
          </div>
          <div className="ai-gold-value">
            <span>Registrado por el médico</span>
            <strong>{patient.copdGold > 0 ? `GOLD ${patient.copdGold}` : "No registrado"}</strong>
          </div>
        </div>
        <p>
          {goldPrediction?.predictedValue && patient.copdGold > 0
            ? goldPrediction.predictedValue === String(patient.copdGold)
              ? "La predicción de IA coincide con el nivel clínico registrado. Confirma el resultado con «Validar predicción»."
              : "La predicción de IA difiere del registro clínico. Revisa ambos valores y valida o marca la predicción como incorrecta."
            : goldPrediction?.predictedValue
              ? "No hay un nivel GOLD clínico registrado para comparar. La predicción de IA requiere validación médica."
              : patientBlockedModels.copd_gold ?? patientBackendError ?? "No hay una predicción de nivel GOLD disponible para validar en este momento."}
        </p>
        {goldPrediction && (() => {
          const goldVerdict = selectedVerdicts[goldPrediction.key]
            ?? persistedVerdicts[canonicalizePredictionKey(goldPrediction.key)];
          return (
            <>
              <div className="ai-gold-validation-actions">
                <button
                  type="button"
                  className={`ai-validation-button ai-validation-button-valid ${goldVerdict === "valid" ? "selected" : ""}`}
                  aria-pressed={goldVerdict === "valid"}
                  disabled={savingPredictionKey === goldPrediction.key}
                  onClick={() => void handleValidate(goldPrediction, "valid")}
                >
                  {savingPredictionKey === goldPrediction.key && goldVerdict === "valid" ? "Guardando…" : "Validar predicción IA GOLD"}
                </button>
                <button
                  type="button"
                  className={`ai-validation-button ai-validation-button-incorrect ${goldVerdict === "incorrect" ? "selected" : ""}`}
                  aria-pressed={goldVerdict === "incorrect"}
                  disabled={savingPredictionKey === goldPrediction.key}
                  onClick={() => void handleValidate(goldPrediction, "incorrect")}
                >
                  {savingPredictionKey === goldPrediction.key && goldVerdict === "incorrect" ? "Guardando…" : "Marcar Prediccion IA GOLD Incorrecto"}
                </button>
              </div>
              {goldVerdict && (
                <span className={`ai-gold-validation-status ${goldVerdict === "valid" ? "success" : "incorrect"}`} role="status">
                  {goldVerdict === "valid" ? "Predicción IA GOLD validada por el médico." : "Predicción IA GOLD marcada como incorrecta."}
                </span>
              )}
              {goldValidationMessage && <span className="ai-gold-validation-status" role="status">{goldValidationMessage}</span>}
            </>
          );
        })()}
      </section>

      <div className="ai-validation-tabs" role="tablist" aria-label="Secciones del asistente IA">
        <button type="button" className={activePanel === "summary" ? "is-active" : ""} onClick={() => setActivePanel("summary")} role="tab" aria-selected={activePanel === "summary"}>
          <span>Resumen</span>
        </button>
        <button type="button" className={activePanel === "validation" ? "is-active" : ""} onClick={() => setActivePanel("validation")} role="tab" aria-selected={activePanel === "validation"}>
          <span>Validar</span><span>{riskPredictions.length}</span>
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
            <div><span>Predicciones de riesgo</span><strong>{riskPredictions.length}</strong></div>
            <div><span>Mayor riesgo</span><strong>{riskPredictions.length ? `${Math.max(...riskPredictions.map((item) => item.risk))}%` : "—"}</strong></div>
            <div><span>Motor</span><strong>{riskPredictions[0]?.modelName || "Local"}</strong></div>
          </div>
          <p className="ai-validation-summary-note">Revisa cada resultado antes de incorporarlo a la valoración clínica. La decisión final siempre corresponde al médico.</p>
        </div>
      )}

      {activePanel === "validation" && (
        <>
          <div className="ai-validation-grid">
            {riskPredictions.map((prediction) => (
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
            {riskPredictions.length === 0 && <p className="ai-validation-chart-empty">No hay predicciones de riesgo disponibles para validar.</p>}
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
          {riskPredictions.map((prediction) => (
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
          {riskPredictions.length === 0 && (
            <p className="ai-validation-chart-empty">La clasificación GOLD es categórica y no se representa como una curva de riesgo temporal.</p>
          )}
        </div>
      )}
    </section>
  );
}
