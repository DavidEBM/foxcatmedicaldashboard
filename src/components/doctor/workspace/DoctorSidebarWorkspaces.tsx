"use client";

import { useEffect, useMemo, useState } from "react";

import type { Patient } from "@/types/doctor-patients";
import type { AiPatientValidationSummary } from "@/types/doctor-ai-validation";
import { subscribeToDoctorValidationSummaries } from "@/services/firebase/ai-validation.service";
import { EXPECTED_PREDICTIONS_PER_PATIENT } from "@/lib/doctor/ai-validation/constants";
import PatientCrudModal from "@/components/doctor/patients/PatientCrudModal";

interface DoctorPatientsWorkspaceProps {
  patients: Patient[];
  doctorUid: string | null;
  selectedPatientId: string | null;
  loading: boolean;
  error: string | null;
  onSelectPatient: (patientId: string) => void;
  onRefresh: () => void;
}

interface DoctorAgendaWorkspaceProps {
  patients: Patient[];
}

interface AgendaEvent {
  id: string;
  kind: "Cita" | "Consulta" | "Monitoreo" | "Laboratorio";
  patient: Patient;
  date: Date | null;
  time: string;
}

const EVENT_CONFIG = [
  {
    kind: "Cita",
    timeKeys: ["appointmentTime"],
    dateKeys: ["appointmentDate", "appointmentAt", "nextAppointmentAt", "appointmentDateTime"],
  },
  {
    kind: "Consulta",
    timeKeys: ["consultationTime"],
    dateKeys: ["consultationDate", "consultationAt", "consultationDateTime"],
  },
  {
    kind: "Monitoreo",
    timeKeys: ["monitoringTime"],
    dateKeys: ["monitoringDate", "monitoringAt", "monitoringDateTime"],
  },
  {
    kind: "Laboratorio",
    timeKeys: ["labTime", "laboratoryTime"],
    dateKeys: ["labDate", "laboratoryDate", "labAt", "labDateTime"],
  },
] as const;

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || /^\d{1,2}:\d{2}$/.test(trimmed)) return null;

    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    const parsed = dateOnly
      ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
      : new Date(trimmed);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: () => Date }).toDate;
    if (typeof toDate === "function") {
      const parsed = toDate();
      return parsed instanceof Date && !Number.isNaN(parsed.getTime())
        ? parsed
        : null;
    }
  }

  return null;
}

function asTime(value: unknown): string {
  const parsed = asDate(value);
  if (parsed && (value instanceof Date || (typeof value === "object" && value !== null))) {
    return new Intl.DateTimeFormat("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(parsed);
  }

  return typeof value === "string" ? value.trim() : "";
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildAgendaEvents(patients: Patient[]): AgendaEvent[] {
  return patients.flatMap((patient) => {
    const rawPatient = patient as unknown as Record<string, unknown>;

    return EVENT_CONFIG.flatMap((config) => {
      const dateValue = config.dateKeys
        .map((key) => rawPatient[key])
        .find((value) => value !== undefined && value !== null && value !== "");
      const timeValue = config.timeKeys
        .map((key) => rawPatient[key])
        .find((value) => value !== undefined && value !== null && value !== "");
      const date = asDate(dateValue);
      const time = asTime(timeValue) || (date ? asTime(date) : "");

      if (!date && !time) return [];

      return [{
        id: `${patient.id}-${config.kind}`,
        kind: config.kind,
        patient,
        date,
        time: time || "Hora pendiente",
      }];
    });
  });
}

function formatShortDate(date: Date): string {
  const formatted = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);

  return formatted.charAt(0).toLocaleUpperCase("es") + formatted.slice(1);
}

function formatMonthTitle(date: Date): string {
  const formatted = new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
  }).format(date);

  return formatted.charAt(0).toLocaleUpperCase("es") + formatted.slice(1);
}

export function DoctorPatientsWorkspace({
  patients,
  doctorUid,
  selectedPatientId,
  loading,
  error,
  onSelectPatient,
  onRefresh,
}: DoctorPatientsWorkspaceProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [wardFilter, setWardFilter] = useState("");
  const [validationFilter, setValidationFilter] = useState("");
  const [validationSummaries, setValidationSummaries] = useState<
    Record<string, AiPatientValidationSummary>
  >({});
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [patientFormStatus, setPatientFormStatus] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToDoctorValidationSummaries(doctorUid, {
      onData: setValidationSummaries,
    });
  }, [doctorUid]);

  const statuses = useMemo(
    () =>
      Array.from(
        new Set(patients.map((patient) => patient.status).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, "es")),
    [patients],
  );

  const locations = useMemo(
    () =>
      Array.from(
        new Set(patients.map((patient) => patient.locationCity).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, "es")),
    [patients],
  );

  const wards = useMemo(
    () =>
      Array.from(
        new Set(patients.map((patient) => patient.ward).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, "es")),
    [patients],
  );

  const filteredPatients = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("es");

    return patients.filter((patient) => {
      const searchableValues = [
        patient.name,
        patient.documentId,
        patient.condition,
        patient.ward,
        patient.locationCity,
        patient.room,
      ];

      const matchesSearch =
        !normalizedSearch ||
        searchableValues.some((value) =>
          value?.toLocaleLowerCase("es").includes(normalizedSearch),
        );

      return (
        matchesSearch &&
        (!statusFilter || patient.status === statusFilter) &&
        (!locationFilter || patient.locationCity === locationFilter) &&
        (!wardFilter || patient.ward === wardFilter) &&
        (!validationFilter ||
          (validationSummaries[patient.id]?.status ?? "pending") === validationFilter)
      );
    });
  }, [locationFilter, patients, search, statusFilter, validationFilter, validationSummaries, wardFilter]);

  const hasFilters = Boolean(
    search || statusFilter || locationFilter || wardFilter || validationFilter,
  );

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setLocationFilter("");
    setWardFilter("");
    setValidationFilter("");
  };

  return (
    <section className="doctor-sidebar-workspace" aria-labelledby="doctor-patients-title">
      <header className="doctor-sidebar-workspace-header">
        <div>
          <span className="doctor-dashboard-eyebrow">Atención asignada</span>
          <h2 id="doctor-patients-title">Pacientes a mi cargo</h2>
          <p>Selecciona un paciente para actualizar el contexto clínico del dashboard.</p>
        </div>
        <div className="doctor-sidebar-workspace-actions">
          <span className="doctor-sidebar-workspace-count">
            {hasFilters
              ? `${filteredPatients.length} de ${patients.length} pacientes`
              : `${patients.length} pacientes`}
          </span>
          <button
            type="button"
            className="doctor-patient-add"
            onClick={() => {
              setPatientFormStatus(null);
              setPatientModalOpen(true);
            }}
            disabled={!doctorUid}
          >
            <span aria-hidden="true">+</span>
            Agregar paciente
          </button>
          <button
            type="button"
            className="doctor-patient-refresh"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Actualizar pacientes"
          >
            <span aria-hidden="true">↻</span>
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </header>

      <label className="doctor-patient-search">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre, documento o diagnóstico"
          aria-label="Buscar pacientes asignados"
        />
      </label>

      <div className="doctor-patient-filters" aria-label="Filtros de pacientes">
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {statuses.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>

        <select
          value={locationFilter}
          onChange={(event) => setLocationFilter(event.target.value)}
          aria-label="Filtrar por ubicación"
        >
          <option value="">Todas las ubicaciones</option>
          {locations.map((location) => (
            <option key={location} value={location}>{location}</option>
          ))}
        </select>

        <select
          value={wardFilter}
          onChange={(event) => setWardFilter(event.target.value)}
          aria-label="Filtrar por servicio"
        >
          <option value="">Todos los servicios</option>
          {wards.map((ward) => (
            <option key={ward} value={ward}>{ward}</option>
          ))}
        </select>

        <select
          value={validationFilter}
          onChange={(event) => setValidationFilter(event.target.value)}
          aria-label="Filtrar por estado de validación IA"
        >
          <option value="">Todas las validaciones</option>
          <option value="pending">Pendientes</option>
          <option value="partial">Parciales</option>
          <option value="complete">Completas</option>
        </select>

        {hasFilters && (
          <button
            type="button"
            className="doctor-patient-clear-filters"
            onClick={clearFilters}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {loading ? (
        <p className="doctor-sidebar-workspace-state" role="status">Cargando pacientes asignados…</p>
      ) : error ? (
        <p className="doctor-sidebar-workspace-state is-error" role="alert">{error}</p>
      ) : filteredPatients.length === 0 ? (
        <p className="doctor-sidebar-workspace-state">
          {patients.length === 0
            ? "No hay pacientes asignados a esta cuenta médica."
            : "No se encontraron pacientes con esa búsqueda."}
        </p>
      ) : (
        <div className="doctor-assigned-patient-grid">
          {filteredPatients.map((patient) => {
            const selected = patient.id === selectedPatientId;
            const validationSummary = validationSummaries[patient.id] ?? {
              patientId: patient.id,
              validatedCount: 0,
              totalPredictions: EXPECTED_PREDICTIONS_PER_PATIENT,
              pendingCount: EXPECTED_PREDICTIONS_PER_PATIENT,
              status: "pending" as const,
            };
            const validationLabel = validationSummary.status === "complete"
              ? "Validación completa"
              : validationSummary.status === "partial"
                ? "Validación parcial"
                : "Validación pendiente";

            return (
              <button
                className={`doctor-assigned-patient ${selected ? "is-selected" : ""}`}
                key={patient.id}
                type="button"
                onClick={() => onSelectPatient(patient.id)}
                aria-pressed={selected}
              >
                <span className="doctor-assigned-patient-avatar" aria-hidden="true">
                  {patient.name.trim().slice(0, 1).toLocaleUpperCase("es") || "P"}
                </span>
                <span className="doctor-assigned-patient-copy">
                  <strong>{patient.name}</strong>
                  <span>{patient.condition || "Diagnóstico sin registrar"}</span>
                  <small>
                    {patient.documentId || "Documento sin registrar"}
                    {patient.ward ? ` · ${patient.ward}` : ""}
                  </small>
                </span>
                <span className="doctor-assigned-patient-statuses">
                  <span className={`doctor-assigned-patient-status status-${patient.statusClass}`}>
                    {patient.status || "Sin estado"}
                  </span>
                  <span
                    className={`doctor-validation-status is-${validationSummary.status}`}
                    title={`${validationLabel}: ${validationSummary.validatedCount}/${validationSummary.totalPredictions}`}
                  >
                    <i aria-hidden="true" />
                    {validationLabel} · {validationSummary.validatedCount}/{validationSummary.totalPredictions}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      {patientFormStatus && (
        <p className="doctor-patient-form-status" role="status">{patientFormStatus}</p>
      )}
      <PatientCrudModal
        open={patientModalOpen}
        mode="create"
        cities={["Bogota", "Medellin", "Cali", "Pasto", "Ipiales", "Barcelona"]}
        doctorId={doctorUid ?? ""}
        onClose={() => setPatientModalOpen(false)}
        onSaved={() => { void onRefresh(); }}
        onStatus={(message, type) => setPatientFormStatus(type === "error" ? message : "Paciente creado correctamente.")}
      />
    </section>
  );
}

export function DoctorAgendaWorkspace({ patients }: DoctorAgendaWorkspaceProps) {
  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(today);

  const events = useMemo(() => buildAgendaEvents(patients), [patients]);
  const datedEvents = events.filter((event) => event.date !== null);
  const undatedEvents = events.filter((event) => event.date === null);
  const selectedEvents = datedEvents
    .filter((event) => event.date && dateKey(event.date) === dateKey(selectedDate))
    .sort((a, b) => a.time.localeCompare(b.time));

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarCellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const eventsPerDay = new Map<string, number>();
  datedEvents.forEach((event) => {
    if (!event.date) return;
    const key = dateKey(event.date);
    eventsPerDay.set(key, (eventsPerDay.get(key) ?? 0) + 1);
  });

  const changeMonth = (offset: number) => {
    const nextMonth = new Date(year, month + offset, 1);
    setVisibleMonth(nextMonth);
    setSelectedDate(nextMonth);
  };

  return (
    <section className="doctor-sidebar-workspace doctor-agenda-workspace" aria-labelledby="doctor-agenda-title">
      <header className="doctor-sidebar-workspace-header">
        <div>
          <span className="doctor-dashboard-eyebrow">Citas asignadas</span>
          <h2 id="doctor-agenda-title">Agenda médica</h2>
          <p>Consultas, monitoreo y laboratorios de tus pacientes asignados.</p>
        </div>
        <span className="doctor-sidebar-workspace-count">{events.length} eventos</span>
      </header>

      <div className="doctor-agenda-layout">
        <section className="doctor-calendar-card" aria-label="Calendario mensual">
          <div className="doctor-calendar-toolbar">
            <button type="button" onClick={() => changeMonth(-1)} aria-label="Mes anterior">‹</button>
            <h3>{formatMonthTitle(visibleMonth)}</h3>
            <button type="button" onClick={() => changeMonth(1)} aria-label="Mes siguiente">›</button>
          </div>
          <div className="doctor-calendar-grid" role="group" aria-label="Días del mes">
            {["L", "M", "X", "J", "V", "S", "D"].map((day, index) => (
              <span className="doctor-calendar-weekday" key={`${day}-${index}`} aria-hidden="true">{day}</span>
            ))}
            {Array.from({ length: calendarCellCount }, (_, index) => {
              const dayNumber = index - firstWeekday + 1;
              if (dayNumber < 1 || dayNumber > daysInMonth) {
                return <span className="doctor-calendar-empty-day" key={`empty-${index}`} />;
              }

              const date = new Date(year, month, dayNumber);
              const key = dateKey(date);
              const eventCount = eventsPerDay.get(key) ?? 0;
              const selected = key === dateKey(selectedDate);
              const isToday = key === dateKey(today);

              return (
                <button
                  className={`doctor-calendar-day ${selected ? "is-selected" : ""} ${isToday ? "is-today" : ""}`}
                  key={key}
                  type="button"
                  aria-label={`${formatShortDate(date)}${eventCount ? `, ${eventCount} eventos` : ""}`}
                  aria-pressed={selected}
                  onClick={() => setSelectedDate(date)}
                >
                  <span>{dayNumber}</span>
                  {eventCount > 0 && <small>{eventCount}</small>}
                </button>
              );
            })}
          </div>
          <div className="doctor-calendar-legend">
            <span><i className="is-today" /> Hoy</span>
            <span><i className="has-events" /> Con eventos fechados</span>
          </div>
        </section>

        <section className="doctor-agenda-day-card" aria-live="polite">
          <span className="doctor-agenda-day-kicker">Día seleccionado</span>
          <h3>{formatShortDate(selectedDate)}</h3>
          {selectedEvents.length > 0 ? (
            <div className="doctor-agenda-event-list">
              {selectedEvents.map((event) => (
                <article className="doctor-agenda-event" key={event.id}>
                  <span className={`doctor-agenda-event-mark kind-${event.kind.toLocaleLowerCase("es")}`} />
                  <div>
                    <strong>{event.kind} · {event.time}</strong>
                    <span>{event.patient.name}</span>
                    <small>{event.patient.condition || "Diagnóstico sin registrar"}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="doctor-sidebar-workspace-state">No hay eventos con fecha para este día.</p>
          )}
        </section>
      </div>

      {undatedEvents.length > 0 && (
        <section className="doctor-agenda-undated" aria-labelledby="doctor-agenda-undated-title">
          <div>
            <h3 id="doctor-agenda-undated-title">Eventos sin fecha asignada</h3>
            <p>Las fichas contienen una hora, pero no una fecha. Completa la fecha para ubicarlos en el calendario.</p>
          </div>
          <div className="doctor-agenda-event-list is-compact">
            {undatedEvents.map((event) => (
              <article className="doctor-agenda-event" key={event.id}>
                <span className={`doctor-agenda-event-mark kind-${event.kind.toLocaleLowerCase("es")}`} />
                <div>
                  <strong>{event.kind} · {event.time}</strong>
                  <span>{event.patient.name}</span>
                  <small>{event.patient.condition || "Diagnóstico sin registrar"}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
