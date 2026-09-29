"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getAllPatients } from "@/services/firebase/patient.service";
import {
  subscribeToAdminModels,
  type AdminModel,
} from "@/services/firebase/admin-models";
import {
  canonicalizePredictionKey,
  subscribeToAdminValidationAnalytics,
} from "@/services/firebase/ai-validation.service";
import type { Patient } from "@/types/doctor-patients";
import type {
  AdminPatientValidationStatus,
  AdminPredictionValidationSummary,
  AdminValidationAnalytics,
} from "@/types/admin-validation";

type ValidationView = "patients" | "comparison";
type PatientFilter = "all" | AdminPatientValidationStatus;

interface PredictionType {
  key: string;
  label: string;
  target: string;
}

interface ChartSlice {
  key: string;
  label: string;
  count: number;
  color: string;
}

const EMPTY_ANALYTICS: AdminValidationAnalytics = {
  patientSummaries: {},
  predictionSummaries: {},
};

const DEFAULT_PREDICTION_TYPES: PredictionType[] = [
  {
    key: "respiratory-risk",
    label: "COPD GOLD / EPOC",
    target: "copd_gold",
  },
  {
    key: "cardiac-risk",
    label: "Insuficiencia cardiaca",
    target: "history_of_heart_failure",
  },
  {
    key: "danger-symptom-risk",
    label: "Síntomas de alarma",
    target: "danger-symptom-risk",
  },
];

const STATUS_META: Record<AdminPatientValidationStatus, { label: string; shortLabel: string }> = {
  validated: { label: "IA validada", shortLabel: "Validada" },
  partial: { label: "Parcialmente validada", shortLabel: "Parcial" },
  missing: { label: "Paciente faltante", shortLabel: "Faltante" },
  "not-validated": { label: "IA no validada", shortLabel: "No validada" },
};

const CHART_COLORS = {
  validated: "#9dbfa7",
  partial: "#cbb5df",
  missing: "#d9dde4",
  "not-validated": "#d9a2a8",
};

function modelValue(model: AdminModel, keys: string[]): string {
  for (const key of keys) {
    const value = model[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
}

function predictionTypeFromModel(model: AdminModel): PredictionType | null {
  const explicitKey = modelValue(model, ["target", "predictionKey", "predictionType"]);
  const modelId = modelValue(model, ["key", "id"]);
  const rawKey = explicitKey || DEFAULT_PREDICTION_TYPES.find(
    (item) => item.key === canonicalizePredictionKey(modelId) || item.target === modelId,
  )?.key || "";
  if (!rawKey) return null;

  const key = canonicalizePredictionKey(rawKey);
  if (!key) return null;

  const known = DEFAULT_PREDICTION_TYPES.find((item) => item.key === key);
  return {
    key,
    label: modelValue(model, ["label", "name", "modelName"]) || known?.label || rawKey,
    target: modelValue(model, ["target", "predictionKey"]) || known?.target || rawKey,
  };
}

function predictionTypeFromSummary(
  summary: AdminPredictionValidationSummary,
): PredictionType {
  const known = DEFAULT_PREDICTION_TYPES.find(
    (item) => item.key === summary.predictionKey,
  );

  return {
    key: summary.predictionKey,
    label: known?.label || summary.label || summary.modelName || summary.predictionKey,
    target: known?.target || summary.target || summary.predictionKey,
  };
}

function getPatientStatus(
  summary: AdminValidationAnalytics["patientSummaries"][string] | undefined,
): AdminPatientValidationStatus {
  if (!summary || summary.reviewedCount === 0) return "missing";
  if (summary.reviewedCount < summary.totalPredictions) return "partial";
  if (summary.incorrectCount > 0) return "not-validated";
  return "validated";
}

function getModelStatus(
  patientId: string,
  predictionKey: string,
  analytics: AdminValidationAnalytics,
): AdminPatientValidationStatus {
  const patientSummary = analytics.patientSummaries[patientId];
  const review = patientSummary?.predictions[predictionKey];

  if (review?.verdict === "valid") return "validated";
  if (review?.verdict === "incorrect") return "not-validated";
  return patientSummary && patientSummary.reviewedCount > 0
    ? "partial"
    : "missing";
}

function getPatientName(patient: Patient): string {
  return patient.name?.trim() || "Paciente sin nombre";
}

function formatPatientStatus(
  status: AdminPatientValidationStatus,
  reviewedCount: number,
  totalPredictions: number,
  pendingCount: number,
): string {
  if (status === "validated") return `${reviewedCount}/${totalPredictions} revisadas`;
  if (status === "partial") return `Pendientes ${pendingCount}/${totalPredictions}`;
  if (status === "not-validated") return `${reviewedCount}/${totalPredictions} revisadas · con observaciones`;
  return `Pendientes ${totalPredictions}/${totalPredictions}`;
}

function percentage(count: number, total: number): string {
  if (!total) return "0%";
  return `${((count / total) * 100).toFixed(1)}%`;
}

function buildDonutGradient(slices: ChartSlice[], total: number): string {
  if (!total) return "conic-gradient(#e4e6eb 0deg 360deg)";

  let current = 0;
  const stops = slices.map((slice) => {
    const start = current;
    current += (slice.count / total) * 360;
    return `${slice.color} ${start}deg ${current}deg`;
  });

  return `conic-gradient(${stops.join(", ")})`;
}

function ChartLegend({
  slices,
  total,
  showValues = true,
}: {
  slices: ChartSlice[];
  total: number;
  showValues?: boolean;
}) {
  return (
    <div className="admin-validation-chart-legend">
      {slices.map((slice) => (
        <div className="admin-validation-legend-item" key={slice.key}>
          <span className="admin-validation-legend-dot" style={{ background: slice.color }} />
          <span>{slice.label}</span>
          {showValues && <strong>{slice.count}</strong>}
          {showValues && <small>{percentage(slice.count, total)}</small>}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: AdminPatientValidationStatus }) {
  return (
    <span className={`admin-validation-status is-${status}`}>
      {STATUS_META[status].shortLabel}
    </span>
  );
}

export default function AdminValidations() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [analytics, setAnalytics] = useState<AdminValidationAnalytics>(EMPTY_ANALYTICS);
  const [activeModels, setActiveModels] = useState<AdminModel[]>([]);
  const [view, setView] = useState<ValidationView>("patients");
  const [filter, setFilter] = useState<PatientFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const loadPatients = useCallback(async () => {
    try {
      const result = await getAllPatients();
      setPatients(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los pacientes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPatients();
    }, 0);

    const unsubscribeValidations = subscribeToAdminValidationAnalytics({
      onData: setAnalytics,
      onError: (cause) => {
        setError(cause.message || "No se pudieron cargar las validaciones.");
        setLoading(false);
      },
    });

    const unsubscribeModels = subscribeToAdminModels(
      setActiveModels,
      () => undefined,
    );

    return () => {
      window.clearTimeout(timer);
      unsubscribeValidations();
      unsubscribeModels();
    };
  }, [loadPatients, reloadToken]);

  const predictionTypes = useMemo(() => {
    const types = new Map<string, PredictionType>();
    DEFAULT_PREDICTION_TYPES.forEach((item) => types.set(item.key, item));

    activeModels
      .filter((model) => model.active === true || model.status === "active")
      .map(predictionTypeFromModel)
      .filter((item): item is PredictionType => Boolean(item))
      .forEach((item) => types.set(item.key, { ...types.get(item.key), ...item }));

    Object.values(analytics.predictionSummaries)
      .map(predictionTypeFromSummary)
      .forEach((item) => types.set(item.key, { ...types.get(item.key), ...item }));

    return Array.from(types.values());
  }, [activeModels, analytics.predictionSummaries]);

  const patientRows = useMemo(() => patients.map((patient) => {
    const summary = analytics.patientSummaries[patient.id];
    const status = getPatientStatus(summary);
    return {
      patient,
      summary: summary ?? {
        patientId: patient.id,
        reviewedCount: 0,
        validCount: 0,
        incorrectCount: 0,
        totalPredictions: 3,
        pendingCount: 3,
        status: "missing" as const,
        predictions: {},
      },
      status,
    };
  }), [analytics.patientSummaries, patients]);

  const filteredPatients = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("es");
    return patientRows.filter(({ patient, status }) => {
      const matchesStatus = filter === "all" || status === filter;
      const matchesSearch = !normalizedSearch || [
        getPatientName(patient),
        patient.documentId,
        patient.condition,
      ].some((value) => String(value ?? "").toLocaleLowerCase("es").includes(normalizedSearch));
      return matchesStatus && matchesSearch;
    });
  }, [filter, patientRows, search]);

  const overallSlices = useMemo<ChartSlice[]>(() => {
    const counts = {
      validated: 0,
      partial: 0,
      missing: 0,
      "not-validated": 0,
    } satisfies Record<AdminPatientValidationStatus, number>;

    patientRows.forEach((row) => { counts[row.status] += 1; });

    return (Object.keys(counts) as AdminPatientValidationStatus[]).map((key) => ({
      key,
      label: STATUS_META[key].label,
      count: counts[key],
      color: CHART_COLORS[key],
    }));
  }, [patientRows]);

  const modelBars = useMemo(() => predictionTypes.map((type) => {
    const counts = {
      validated: 0,
      partial: 0,
      missing: 0,
      "not-validated": 0,
    } satisfies Record<AdminPatientValidationStatus, number>;

    patients.forEach((patient) => {
      counts[getModelStatus(patient.id, type.key, analytics)] += 1;
    });

    return {
      ...type,
      slices: (Object.keys(counts) as AdminPatientValidationStatus[]).map((key) => ({
        key,
        label: STATUS_META[key].label,
        count: counts[key],
        color: CHART_COLORS[key],
      })),
    };
  }), [analytics, patients, predictionTypes]);

  const totalPatients = patients.length;
  const reviewedPatients = patientRows.filter((row) => row.summary.reviewedCount > 0).length;

  return (
    <section className="admin-module admin-validations-module">
      <div className="admin-module-header admin-validations-header">
        <div>
          <span className="admin-eyebrow">CONTROL DE CALIDAD CLÍNICA</span>
          <h2>Validaciones IA</h2>
          <p>Compara la predicción de los modelos con el criterio registrado por los médicos.</p>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={() => setReloadToken((value) => value + 1)}
          disabled={loading}
        >
          Actualizar datos
        </button>
      </div>

      {error && <div className="admin-validation-alert" role="alert">{error}</div>}

      <div className="admin-validation-metrics">
        <article><span>Pacientes</span><strong>{totalPatients}</strong><small>Denominador total</small></article>
        <article><span>Revisados</span><strong>{reviewedPatients}</strong><small>Con al menos una validación</small></article>
        <article><span>IA validada</span><strong>{overallSlices[0]?.count ?? 0}</strong><small>Revisión completa y correcta</small></article>
        <article><span>Pendientes</span><strong>{(overallSlices.find((slice) => slice.key === "partial")?.count ?? 0) + (overallSlices.find((slice) => slice.key === "missing")?.count ?? 0)}</strong><small>Parciales o faltantes</small></article>
      </div>

      <div className="admin-validation-charts-grid">
        <article className="admin-validation-chart-card">
          <div className="admin-validation-card-heading">
            <div>
              <span className="admin-eyebrow">COBERTURA GLOBAL</span>
              <h3>Estado de validación por paciente</h3>
            </div>
            <span className="admin-validation-total-mark">{totalPatients ? "100% total" : "Sin pacientes"}</span>
          </div>

          <div className="admin-validation-donut-layout">
            <div
              className="admin-validation-donut"
              style={{ background: buildDonutGradient(overallSlices, totalPatients) }}
              role="img"
              aria-label="Distribución del estado de validación del total de pacientes"
            >
              <div><strong>{totalPatients ? "100%" : "0%"}</strong><span>de pacientes</span></div>
            </div>
            <ChartLegend slices={overallSlices} total={totalPatients} />
          </div>
          <p className="admin-validation-chart-note">Las categorías son excluyentes: cada paciente cuenta una sola vez y el total siempre representa el 100%.</p>
        </article>

        <article className="admin-validation-chart-card">
          <div className="admin-validation-card-heading">
            <div>
              <span className="admin-eyebrow">COMPARATIVA POR MODELO</span>
              <h3>Validación separada por predicción</h3>
            </div>
            <span className="admin-validation-total-mark">{predictionTypes.length} modelos</span>
          </div>

          <div className="admin-validation-bar-chart" role="img" aria-label="Comparativa por tipo de predicción">
            {modelBars.map((model) => (
              <div className="admin-validation-model-row" key={model.key}>
                <div className="admin-validation-model-label">
                  <strong>{model.label}</strong>
                  <small>{totalPatients} pacientes</small>
                </div>
                <div className="admin-validation-stacked-bar">
                  {model.slices.map((slice) => (
                    <span
                      key={slice.key}
                      className={`is-${slice.key}`}
                      style={{ width: `${totalPatients ? (slice.count / totalPatients) * 100 : 0}%`, background: slice.color }}
                      title={`${slice.label}: ${slice.count} (${percentage(slice.count, totalPatients)})`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <ChartLegend slices={overallSlices} total={totalPatients} showValues={false} />
        </article>
      </div>

      <div className="admin-validation-view-tabs" role="tablist" aria-label="Detalle de validaciones">
        <button type="button" role="tab" aria-selected={view === "patients"} className={view === "patients" ? "is-active" : ""} onClick={() => setView("patients")}>Listado de pacientes</button>
        <button type="button" role="tab" aria-selected={view === "comparison"} className={view === "comparison" ? "is-active" : ""} onClick={() => setView("comparison")}>Comparativa IA–médico</button>
      </div>

      {view === "patients" ? (
        <section className="admin-validation-list-card">
          <div className="admin-validation-list-toolbar">
            <div>
              <h3>Pacientes y avance de validación</h3>
              <p>Los estados parciales muestran cuántas revisiones siguen pendientes.</p>
            </div>
            <div className="admin-validation-filters">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar paciente..." aria-label="Buscar paciente" />
              <select value={filter} onChange={(event) => setFilter(event.target.value as PatientFilter)} aria-label="Filtrar pacientes por validación">
                <option value="all">Todos los estados</option>
                <option value="validated">IA validada</option>
                <option value="partial">Parcialmente validados</option>
                <option value="missing">Pacientes faltantes</option>
                <option value="not-validated">IA no validada</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="admin-validation-empty">Cargando pacientes y validaciones...</div>
          ) : filteredPatients.length ? (
            <div className="admin-validation-patient-list">
              {filteredPatients.map(({ patient, summary, status }) => (
                <article className="admin-validation-patient-row" key={patient.id}>
                  <div className="admin-validation-patient-main">
                    <strong>{getPatientName(patient)}</strong>
                    <span>{patient.condition || "Condición no registrada"} · {patient.documentId || "Sin identificación"}</span>
                  </div>
                  <StatusBadge status={status} />
                  <div className="admin-validation-patient-progress">
                    <strong>{formatPatientStatus(status, summary.reviewedCount, summary.totalPredictions, summary.pendingCount)}</strong>
                    <div><span style={{ width: `${(summary.reviewedCount / summary.totalPredictions) * 100}%` }} /></div>
                  </div>
                  <div className="admin-validation-patient-result">
                    <span>Correctas <strong>{summary.validCount}</strong></span>
                    <span>No válidas <strong>{summary.incorrectCount}</strong></span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="admin-validation-empty">No hay pacientes que coincidan con el filtro.</div>
          )}
        </section>
      ) : (
        <section className="admin-validation-comparison-card">
          <div className="admin-validation-list-toolbar">
            <div>
              <h3>Comparativa entre IA y criterio médico</h3>
              <p>“IA correcta” corresponde a una validación positiva del médico; “No validada” indica una revisión negativa.</p>
            </div>
          </div>
          <div className="admin-validation-comparison-wrapper">
            <table className="admin-validation-comparison-table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Estado global</th>
                  {predictionTypes.map((type) => <th key={type.key}>{type.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {patientRows.map(({ patient, status }) => (
                  <tr key={patient.id}>
                    <td><strong>{getPatientName(patient)}</strong><small>{patient.condition || "Sin condición"}</small></td>
                    <td><StatusBadge status={status} /></td>
                    {predictionTypes.map((type) => {
                      const modelStatus = getModelStatus(patient.id, type.key, analytics);
                      const review = analytics.patientSummaries[patient.id]?.predictions[type.key];
                      return (
                        <td key={type.key}>
                          <span className={`admin-validation-comparison-status is-${modelStatus}`}>
                            {modelStatus === "validated" ? "✓ IA correcta" : modelStatus === "not-validated" ? "× No validada" : modelStatus === "partial" ? "Pendiente parcial" : "Paciente faltante"}
                          </span>
                          {review?.modelName && <small>{review.modelName}</small>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!patientRows.length && <div className="admin-validation-empty">No hay pacientes disponibles.</div>}
        </section>
      )}
    </section>
  );
}
