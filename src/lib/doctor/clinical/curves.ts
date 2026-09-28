import type {
  ClinicalAssessment,
  ClinicalCurvePoint,
} from "@/types/doctor-clinical";
import type { Patient } from "@/types/doctor-patients";

export type ClinicalCurveType = "spo2" | "respiratoryRate";

export function buildClinicalCurvePoints(
  patient: Patient,
  assessment: ClinicalAssessment,
  type: ClinicalCurveType,
): ClinicalCurvePoint[] {
  const base =
    type === "spo2"
      ? [84, 88, 90, 92, 94, 96, 98]
      : [12, 16, 20, 24, 28, 32, 36];

  return base.map((value) => {
    const delta =
      type === "spo2"
        ? Math.max(
            -16,
            Math.min(
              22,
              (Math.round(assessment.expectedOxygen) - value) * 4,
            ),
          )
        : Math.max(
            -14,
            Math.min(26, (value - 20) * 2.4),
          );

    return {
      x: value,
      y: Math.min(
        98,
        Math.max(
          5,
          Math.round(assessment.shortRisk + delta),
        ),
      ),
      active:
        type === "spo2"
          ? Math.round(
              Number(patient.oxygenSaturation || 0),
            ) === value
          : Math.round(
              Number(patient.respiratoryRate || 0),
            ) === value,
    };
  });
}