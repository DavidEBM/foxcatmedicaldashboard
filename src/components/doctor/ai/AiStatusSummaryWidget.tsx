"use client";

import type { ClinicalAssessment } from "@/types/doctor-clinical";
import type { Patient } from "@/types/doctor-patients";
import PredictionChart from "./PredictionChart";

interface AiStatusSummaryWidgetProps {
  patient: Patient;
  assessment: ClinicalAssessment;
}

export default function AiStatusSummaryWidget({ patient, assessment }: AiStatusSummaryWidgetProps) {
  const timeline = [
    { hours: 24, label: "24 h", risk: assessment.shortRisk },
    { hours: 168, label: "7 d", risk: assessment.weekRisk },
    { hours: 720, label: "30 d", risk: assessment.longRisk },
  ];

  return (
    <section className="ai-status-summary-widget">
      <div className="ai-status-summary-head"><div><span>Lectura consolidada</span><strong>{patient.name}</strong></div><b>{assessment.shortRisk}%</b></div>
      <p className="ai-status-summary-text">{assessment.summary ?? "Resumen de riesgo clínico calculado para el paciente."}</p>
      <div className="ai-status-summary-metrics"><div><span>24 horas</span><strong>{assessment.shortRisk}%</strong></div><div><span>7 días</span><strong>{assessment.weekRisk}%</strong></div><div><span>30 días</span><strong>{assessment.longRisk}%</strong></div></div>
      <PredictionChart timeline={timeline} />
      <small className="ai-status-summary-disclaimer">La IA apoya la revisión médica; no sustituye el criterio clínico.</small>
    </section>
  );
}
