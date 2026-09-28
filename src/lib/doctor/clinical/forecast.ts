import type {
  ClinicalAssessment,
  ClinicalForecast,
  ConsultationTimeline,
  RegionProfile,
} from "@/types/doctor-clinical";
import type { Patient } from "@/types/doctor-patients";

export function buildConsultationTimeline(
  assessment: Pick<
    ClinicalAssessment,
    "shortRisk" | "weekRisk" | "longRisk"
  > | null,
): ConsultationTimeline {
  if (!assessment) {
    return {
      lowRiskHours: 0,
      dangerHours: 0,
      projectedRisk: 0,
      summary: "No hay una proyección temporal disponible todavía.",
    };
  }

  if (assessment.shortRisk >= 70) {
    return {
      lowRiskHours: 0,
      dangerHours: 24,
      projectedRisk: assessment.shortRisk,
      summary: `Ya existe un riesgo alto en la ventana de 24 horas: puede alcanzar ${assessment.shortRisk}%. Si no se corrige, hacia 7 dias podria mantenerse o subir hasta ${assessment.weekRisk}%.`,
    };
  }

  if (assessment.shortRisk >= 45) {
    return {
      lowRiskHours: 0,
      dangerHours: 48,
      projectedRisk: assessment.weekRisk,
      summary: `No hay una ventana amplia de riesgo bajo. Dentro de 24 horas el riesgo puede llegar a ${assessment.shortRisk}% y, si no mejora, hacia 7 dias podria subir hasta ${assessment.weekRisk}%.`,
    };
  }

  if (assessment.weekRisk >= 55) {
    return {
      lowRiskHours: 24,
      dangerHours: 72,
      projectedRisk: assessment.weekRisk,
      summary: `En el momento actual no se espera un riesgo elevado si sigue las recomendaciones. A 24 horas debe reevaluarse y hacia 7 dias podria subir hasta ${assessment.weekRisk}%.`,
    };
  }

  if (assessment.longRisk >= 55) {
    return {
      lowRiskHours: 48,
      dangerHours: 168,
      projectedRisk: assessment.longRisk,
      summary: `Durante la ventana de 24 horas no se espera un riesgo elevado si sigue las recomendaciones. Si no mantiene el control, hacia 30 dias podria subir hasta ${assessment.longRisk}%.`,
    };
  }

  return {
    lowRiskHours: 72,
    dangerHours: 168,
    projectedRisk: assessment.longRisk,
    summary: `No se observa un riesgo elevado actual. Puede mantenerse estable en la ventana de 24 horas si sigue las recomendaciones; despues, conviene reevaluar para evitar que el riesgo aumente hasta ${assessment.longRisk}% a 30 dias.`,
  };
}

export function getConsultationLowRiskWindow(
  assessment: ClinicalAssessment | null,
): string {
  if (!assessment) {
    return "Sin ventana estimable";
  }

  const timeline = buildConsultationTimeline(assessment);

  if (!timeline.lowRiskHours) {
    return "No se identifica una ventana clara de riesgo bajo; el caso requiere seguimiento cercano desde ahora.";
  }

  return `Puede mantenerse en vigilancia baja durante cerca de ${timeline.lowRiskHours} horas si cumple las recomendaciones.`;
}

export function buildClinicalForecast(
  patient: Patient | null,
  assessment: ClinicalAssessment | null,
  region: RegionProfile,
): ClinicalForecast {
  if (!patient || !assessment) {
    return {
      horizon: "Sin paciente activo",
      deterioration:
        "No hay pronostico disponible hasta seleccionar un paciente.",
      watchSignal: "Sin senal dominante",
      ifUntreated:
        "Selecciona un paciente para calcular el deterioro probable.",
    };
  }

  let horizon = "Seguimiento ordinario";

  if (assessment.shortRisk >= 70) {
    horizon = "Menos de 24 horas";
  } else if (assessment.shortRisk >= 45) {
    horizon = "Dentro de 24 horas";
  } else if (assessment.weekRisk >= 55) {
    horizon = "Dentro de 7 dias";
  } else if (assessment.longRisk >= 55) {
    horizon = "Dentro de 30 dias";
  }

  const respiratoryDriver =
    assessment.outcomeRisks.respiratory || 0;

  const cardiacDriver =
    assessment.outcomeRisks.cardiac || 0;

  const symptomDriver =
    assessment.outcomeRisks.dangerousSymptom || 0;

  let deterioration =
    "Riesgo de reagudizacion clinica progresiva.";

  let watchSignal =
    "Vigilar cambios globales del estado clinico.";

  let ifUntreated =
    `Si no se actua en ${horizon.toLowerCase()}, el riesgo compuesto puede subir desde ${assessment.shortRisk}% hacia ${assessment.weekRisk}% y ${assessment.longRisk}%.`;

  if (assessment.dominantRiskType === "respiratory") {
    deterioration =
      `El deterioro mas probable es respiratorio, con desaturacion y mayor trabajo ventilatorio en ${horizon.toLowerCase()}.`;

    watchSignal =
      `Senal centinela: O2 ${patient.oxygenSaturation || "sin dato"}% frente a expectativa ${Math.round(assessment.expectedOxygen)}% y FR ${patient.respiratoryRate || "sin dato"} rpm.`;

    ifUntreated =
      `Sin intervencion, la desaturacion puede consolidarse como descompensacion respiratoria en ${region.label}, especialmente con altitud ${region.altitude} m y subriesgo respiratorio ${respiratoryDriver}%.`;
  } else if (assessment.dominantRiskType === "cardiac") {
    deterioration =
      `El deterioro mas probable es cardiopulmonar/hemodinamico dentro de ${horizon.toLowerCase()}.`;

    watchSignal =
      `Senal centinela: pulso ${patient.pulse || "sin dato"} bpm, presion ${patient.bloodPressureSystolic || "sin dato"}/${patient.bloodPressureDiastolic || "sin dato"} y antecedente cardiaco ${patient.heartFailureHistory || "sin dato"}.`;

    ifUntreated =
      `Sin actuar, puede aumentar la probabilidad de congestion o inestabilidad hemodinamica, con subriesgo cardiaco ${cardiacDriver}% antes de la siguiente ventana critica.`;
  } else {
    deterioration =
      `El deterioro mas probable es la aparicion de un sintoma peligroso o reagudizacion subjetiva en ${horizon.toLowerCase()}.`;

    watchSignal =
      `Senal centinela: disnea, secreciones y cambio funcional con subriesgo sintomatico ${symptomDriver}%.`;

    ifUntreated =
      `Sin manejo temprano, el cambio clinico puede hacerse visible antes de la reevaluacion programada, empujando el riesgo a ${assessment.weekRisk}% durante la semana.`;
  }

  return {
    horizon,
    deterioration,
    watchSignal,
    ifUntreated,
  };
}