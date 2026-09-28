"use client";

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import * as XLSX from "xlsx";

import {
  addDoc,
  collection,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/services/firebase/firebase-config";

import {
  getFirebaseErrorMessage,
  getFirstValue,
  hasValue,
  normalizeDocumentId,
  normalizeImportedGold,
  normalizeImportedSmokingStatus,
  normalizeImportedStatus,
  normalizeRow,
  normalizeText,
  normalizeYesNo,
} from "@/lib/admin-utils";

import { PATIENT_IMPORT_FIELDS } from "@/lib/admin-patient-fields";

import {
  buildPatientCreateDocument,
  buildPatientUpdateData,
  createUploadLog,
  getUploadLog,
  rollbackUpload,
  updateUploadLog,
} from "@/services/firebase/admin-imports";

const PATIENTS_COLLECTION = "patients";

const LAST_UPLOAD_LOG_KEY =
  "foxcat_last_patient_upload_log";

export interface AdminImportUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
}

interface PendingImport {
  fileName: string;
  rows: Record<string, unknown>[];
}

interface ImportedPatientData {
  [key: string]: unknown;
  temporaryName?: boolean;
  generatedDocumentId?: boolean;
}

interface ExistingPatient {
  id: string;
  documentId: string;
  age?: unknown;
  sex?: unknown;
}

interface SkippedRow {
  row: number;
  documentId?: string | null;
  reason: string;
}

type ImportStatusType =
  | "info"
  | "success"
  | "error";

interface ImportStatus {
  message: string;
  type: ImportStatusType;
}

interface AdminImportProps {
  currentAdmin: AdminImportUser | null;
}

/**
 * Convierte:
 *
 * 5.0  -> "5"
 * 12.0 -> "12"
 */
function normalizeTemporaryName(
  value: unknown
): string {
  if (!hasValue(value)) {
    return "";
  }

  const text = String(value).trim();

  if (!text) {
    return "";
  }

  if (/^\d+\.0+$/.test(text)) {
    return text.replace(/\.0+$/, "");
  }

  return text;
}

/**
 * Normaliza edad para poder comparar Excel
 * contra Firestore.
 */
function normalizeAge(
  value: unknown
): string {
  if (!hasValue(value)) {
    return "";
  }

  const text = String(value)
    .trim()
    .replace(",", ".");

  if (/^\d+\.0+$/.test(text)) {
    return text.replace(/\.0+$/, "");
  }

  return text;
}

/**
 * Normaliza sexo para comparación.
 *
 * Ejemplos:
 * Hombre / hombre / M / Masculino -> hombre
 * Mujer / mujer / F / Femenino -> mujer
 */
function normalizeSex(
  value: unknown
): string {
  const normalized =
    normalizeText(value);

  if (
    [
      "hombre",
      "masculino",
      "male",
      "m",
    ].includes(normalized)
  ) {
    return "hombre";
  }

  if (
    [
      "mujer",
      "femenino",
      "female",
      "f",
    ].includes(normalized)
  ) {
    return "mujer";
  }

  return normalized;
}

/**
 * Comprueba si dos pacientes representan
 * suficientemente al mismo individuo.
 *
 * IMPORTANTE:
 * El ID por sí solo NO es suficiente.
 *
 * Para actualizar exigimos:
 * - mismo documentId
 * - misma edad
 * - mismo sexo
 */
function isSamePatient(
  imported: ImportedPatientData,
  existing: ExistingPatient
): boolean {
  const importedAge =
    normalizeAge(imported.age);

  const existingAge =
    normalizeAge(existing.age);

  const importedSex =
    normalizeSex(imported.sex);

  const existingSex =
    normalizeSex(existing.sex);

  if (!importedAge || !existingAge) {
    return false;
  }

  if (!importedSex || !existingSex) {
    return false;
  }

  return (
    importedAge === existingAge &&
    importedSex === existingSex
  );
}

/**
 * Busca el valor de Unnamed: 0 en la fila original.
 */
function getTemporaryPatientName(
  row: Record<string, unknown>
): string {
  const possibleKeys = [
    "Unnamed: 0",
    "Unnamed 0",
    "Unnamed:0",
    "unnamed: 0",
    "unnamed 0",
    "unnamed0",
  ];

  for (const key of possibleKeys) {
    if (
      Object.prototype.hasOwnProperty.call(
        row,
        key
      )
    ) {
      const value =
        normalizeTemporaryName(row[key]);

      if (value) {
        return value;
      }
    }
  }

  for (const [key, value] of Object.entries(
    row
  )) {
    const normalizedKey = key
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

    if (
      normalizedKey === "unnamed0"
    ) {
      const temporaryName =
        normalizeTemporaryName(value);

      if (temporaryName) {
        return temporaryName;
      }
    }
  }

  const normalized = normalizeRow(row);

  const value = getFirstValue(
    normalized,
    [
      "Unnamed: 0",
      "Unnamed 0",
      "Unnamed:0",
      "unnamed: 0",
      "unnamed 0",
      "unnamed0",
    ]
  );

  return normalizeTemporaryName(value);
}

/**
 * Busca posibles identificadores alternativos.
 */
function getAlternativeDocumentId(
  row: Record<string, unknown>
): string {
  const normalized = normalizeRow(row);

  const aliases = [
    "ID",
    "Id",
    "id",
    "documentId",
    "document id",
    "documentID",
    "cedula",
    "cedula paciente",
    "documento",
    "documento identidad",
    "identificacion",
    "identificación",
    "patientId",
    "patient id",
    "patientID",
    "codigo paciente",
    "codigo",
    "código",
    "número documento",
    "numero documento",
    "numero de documento",
    "numero identificacion",
    "numero identificación",
  ];

  const value =
    getFirstValue(
      normalized,
      aliases
    );

  return normalizeDocumentId(value);
}

/**
 * Genera un ID temporal realmente único.
 *
 * crypto.randomUUID() es preferible a
 * Math.random() para este propósito.
 */
function generateUniqueDocumentId(
  usedDocumentIds: Set<string>
): string {
  let candidate = "";

  do {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      candidate =
        `IMP-${crypto.randomUUID()}`;
    } else {
      candidate =
        `IMP-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;
    }
  } while (
    usedDocumentIds.has(candidate)
  );

  usedDocumentIds.add(candidate);

  return candidate;
}

/**
 * Carga todos los pacientes con los datos
 * mínimos necesarios para determinar si un
 * ID coincidente realmente corresponde al
 * mismo paciente.
 */
async function loadExistingPatients(): Promise<
  ExistingPatient[]
> {
  const snapshot = await getDocs(
    collection(db, PATIENTS_COLLECTION)
  );

  const patients: ExistingPatient[] = [];

  snapshot.docs.forEach((item) => {
    const data = item.data();

    const documentId =
      normalizeDocumentId(data.documentId);

    if (!documentId) {
      return;
    }

    patients.push({
      id: item.id,
      documentId,
      age: data.age,
      sex: data.sex,
    });
  });

  return patients;
}

export default function AdminImport({
  currentAdmin,
}: AdminImportProps) {
  const [pendingImport, setPendingImport] =
    useState<PendingImport>({
      fileName: "",
      rows: [],
    });

  const [lastUploadLogId, setLastUploadLogId] =
    useState<string | null>(() => {
      if (typeof window === "undefined") {
        return null;
      }

      return localStorage.getItem(
        LAST_UPLOAD_LOG_KEY
      );
    });

  const [status, setStatus] =
    useState<ImportStatus>({
      message:
        "Selecciona un archivo para visualizar los datos antes de importarlos.",
      type: "info",
    });

  const [progress, setProgress] = useState(0);

  const [progressVisible, setProgressVisible] =
    useState(false);

  const [isReadingFile, setIsReadingFile] =
    useState(false);

  const [isImporting, setIsImporting] =
    useState(false);

  const [isRollingBack, setIsRollingBack] =
    useState(false);

  const [rollbackAvailable, setRollbackAvailable] =
    useState<boolean>(() => {
      if (typeof window === "undefined") {
        return false;
      }

      return Boolean(
        localStorage.getItem(
          LAST_UPLOAD_LOG_KEY
        )
      );
    });

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const hasPendingRows =
    pendingImport.rows.length > 0;

  const canStartImport =
    hasPendingRows &&
    !isReadingFile &&
    !isImporting &&
    !isRollingBack &&
    !!currentAdmin;

  const extractPatientImportData =
    useCallback(
      (
        row: Record<string, unknown>
      ): ImportedPatientData => {
        const normalized =
          normalizeRow(row);

        const data: ImportedPatientData =
          {};

        PATIENT_IMPORT_FIELDS.forEach(
          (field) => {
            const value =
              getFirstValue(
                normalized,
                field.aliases
              );

            if (!hasValue(value)) {
              return;
            }

            data[field.key] = value;
          }
        );

        /*
         * DOCUMENT ID
         */
        if (hasValue(data.documentId)) {
          data.documentId =
            normalizeDocumentId(
              data.documentId
            );
        }

        if (
          !hasValue(data.documentId)
        ) {
          const alternativeId =
            getAlternativeDocumentId(
              row
            );

          if (alternativeId) {
            data.documentId =
              alternativeId;
          }
        }

        /*
         * NOMBRE
         */
        let temporaryNameUsed =
          false;

        if (hasValue(data.name)) {
          data.name = String(
            data.name
          ).trim();
        } else {
          let temporaryName = "";

          if (
            hasValue(data.unnamedIndex)
          ) {
            temporaryName =
              normalizeTemporaryName(
                data.unnamedIndex
              );
          }

          if (!temporaryName) {
            temporaryName =
              getTemporaryPatientName(row);
          }

          if (!temporaryName) {
            temporaryName =
              normalizeTemporaryName(
                data.documentId
              );
          }

          if (temporaryName) {
            data.name =
              temporaryName;

            temporaryNameUsed =
              true;
          }
        }

        /*
         * NORMALIZACIONES CLÍNICAS
         */
        if (hasValue(data.status)) {
          data.status =
            normalizeImportedStatus(
              data.status
            );
        }

        if (hasValue(data.copdGold)) {
          data.copdGold =
            normalizeImportedGold(
              data.copdGold
            );
        }

        if (
          hasValue(data.smokingStatus)
        ) {
          data.smokingStatus =
            normalizeImportedSmokingStatus(
              data.smokingStatus
            );
        }

        const yesNoFields = [
          "heartFailureHistory",
          "coronaryHistory",
          "arrhythmias",
          "atrialFib",
          "asthma",
          "copdConfirmed",
        ];

        yesNoFields.forEach((field) => {
          if (hasValue(data[field])) {
            data[field] =
              normalizeYesNo(
                data[field]
              );
          }
        });

        data.temporaryName =
          temporaryNameUsed;

        delete data.unnamedIndex;

        return data;
      },
      []
    );

  const validateImportedPatientData =
    useCallback(
      (
        data: ImportedPatientData
      ): string | null => {
        const missing: string[] = [];

        if (!hasValue(data.documentId)) {
          missing.push("documentId");
        }

        if (!hasValue(data.age)) {
          missing.push("age");
        }

        if (!hasValue(data.name)) {
          missing.push("name");
        }

        if (!missing.length) {
          return null;
        }

        return (
          "faltan campos obligatorios: " +
          missing.join(", ")
        );
      },
      []
    );

  const readImportFile =
    useCallback(
      async (
        file: File
      ): Promise<
        Record<string, unknown>[]
      > => {
        const extension =
          file.name
            .split(".")
            .pop()
            ?.toLowerCase();

        if (
          ![
            "xlsx",
            "xls",
            "csv",
          ].includes(extension || "")
        ) {
          throw new Error(
            "El archivo debe ser XLSX, XLS o CSV."
          );
        }

        const buffer =
          await file.arrayBuffer();

        const workbook =
          XLSX.read(buffer, {
            type: "array",
            cellDates: true,
          });

        if (!workbook.SheetNames.length) {
          throw new Error(
            "El archivo no contiene hojas."
          );
        }

        const sheet =
          workbook.Sheets[
            workbook.SheetNames[0]
          ];

        if (!sheet) {
          throw new Error(
            "No se pudo leer la primera hoja del archivo."
          );
        }

        const rows =
          XLSX.utils.sheet_to_json(
            sheet,
            {
              defval: null,
              raw: false,
            }
          ) as Record<
            string,
            unknown
          >[];

        const validRows =
          rows.filter((row) =>
            Object.values(row).some(
              hasValue
            )
          );

        if (!validRows.length) {
          throw new Error(
            "No se encontraron registros válidos en el archivo."
          );
        }

        return validRows;
      },
      []
    );

  const resetImportState =
    useCallback(() => {
      setPendingImport({
        fileName: "",
        rows: [],
      });

      setProgress(0);
      setProgressVisible(false);

      setStatus({
        message:
          "Selecciona un archivo para visualizar los datos antes de importarlos.",
        type: "info",
      });

      setIsReadingFile(false);
    }, []);

  const handleFileChange =
    useCallback(
      async (
        event: ChangeEvent<HTMLInputElement>
      ) => {
        const file =
          event.target.files?.[0];

        if (!file) {
          resetImportState();
          return;
        }

        setIsReadingFile(true);

        setStatus({
          message: "Leyendo archivo...",
          type: "info",
        });

        try {
          const rows =
            await readImportFile(file);

          setPendingImport({
            fileName: file.name,
            rows,
          });

          setStatus({
            message:
              `Archivo válido. Se encontraron ${rows.length} registros.`,
            type: "success",
          });
        } catch (error) {
          console.error(
            "Error leyendo archivo:",
            error
          );

          setPendingImport({
            fileName: "",
            rows: [],
          });

          setStatus({
            message:
              getFirebaseErrorMessage(
                error
              ),
            type: "error",
          });
        } finally {
          setIsReadingFile(false);
        }
      },
      [
        readImportFile,
        resetImportState,
      ]
    );

  const executePatientImport =
    useCallback(async () => {
      if (!currentAdmin) {
        setStatus({
          message:
            "No existe una sesión administrativa válida.",
          type: "error",
        });

        return;
      }

      if (!pendingImport.rows.length) {
        setStatus({
          message:
            "No hay registros para importar.",
          type: "error",
        });

        return;
      }

      setIsImporting(true);
      setRollbackAvailable(false);
      setProgressVisible(true);
      setProgress(0);

      const createdPatientIds: string[] =
        [];

      const updatedPatientIds: string[] =
        [];

      const skippedRows: SkippedRow[] =
        [];

      let uploadLogId: string | null =
        null;

      try {
        setStatus({
          message:
            "Consultando pacientes existentes...",
          type: "info",
        });

        /*
         * Cargamos edad y sexo además del ID.
         */
        const existingPatients =
          await loadExistingPatients();

        /*
         * IDs que ya existen en Firestore.
         */
        const usedDocumentIds =
          new Set<string>(
            existingPatients.map(
              (patient) =>
                patient.documentId
            )
          );

        /*
         * Índice por documentId.
         *
         * Puede haber más de un paciente con
         * el mismo ID por anonimización.
         */
        const patientsByDocument =
          new Map<
            string,
            ExistingPatient[]
          >();

        existingPatients.forEach(
          (patient) => {
            const current =
              patientsByDocument.get(
                patient.documentId
              ) || [];

            current.push(patient);

            patientsByDocument.set(
              patient.documentId,
              current
            );
          }
        );

        /*
         * IDs utilizados en el archivo actual.
         */
        const importedDocumentIds =
          new Map<
            string,
            ImportedPatientData[]
          >();

        setStatus({
          message:
            "Creando registro de importación...",
          type: "info",
        });

        uploadLogId =
          await createUploadLog({
            fileName:
              pendingImport.fileName,
            recordsRequested:
              pendingImport.rows.length,
            uploadedBy:
              currentAdmin.uid,
            uploadedByEmail:
              currentAdmin.email,
          });

        for (
          let index = 0;
          index <
          pendingImport.rows.length;
          index++
        ) {
          const row =
            pendingImport.rows[index];

          const rowNumber = index + 2;

          const data =
            extractPatientImportData(row);

          let documentId =
            normalizeDocumentId(
              data.documentId
            );

          /*
           * =====================================================
           * ID AUSENTE
           * =====================================================
           */
          if (!documentId) {
            documentId =
              generateUniqueDocumentId(
                usedDocumentIds
              );

            data.documentId =
              documentId;

            data.generatedDocumentId =
              true;

            data.name =
              documentId;

            data.temporaryName =
              true;
          }

          /*
           * =====================================================
           * CANDIDATOS CON EL MISMO ID
           * =====================================================
           */
          let candidates =
            patientsByDocument.get(
              documentId
            ) || [];

          /*
           * También tenemos que considerar
           * pacientes creados anteriormente
           * durante ESTE MISMO archivo.
           */
          const importedWithSameId =
            importedDocumentIds.get(
              documentId
            ) || [];

          /*
           * Buscamos un paciente existente
           * que tenga:
           *
           * ID + edad + sexo iguales.
           */
          let existingMatch:
            | ExistingPatient
            | undefined;

          if (candidates.length > 0) {
            existingMatch =
              candidates.find(
                (candidate) =>
                  isSamePatient(
                    data,
                    candidate
                  )
              );
          }

          /*
           * Si el mismo ID ya apareció dentro
           * del Excel, buscamos también una
           * coincidencia por edad + sexo.
           */
          const sameImportedPatient =
            importedWithSameId.find(
              (previous) =>
                normalizeAge(
                  previous.age
                ) ===
                  normalizeAge(
                    data.age
                  ) &&
                normalizeSex(
                  previous.sex
                ) ===
                  normalizeSex(
                    data.sex
                  )
            );

          /*
           * =====================================================
           * ID COLISIONADO
           * =====================================================
           *
           * Si existe el mismo ID pero:
           *
           * - edad diferente
           * - sexo diferente
           * - edad ausente
           * - sexo ausente
           *
           * NO actualizamos.
           *
           * Generamos un ID nuevo.
           */
          const hasDocumentCollision =
            candidates.length > 0;

          const hasSameImportedId =
            importedWithSameId.length > 0;

          if (
            !existingMatch &&
            (
              hasDocumentCollision ||
              hasSameImportedId
            )
          ) {
            const originalDocumentId =
              documentId;

            documentId =
              generateUniqueDocumentId(
                usedDocumentIds
              );

            data.documentId =
              documentId;

            data.generatedDocumentId =
              true;

            /*
             * Si el nombre era temporal,
             * también utilizamos el nuevo ID.
             */
            if (
              data.temporaryName
            ) {
              data.name =
                documentId;
            }

            setStatus({
              message:
                `Fila ${rowNumber}: ID ${originalDocumentId} coincide con otro paciente, pero edad/sexo no coinciden. Se generó ${documentId}.`,
              type: "info",
            });

            candidates = [];

            existingMatch =
              undefined;
          }

          /*
           * Si no tenemos nombre por alguna
           * razón, usamos el ID definitivo.
           */
          if (!hasValue(data.name)) {
            data.name =
              documentId;

            data.temporaryName =
              true;
          }

          /*
           * =====================================================
           * ACTUALIZACIÓN
           * =====================================================
           */
          if (existingMatch) {
            /*
             * El nombre temporal jamás reemplaza
             * un nombre real existente.
             */
            const updateDataSource = {
              ...data,
            };

            delete updateDataSource
              .temporaryName;

            delete updateDataSource
              .generatedDocumentId;

            if (data.temporaryName) {
              delete updateDataSource.name;
            }

            const updateData =
              buildPatientUpdateData(
                updateDataSource,
                currentAdmin.uid
              );

            await updateDoc(
              doc(
                db,
                PATIENTS_COLLECTION,
                existingMatch.id
              ),
              updateData
            );

            updatedPatientIds.push(
              existingMatch.id
            );
          } else {
            /*
             * ===================================================
             * CREACIÓN
             * ===================================================
             */
            const validationError =
              validateImportedPatientData(
                data
              );

            if (validationError) {
              skippedRows.push({
                row: rowNumber,
                documentId,
                reason:
                  validationError,
              });

              setProgress(
                ((index + 1) /
                  pendingImport.rows.length) *
                  100
              );

              continue;
            }

            const createData = {
              ...data,
            };

            delete createData
              .temporaryName;

            delete createData
              .generatedDocumentId;

            const patientData =
              buildPatientCreateDocument(
                createData,
                currentAdmin.uid
              );

            const patientRef =
              await addDoc(
                collection(
                  db,
                  PATIENTS_COLLECTION
                ),
                patientData
              );

            createdPatientIds.push(
              patientRef.id
            );

            const newPatient: ExistingPatient =
              {
                id: patientRef.id,
                documentId,
                age: data.age,
                sex: data.sex,
              };

            candidates.push(
              newPatient
            );

            patientsByDocument.set(
              documentId,
              candidates
            );

            usedDocumentIds.add(
              documentId
            );
          }

          /*
           * Guardamos el registro dentro del
           * archivo para detectar IDs repetidos.
           */
          const currentImported =
            importedDocumentIds.get(
              documentId
            ) || [];

          currentImported.push({
            ...data,
          });

          importedDocumentIds.set(
            documentId,
            currentImported
          );

          if (uploadLogId) {
            await updateUploadLog(
              uploadLogId,
              {
                recordsProcessed:
                  index + 1,

                recordsCreated:
                  createdPatientIds.length,

                recordsUpdated:
                  updatedPatientIds.length,

                recordsSkipped:
                  skippedRows.length,

                createdPatientIds: [
                  ...createdPatientIds,
                ],

                updatedPatientIds: [
                  ...updatedPatientIds,
                ],

                skippedRows: [
                  ...skippedRows,
                ],

                updatedAt: new Date(),
              }
            );
          }

          setProgress(
            ((index + 1) /
              pendingImport.rows.length) *
              100
          );

          setStatus({
            message:
              `Procesando ${index + 1} de ${pendingImport.rows.length}...`,
            type: "info",
          });
        }

        if (uploadLogId) {
          await updateUploadLog(
            uploadLogId,
            {
              status:
                skippedRows.length > 0
                  ? "completed_with_skipped_rows"
                  : "completed",

              recordsProcessed:
                pendingImport.rows.length,

              recordsCreated:
                createdPatientIds.length,

              recordsUpdated:
                updatedPatientIds.length,

              recordsSkipped:
                skippedRows.length,

              createdPatientIds: [
                ...createdPatientIds,
              ],

              updatedPatientIds: [
                ...updatedPatientIds,
              ],

              skippedRows: [
                ...skippedRows,
              ],

              completedAt: new Date(),
              updatedAt: new Date(),
            }
          );
        }

        setLastUploadLogId(
          uploadLogId
        );

        if (uploadLogId) {
          localStorage.setItem(
            LAST_UPLOAD_LOG_KEY,
            uploadLogId
          );
        }

        setProgress(100);

        setRollbackAvailable(
          createdPatientIds.length > 0
        );

        const skippedSummary =
          skippedRows.length > 0
            ? skippedRows
                .slice(0, 10)
                .map(
                  (item) =>
                    `Fila ${item.row}: ${item.reason}`
                )
                .join(" | ")
            : "";

        setStatus({
          message:
            `Importación completada: ${createdPatientIds.length} creados, ${updatedPatientIds.length} actualizados y ${skippedRows.length} omitidos.` +
            (skippedSummary
              ? ` Motivos: ${skippedSummary}`
              : ""),
          type:
            skippedRows.length > 0
              ? "info"
              : "success",
        });

        setPendingImport({
          fileName: "",
          rows: [],
        });

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (error) {
        console.error(
          "Error durante importación:",
          error
        );

        if (uploadLogId) {
          try {
            const log =
              await getUploadLog(
                uploadLogId
              );

            if (
              log &&
              Array.isArray(
                log.createdPatientIds
              ) &&
              log.createdPatientIds.length > 0
            ) {
              await rollbackUpload(
                uploadLogId
              );
            }
          } catch (
            rollbackError
          ) {
            console.error(
              "Error durante rollback automático:",
              rollbackError
            );
          }
        }

        setStatus({
          message:
            `La importación falló: ${getFirebaseErrorMessage(error)}. Los pacientes nuevos fueron revertidos cuando fue posible; los pacientes existentes no se revierten.`,
          type: "error",
        });

        setProgressVisible(false);
      } finally {
        setIsImporting(false);
      }
    }, [
      currentAdmin,
      pendingImport,
      extractPatientImportData,
      validateImportedPatientData,
    ]);

  const handleStartImport =
    useCallback(() => {
      if (!currentAdmin) {
        setStatus({
          message:
            "No existe una sesión administrativa válida.",
          type: "error",
        });

        return;
      }

      if (!pendingImport.rows.length) {
        return;
      }

      const confirmed =
        window.confirm(
          `Se procesarán ${pendingImport.rows.length} registros desde "${pendingImport.fileName}".\n\n` +
            "• ID + edad + sexo coincidentes → actualizar paciente.\n" +
            "• ID coincidente pero edad/sexo diferentes → crear paciente nuevo con ID generado.\n" +
            "• ID ausente → generar ID único.\n" +
            "• Unnamed: 0 → nombre temporal.\n" +
            "• Nombre ausente → ID como nombre temporal.\n" +
            "• N/A y campos vacíos → se consideran ausentes.\n" +
            "• Campos ausentes → no sobrescriben datos existentes.\n\n" +
            "¿Deseas continuar?"
        );

      if (!confirmed) {
        return;
      }

      void executePatientImport();
    }, [
      currentAdmin,
      pendingImport,
      executePatientImport,
    ]);

  const handleRollback =
    useCallback(async () => {
      const logId =
        lastUploadLogId ||
        localStorage.getItem(
          LAST_UPLOAD_LOG_KEY
        );

      if (!logId) {
        setStatus({
          message:
            "No existe una importación disponible para rollback.",
          type: "error",
        });

        return;
      }

      const confirmed =
        window.confirm(
          "Se eliminarán únicamente los pacientes NUEVOS creados por la última importación.\n\nLos pacientes existentes que fueron actualizados NO serán eliminados.\n\n¿Confirmas el rollback?"
        );

      if (!confirmed) {
        return;
      }

      setIsRollingBack(true);
      setProgressVisible(true);
      setProgress(0);

      try {
        const result =
          await rollbackUpload(logId);

        if (
          result.failedIds.length > 0
        ) {
          setStatus({
            message:
              `Rollback incompleto: ${result.deletedIds.length} pacientes eliminados y ${result.failedIds.length} no pudieron eliminarse.`,
            type: "error",
          });

          setRollbackAvailable(true);
          return;
        }

        localStorage.removeItem(
          LAST_UPLOAD_LOG_KEY
        );

        setLastUploadLogId(null);
        setRollbackAvailable(false);
        setProgress(100);

        setStatus({
          message:
            `Rollback completado. Se eliminaron ${result.deletedIds.length} pacientes nuevos.`,
          type: "success",
        });
      } catch (error) {
        setStatus({
          message:
            getFirebaseErrorMessage(error),
          type: "error",
        });

        setRollbackAvailable(true);
      } finally {
        setIsRollingBack(false);
        setProgressVisible(false);
      }
    }, [lastUploadLogId]);

  const previewRows =
    pendingImport.rows.slice(0, 10);

  const previewColumns =
    Array.from(
      new Set(
        previewRows.flatMap((row) =>
          Object.keys(row)
        )
      )
    ).slice(0, 12);

  return (
    <section
      id="admin-import"
      className="admin-module"
    >
      <div className="panel-header">
        <div>
          <h2>
            Importación de pacientes
          </h2>

          <p className="panel-subtitle">
            Importa pacientes desde
            archivos XLSX, XLS o CSV.
          </p>
        </div>
      </div>

      <div className="import-controls">
        <div className="form-group">
          <label htmlFor="patients-file">
            Archivo de pacientes
          </label>

          <input
            ref={fileInputRef}
            id="patients-file"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            disabled={
              isReadingFile ||
              isImporting ||
              isRollingBack
            }
          />
        </div>

        <p className="panel-subtitle">
          {pendingImport.fileName
            ? `${pendingImport.fileName} — ${pendingImport.rows.length} registros`
            : "Ningún archivo seleccionado."}
        </p>
      </div>

      {hasPendingRows && (
        <div className="import-info">
          <strong>Archivo válido.</strong>{" "}
          {pendingImport.rows.length}{" "}
          registros listos para importar.
        </div>
      )}

      <div
        className="import-preview"
        style={{
          marginTop: "1.5rem",
        }}
      >
        {hasPendingRows ? (
          <>
            <div className="users-table-container">
              <table className="users-table">
                <thead>
                  <tr>
                    {previewColumns.map(
                      (column) => (
                        <th key={column}>
                          {column}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {previewRows.map(
                    (row, index) => (
                      <tr key={index}>
                        {previewColumns.map(
                          (column) => (
                            <td
                              key={`${index}-${column}`}
                            >
                              {String(
                                row[column] ??
                                  ""
                              )}
                            </td>
                          )
                        )}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <p className="panel-subtitle">
              Mostrando{" "}
              {previewRows.length} de{" "}
              {pendingImport.rows.length}{" "}
              registros.
            </p>
          </>
        ) : (
          <p className="panel-subtitle">
            Selecciona un archivo para
            visualizar los datos antes
            de importarlos.
          </p>
        )}
      </div>

      <div
        className={`admin-status admin-status-${status.type}`}
        role="status"
        aria-live="polite"
      >
        {status.message}
      </div>

      {progressVisible && (
        <div
          className="import-progress"
          style={{
            marginTop: "1rem",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "8px",
              borderRadius: "999px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.min(
                  100,
                  Math.max(0, progress)
                )}%`,
                height: "100%",
                transition:
                  "width 0.2s ease",
              }}
            />
          </div>

          <p className="panel-subtitle">
            {Math.round(progress)}%
          </p>
        </div>
      )}

      <div
        className="admin-actions"
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginTop: "1.5rem",
        }}
      >
        <button
          type="button"
          className="btn-primary"
          onClick={handleStartImport}
          disabled={!canStartImport}
        >
          {isReadingFile
            ? "Leyendo..."
            : isImporting
              ? "Importando..."
              : "Iniciar importación"}
        </button>

        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            void handleRollback()
          }
          disabled={
            !rollbackAvailable ||
            isImporting ||
            isRollingBack
          }
        >
          {isRollingBack
            ? "Revirtiendo..."
            : "Rollback última importación"}
        </button>

        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            if (
              isImporting ||
              isRollingBack
            ) {
              return;
            }

            resetImportState();

            if (fileInputRef.current) {
              fileInputRef.current.value =
                "";
            }
          }}
          disabled={
            isImporting ||
            isRollingBack
          }
        >
          Limpiar
        </button>
      </div>

      <div
        className="panel-subtitle"
        style={{
          marginTop: "1.5rem",
        }}
      >
        <strong>Comportamiento:</strong>

        <ul>
          <li>
            <code>ID + edad + sexo</code>
            deben coincidir para actualizar
            un paciente.
          </li>

          <li>
            Un <code>ID</code> coincidente
            con edad o sexo diferente se
            considera otro paciente.
          </li>

          <li>
            Los pacientes con ID colisionado
            reciben un nuevo ID{" "}
            <code>IMP-...</code>.
          </li>

          <li>
            Si falta el <code>ID</code>, se
            genera un identificador único.
          </li>

          <li>
            Los IDs generados se verifican
            contra Firestore y contra el
            archivo actual.
          </li>

          <li>
            <code>Unnamed: 0</code> se utiliza
            como nombre temporal.
          </li>

          <li>
            Si falta el nombre, se utiliza el
            ID como nombre temporal.
          </li>

          <li>
            Un nombre temporal nunca
            sobrescribe un nombre real.
          </li>

          <li>
            <code>N/A</code> se considera
            ausente.
          </li>

          <li>
            Los campos ausentes no
            sobrescriben datos existentes.
          </li>

          <li>
            El rollback solamente elimina
            pacientes creados por la
            importación.
          </li>
        </ul>
      </div>
    </section>
  );
}