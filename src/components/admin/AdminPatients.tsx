"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getActiveDoctors,
  type AdminUser,
} from "@/services/firebase/admin-users";
import {
  assignPatientToDoctor,
  removePatientFromDoctor,
  subscribeToAdminPatients,
  type AdminPatient,
} from "@/services/firebase/admin-patients";
import {
  getFirebaseErrorMessage,
  getNestedValue,
  normalizeDocumentId,
  normalizeText,
} from "@/lib/admin-utils";

import PatientFilters, {
  type PatientFiltersState,
} from "./patients/patientFilters";

interface AdminPatientsProps {
  currentAdmin?: AdminUser | null;
}

const EMPTY_FILTERS: PatientFiltersState = {
  search: "",
  status: "",
  doctor: "",
  location: "",
};

type PatientGroup =
  | ""
  | "all"
  | "unassigned"
  | "assigned"
  | "copd"
  | "copd-confirmed";

type AssignmentAction = "assign" | "remove";

function getPatientValue(patient: AdminPatient, paths: string[]): string {
  const value = getNestedValue(patient, paths);
  return value == null ? "" : String(value);
}

function getPatientName(patient: AdminPatient): string {
  return getPatientValue(patient, [
    "name",
    "displayName",
    "personalData.name",
    "personal.name",
  ]);
}

function getPatientDocument(patient: AdminPatient): string {
  return normalizeDocumentId(
    getNestedValue(patient, [
      "documentId",
      "document",
      "cedula",
      "identification",
      "personalData.documentId",
      "personal.documentId",
    ])
  );
}

function getPatientStatus(patient: AdminPatient): string {
  return getPatientValue(patient, [
    "status",
    "clinicalStatus",
    "estado",
    "condition",
    "pulmonaryStatus",
  ]);
}

function getPatientLocation(patient: AdminPatient): string {
  return getPatientValue(patient, [
    "locationCity",
    "location",
    "ubicacion",
    "area",
    "service",
    "roomBed",
  ]);
}

function getAssignedDoctorIds(patient: AdminPatient): string[] {
  if (Array.isArray(patient.assignedDoctorIds)) {
    return patient.assignedDoctorIds
      .map((doctorId) => String(doctorId).trim())
      .filter(Boolean);
  }

  if (!Array.isArray(patient.assignedDoctors)) {
    return [];
  }

  return patient.assignedDoctors
    .map((doctor): string => {
      if (doctor !== null && typeof doctor === "object") {
        const doctorRecord = doctor as { id?: unknown; uid?: unknown };
        return String(doctorRecord.id ?? doctorRecord.uid ?? "").trim();
      }

      return String(doctor ?? "").trim();
    })
    .filter(Boolean);
}

function isPatientUnassigned(patient: AdminPatient): boolean {
  return getAssignedDoctorIds(patient).length === 0;
}

function isCopdPatient(patient: AdminPatient): boolean {
  const confirmed = normalizeText(
    getPatientValue(patient, ["copdConfirmed", "epocConfirmado"])
  );
  const severity = getPatientValue(patient, ["copdSeverity"]);
  const gold = getPatientValue(patient, ["copdGold"]);

  return (
    ["si", "s", "yes", "y", "true", "1", "positivo", "positive"].includes(
      confirmed
    ) ||
    Boolean(severity) ||
    Boolean(gold)
  );
}

function isCopdConfirmed(patient: AdminPatient): boolean {
  const value = normalizeText(
    getPatientValue(patient, ["copdConfirmed", "epocConfirmado"])
  );

  return ["si", "s", "yes", "y", "true", "1", "positivo", "positive"].includes(
    value
  );
}

function getGroupPatients(
  group: PatientGroup,
  patients: AdminPatient[]
): AdminPatient[] {
  switch (group) {
    case "all":
      return patients;
    case "unassigned":
      return patients.filter(isPatientUnassigned);
    case "assigned":
      return patients.filter((patient) => !isPatientUnassigned(patient));
    case "copd":
      return patients.filter(isCopdPatient);
    case "copd-confirmed":
      return patients.filter(isCopdConfirmed);
    default:
      return [];
  }
}

function updateLocalAssignment(
  patient: AdminPatient,
  doctorUid: string,
  action: AssignmentAction
): AdminPatient {
  const currentIds = getAssignedDoctorIds(patient);
  const currentDoctors = Array.isArray(patient.assignedDoctors)
    ? patient.assignedDoctors
    : [];

  if (action === "assign") {
    return {
      ...patient,
      assignedDoctorIds: currentIds.includes(doctorUid)
        ? currentIds
        : [...currentIds, doctorUid],
      assignedDoctors: currentDoctors.some((doctor) => {
        if (doctor !== null && typeof doctor === "object") {
          const record = doctor as { id?: unknown; uid?: unknown };
          return String(record.id ?? record.uid ?? "").trim() === doctorUid;
        }

        return String(doctor ?? "").trim() === doctorUid;
      })
        ? currentDoctors
        : [...currentDoctors, { uid: doctorUid }],
    };
  }

  return {
    ...patient,
    assignedDoctorIds: currentIds.filter((id) => id !== doctorUid),
    assignedDoctors: currentDoctors.filter((doctor) => {
      if (doctor !== null && typeof doctor === "object") {
        const record = doctor as { id?: unknown; uid?: unknown };
        return String(record.id ?? record.uid ?? "").trim() !== doctorUid;
      }

      return String(doctor ?? "").trim() !== doctorUid;
    }),
  };
}

export default function AdminPatients({ currentAdmin }: AdminPatientsProps) {
  const [patients, setPatients] = useState<AdminPatient[]>([]);
  const [doctors, setDoctors] = useState<AdminUser[]>([]);
  const [filters, setFilters] =
    useState<PatientFiltersState>(EMPTY_FILTERS);
  const [patientGroup, setPatientGroup] = useState<PatientGroup>("");
  const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([]);
  const [selectedDoctorIds, setSelectedDoctorIds] = useState<string[]>([]);
  const [assignmentAction, setAssignmentAction] =
    useState<AssignmentAction>("assign");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);

  useEffect(() => {
    return subscribeToAdminPatients({
      onData: (data) => {
        setPatients(data);
        setLoading(false);
        setSelectedPatientIds((current) =>
          current.filter((id) => data.some((patient) => patient.id === id))
        );
      },
      onError: (firebaseError) => {
        setLoading(false);
        setFeedback({
          type: "error",
          message: getFirebaseErrorMessage(firebaseError),
        });
      },
    });
  }, []);

  useEffect(() => {
    return getActiveDoctors({
      onData: setDoctors,
      onError: (firebaseError) =>
        setFeedback({
          type: "error",
          message: getFirebaseErrorMessage(firebaseError),
        }),
    });
  }, []);

  const statuses = useMemo(
    () =>
      Array.from(
        new Set(
          patients
            .map(getPatientStatus)
            .map((value) => value.trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    [patients]
  );

  const locations = useMemo(
    () =>
      Array.from(
        new Set(
          patients
            .map(getPatientLocation)
            .map((value) => value.trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    [patients]
  );

  const doctorOptions = useMemo(
    () =>
      doctors.map((doctor) => ({
        id: doctor.id || doctor.uid,
        displayName:
          doctor.displayName || doctor.email || doctor.id || doctor.uid,
      })),
    [doctors]
  );

  const filteredPatients = useMemo(() => {
    const search = normalizeText(filters.search);
    const status = normalizeText(filters.status);
    const location = normalizeText(filters.location);

    return patients.filter((patient) => {
      const name = normalizeText(getPatientName(patient));
      const document = normalizeText(getPatientDocument(patient));
      const patientStatus = normalizeText(getPatientStatus(patient));
      const patientLocation = normalizeText(getPatientLocation(patient));
      const assignedDoctorIds = getAssignedDoctorIds(patient);

      if (search && !name.includes(search) && !document.includes(search)) {
        return false;
      }
      if (status && patientStatus !== status) {
        return false;
      }
      if (location && patientLocation !== location) {
        return false;
      }
      if (filters.doctor === "__unassigned__" && assignedDoctorIds.length > 0) {
        return false;
      }
      if (
        filters.doctor &&
        filters.doctor !== "__unassigned__" &&
        !assignedDoctorIds.includes(filters.doctor)
      ) {
        return false;
      }

      return true;
    });
  }, [filters, patients]);

  const groupedPatients = useMemo(
    () => getGroupPatients(patientGroup, filteredPatients),
    [filteredPatients, patientGroup]
  );

  const visiblePatientIds = useMemo(
    () => groupedPatients.map((patient) => patient.id),
    [groupedPatients]
  );

  const selectedVisiblePatientIds = useMemo(
    () => selectedPatientIds.filter((id) => visiblePatientIds.includes(id)),
    [selectedPatientIds, visiblePatientIds]
  );

  const allVisibleSelected =
    visiblePatientIds.length > 0 &&
    visiblePatientIds.every((id) => selectedPatientIds.includes(id));

  const selectedDoctors = doctorOptions.filter((doctor) =>
    selectedDoctorIds.includes(doctor.id)
  );

  function handleGroupChange(group: PatientGroup) {
    setPatientGroup(group);
    setSelectedPatientIds(
      group
        ? getGroupPatients(group, filteredPatients).map((patient) => patient.id)
        : []
    );
  }

  function handlePatientSelection(patientId: string, checked: boolean) {
    setSelectedPatientIds((current) => {
      if (checked) {
        return current.includes(patientId) ? current : [...current, patientId];
      }
      return current.filter((id) => id !== patientId);
    });
  }

  function handleSelectAllVisible(checked: boolean) {
    setSelectedPatientIds((current) => {
      if (!checked) {
        return current.filter((id) => !visiblePatientIds.includes(id));
      }

      return Array.from(new Set([...current, ...visiblePatientIds]));
    });
  }

  function toggleDoctor(doctorId: string) {
    setSelectedDoctorIds((current) =>
      current.includes(doctorId)
        ? current.filter((id) => id !== doctorId)
        : [...current, doctorId]
    );
  }

  function toggleAllDoctors() {
    setSelectedDoctorIds((current) =>
      current.length === doctorOptions.length
        ? []
        : doctorOptions.map((doctor) => doctor.id)
    );
  }

  function clearSelection() {
    setSelectedPatientIds([]);
    setSelectedDoctorIds([]);
    setPatientGroup("");
  }

  async function handleBulkAssignment() {
    if (!currentAdmin) {
      setFeedback({
        type: "error",
        message: "No se pudo identificar al administrador actual.",
      });
      return;
    }

    const patientsToProcess = groupedPatients.filter((patient) =>
      selectedPatientIds.includes(patient.id)
    );

    if (patientsToProcess.length === 0) {
      setFeedback({
        type: "error",
        message: "Selecciona uno o varios pacientes.",
      });
      return;
    }

    if (selectedDoctorIds.length === 0) {
      setFeedback({
        type: "error",
        message: "Selecciona uno o varios médicos.",
      });
      return;
    }

    const doctorLabel =
      selectedDoctors.length === 1
        ? selectedDoctors[0].displayName
        : `${selectedDoctors.length} médicos`;
    const eligibleCount = patientsToProcess.reduce((count, patient) => {
      const assignedIds = getAssignedDoctorIds(patient);
      return (
        count +
        selectedDoctorIds.filter((doctorId) =>
          assignmentAction === "assign"
            ? !assignedIds.includes(doctorId)
            : assignedIds.includes(doctorId)
        ).length
      );
    }, 0);

    if (eligibleCount === 0) {
      setFeedback({
        type: "error",
        message:
          assignmentAction === "assign"
            ? "Todos los pacientes ya tienen esos médicos asignados."
            : "Ninguno de los pacientes tiene esos médicos asignados.",
      });
      return;
    }

    const actionLabel = assignmentAction === "assign" ? "asignar" : "retirar";
    if (
      !window.confirm(
        `¿Confirmas ${actionLabel} médicos?\n\nPacientes: ${patientsToProcess.length}\nMédicos: ${doctorLabel}\nRelaciones a actualizar: ${eligibleCount}`
      )
    ) {
      return;
    }

    setProcessing(true);
    setFeedback(null);

    let updatedCount = 0;
    let failedCount = 0;

    for (const patient of patientsToProcess) {
      let workingPatient = patient;

      for (const doctorId of selectedDoctorIds) {
        const alreadyAssigned = getAssignedDoctorIds(workingPatient).includes(
          doctorId
        );
        const shouldUpdate =
          assignmentAction === "assign" ? !alreadyAssigned : alreadyAssigned;

        if (!shouldUpdate) {
          continue;
        }

        try {
          if (assignmentAction === "assign") {
            await assignPatientToDoctor(workingPatient, doctorId, currentAdmin.uid);
          } else {
            await removePatientFromDoctor(workingPatient, doctorId, currentAdmin.uid);
          }

          workingPatient = updateLocalAssignment(
            workingPatient,
            doctorId,
            assignmentAction
          );
          updatedCount++;
        } catch (assignmentError) {
          failedCount++;
          console.error(
            `Error actualizando la asignación de ${patient.id}:`,
            assignmentError
          );
        }
      }
    }

    setProcessing(false);
    setSelectedPatientIds([]);
    setSelectedDoctorIds([]);
    setPatientGroup("");
    setFeedback({
      type: failedCount > 0 ? "error" : "success",
      message:
        failedCount > 0
          ? `Proceso parcial: ${updatedCount} relación(es) actualizadas y ${failedCount} con error.`
          : `Listo: ${updatedCount} relación(es) fueron ${
              assignmentAction === "assign" ? "asignadas" : "retiradas"
            } correctamente.`,
    });
  }

  return (
    <section className="admin-module admin-patients-module">
      <div className="admin-module-header">
        <div>
          <span className="admin-eyebrow">GESTIÓN DE PACIENTES</span>
          <h2>Asignaciones médicas</h2>
          <p>
            Selecciona pacientes y médicos en conjunto para agregar o retirar
            relaciones de forma rápida y segura.
          </p>
        </div>

        <div className="admin-patients-count">
          {filteredPatients.length} de {patients.length} pacientes
        </div>
      </div>

      <PatientFilters
        filters={filters}
        doctors={doctorOptions}
        statuses={statuses}
        locations={locations}
        onChange={setFilters}
      />

      <div className="assignment-workspace">
        <section className="panel assignment-selection-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">1. Selecciona pacientes</h3>
              <p className="panel-subtitle">
                Usa un grupo o marca pacientes individuales en la tabla.
              </p>
            </div>
            <span className="assignment-selection-count">
              {selectedVisiblePatientIds.length} seleccionados
            </span>
          </div>

          <div className="assignment-selection-controls">
            <div className="form-group">
              <label htmlFor="patient-group">Seleccionar grupo</label>
              <select
                id="patient-group"
                value={patientGroup}
                onChange={(event) =>
                  handleGroupChange(event.target.value as PatientGroup)
                }
                disabled={loading || filteredPatients.length === 0 || processing}
              >
                <option value="">Elegir un grupo...</option>
                <option value="all">Todos los pacientes filtrados</option>
                <option value="unassigned">Pacientes sin médico</option>
                <option value="assigned">Pacientes con médico</option>
                <option value="copd">Pacientes con EPOC</option>
                <option value="copd-confirmed">EPOC confirmado</option>
              </select>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={clearSelection}
              disabled={selectedPatientIds.length === 0 && selectedDoctorIds.length === 0}
            >
              Limpiar selección
            </button>
          </div>
        </section>

        <section className="panel assignment-doctors-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">2. Elige médicos</h3>
              <p className="panel-subtitle">
                Puedes elegir uno, varios o todos los médicos activos.
              </p>
            </div>
            <span className="assignment-selection-count">
              {selectedDoctorIds.length} seleccionados
            </span>
          </div>

          {doctors.length === 0 ? (
            <p className="panel-subtitle">
              No hay médicos activos disponibles para asignar pacientes.
            </p>
          ) : (
            <div className="admin-doctor-picker">
              <label className="admin-doctor-option admin-doctor-option-all">
                <input
                  type="checkbox"
                  checked={
                    selectedDoctorIds.length === doctorOptions.length &&
                    doctorOptions.length > 0
                  }
                  onChange={toggleAllDoctors}
                  disabled={processing}
                />
                <span>Seleccionar todos</span>
              </label>

              {doctorOptions.map((doctor) => (
                <label className="admin-doctor-option" key={doctor.id}>
                  <input
                    type="checkbox"
                    checked={selectedDoctorIds.includes(doctor.id)}
                    onChange={() => toggleDoctor(doctor.id)}
                    disabled={processing}
                  />
                  <span>{doctor.displayName}</span>
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="panel assignment-action-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">3. Aplica el cambio</h3>
              <p className="panel-subtitle">
                La acción se aplicará a todas las combinaciones seleccionadas.
              </p>
            </div>
          </div>

          <div className="assignment-action-row">
            <div
              className="assignment-action-choice"
              role="group"
              aria-label="Tipo de acción"
            >
              <button
                type="button"
                className={assignmentAction === "assign" ? "active" : ""}
                onClick={() => setAssignmentAction("assign")}
                disabled={processing}
              >
                + Agregar médicos
              </button>
              <button
                type="button"
                className={
                  assignmentAction === "remove" ? "active danger" : "danger"
                }
                onClick={() => setAssignmentAction("remove")}
                disabled={processing}
              >
                − Retirar médicos
              </button>
            </div>

            <button
              type="button"
              className={
                assignmentAction === "remove"
                  ? "btn assignment-submit assignment-submit-danger"
                  : "btn assignment-submit"
              }
              onClick={handleBulkAssignment}
              disabled={
                processing ||
                selectedVisiblePatientIds.length === 0 ||
                selectedDoctorIds.length === 0
              }
            >
              {processing
                ? "Actualizando asignaciones..."
                : assignmentAction === "assign"
                  ? "Asignar seleccionados"
                  : "Retirar seleccionados"}
            </button>
          </div>
        </section>
      </div>

      {feedback && (
        <div
          className={`admin-status assignment-feedback ${feedback.type}`}
          role="status"
        >
          {feedback.message}
        </div>
      )}

      <div className="assignment-table-heading">
        <div>
          <h3 className="panel-title">Pacientes</h3>
          <p className="panel-subtitle">
            {groupedPatients.length} visibles · marca uno o varios para gestionarlos.
          </p>
        </div>
        <span className="assignment-selection-count">
          {selectedVisiblePatientIds.length} para actualizar
        </span>
      </div>

      {loading ? (
        <div className="panel assignment-empty-state">
          <p className="panel-subtitle">Consultando pacientes...</p>
        </div>
      ) : groupedPatients.length === 0 ? (
        <div className="panel assignment-empty-state">
          <p className="panel-subtitle">
            No hay pacientes que coincidan con los filtros.
          </p>
        </div>
      ) : (
        <div className="users-table-container assignment-table-container">
          <table className="users-table assignment-table">
            <thead>
              <tr>
                <th className="patient-select-column">
                  <input
                    type="checkbox"
                    className="patient-checkbox"
                    checked={allVisibleSelected}
                    onChange={(event) => handleSelectAllVisible(event.target.checked)}
                    aria-label="Seleccionar todos los pacientes visibles"
                  />
                </th>
                <th>Paciente</th>
                <th>Documento</th>
                <th>Estado</th>
                <th>Ubicación</th>
                <th>Médicos asignados</th>
              </tr>
            </thead>
            <tbody>
              {groupedPatients.map((patient) => {
                const doctorIds = getAssignedDoctorIds(patient);
                const selected = selectedPatientIds.includes(patient.id);

                return (
                  <tr
                    key={patient.id}
                    className={selected ? "is-selected" : undefined}
                  >
                    <td className="patient-select-column">
                      <input
                        type="checkbox"
                        className="patient-checkbox"
                        checked={selected}
                        onChange={(event) =>
                          handlePatientSelection(patient.id, event.target.checked)
                        }
                        aria-label={`Seleccionar ${getPatientName(patient) || "paciente"}`}
                      />
                    </td>
                    <td>
                      <strong>{getPatientName(patient) || "Sin nombre"}</strong>
                      <small>{getPatientValue(patient, ["sex", "gender"])}</small>
                    </td>
                    <td>{getPatientDocument(patient) || "—"}</td>
                    <td>{getPatientStatus(patient) || "Sin estado"}</td>
                    <td>{getPatientLocation(patient) || "Sin ubicación"}</td>
                    <td>
                      {doctorIds.length === 0 ? (
                        <span className="soft-badge assignment-unassigned-badge">
                          Sin médico
                        </span>
                      ) : (
                        <div className="assignment-doctor-badges">
                          {doctorIds.map((doctorId) => (
                            <span className="soft-badge" key={doctorId}>
                              {doctorOptions.find((doctor) => doctor.id === doctorId)
                                ?.displayName || doctorId}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {currentAdmin && (
        <p className="panel-subtitle admin-patients-footer">
          Sesión administrativa: {currentAdmin.displayName || currentAdmin.email || currentAdmin.id}
        </p>
      )}
    </section>
  );
}
