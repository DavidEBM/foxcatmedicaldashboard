import type { Patient, PatientStatus, SmokingStatus } from "@/types/doctor-patients";
import {
	getStatusClass,
	normalizeBooleanText,
	normalizeOxygenValue,
	normalizeSmokingStatus,
} from "@/lib/doctor/doctor-utils";

function text(data: Record<string, unknown>, ...keys: string[]): string {
	for (const key of keys) {
		const value = data[key];
		if (value !== undefined && value !== null && String(value).trim()) {
			return String(value).trim();
		}
	}
	return "";
}

function number(data: Record<string, unknown>, ...keys: string[]): number {
	for (const key of keys) {
		const value = data[key];
		const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
		if (Number.isFinite(parsed)) return parsed;
	}
	return 0;
}

export function normalizePatient(
	source: Record<string, unknown>,
	id: string,
): Patient {
	const data = { ...source };
	const statusText = text(data, "status", "clinicalStatus").toLowerCase();
	const status: PatientStatus = statusText.includes("critic")
		? "Critico"
		: statusText.includes("riesgo") || statusText.includes("observ")
			? "Riesgo"
			: "Estable";
	const smoking = normalizeSmokingStatus(data.smokingStatus ?? data.smoking) as SmokingStatus;

	return {
		...data,
		id,
		name: text(data, "name", "displayName") || "Paciente sin nombre",
		documentId: text(data, "documentId", "document", "cedula"),
		age: number(data, "age"),
		condition: text(data, "condition", "diagnosis", "diagnosisName"),
		status,
		statusClass: getStatusClass(status) as Patient["statusClass"],
		photoUrl: text(data, "photoUrl", "photoURL"),
		bloodPressureSystolic: number(data, "bloodPressureSystolic", "systolicBP"),
		bloodPressureDiastolic: number(data, "bloodPressureDiastolic", "diastolicBP"),
		pulse: number(data, "pulse", "heartRate"),
		glucose: number(data, "glucose"),
		oxygenSaturation: normalizeOxygenValue(data.oxygenSaturation),
		respiratoryRate: number(data, "respiratoryRate"),
		hemoglobin: number(data, "hemoglobin"),
		creatinine: number(data, "creatinine"),
		bmi: number(data, "bmi"),
		packHistory: number(data, "packHistory", "packYears"),
		copdGold: number(data, "copdGold"),
		smokingStatus: smoking,
		heartFailureHistory: normalizeBooleanText(data.heartFailureHistory),
		coronaryHistory: normalizeBooleanText(data.coronaryHistory),
		arrhythmias: normalizeBooleanText(data.arrhythmias),
		ecg: text(data, "ecg"),
		bnp: number(data, "bnp"),
		locationCity: text(data, "locationCity", "city", "location"),
		locationElevationM: number(data, "locationElevationM", "altitude"),
		locationRiskLevel: number(data, "locationRiskLevel", "riskLevel"),
		ward: text(data, "ward", "service"),
		room: text(data, "room", "roomBed"),
		appointmentTime: text(data, "appointmentTime", "consultationTime"),
		monitoringTime: text(data, "monitoringTime"),
		labTime: text(data, "labTime", "laboratoryTime"),
		notes: text(data, "notes", "clinicalNotes"),
		createdBy: text(data, "createdBy"),
		assignedDoctorIds: Array.isArray(data.assignedDoctorIds)
			? data.assignedDoctorIds.map(String)
			: [],
	} as Patient;
}

export function sanitizePatientPayload(
	payload: Record<string, unknown>,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(payload).filter(([, value]) => value !== undefined),
	);
}

export { normalizeOxygenValue, normalizeBooleanText, normalizeSmokingStatus };
export { getStatusClass };
export { parseNumericOrKeyword, mapBloodPressureCategory } from "@/lib/doctor/doctor-utils";