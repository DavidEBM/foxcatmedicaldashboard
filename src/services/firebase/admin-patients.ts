import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/services/firebase/firebase-config";

export interface AdminPatient extends DocumentData {
  id: string;

  // Identificación
  name?: string;
  documentId?: string;
  documentType?: string;

  // Demografía
  age?: unknown;
  birthDate?: unknown;
  gender?: string;
  sex?: string;

  // Estado y ubicación
  status?: string;
  condition?: string;
  location?: string;
  locationCity?: string;
  locationElevationM?: unknown;

  // Atención
  consultationType?: string;
  consultationReason?: string;
  appointmentType?: string;
  consultationTime?: unknown;
  appointmentTime?: unknown;
  monitoringTime?: unknown;
  labTime?: unknown;

  // Tabaquismo
  smokingDaily?: unknown;
  smoking?: unknown;
  smokingStatus?: string;
  packHistory?: unknown;

  // EPOC
  copdSeverity?: unknown;
  copdGold?: unknown;
  copdConfirmed?: unknown;

  // Función pulmonar
  mwt1?: unknown;
  mwt2?: unknown;
  mwt1Best?: unknown;
  fev1?: unknown;
  fev1Pred?: unknown;
  fvc?: unknown;
  fvcPred?: unknown;

  // Escalas clínicas
  cat?: unknown;
  catScore?: unknown;
  had?: unknown;
  hadScore?: unknown;
  sgrq?: unknown;
  mmrc?: unknown;
  bodex?: unknown;
  dyspneaScale?: unknown;
  dyspneaScore?: unknown;
  emergencyClassification?: unknown;

  // Cardiovascular
  atrialFib?: unknown;
  heartFailureHistory?: unknown;
  coronaryHistory?: unknown;
  arrhythmias?: unknown;
  cardiovascularRisk?: unknown;

  // Signos vitales
  temperature?: unknown;
  respiratoryRate?: unknown;
  heartRate?: unknown;
  pulse?: unknown;
  oxygenSaturation?: unknown;
  systolicBP?: unknown;
  diastolicBP?: unknown;
  bloodPressure?: unknown;

  // Antropometría
  bmi?: unknown;
  weight?: unknown;
  height?: unknown;

  // Respiratorio
  sputum?: unknown;
  asthma?: unknown;
  pulmonaryStatus?: unknown;

  // Diagnóstico
  diagnosis?: unknown;
  diagnoses?: unknown;
  diagnosisName?: unknown;
  medicalHistory?: unknown;
  clinicalHistory?: unknown;
  personalHistory?: unknown;
  familyHistory?: unknown;
  chronicDiseases?: unknown;
  diseases?: unknown;
  conditions?: unknown;
  allergies?: unknown;
  medications?: unknown;
  symptoms?: unknown;
  observations?: unknown;
  clinicalNotes?: unknown;

  // Contexto
  lifeCycle?: unknown;
  disability?: unknown;
  disabilityType?: unknown;
  occupation?: unknown;
  datasetOrigin?: unknown;

  // Laboratorio
  glucose?: unknown;
  hemoglobin?: unknown;
  creatinine?: unknown;
  ecg?: unknown;
  bnp?: unknown;

  // Hospitalización
  roomBed?: unknown;
  room?: unknown;
  ward?: unknown;

  // Otros
  notes?: unknown;
  photoUrl?: unknown;

  // Asignación médica
  assignedDoctorIds?: string[];
  assignedDoctors?: unknown[];

  // Permite campos adicionales provenientes
  // de Firebase o del proceso de importación.
  [key: string]: unknown;
}

interface SubscribePatientsOptions {
  onData: (patients: AdminPatient[]) => void;
  onError?: (error: Error) => void;
}

export interface PatientDoctorAssignment {
  id: string;
  patientId: string;
  doctorUid: string;
  assignedAt?: unknown;
  assignedBy?: string;
  status?: string;
}

export function subscribeToAdminPatients(
  options: SubscribePatientsOptions
): Unsubscribe {
  return onSnapshot(
    collection(db, "patients"),
    (snapshot) => {
      const patients: AdminPatient[] =
        snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

      options.onData(patients);
    },
    (error) => {
      options.onError?.(error);
    }
  );
}

/**
 * Asigna un médico a un paciente.
 *
 * Mantiene intactos todos los datos clínicos
 * existentes del paciente.
 *
 * Actualiza únicamente los campos de asignación
 * y auditoría del documento patients.
 *
 * También crea la relación en
 * patientAssignments si todavía no existe.
 */
export async function assignPatientToDoctor(
  patient: AdminPatient,
  doctorUid: string,
  adminUid: string
): Promise<void> {
  const normalizedDoctorUid =
    doctorUid.trim();

  const normalizedAdminUid =
    adminUid.trim();

  if (!patient.id) {
    throw new Error(
      "El paciente no tiene un identificador válido."
    );
  }

  if (!normalizedDoctorUid) {
    throw new Error(
      "Debes seleccionar un médico."
    );
  }

  if (!normalizedAdminUid) {
    throw new Error(
      "No se pudo identificar al administrador actual."
    );
  }

  const currentDoctorIds =
    getAssignedDoctorIds(patient);

  const currentAssignedDoctors =
    Array.isArray(patient.assignedDoctors)
      ? patient.assignedDoctors
      : [];

  const alreadyAssigned =
    currentDoctorIds.includes(
      normalizedDoctorUid
    );

  const assignmentsQuery = query(
    collection(
      db,
      "patientAssignments"
    ),
    where(
      "patientId",
      "==",
      patient.id
    ),
    where(
      "doctorUid",
      "==",
      normalizedDoctorUid
    )
  );

  const assignmentsSnapshot =
    await getDocs(
      assignmentsQuery
    );

  const activeAssignment =
    assignmentsSnapshot.docs.find(
      (assignment) => assignment.data().status !== "inactive"
    );

  const inactiveAssignment =
    assignmentsSnapshot.docs.find(
      (assignment) => assignment.data().status === "inactive"
    );

  /*
   * Actualizamos únicamente la información
   * de asignación. Los demás campos clínicos
   * permanecen intactos.
   */
  if (!alreadyAssigned) {
    const nextDoctorIds = [
      ...currentDoctorIds,
      normalizedDoctorUid,
    ];

    const nextAssignedDoctors = [
      ...currentAssignedDoctors,
      {
        uid: normalizedDoctorUid,
      },
    ];

    await updateDoc(
      doc(
        db,
        "patients",
        patient.id
      ),
      {
        assignedDoctorIds:
          nextDoctorIds,
        assignedDoctors:
          nextAssignedDoctors,
        updatedAt:
          serverTimestamp(),
        updatedBy:
          normalizedAdminUid,
      }
    );
  }

  /*
   * Evita crear dos relaciones
   * paciente-médico iguales.
   */
  if (activeAssignment) {
    return;
  }

  if (inactiveAssignment) {
    await updateDoc(inactiveAssignment.ref, {
      status: "active",
      reassignedBy: normalizedAdminUid,
      reassignedAt: serverTimestamp(),
    });
  } else {
    await addDoc(
      collection(
        db,
        "patientAssignments"
      ),
      {
        patientId: patient.id,
        doctorUid:
          normalizedDoctorUid,
        assignedBy:
          normalizedAdminUid,
        assignedAt:
          serverTimestamp(),
        status: "active",
      }
    );
  }
}

/**
 * Retira un médico de un paciente sin tocar la información clínica.
 *
 * La relación en patientAssignments se conserva como inactiva para
 * mantener la trazabilidad de la administración.
 */
export async function removePatientFromDoctor(
  patient: AdminPatient,
  doctorUid: string,
  adminUid: string
): Promise<void> {
  const normalizedDoctorUid = doctorUid.trim();
  const normalizedAdminUid = adminUid.trim();

  if (!patient.id) {
    throw new Error("El paciente no tiene un identificador válido.");
  }

  if (!normalizedDoctorUid) {
    throw new Error("Debes seleccionar un médico.");
  }

  if (!normalizedAdminUid) {
    throw new Error("No se pudo identificar al administrador actual.");
  }

  const currentDoctorIds = getAssignedDoctorIds(patient);
  const nextDoctorIds = currentDoctorIds.filter(
    (assignedDoctorId) => assignedDoctorId !== normalizedDoctorUid
  );

  const currentAssignedDoctors = Array.isArray(patient.assignedDoctors)
    ? patient.assignedDoctors
    : [];
  const nextAssignedDoctors = currentAssignedDoctors.filter((doctor) => {
    if (doctor !== null && typeof doctor === "object") {
      const doctorRecord = doctor as { id?: unknown; uid?: unknown };
      const id = String(doctorRecord.id ?? doctorRecord.uid ?? "").trim();
      return id !== normalizedDoctorUid;
    }

    return String(doctor ?? "").trim() !== normalizedDoctorUid;
  });

  if (nextDoctorIds.length !== currentDoctorIds.length) {
    await updateDoc(doc(db, "patients", patient.id), {
      assignedDoctorIds: nextDoctorIds,
      assignedDoctors: nextAssignedDoctors,
      updatedAt: serverTimestamp(),
      updatedBy: normalizedAdminUid,
    });
  }

  const assignmentsSnapshot = await getDocs(
    query(
      collection(db, "patientAssignments"),
      where("patientId", "==", patient.id),
      where("doctorUid", "==", normalizedDoctorUid)
    )
  );

  await Promise.all(
    assignmentsSnapshot.docs.map((assignment) =>
      updateDoc(assignment.ref, {
        status: "inactive",
        removedAt: serverTimestamp(),
        removedBy: normalizedAdminUid,
      })
    )
  );
}

function getAssignedDoctorIds(
  patient: AdminPatient
): string[] {
  const assignedDoctorIds =
    patient.assignedDoctorIds;

  if (
    Array.isArray(
      assignedDoctorIds
    )
  ) {
    return assignedDoctorIds
      .map((doctorId) =>
        String(
          doctorId
        ).trim()
      )
      .filter(Boolean);
  }

  const assignedDoctors =
    patient.assignedDoctors;

  if (
    !Array.isArray(
      assignedDoctors
    )
  ) {
    return [];
  }

  return assignedDoctors
    .map((doctor): string => {
      if (
        doctor !== null &&
        typeof doctor ===
          "object"
      ) {
        if ("id" in doctor) {
          return String(
            (
              doctor as {
                id: unknown;
              }
            ).id ?? ""
          ).trim();
        }

        if ("uid" in doctor) {
          return String(
            (
              doctor as {
                uid: unknown;
              }
            ).uid ?? ""
          ).trim();
        }
      }

      return String(
        doctor ?? ""
      ).trim();
    })
    .filter(Boolean);
}
