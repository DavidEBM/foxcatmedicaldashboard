import type { Patient } from "@/types/doctor-patients";
import type {
	ClinicalAssessment,
	TrainingManifest,
	TrainingProfile,
} from "@/types/doctor-clinical";
import {
	buildPredictionCatalog as buildClinicalPredictionCatalog,
} from "@/lib/doctor/ai-validation/predictions";

export function getAvailablePredictionTypes(): string[] {
	return ["respiratory-risk", "cardiac-risk", "danger-symptom-risk"];
}

export function buildPredictionCatalog(
	patient: Patient,
	assessment: ClinicalAssessment,
	trainingProfile?: TrainingProfile,
	trainingManifest?: TrainingManifest | null,
) {
	return buildClinicalPredictionCatalog(
		patient,
		assessment,
		trainingProfile,
		trainingManifest,
	);
}