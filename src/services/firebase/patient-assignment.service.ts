import {
	collection,
	getDocs,
	query,
	where,
} from "firebase/firestore";

import { db } from "@/services/firebase/firebase-config";

export async function getAssignedPatientIds(
	doctorUid: string,
): Promise<string[]> {
	const [assignmentResult, patientResult] = await Promise.allSettled([
		getDocs(
			query(
				collection(db, "patientAssignments"),
				where("doctorUid", "==", doctorUid),
			),
		),
		getDocs(
			query(
				collection(db, "patients"),
				where("assignedDoctorIds", "array-contains", doctorUid),
			),
		),
	]);

	if (
		assignmentResult.status === "rejected" &&
		patientResult.status === "rejected"
	) {
		throw assignmentResult.reason;
	}

	const assignedByRelation = (assignmentResult.status === "fulfilled"
		? assignmentResult.value.docs
		: [])
		.filter((item) => item.data().status !== "inactive")
		.map((item) => item.data().patientId)
		.filter((patientId): patientId is string => typeof patientId === "string");

	const assignedPatientIds = patientResult.status === "fulfilled"
		? patientResult.value.docs.map((item) => item.id)
		: [];

	return [...new Set([
		...assignedByRelation,
		...assignedPatientIds,
	])];
}