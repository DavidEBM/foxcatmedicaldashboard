import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/services/firebase/firebase-config";

export const PATIENTS_COLLECTION = "patients";
export const UPLOAD_LOGS_COLLECTION = "uploadLogs";

/* ============================================================
   TIPOS
============================================================ */

export interface PatientImportData {
  [key: string]: unknown;

  // Identificación
  name?: string;
  unnamedIndex?: unknown;
  documentId?: string;
  age?: unknown;
  sex?: unknown;

  // Tabaquismo
  packHistory?: unknown;
  smokingDaily?: unknown;
  smokingStatus?: unknown;

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
  had?: unknown;
  sgrq?: unknown;
  mmrc?: unknown;
  bodex?: unknown;
  dyspneaScale?: unknown;

  // Cardiovascular
  heartFailureHistory?: unknown;
  coronaryHistory?: unknown;
  arrhythmias?: unknown;
  atrialFib?: unknown;
  cardiovascularRisk?: unknown;

  // Respiratorio
  asthma?: unknown;
  sputum?: unknown;
  pulmonaryStatus?: unknown;

  // Signos vitales
  temperature?: unknown;
  respiratoryRate?: unknown;
  heartRate?: unknown;
  oxygenSaturation?: unknown;
  systolicBP?: unknown;
  diastolicBP?: unknown;
  bloodPressure?: unknown;

  // Antropometría
  bmi?: unknown;
  weight?: unknown;
  height?: unknown;

  // Laboratorio
  glucose?: unknown;
  hemoglobin?: unknown;
  creatinine?: unknown;
  ecg?: unknown;
  bnp?: unknown;

  // Ubicación
  location?: unknown;
  locationCity?: unknown;
  locationElevationM?: unknown;

  // Diagnóstico / contexto
  diagnosisName?: unknown;
  lifeCycle?: unknown;
  emergencyClassification?: unknown;
  disability?: unknown;
  disabilityType?: unknown;
  occupation?: unknown;

  // Estado
  status?: unknown;
  condition?: unknown;

  // Hospitalización
  roomBed?: unknown;
  consultationTime?: unknown;
  appointmentTime?: unknown;
  monitoringTime?: unknown;
  labTime?: unknown;

  // Adicional
  datasetOrigin?: unknown;
  notes?: unknown;
}

export interface PatientImportRow {
  [key: string]: unknown;
}

export interface UploadLog {
  id?: string;
  type: "patients";
  operation: "import_upsert";
  fileName: string;
  recordsRequested: number;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  createdPatientIds: string[];
  updatedPatientIds: string[];
  skippedRows: Array<{
    row: number;
    reason: string;
  }>;
  uploadedBy: string;
  uploadedByEmail: string | null;
  status:
    | "processing"
    | "completed"
    | "completed_with_skipped_rows"
    | "failed_rollback_incomplete"
    | "failed_rolled_back"
    | "rolled_back"
    | "rollback_incomplete";
  createdAt?: unknown;
  completedAt?: unknown;
  rolledBackAt?: unknown;
  rollbackDeletedCount?: number;
  rollbackError?: string | null;
}

export interface PatientLookup {
  id: string;
  documentId: string;
}

/* ============================================================
   HELPERS
============================================================ */

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim() !== "";
  }

  return true;
}

function cleanValue(value: unknown): unknown {
  if (!hasValue(value)) {
    return null;
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return value;
}

export function normalizeDocumentId(
  value: unknown
): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "");
}

/* ============================================================
   NORMALIZACIÓN NUMÉRICA
============================================================ */

function normalizeNumber(
  value: unknown
): unknown {
  if (!hasValue(value)) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : null;
  }

  const text = String(value)
    .trim()
    .replace(",", ".");

  if (!text) {
    return null;
  }

  const number = Number(text);

  return Number.isFinite(number)
    ? number
    : value;
}

/* ============================================================
   NORMALIZACIÓN SI / NO
============================================================ */

function normalizeYesNoValue(
  value: unknown
): unknown {
  if (!hasValue(value)) {
    return null;
  }

  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }

  const normalized = String(value)
    .trim()
    .toLowerCase();

  if (
    [
      "si",
      "sí",
      "yes",
      "true",
      "1",
    ].includes(normalized)
  ) {
    return "Si";
  }

  if (
    [
      "no",
      "false",
      "0",
    ].includes(normalized)
  ) {
    return "No";
  }

  return String(value).trim();
}

/* ============================================================
   NORMALIZACIÓN GOLD
============================================================ */

function normalizeGoldValue(
  value: unknown
): unknown {
  if (!hasValue(value)) {
    return null;
  }

  const normalized =
    normalizeNumber(value);

  if (
    typeof normalized === "number"
  ) {
    return normalized;
  }

  const text = String(value)
    .trim()
    .toUpperCase();

  const match = text.match(/[1-4]/);

  if (match) {
    return Number(match[0]);
  }

  return value;
}

/* ============================================================
   NORMALIZACIÓN TABAQUISMO
============================================================ */

function normalizeSmokingStatus(
  value: unknown
): unknown {
  if (!hasValue(value)) {
    return null;
  }

  const normalized = String(value)
    .trim()
    .toLowerCase();

  if (
    [
      "no",
      "no fuma",
      "nunca",
      "never",
      "never smoker",
      "0",
    ].includes(normalized)
  ) {
    return "No";
  }

  if (
    [
      "exfumador",
      "ex fumador",
      "ex-fumador",
      "former smoker",
      "former",
    ].includes(normalized)
  ) {
    return "Exfumador";
  }

  if (
    [
      "activo",
      "fumador activo",
      "active",
      "current",
      "current smoker",
      "fumador",
    ].includes(normalized)
  ) {
    return "Activo";
  }

  return String(value).trim();
}

/* ============================================================
   NORMALIZACIÓN DE TODA LA INFORMACIÓN
============================================================ */

function normalizePatientImportData(
  data: PatientImportData
): PatientImportData {
  const normalized: PatientImportData = {
    ...data,
  };

  /*
   * ==========================================================
   * NOMBRE TEMPORAL
   *
   * Prioridad:
   *
   * 1. name / NOMBRE real
   * 2. unnamedIndex proveniente de "Unnamed: 0"
   *
   * Ejemplo:
   *
   * Unnamed: 0 = 25
   * NOMBRE     = vacío
   *
   * Resultado:
   * name = "25"
   * ==========================================================
   */

  if (hasValue(normalized.name)) {
    normalized.name =
      String(normalized.name).trim();
  } else if (
    hasValue(normalized.unnamedIndex)
  ) {
    normalized.name =
      String(
        normalized.unnamedIndex
      ).trim();
  }

  /*
   * No guardamos el campo técnico
   * unnamedIndex como información clínica.
   *
   * El número se utiliza únicamente
   * como nombre temporal.
   */
  delete normalized.unnamedIndex;

  if (hasValue(normalized.documentId)) {
    normalized.documentId =
      normalizeDocumentId(
        normalized.documentId
      );
  }

  const numericFields = [
    "age",
    "packHistory",
    "smokingDaily",
    "mwt1",
    "mwt2",
    "mwt1Best",
    "fev1",
    "fev1Pred",
    "fvc",
    "fvcPred",
    "cat",
    "had",
    "sgrq",
    "bmi",
    "glucose",
    "hemoglobin",
    "creatinine",
    "systolicBP",
    "diastolicBP",
    "oxygenSaturation",
    "heartRate",
    "respiratoryRate",
    "temperature",
    "locationElevationM",
    "mmrc",
    "bodex",
    "dyspneaScale",
    "cardiovascularRisk",
    "emergencyClassification",
    "weight",
    "height",
  ] as const;

  numericFields.forEach((field) => {
    if (hasValue(normalized[field])) {
      normalized[field] =
        normalizeNumber(
          normalized[field]
        );
    }
  });

  if (hasValue(normalized.copdGold)) {
    normalized.copdGold =
      normalizeGoldValue(
        normalized.copdGold
      );
  }

  if (hasValue(normalized.smokingStatus)) {
    normalized.smokingStatus =
      normalizeSmokingStatus(
        normalized.smokingStatus
      );
  }

  const yesNoFields = [
    "heartFailureHistory",
    "coronaryHistory",
    "arrhythmias",
    "atrialFib",
    "asthma",
    "copdConfirmed",
  ] as const;

  yesNoFields.forEach((field) => {
    if (hasValue(normalized[field])) {
      normalized[field] =
        normalizeYesNoValue(
          normalized[field]
        );
    }
  });

  return normalized;
}

/* ============================================================
   VALORES ANIDADOS
============================================================ */

function getNestedValue(
  object: unknown,
  paths: string[]
): unknown {
  if (
    !object ||
    typeof object !== "object"
  ) {
    return null;
  }

  for (const path of paths) {
    const parts = path.split(".");
    let current: unknown = object;

    for (const part of parts) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== "object"
      ) {
        current = null;
        break;
      }

      current = (
        current as Record<
          string,
          unknown
        >
      )[part];
    }

    if (hasValue(current)) {
      return current;
    }
  }

  return null;
}

/* ============================================================
   DOCUMENTO DEL PACIENTE
============================================================ */

function getPatientDocumentId(
  data: Record<string, unknown>
): string {
  const value =
    getNestedValue(data, [
      "documentId",
      "document",
      "cedula",
      "identification",
      "identificationNumber",
      "identity.documentId",
      "personalData.documentId",
      "personal.documentId",
    ]);

  return normalizeDocumentId(value);
}

/* ============================================================
   CREAR PACIENTE
============================================================ */

export function buildPatientCreateDocument(
  data: PatientImportData,
  uid: string,
  fileType: "XLSX" | "CSV" = "XLSX"
): Record<string, unknown> {
  const normalized =
    normalizePatientImportData(data);

  const patient: Record<
    string,
    unknown
  > = {};

  Object.entries(normalized).forEach(
    ([key, value]) => {
      const cleaned =
        cleanValue(value);

      if (cleaned !== null) {
        patient[key] = cleaned;
      }
    }
  );

  const documentId =
    normalizeDocumentId(
      normalized.documentId
    );

  const displayName =
    String(
      normalized.name ?? ""
    ).trim();

  return {
    ...patient,

    ownerUid: null,

    assignedDoctorIds: [],
    assignedDoctors: [],

    importMetadata: {
      source: "admin",
      importedBy: uid,
      importedAt: serverTimestamp(),
      fileType,
      displayName,
      documentId,
    },

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
    updatedBy: uid,
  };
}

/* ============================================================
   ACTUALIZAR PACIENTE
============================================================ */

export function buildPatientUpdateData(
  data: PatientImportData,
  uid: string,
  fileType: "XLSX" | "CSV" = "XLSX"
): Record<string, unknown> {
  const normalized =
    normalizePatientImportData(data);

  const updateData: Record<
    string,
    unknown
  > = {};

  Object.entries(normalized).forEach(
    ([key, value]) => {
      const cleaned =
        cleanValue(value);

      if (cleaned !== null) {
        updateData[key] = cleaned;
      }
    }
  );

  updateData.updatedAt =
    serverTimestamp();

  updateData.updatedBy = uid;

  updateData[
    "importMetadata.source"
  ] = "admin";

  updateData[
    "importMetadata.importedBy"
  ] = uid;

  updateData[
    "importMetadata.importedAt"
  ] = serverTimestamp();

  updateData[
    "importMetadata.fileType"
  ] = fileType;

  if (hasValue(normalized.name)) {
    updateData[
      "importMetadata.displayName"
    ] = String(
      normalized.name
    ).trim();
  }

  if (hasValue(normalized.documentId)) {
    updateData[
      "importMetadata.documentId"
    ] = normalizeDocumentId(
      normalized.documentId
    );
  }

  /*
   * No modificamos:
   * assignedDoctorIds
   * assignedDoctors
   *
   * Una nueva importación no debe
   * eliminar asignaciones existentes.
   */

  return updateData;
}

/* ============================================================
   BUSCAR PACIENTES EXISTENTES
============================================================ */

export async function loadPatientsForImportLookup(): Promise<
  Map<string, PatientLookup>
> {
  const snapshot =
    await getDocs(
      collection(
        db,
        PATIENTS_COLLECTION
      )
    );

  const patients =
    new Map<
      string,
      PatientLookup
    >();

  snapshot.forEach(
    (snapshotDoc) => {
      const data =
        snapshotDoc.data();

      const documentId =
        getPatientDocumentId(data);

      if (!documentId) {
        return;
      }

      if (!patients.has(documentId)) {
        patients.set(
          documentId,
          {
            id: snapshotDoc.id,
            documentId,
          }
        );
      }
    }
  );

  return patients;
}

/* ============================================================
   CREAR LOG DE IMPORTACIÓN
============================================================ */

export async function createUploadLog(
  params: {
    fileName: string;
    recordsRequested: number;
    uploadedBy: string;
    uploadedByEmail?: string | null;
  }
): Promise<string> {
  const log = {
    type: "patients",
    operation: "import_upsert",

    fileName:
      params.fileName,

    recordsRequested:
      params.recordsRequested,

    recordsProcessed: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,

    createdPatientIds: [],
    updatedPatientIds: [],
    skippedRows: [],

    uploadedBy:
      params.uploadedBy,

    uploadedByEmail:
      params.uploadedByEmail ??
      null,

    status: "processing",

    createdAt:
      serverTimestamp(),
  };

  const reference =
    await addDoc(
      collection(
        db,
        UPLOAD_LOGS_COLLECTION
      ),
      log
    );

  return reference.id;
}

/* ============================================================
   ACTUALIZAR LOG
============================================================ */

export async function updateUploadLog(
  logId: string,
  data: Record<string, unknown>
): Promise<void> {
  await updateDoc(
    doc(
      db,
      UPLOAD_LOGS_COLLECTION,
      logId
    ),
    data
  );
}

/* ============================================================
   OBTENER LOG
============================================================ */

export async function getUploadLog(
  logId: string
): Promise<
  (UploadLog & {
    id: string;
  }) | null
> {
  const snapshot =
    await getDoc(
      doc(
        db,
        UPLOAD_LOGS_COLLECTION,
        logId
      )
    );

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() as UploadLog),
  };
}

/* ============================================================
   ELIMINAR PACIENTES CREADOS
============================================================ */

export async function deleteCreatedPatients(
  patientIds: string[]
): Promise<{
  deletedIds: string[];
  failedIds: string[];
}> {
  const deletedIds: string[] = [];
  const failedIds: string[] = [];

  for (const patientId of patientIds) {
    try {
      await deleteDoc(
        doc(
          db,
          PATIENTS_COLLECTION,
          patientId
        )
      );

      deletedIds.push(patientId);
    } catch {
      failedIds.push(patientId);
    }
  }

  return {
    deletedIds,
    failedIds,
  };
}

/* ============================================================
   ROLLBACK
============================================================ */

export async function rollbackUpload(
  logId: string
): Promise<{
  deletedIds: string[];
  failedIds: string[];
}> {
  const log =
    await getUploadLog(logId);

  if (!log) {
    throw new Error(
      "No se encontró el registro de importación."
    );
  }

  if (
    log.status ===
    "rolled_back"
  ) {
    throw new Error(
      "Esta importación ya fue revertida."
    );
  }

  const createdPatientIds =
    Array.isArray(
      log.createdPatientIds
    )
      ? log.createdPatientIds
      : [];

  if (
    createdPatientIds.length === 0
  ) {
    throw new Error(
      "Esta importación no tiene pacientes creados para revertir."
    );
  }

  const result =
    await deleteCreatedPatients(
      createdPatientIds
    );

  const rollbackComplete =
    result.failedIds.length === 0;

  await updateUploadLog(
    logId,
    {
      status:
        rollbackComplete
          ? "rolled_back"
          : "rollback_incomplete",

      rolledBackAt:
        serverTimestamp(),

      rollbackDeletedCount:
        result.deletedIds.length,

      rollbackError:
        rollbackComplete
          ? null
          : `No fue posible eliminar ${result.failedIds.length} paciente(s).`,
    }
  );

  return result;
}