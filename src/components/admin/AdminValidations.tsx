"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getAllPatients } from "@/services/firebase/patient.service";
import {
  subscribeToAdminModels,
  type AdminModel,
} from "@/services/firebase/admin-models";
import {
  getActiveDoctors,
  type AdminUser,
} from "@/services/firebase/admin-users";
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
import { EXPECTED_PREDICTIONS_PER_PATIENT } from "@/lib/doctor/ai-validation/constants";

type ValidationView = "patients" | "comparison";
type PatientFilter = "all" | AdminPatientValidationStatus;
type DoctorScope = "general" | "doctor" | "group";

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
  records: [],
};

const DEFAULT_PREDICTION_TYPES: PredictionType[] = [
  {
    key: "copd_gold",
    label: "COPD GOLD / EPOC",
    target: "copd_gold",
  },
  {
    key: "cardiac-risk",
    label: "Riesgo de insuficiencia cardíaca",
    target: "history_of_heart_failure",
  },
  {
    key: "respiratory-risk",
    label: "Riesgo respiratorio",
    target: "respiratory-risk",
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

const PIE_COLORS = {
  validated: "#72aa84",
  incorrect: "#d97c83",
  pending: "#d9dde4",
};

const RISK_TARGET_LABELS: Record<string, string> = {
  "respiratory-risk": "Riesgo respiratorio",
  "cardiac-risk": "Riesgo de insuficiencia cardíaca",
  "danger-symptom-risk": "Síntomas de alarma",
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

function validationTargetKey(record: AdminValidationAnalytics["records"][number]): string {
  if (record.predictionKey === "copd_gold" || record.target.toLowerCase().includes("copd_gold")) {
    return "copd_gold";
  }
  return canonicalizePredictionKey(record.target || record.predictionKey);
}

function buildValidationSlices(
  patientIds: string[],
  targetKey: string,
  records: AdminValidationAnalytics["records"],
  doctorIds: string[],
): ChartSlice[] {
  const count = { validated: 0, incorrect: 0, pending: 0 };
  const patientIdSet = new Set(patientIds);
  const latestByPatient = new Map<string, AdminValidationAnalytics["records"][number]>();

  records.forEach((record) => {
    if (!patientIdSet.has(record.patientId) || validationTargetKey(record) !== targetKey) return;
    if (doctorIds.length && !doctorIds.includes(record.doctorUid)) return;
    const current = latestByPatient.get(record.patientId);
    if (!current || record.updatedAtMillis >= current.updatedAtMillis) {
      latestByPatient.set(record.patientId, record);
    }
  });

  patientIds.forEach((patientId) => {
    const latest = latestByPatient.get(patientId);
    if (!latest) count.pending += 1;
    else if (latest.verdict === "valid") count.validated += 1;
    else count.incorrect += 1;
  });

  return [
    { key: "validated", label: "Validada por el médico", count: count.validated, color: PIE_COLORS.validated },
    { key: "incorrect", label: "Marcada incorrecta", count: count.incorrect, color: PIE_COLORS.incorrect },
    { key: "pending", label: "Pendiente", count: count.pending, color: PIE_COLORS.pending },
  ];
}

function escapeSvg(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character] ?? character);
}

async function downloadValidationDonut(
  chartId: "epoc" | "riesgos",
  title: string,
  subtitle: string,
  slices: ChartSlice[],
): Promise<void> {
  const width = 1100;
  const height = 620;
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  const circumference = 2 * Math.PI * 142;
  let offset = 0;
  const rings = slices.map((slice) => {
    const arcLength = total ? circumference * slice.count / total : 0;
    const circle = `<circle cx="290" cy="315" r="142" fill="none" stroke="${slice.color}" stroke-width="66" stroke-dasharray="${arcLength} ${circumference - arcLength}" stroke-dashoffset="${-offset}" transform="rotate(-90 290 315)" />`;
    offset += arcLength;
    return circle;
  }).join("");
  const legend = slices.map((slice, index) => {
    const y = 236 + index * 90;
    return `<circle cx="600" cy="${y}" r="10" fill="${slice.color}" />
      <text x="626" y="${y + 5}" class="legend">${escapeSvg(slice.label)}</text>
      <text x="1015" y="${y + 5}" text-anchor="end" class="value">${slice.count} · ${percentage(slice.count, total)}</text>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#ffffff" />
    <style>.title{fill:#292735;font:700 30px Arial,sans-serif}.subtitle{fill:#656273;font:400 16px Arial,sans-serif}.legend{fill:#4f4c5c;font:600 18px Arial,sans-serif}.value{fill:#292735;font:700 18px Arial,sans-serif}.center{fill:#292735;font:700 34px Arial,sans-serif}.center-small{fill:#656273;font:400 15px Arial,sans-serif}</style>
    <text x="54" y="62" class="title">${escapeSvg(title)}</text>
    <text x="54" y="94" class="subtitle">${escapeSvg(subtitle)}</text>
    ${rings}
    <circle cx="290" cy="315" r="102" fill="#fff" />
    <text x="290" y="309" text-anchor="middle" class="center">${total}</text>
    <text x="290" y="340" text-anchor="middle" class="center-small">pacientes</text>
    ${legend}
    <text x="54" y="578" class="subtitle">Distribución de validaciones · Los pendientes representan pacientes sin revisión registrada para este target.</text>
  </svg>`;
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.src = svgUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("No se pudo generar la imagen del diagrama."));
    });
    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo crear la imagen del diagrama.");
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("No se pudo exportar el diagrama.")), "image/png");
    });
    const pngUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = `validaciones-${chartId}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
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
  const [doctors, setDoctors] = useState<AdminUser[]>([]);
  const [view, setView] = useState<ValidationView>("patients");
  const [filter, setFilter] = useState<PatientFilter>("all");
  const [doctorScope, setDoctorScope] = useState<DoctorScope>("general");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedGroupDoctorIds, setSelectedGroupDoctorIds] = useState<string[]>([]);
  const [selectedRiskTarget, setSelectedRiskTarget] = useState("__all__");
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
    const unsubscribeDoctors = getActiveDoctors({
      onData: setDoctors,
      onError: (cause) => setError(cause.message || "No se pudieron cargar los médicos."),
    });

    return () => {
      window.clearTimeout(timer);
      unsubscribeValidations();
      unsubscribeModels();
      unsubscribeDoctors();
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
        totalPredictions: EXPECTED_PREDICTIONS_PER_PATIENT,
        pendingCount: EXPECTED_PREDICTIONS_PER_PATIENT,
        goldVerdict: null,
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

  const riskTargetOptions = useMemo(() => {
    const targets = new Map<string, string>();
    Object.entries(RISK_TARGET_LABELS).forEach(([key, label]) => targets.set(key, label));
    analytics.records.forEach((record) => {
      const key = validationTargetKey(record);
      if (key !== "copd_gold") {
        targets.set(key, RISK_TARGET_LABELS[key] || predictionTypes.find((type) => type.key === key)?.label || record.target || key);
      }
    });
    return Array.from(targets, ([key, label]) => ({ key, label }));
  }, [analytics.records, predictionTypes]);

  const activeDoctorIds = useMemo(() => {
    if (doctorScope === "doctor") return selectedDoctorId ? [selectedDoctorId] : [];
    if (doctorScope === "group") return selectedGroupDoctorIds;
    return [];
  }, [doctorScope, selectedDoctorId, selectedGroupDoctorIds]);

  const chartPatients = useMemo(() => {
    if (doctorScope === "general") return patients;
    if (!activeDoctorIds.length) return [];
    const doctorSet = new Set(activeDoctorIds);
    const patientsWithReviews = new Set(
      analytics.records.filter((record) => doctorSet.has(record.doctorUid)).map((record) => record.patientId),
    );
    return patients.filter((patient) =>
      patient.assignedDoctorIds?.some((doctorId) => doctorSet.has(doctorId))
      || patientsWithReviews.has(patient.id),
    );
  }, [activeDoctorIds, analytics.records, doctorScope, patients]);

  const chartPatientIds = useMemo(() => chartPatients.map((patient) => patient.id), [chartPatients]);
  const epocSlices = useMemo(
    () => buildValidationSlices(chartPatientIds, "copd_gold", analytics.records, activeDoctorIds),
    [activeDoctorIds, analytics.records, chartPatientIds],
  );
  const riskSlices = useMemo(() => {
    if (selectedRiskTarget !== "__all__") {
      return buildValidationSlices(chartPatientIds, selectedRiskTarget, analytics.records, activeDoctorIds);
    }
    return riskTargetOptions.reduce<ChartSlice[]>((combined, target) => {
      const slices = buildValidationSlices(chartPatientIds, target.key, analytics.records, activeDoctorIds);
      slices.forEach((slice) => {
        const current = combined.find((item) => item.key === slice.key);
        if (current) current.count += slice.count;
        else combined.push({ ...slice });
      });
      return combined;
    }, [
      { key: "validated", label: "Validada por el médico", count: 0, color: PIE_COLORS.validated },
      { key: "incorrect", label: "Marcada incorrecta", count: 0, color: PIE_COLORS.incorrect },
      { key: "pending", label: "Pendiente", count: 0, color: PIE_COLORS.pending },
    ]);
  }, [activeDoctorIds, analytics.records, chartPatientIds, riskTargetOptions, selectedRiskTarget]);

  const epocTotal = epocSlices.reduce((sum, slice) => sum + slice.count, 0);
  const riskTotal = riskSlices.reduce((sum, slice) => sum + slice.count, 0);
  const doctorScopeLabel = doctorScope === "general"
    ? "Todos los médicos"
    : doctorScope === "doctor"
      ? doctors.find((doctor) => doctor.uid === selectedDoctorId)?.displayName || "Médico sin seleccionar"
      : `${activeDoctorIds.length} médicos seleccionados`;
  const [downloadingChart, setDownloadingChart] = useState<"epoc" | "riesgos" | null>(null);

  const handleDownloadChart = async (chartId: "epoc" | "riesgos") => {
    if (downloadingChart) return;
    setDownloadingChart(chartId);
    try {
      const slices = chartId === "epoc" ? epocSlices : riskSlices;
      const title = chartId === "epoc" ? "Validación EPOC · Nivel GOLD" : "Validación de predicciones de riesgo";
      const targetLabel = chartId === "epoc"
        ? "Target: COPD GOLD"
        : selectedRiskTarget === "__all__"
          ? `Todos los targets de riesgo · ${riskTargetOptions.length} targets`
          : `Target: ${riskTargetOptions.find((target) => target.key === selectedRiskTarget)?.label || selectedRiskTarget}`;
      await downloadValidationDonut(chartId, title, `${targetLabel} · ${doctorScopeLabel}`, slices);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la imagen del diagrama.");
    } finally {
      setDownloadingChart(null);
    }
  };

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

      <section className="admin-validation-chart-controls" aria-label="Filtros para diagramas de validación">
        <label>
          <span>Ámbito de médicos</span>
          <select value={doctorScope} onChange={(event) => setDoctorScope(event.target.value as DoctorScope)}>
            <option value="general">General · todos los médicos</option>
            <option value="doctor">Un médico</option>
            <option value="group">Grupo de médicos</option>
          </select>
        </label>
        {doctorScope === "doctor" && (
          <label>
            <span>Médico</span>
            <select value={selectedDoctorId} onChange={(event) => setSelectedDoctorId(event.target.value)}>
              <option value="">Selecciona un médico</option>
              {doctors.map((doctor) => <option value={doctor.uid} key={doctor.uid}>{doctor.displayName || doctor.email || doctor.uid}</option>)}
            </select>
          </label>
        )}
        {doctorScope === "group" && (
          <fieldset className="admin-validation-doctor-group">
            <legend>Grupo de médicos · selecciona uno o más</legend>
            {doctors.length ? doctors.map((doctor) => (
              <label key={doctor.uid}>
                <input
                  type="checkbox"
                  checked={selectedGroupDoctorIds.includes(doctor.uid)}
                  onChange={(event) => setSelectedGroupDoctorIds((current) => event.target.checked
                    ? [...current, doctor.uid]
                    : current.filter((uid) => uid !== doctor.uid))}
                />
                <span>{doctor.displayName || doctor.email || doctor.uid}</span>
              </label>
            )) : <small>No hay médicos activos disponibles.</small>}
          </fieldset>
        )}
        <div className="admin-validation-chart-scope" aria-live="polite">
          <span>Filtro aplicado</span>
          <strong>{doctorScopeLabel}</strong>
        </div>
      </section>

      <div className="admin-validation-charts-grid admin-validation-donut-grid">
        <article className="admin-validation-chart-card">
          <div className="admin-validation-card-heading">
            <div>
              <span className="admin-eyebrow">CLASIFICACIÓN CATEGÓRICA</span>
              <h3>Validación EPOC · Nivel GOLD</h3>
              <p>Solo el resultado categórico GOLD, independiente de los riesgos.</p>
            </div>
            <button type="button" className="admin-validation-download" onClick={() => void handleDownloadChart("epoc")} disabled={downloadingChart !== null || !epocTotal}>
              {downloadingChart === "epoc" ? "Generando…" : "Guardar imagen EPOC"}
            </button>
          </div>
          <div className="admin-validation-donut-layout">
            <div className="admin-validation-donut" style={{ background: buildDonutGradient(epocSlices, epocTotal) }} role="img" aria-label={`Distribución de validaciones EPOC GOLD: ${epocTotal} pacientes`}>
              <div><strong>{epocTotal}</strong><span>pacientes</span></div>
            </div>
            <ChartLegend slices={epocSlices} total={epocTotal} />
          </div>
          <p className="admin-validation-chart-note">Cada paciente cuenta una vez. “Pendiente” indica que no hay una validación GOLD registrada en el ámbito seleccionado.</p>
        </article>

        <article className="admin-validation-chart-card">
          <div className="admin-validation-card-heading">
            <div>
              <span className="admin-eyebrow">EVENTOS Y RIESGOS</span>
              <h3>Validación de riesgos</h3>
              <p>Elige un target de riesgo o reúne todos los targets.</p>
            </div>
            <button type="button" className="admin-validation-download" onClick={() => void handleDownloadChart("riesgos")} disabled={downloadingChart !== null || !riskTotal}>
              {downloadingChart === "riesgos" ? "Generando…" : "Guardar imagen de riesgos"}
            </button>
          </div>
          <label className="admin-validation-risk-target-filter">
            <span>Target de riesgo</span>
            <select value={selectedRiskTarget} onChange={(event) => setSelectedRiskTarget(event.target.value)}>
              <option value="__all__">Todos los targets de riesgo</option>
              {riskTargetOptions.map((target) => <option key={target.key} value={target.key}>{target.label}</option>)}
            </select>
          </label>
          <div className="admin-validation-donut-layout">
            <div className="admin-validation-donut" style={{ background: buildDonutGradient(riskSlices, riskTotal) }} role="img" aria-label={`Distribución de validaciones de riesgo: ${riskTotal} revisiones`}>
              <div><strong>{riskTotal}</strong><span>{selectedRiskTarget === "__all__" ? "revisiones" : "pacientes"}</span></div>
            </div>
            <ChartLegend slices={riskSlices} total={riskTotal} />
          </div>
          <p className="admin-validation-chart-note">
            {selectedRiskTarget === "__all__"
              ? `Se cuenta cada paciente por target de riesgo (${riskTargetOptions.length} targets); EPOC GOLD se excluye.`
              : "Cada paciente cuenta una vez en el target elegido; EPOC GOLD se excluye de esta gráfica."}
          </p>
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
                    <small className={`admin-validation-gold-verdict is-${summary.goldVerdict ?? "pending"}`}>
                      GOLD · {summary.goldVerdict === "valid" ? "validada" : summary.goldVerdict === "incorrect" ? "marcada incorrecta" : "pendiente"}
                    </small>
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
