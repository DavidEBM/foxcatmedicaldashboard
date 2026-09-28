import type {
  ClinicalAssessment,
  ClinicalRiskTone,
  RiskTimelineItem,
} from "@/types/doctor-clinical";
import type { Patient } from "@/types/doctor-patients";

export function riskTone(value: number): string {
  if (value >= 70) return "Riesgo alto";
  if (value >= 45) return "Riesgo medio";
  return "Riesgo bajo";
}

export function buildDomainRiskTimeline(
  assessment: ClinicalAssessment,
): RiskTimelineItem[] {
  const respiratory =
    assessment.outcomeRisks.respiratory || 0;

  const cardiac =
    assessment.outcomeRisks.cardiac || 0;

  const symptom =
    assessment.outcomeRisks.dangerousSymptom || 0;

  const scaleForWindow = (
    base: number,
    factor: number,
    floor = 8,
  ) =>
    Math.min(
      98,
      Math.max(floor, Math.round(base * factor)),
    );

  return [
    {
      label: "Riesgo respiratorio",
      values: [
        scaleForWindow(respiratory, 0.82),
        scaleForWindow(
          Math.max(respiratory, assessment.shortRisk * 0.62),
          0.95,
        ),
        scaleForWindow(
          Math.max(respiratory, assessment.weekRisk * 0.55),
          1,
        ),
        scaleForWindow(
          Math.max(respiratory, assessment.longRisk * 0.48),
          1.04,
        ),
      ],
    },
    {
      label: "Riesgo cardiaco",
      values: [
        scaleForWindow(cardiac, 0.82),
        scaleForWindow(
          Math.max(cardiac, assessment.shortRisk * 0.5),
          0.94,
        ),
        scaleForWindow(
          Math.max(cardiac, assessment.weekRisk * 0.46),
          1,
        ),
        scaleForWindow(
          Math.max(cardiac, assessment.longRisk * 0.54),
          1.05,
        ),
      ],
    },
    {
      label: "Sintoma peligroso",
      values: [
        scaleForWindow(symptom, 0.82),
        scaleForWindow(
          Math.max(symptom, assessment.shortRisk * 0.46),
          0.96,
        ),
        scaleForWindow(
          Math.max(symptom, assessment.weekRisk * 0.42),
          1,
        ),
        scaleForWindow(
          Math.max(symptom, assessment.longRisk * 0.38),
          1.02,
        ),
      ],
    },
  ];
}

export function buildRiskDrivers(
  patient: Patient | null,
  assessment: ClinicalAssessment,
): string[] {
  const drivers = [...assessment.triggers]
    .filter((item) => !item.startsWith("Subriesgos"))
    .slice(0, 6);

  if ((patient?.bnp ?? 0) >= 400) {
    drivers.unshift(
      `BNP elevado (${patient?.bnp} pg/mL) aumenta sospecha de carga cardiaca.`,
    );
  }

  if (
    patient?.oxygenSaturation &&
    patient.oxygenSaturation < assessment.expectedOxygen
  ) {
    drivers.unshift(
      `SpO2 bajo expectativa regional (${patient.oxygenSaturation}% vs ${Math.round(assessment.expectedOxygen)}%).`,
    );
  }

  return drivers.length
    ? [...new Set(drivers)].slice(0, 6)
    : ["No hay impulsores mayores con los datos actuales."];
}

export function buildProtectiveFactors(
  patient: Patient,
  assessment: ClinicalAssessment,
): string[] {
  const protective: string[] = [];

  if (patient.status === "Estable") {
    protective.push("Estado clinico registrado como estable.");
  }

  if (
    patient.oxygenSaturation &&
    patient.oxygenSaturation >= Math.round(assessment.expectedOxygen)
  ) {
    protective.push(
      `SpO2 conservada para el contexto regional (${patient.oxygenSaturation}%).`,
    );
  }

  if (
    patient.respiratoryRate &&
    patient.respiratoryRate < 22
  ) {
    protective.push(
      `Frecuencia respiratoria sin taquipnea marcada (${patient.respiratoryRate} rpm).`,
    );
  }

  if (patient.pulse && patient.pulse < 100) {
    protective.push(
      `Pulso sin taquicardia (${patient.pulse} bpm).`,
    );
  }

  if (patient.glucose && patient.glucose < 180) {
    protective.push(
      `Glucosa sin hiperglucemia severa (${patient.glucose} mg/dL).`,
    );
  }

  if (
    patient.heartFailureHistory !== "Si" &&
    patient.coronaryHistory !== "Si"
  ) {
    protective.push(
      "Sin antecedente cardiaco mayor registrado.",
    );
  }

  return protective.length
    ? protective.slice(0, 6)
    : [
        "No se identifican factores protectores fuertes; completar datos faltantes mejora la lectura.",
      ];
}