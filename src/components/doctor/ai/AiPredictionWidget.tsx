"use client";

import { useEffect, useState } from "react";

import type { ClinicalAssessment } from "@/types/doctor-clinical";
import type { Patient } from "@/types/doctor-patients";
import type { AiPrediction, AiValidationVerdict } from "@/types/doctor-ai-validation";
import { buildPredictionCatalog } from "@/lib/doctor/ai-validation/predictions";
import { useAiPredictionValidation } from "@/hooks/doctor/useAiPredictionValidation";
import PredictionCard from "./PredictionCard";

interface AiPredictionWidgetProps {
  patient: Patient;
  assessment: ClinicalAssessment;
  target: "copd_gold" | "history_of_heart_failure" | "clinical_risk";
  title: string;
  subtitle: string;
  doctorUid: string | null;
  trainingProfile: Parameters<typeof buildPredictionCatalog>[2];
}

const TARGET_ALIASES: Record<AiPredictionWidgetProps["target"], string[]> = {
  copd_gold: ["copd_gold", "respiratory-risk"],
  history_of_heart_failure: ["history_of_heart_failure", "cardiac-risk"],
  clinical_risk: ["danger-symptom-risk"],
};

export default function AiPredictionWidget({
  patient,
  assessment,
  target,
  title,
  subtitle,
  doctorUid,
  trainingProfile,
}: AiPredictionWidgetProps) {
  const { savingPredictionKey, validatePrediction } = useAiPredictionValidation({ doctorUid });
  const [prediction, setPrediction] = useState<AiPrediction | null>(null);
  const [verdict, setVerdict] = useState<AiValidationVerdict>();
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fallback = buildPredictionCatalog(patient, assessment, trainingProfile).find((item) => TARGET_ALIASES[target].includes(item.target));

    void fetch("/api/ai-predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patient),
    })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("IA no disponible")))
      .then((payload) => {
        if (cancelled) return;
        const raw = Array.isArray(payload.predictions)
          ? payload.predictions.find((item: Record<string, unknown>) => TARGET_ALIASES[target].includes(String(item.key)))
          : null;
        if (!raw) {
          setPrediction(fallback ?? null);
          return;
        }
        const probabilities = Array.isArray(raw.probabilities) ? raw.probabilities.map(Number) : [];
        const directRisk = raw.risk;
        const hasDirectRisk = directRisk !== null && directRisk !== undefined && directRisk !== "" && Number.isFinite(Number(directRisk));
        const hasProbabilityRisk = probabilities.some(Number.isFinite);
        if (!hasDirectRisk && !hasProbabilityRisk) {
          setPrediction(fallback ?? null);
          return;
        }
        const risk = hasDirectRisk
          ? Math.max(0, Math.min(100, Math.round(Number(directRisk))))
          : Math.round(Math.max(...probabilities.filter(Number.isFinite), 0) * 100);
        setPrediction({
          key: String(raw.key),
          label: String(raw.label ?? title),
          risk,
          horizonHours: 24,
          timeline: [{ hours: 24, label: "24 h", risk }],
          source: "backend",
          modelName: String(raw.modelName ?? "Modelo ML"),
          artifact: String(raw.artifact ?? ""),
          target: String(raw.key),
        });
      })
      .catch(() => {
        if (!cancelled) setPrediction(fallback ?? null);
      });

    return () => { cancelled = true; };
  }, [assessment, patient, target, title, trainingProfile]);

  if (!prediction) {
    return <div className="ai-widget-loading">Preparando predicción para {patient.name}…</div>;
  }

  const handleValidate = async (next: AiValidationVerdict) => {
    setValidationMessage(null);
    try {
      await validatePrediction({ patient, prediction }, next);
      setVerdict(next);
      setValidationMessage(next === "valid"
        ? "Validación guardada como validado."
        : "Validación guardada como no validado.");
    } catch (error) {
      console.error("No se pudo guardar la validación IA", error);
      setVerdict(undefined);
      setValidationMessage(error instanceof Error
        ? error.message
        : "No se pudo guardar la validación. Revisa tu sesión y los permisos de Firestore.");
    }
  };

  return (
    <section className="ai-single-prediction-widget">
      <div className="ai-single-prediction-heading">
        <div><span>{subtitle}</span><strong>{title}</strong></div>
        <span className="ai-model-chip">{prediction.source === "backend" ? "Modelo ML" : "Estimación local"}</span>
      </div>
      <PredictionCard
        prediction={prediction}
        showChart
        saving={savingPredictionKey === prediction.key}
        selectedVerdict={verdict}
        onValidate={(_, next) => void handleValidate(next)}
      />
      {validationMessage && (
        <p
          className={`ai-validation-result ${verdict ? "success" : "incorrect"}`}
          role={verdict ? "status" : "alert"}
          aria-live="polite"
        >
          {validationMessage}
        </p>
      )}
    </section>
  );
}
