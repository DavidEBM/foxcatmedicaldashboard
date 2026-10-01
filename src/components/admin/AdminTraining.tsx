"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { auth } from "@/services/firebase/firebase-config";
import {
  ML_ALGORITHMS,
  ML_TARGETS,
  type MlAlgorithmId,
  type MlTargetId,
} from "@/lib/ml/training-config";

interface TrainingImage {
  path: string;
  name: string;
  url: string;
}

interface ModelReport {
  selectedModel?: string | null;
  runSelectedModel?: string | null;
  publishedValidationMetrics?: Record<string, unknown>;
  publicationReason?: string;
  publishedThisRun?: boolean;
  split?: { train?: number; validation?: number; test?: number };
  testMetrics?: Record<string, unknown>;
  algorithmsTested?: ModelCandidate[];
}

interface ModelCandidate {
  model: string;
  available?: boolean;
  validationMetrics?: Record<string, unknown>;
  testEvaluationAvailable?: boolean;
  testMetrics?: Record<string, unknown>;
}

interface TrainingManifest {
  generatedAt?: string;
  splitTotals?: { train?: number; validation?: number; test?: number };
  models?: Record<string, ModelReport>;
  skippedTargets?: Record<string, { reason?: string; status?: string }>;
  dataSources?: {
    firebaseIncluded?: boolean;
    localRows?: number;
    firebaseRows?: number;
    rowsAfterDeduplication?: number;
    duplicatesRemoved?: number;
    matchedExistingPatients?: number;
    targetConflicts?: number;
  };
}

interface TrainingJob {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  algorithms: string[];
  targets: string[];
  includeFirebasePatients: boolean;
  startedAt: string;
  finishedAt?: string;
  logs: string;
  error?: string;
}

interface TrainingStatusResponse {
  manifest: TrainingManifest | null;
  images: TrainingImage[];
  latestRun: TrainingJob | null;
}

function asPercent(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return `${(numeric <= 1 ? numeric * 100 : numeric).toFixed(1)}%`;
}

function metric(report: ModelReport | undefined, key: string): string {
  return asPercent(report?.testMetrics?.[key]);
}

const ELIGIBILITY_THRESHOLDS = {
  accuracy: 0.70,
  f1: 0.70,
  mcc: 0.40,
  kappa: 0.40,
  auc: 0.70,
} as const;

const SELECTION_METRICS = [
  { key: "accuracy", label: "Accuracy", threshold: ELIGIBILITY_THRESHOLDS.accuracy },
  { key: "f1", label: "F1-Score", threshold: ELIGIBILITY_THRESHOLDS.f1 },
  { key: "mcc", label: "MCC", threshold: ELIGIBILITY_THRESHOLDS.mcc },
  { key: "kappa", label: "Kappa", threshold: ELIGIBILITY_THRESHOLDS.kappa },
  { key: "auc", label: "ROC-AUC", threshold: ELIGIBILITY_THRESHOLDS.auc },
] as const;

const COMPARISON_METRICS = [
  ...SELECTION_METRICS.map(({ key, label }) => ({ key, label })),
  { key: "balancedAccuracy", label: "Balanced Acc." },
  { key: "precision", label: "Precisión" },
  { key: "recallSensitivity", label: "Sensibilidad" },
] as const;

function rawCandidateMetric(candidate: ModelCandidate, key: string): number | null {
  const numeric = Number(candidate.validationMetrics?.[key]);
  return Number.isFinite(numeric) ? numeric : null;
}

function metricPercent(value: number | null): number | null {
  if (value === null) return null;
  return value > 1 ? value / 100 : value;
}

function metricLabel(candidate: ModelCandidate, key: string): string {
  const value = rawCandidateMetric(candidate, key);
  if (value === null) return "—";
  if (key === "mcc" || key === "kappa") return value.toFixed(3);
  const percent = metricPercent(value);
  return percent === null ? "—" : `${(percent * 100).toFixed(1)}%`;
}

function isCandidateEligible(candidate: ModelCandidate): boolean {
  if (candidate.available === false) return false;
  return SELECTION_METRICS.every(({ key, threshold }) => {
    const value = rawCandidateMetric(candidate, key);
    return value !== null && value >= threshold;
  });
}

function isPublishedModelEligible(report: ModelReport): boolean {
  if (!report.selectedModel) return false;
  const metrics = report.publishedValidationMetrics
    ?? report.algorithmsTested?.find((candidate) => candidate.model === report.selectedModel)?.validationMetrics;
  return isCandidateEligible({ model: report.selectedModel, available: true, validationMetrics: metrics });
}

function candidateSelectionRank(candidate: ModelCandidate): number[] {
  return [
    ...["f1", "auc", "mcc", "kappa", "accuracy"].map((key) =>
      rawCandidateMetric(candidate, key) ?? Number.NEGATIVE_INFINITY,
    ),
  ];
}

function compareCandidatesBySelection(
  left: ModelCandidate,
  right: ModelCandidate,
): number {
  const leftRank = candidateSelectionRank(left);
  const rightRank = candidateSelectionRank(right);
  for (let index = 0; index < leftRank.length; index += 1) {
    if (leftRank[index] === rightRank[index]) continue;
    return leftRank[index] > rightRank[index] ? -1 : 1;
  }
  return 0;
}

function targetLabel(target: string): string {
  return ML_TARGETS.find((item) => item.id === target)?.label || target;
}

function runTestCandidate(
  report: ModelReport,
  candidates: ModelCandidate[],
): ModelCandidate | undefined {
  if (!report.runSelectedModel) return undefined;
  return candidates.find((candidate) => (
    candidate.model === report.runSelectedModel
    && isCandidateEligible(candidate)
    && candidate.testEvaluationAvailable
    && !!candidate.testMetrics
    && Object.keys(candidate.testMetrics).length > 0
  ));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncateLabel(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

async function downloadSvgAsPng(svg: string, target: string, graphId: number): Promise<void> {
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = svgUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("No se pudo preparar la imagen."));
    });
    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = image.naturalWidth * scale;
    canvas.height = image.naturalHeight * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("El navegador no pudo crear el lienzo de descarga.");
    context.scale(scale, scale);
    context.drawImage(image, 0, 0);
    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo convertir el gráfico a PNG.")), "image/png");
    });
    const pngUrl = URL.createObjectURL(pngBlob);
    const safeTarget = target.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "");
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = `grafica-${graphId}-${safeTarget || "objetivo"}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function validationHeatmapColor(value: number, threshold: number): string {
  const clamp = Math.max(-1, Math.min(1, value));
  const interpolate = (start: number[], end: number[], amount: number) =>
    `rgb(${start.map((channel, index) => Math.round(channel + (end[index] - channel) * amount)).join(",")})`;
  if (clamp >= threshold) {
    return interpolate([224, 244, 231], [18, 92, 50], (clamp - threshold) / (1 - threshold));
  }
  const failureStrength = Math.max(0, Math.min(1, 1 - Math.max(0, clamp) / threshold));
  return interpolate([255, 239, 239], [190, 62, 62], failureStrength);
}

function informativeHeatmapColor(value: number | null, key: string): string {
  if (value === null) return "#eef0f4";
  const scaled = key === "mcc" || key === "kappa"
    ? (value + 1) / 2
    : metricPercent(value) ?? 0;
  const intensity = Math.max(0, Math.min(1, scaled));
  const red = Math.round(238 - intensity * 94);
  const green = Math.round(245 - intensity * 74);
  const blue = Math.round(241 - intensity * 113);
  return `rgb(${red}, ${green}, ${blue})`;
}

function isMetricPassing(value: number | null, threshold: number): boolean {
  return value !== null && value >= threshold;
}

function chartBase(width: number, height: number, title: string, subtitle: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#fff" />
    <style>.title{fill:#25263a;font:700 28px Arial,sans-serif}.subtitle{fill:#626477;font:400 15px Arial,sans-serif}.label{fill:#3f4051;font:600 13px Arial,sans-serif}.header{fill:#535569;font:700 12px Arial,sans-serif}.cell{fill:#25263a;font:700 12px Arial,sans-serif}.note{fill:#626477;font:400 12px Arial,sans-serif}</style>
    <text x="48" y="48" class="title">${escapeXml(title)}</text>
    <text x="48" y="76" class="subtitle">${escapeXml(subtitle)}</text>`;
}

function eligibilityChartSvg(label: string, candidates: ModelCandidate[]): string {
  const width = 1450;
  const margin = 48;
  const modelWidth = 240;
  const statusWidth = 160;
  const metricWidth = (width - margin * 2 - modelWidth - statusWidth) / SELECTION_METRICS.length;
  const headerY = 126;
  const rowHeight = 52;
  const height = headerY + 45 + candidates.length * rowHeight + 75;
  const winner = [...candidates].filter(isCandidateEligible).sort(compareCandidatesBySelection)[0];
  const headers = SELECTION_METRICS.map((metric, index) => {
    const x = margin + modelWidth + index * metricWidth;
    return `<text x="${x + metricWidth / 2}" y="${headerY + 24}" text-anchor="middle" class="header">${escapeXml(metric.label)}</text>
      <text x="${x + metricWidth / 2}" y="${headerY + 41}" text-anchor="middle" class="note">mín. ${(metric.threshold * 100).toFixed(0)}%</text>`;
  }).join("");
  const rows = candidates.map((candidate, rowIndex) => {
    const y = headerY + 52 + rowIndex * rowHeight;
    const eligible = isCandidateEligible(candidate);
    const cells = SELECTION_METRICS.map((metric, metricIndex) => {
      const value = rawCandidateMetric(candidate, metric.key);
      const x = margin + modelWidth + metricIndex * metricWidth;
      const passed = isMetricPassing(value, metric.threshold);
      const shadeValue = metric.key === "mcc" || metric.key === "kappa" ? (value ?? -1) : (metricPercent(value) ?? 0);
      return `<rect x="${x + 3}" y="${y + 3}" width="${metricWidth - 6}" height="${rowHeight - 6}" rx="6" fill="${validationHeatmapColor(shadeValue, metric.threshold)}" />
        <text x="${x + metricWidth / 2}" y="${y + 24}" text-anchor="middle" class="cell">${escapeXml(metricLabel(candidate, metric.key))}</text>
        <text x="${x + metricWidth / 2}" y="${y + 40}" text-anchor="middle" class="note">${value === null ? "sin dato" : passed ? "Cumple" : "No cumple"}</text>`;
    }).join("");
    const statusX = width - margin - statusWidth;
    const modelLabel = candidate.model === winner?.model ? `${candidate.model} · GANADOR` : candidate.model;
    return `<text x="${margin}" y="${y + 29}" class="label">${escapeXml(truncateLabel(modelLabel, 30))}</text>${cells}
      <text x="${statusX + statusWidth / 2}" y="${y + 29}" fill="${eligible ? "#17633a" : "#a33838"}" font-family="Arial,sans-serif" font-size="12" font-weight="700">${eligible ? "ELEGIBLE" : "NO ELEGIBLE"}</text>`;
  }).join("");
  return `${chartBase(width, height, "Gráfica 1 · Cumplimiento de requisitos", `${label} · verde = umbral cumplido, rojo = no cumplido; se exigen los cinco.`)}
    <text x="${margin}" y="${headerY + 24}" class="header">Modelo</text>${headers}
    <text x="${width - margin - statusWidth + statusWidth / 2}" y="${headerY + 24}" text-anchor="middle" class="header">Elegibilidad</text>${rows}
    <text x="${margin}" y="${height - 24}" class="note">Elegible solo cuando Accuracy ≥ 0.70, F1 ≥ 0.70, MCC ≥ 0.40, Kappa ≥ 0.40 y ROC-AUC ≥ 0.70.</text></svg>`;
}

function mccChartSvg(label: string, candidates: ModelCandidate[]): string {
  const width = 1200;
  const margin = 48;
  const trackX = 360;
  const trackWidth = 690;
  const startY = 142;
  const rowHeight = 46;
  const height = startY + candidates.length * rowHeight + 84;
  const zeroX = trackX + trackWidth / 2;
  const rows = candidates.map((candidate, index) => {
    const y = startY + index * rowHeight;
    const mcc = rawCandidateMetric(candidate, "mcc");
    const value = Math.max(-1, Math.min(1, mcc ?? 0));
    const barWidth = Math.abs(value) * trackWidth / 2;
    const barX = value >= 0 ? zeroX : zeroX - barWidth;
    return `<text x="${margin}" y="${y + 20}" class="label">${escapeXml(truncateLabel(candidate.model, 34))}</text>
      <rect x="${trackX}" y="${y}" width="${trackWidth}" height="16" rx="8" fill="#f1f2f6" />
      <rect x="${barX}" y="${y}" width="${barWidth}" height="16" rx="8" fill="${(mcc ?? -1) >= ELIGIBILITY_THRESHOLDS.mcc ? "#328452" : "#d17a7a"}" />
      <text x="${trackX + trackWidth + 18}" y="${y + 13}" class="cell">${mcc === null ? "—" : mcc.toFixed(3)}</text>`;
  }).join("");
  return `${chartBase(width, height, "Gráfica 2 · MCC por modelo", `${label} · Validación · MCC real de −1 a 1 · umbral de elegibilidad: 0.40`)}
    <line x1="${zeroX}" y1="${startY - 12}" x2="${zeroX}" y2="${height - 56}" stroke="#747688" stroke-width="2" />
    <text x="${trackX}" y="${startY - 16}" class="note">−1</text><text x="${zeroX}" y="${startY - 16}" text-anchor="middle" class="note">0</text><text x="${trackX + trackWidth}" y="${startY - 16}" text-anchor="end" class="note">1</text>${rows}</svg>`;
}

function fullMetricsHeatmapSvg(label: string, candidates: ModelCandidate[]): string {
  const width = 1550;
  const margin = 38;
  const modelWidth = 190;
  const metricWidth = (width - margin * 2 - modelWidth) / COMPARISON_METRICS.length;
  const startY = 136;
  const rowHeight = 46;
  const height = startY + candidates.length * rowHeight + 74;
  const header = COMPARISON_METRICS.map((metric, index) => {
    const x = margin + modelWidth + index * metricWidth;
    return `<text x="${x + metricWidth / 2}" y="${startY - 22}" text-anchor="middle" class="header">${escapeXml(metric.label)}</text>`;
  }).join("");
  const rows = candidates.map((candidate, rowIndex) => {
    const y = startY + rowIndex * rowHeight;
    const cells = COMPARISON_METRICS.map((metric, metricIndex) => {
      const value = rawCandidateMetric(candidate, metric.key);
      const scaled = metric.key === "mcc" || metric.key === "kappa"
        ? (value === null ? 0 : (value + 1) / 2)
        : metricPercent(value) ?? 0;
      const clamped = Math.max(0, Math.min(1, scaled));
      const red = Math.round(239 - clamped * 100);
      const green = Math.round(245 - clamped * 70);
      const blue = Math.round(241 - clamped * 120);
      const x = margin + modelWidth + metricIndex * metricWidth;
      return `<rect x="${x + 2}" y="${y + 2}" width="${metricWidth - 4}" height="${rowHeight - 4}" rx="5" fill="rgb(${red},${green},${blue})" />
        <text x="${x + metricWidth / 2}" y="${y + 28}" text-anchor="middle" class="cell">${escapeXml(metricLabel(candidate, metric.key))}</text>`;
    }).join("");
    return `<text x="${margin}" y="${y + 28}" class="label">${escapeXml(truncateLabel(candidate.model, 26))}</text>${cells}`;
  }).join("");
  return `${chartBase(width, height, "Gráfica 3 · Heatmap de métricas", `${label} · VALIDATION · Incluye métricas dentro y fuera de los requisitos de selección.`)}${header}${rows}
    <text x="${margin}" y="${height - 24}" class="note">MCC/Kappa: color normalizado solo para comparación visual; los valores mostrados son los originales.</text></svg>`;
}

async function downloadComparisonImage(
  target: string,
  label: string,
  graphId: number,
  candidates: ModelCandidate[],
): Promise<void> {
  const svg = graphId === 1
    ? eligibilityChartSvg(label, candidates)
    : graphId === 2
      ? mccChartSvg(label, candidates)
      : fullMetricsHeatmapSvg(label, candidates);
  await downloadSvgAsPng(svg, target, graphId);
}

export default function AdminTraining() {
  const [status, setStatus] = useState<TrainingStatusResponse | null>(null);
  const [selectedAlgorithms, setSelectedAlgorithms] = useState<MlAlgorithmId[]>(
    ML_ALGORITHMS.map((item) => item.id),
  );
  const [selectedTargets, setSelectedTargets] = useState<MlTargetId[]>([
    "copd_gold",
    "history_of_heart_failure",
  ]);
  const [includeFirebasePatients, setIncludeFirebasePatients] = useState(true);
  const [runId, setRunId] = useState<string | null>(null);
  const [job, setJob] = useState<TrainingJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [downloadingTarget, setDownloadingTarget] = useState<string | null>(null);
  const [error, setError] = useState("");

  const getToken = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("La sesión administrativa no está disponible.");
    return user.getIdToken();
  }, []);

  const loadStatus = useCallback(async (syncLatestJob = true) => {
    const token = await getToken();
    const response = await fetch("/api/admin/ml", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = await response.json() as TrainingStatusResponse & { error?: string };
    if (!response.ok) throw new Error(payload.error || "No se pudo cargar el estado ML.");
    setStatus(payload);
    if (syncLatestJob && payload.latestRun) {
      setJob(payload.latestRun);
    }
  }, [getToken]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialStatus() {
      try {
        await loadStatus();
      } catch (cause: unknown) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "No se pudo cargar el módulo ML.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInitialStatus();
    return () => {
      cancelled = true;
    };
  }, [loadStatus]);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const token = await getToken();
        const response = await fetch(`/api/admin/ml/train?runId=${encodeURIComponent(runId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const payload = await response.json() as { job?: TrainingJob; error?: string };
        if (!response.ok) throw new Error(payload.error || "No se pudo consultar el entrenamiento.");
        if (cancelled || !payload.job) return;
        setJob(payload.job);

        if (payload.job.status === "succeeded" || payload.job.status === "failed") {
          setRunId(null);
          await loadStatus(false);
        }
      } catch (cause: unknown) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Falló la consulta del entrenamiento.");
      }
    };

    void poll();
    const interval = window.setInterval(() => void poll(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [getToken, loadStatus, runId]);

  function toggleAlgorithm(id: MlAlgorithmId) {
    setSelectedAlgorithms((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  function toggleTarget(id: MlTargetId) {
    setSelectedTargets((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  async function startTraining() {
    if (!selectedAlgorithms.length || !selectedTargets.length || starting || runId) return;

    try {
      setStarting(true);
      setError("");
      const token = await getToken();
      const response = await fetch("/api/admin/ml/train", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          algorithms: selectedAlgorithms,
          targets: selectedTargets,
          includeFirebasePatients,
        }),
      });
      const payload = await response.json() as { job?: TrainingJob; error?: string };
      if (!response.ok || !payload.job) throw new Error(payload.error || "No se pudo iniciar el entrenamiento.");
      setJob(payload.job);
      setRunId(payload.job.id);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar el entrenamiento.");
    } finally {
      setStarting(false);
    }
  }

  async function refreshTrainingData() {
    try {
      setRefreshing(true);
      setError("");
      await loadStatus(false);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "No se pudieron actualizar los resultados.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDownloadComparison(
    target: string,
    graphId: number,
    candidates: ModelCandidate[],
  ) {
    if (downloadingTarget) return;
    try {
      setDownloadingTarget(`${target}:${graphId}`);
      setError("");
      await downloadComparisonImage(
        target,
        targetLabel(target),
        graphId,
        candidates,
      );
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "No se pudo descargar la comparativa.");
    } finally {
      setDownloadingTarget(null);
    }
  }

  const reports = useMemo(
    () => Object.entries(status?.manifest?.models ?? {}),
    [status?.manifest?.models],
  );

  const latestJob = job ?? status?.latestRun;
  const running = latestJob?.status === "queued" || latestJob?.status === "running";

  return (
    <section className="admin-module admin-training-module">
      <div className="admin-module-header">
        <div>
          <span className="admin-eyebrow">INTELIGENCIA ARTIFICIAL</span>
          <h2>Entrenamiento de IAs</h2>
          <p>
            Ejecuta los algoritmos disponibles sobre el dataset clínico y conserva
            modelos, métricas y gráficos en <code>ml/outputs/SavedModels</code>.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void startTraining()}
          disabled={starting || running || !selectedAlgorithms.length || !selectedTargets.length}
        >
          {running || starting ? "Entrenando..." : "Iniciar entrenamiento"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void refreshTrainingData()}
          disabled={refreshing || running || loading}
        >
          {refreshing ? "Actualizando..." : "Actualizar resultados"}
        </button>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="admin-training-methodology">
        <strong>Flujo protegido</strong>
        <span>TRAIN 70%</span>
        <span>VALIDATION 15%</span>
        <span>TEST 15%</span>
            <span>CV agrupada por paciente solo en TRAIN</span>
            <span>TEST únicamente para la evaluación final</span>
      </div>

      <label className="admin-training-source-option">
        <input
          type="checkbox"
          checked={includeFirebasePatients}
          onChange={(event) => setIncludeFirebasePatients(event.target.checked)}
          disabled={running}
        />
        <span>
          <strong>Incluir pacientes de Firebase</strong>
          <small>Se fusionan y deduplican antes de crear TRAIN, VALIDATION y TEST.</small>
        </span>
      </label>

      <div className="admin-training-selection">
        <div className="panel admin-training-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Algoritmos</h3>
              <p className="panel-subtitle">Selecciona las IAs que se ejecutarán desde el navegador.</p>
            </div>
          </div>
          <div className="admin-check-grid">
            {ML_ALGORITHMS.map((algorithm) => (
              <label className="admin-check-option" key={algorithm.id}>
                <input
                  type="checkbox"
                  checked={selectedAlgorithms.includes(algorithm.id)}
                  onChange={() => toggleAlgorithm(algorithm.id)}
                  disabled={running}
                />
                <span>{algorithm.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="panel admin-training-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Objetivos clínicos</h3>
              <p className="panel-subtitle">Los objetivos sin clases suficientes se reportan como no entrenables.</p>
            </div>
          </div>
          <div className="admin-check-grid">
            {ML_TARGETS.map((target) => {
              const skipped = status?.manifest?.skippedTargets?.[target.id];
              return (
                <label className="admin-check-option" key={target.id}>
                  <input
                    type="checkbox"
                    checked={selectedTargets.includes(target.id)}
                    onChange={() => toggleTarget(target.id)}
                    disabled={running}
                  />
                  <span>
                    {target.label}
                    {skipped && <small>{skipped.status || "Revisar datos"}</small>}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {latestJob && (
        <div className={`admin-training-run admin-training-run-${latestJob.status}`}>
          <div className="admin-training-run-header">
            <div>
              <span className="admin-eyebrow">EJECUCIÓN {latestJob.id.slice(0, 8)}</span>
              <strong>{latestJob.status === "succeeded" ? "Entrenamiento completado" : latestJob.status === "failed" ? "Entrenamiento con errores" : "Entrenamiento en curso"}</strong>
            </div>
            <span>{new Date(latestJob.startedAt).toLocaleString("es-CO")}</span>
          </div>
          <pre className="admin-training-log">{latestJob.logs || "Preparando proceso..."}</pre>
        </div>
      )}

      <div className="panel admin-training-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Últimos resultados</h3>
            <p className="panel-subtitle">
              {status?.manifest?.generatedAt
                ? `Generado: ${new Date(status.manifest.generatedAt).toLocaleString("es-CO")}`
                : loading ? "Cargando manifiesto..." : "Todavía no hay un manifiesto disponible."}
            </p>
          </div>
        </div>

        {reports.length ? (
          <div className="admin-training-results-grid">
            {reports.map(([target, report]) => (
              <article className="admin-training-result-card" key={target}>
                <span>{target}</span>
                <strong>{report.selectedModel || "Sin modelo publicado"}</strong>
                <div>
                  <small>Accuracy TEST vigente</small><b>{metric(report, "accuracy")}</b>
                  <small>F1 TEST vigente</small><b>{metric(report, "f1")}</b>
                  <small>AUC TEST vigente</small><b>{metric(report, "auc")}</b>
                </div>
                {report.runSelectedModel && report.runSelectedModel !== report.selectedModel && (
                  <small className="admin-training-result-note">
                    Esta corrida probÃ³ {report.runSelectedModel}; se mantuvo el modelo vigente {report.selectedModel}.
                  </small>
                )}
                {report.publicationReason?.startsWith("no_eligible_candidate") && (
                  <small className="admin-training-result-note">
                    Ningún modelo cumplió los cinco requisitos en esta corrida; no se eligió un ganador nuevo.
                    {report.selectedModel ? ` Se conserva el modelo publicado elegible: ${report.selectedModel}.` : " No hay modelo publicado para este objetivo."}
                  </small>
                )}
                <em className={isPublishedModelEligible(report) ? "is-good" : "is-warning"}>
                  {isPublishedModelEligible(report) ? "Modelo publicado elegible" : "Sin modelo publicado elegible"}
                </em>
              </article>
            ))}
          </div>
        ) : (
          <p className="panel-subtitle">Ejecuta un entrenamiento para generar resultados.</p>
        )}
      </div>

      <section className="admin-training-comparisons" aria-labelledby="admin-training-comparisons-title">
        <div className="admin-training-comparisons-heading">
          <div>
            <span className="admin-eyebrow">COMPARATIVA VS</span>
            <h3 id="admin-training-comparisons-title">Rendimiento de todos los modelos por objetivo</h3>
            <p className="admin-training-comparison-note">
              Solo se comparan targets con al menos un modelo elegible. Para ser elegible debe cumplir simultáneamente Accuracy ≥ 0.70, F1 ≥ 0.70, MCC ≥ 0.40, Kappa ≥ 0.40 y ROC-AUC ≥ 0.70.
            </p>
            <p className="admin-training-comparison-note">
              Entre modelos elegibles se prioriza F1-Score y luego ROC-AUC, MCC, Kappa y Accuracy. La calidad normalizada es solo informativa; su gráfico histórico está en Imágenes de diagnóstico.
            </p>
            <p className="admin-training-comparison-note">
              Cada comparativa incluye todos los algoritmos que reportaron métricas, hayan ganado o no; los elegibles aparecen primero y el mejor elegible se marca como ganador.
            </p>
          </div>
        </div>

        {reports.some(([, report]) => report.algorithmsTested?.some(isCandidateEligible)) ? (
          <div className="admin-training-comparison-grid">
            {reports.map(([target, sourceReport]) => {
              const candidates = [...(sourceReport.algorithmsTested || [])]
                .filter((candidate) => candidate.available !== false)
                .sort((left, right) => Number(isCandidateEligible(right)) - Number(isCandidateEligible(left)) || compareCandidatesBySelection(left, right));
              const eligibleCandidates = candidates.filter(isCandidateEligible);
              if (!eligibleCandidates.length) return null;
              const winner = eligibleCandidates[0];
              const testCandidate = runTestCandidate(sourceReport, candidates);
              const selectedTest = testCandidate?.testMetrics;
              const report: ModelReport = {
                ...sourceReport,
                selectedModel: testCandidate?.model || sourceReport.selectedModel,
                testMetrics: testCandidate?.testMetrics || sourceReport.testMetrics,
              };

              return (
                <article className="admin-training-comparison" key={`comparison-${target}`}>
                  <header className="admin-training-comparison-header">
                    <div>
                      <span className="admin-eyebrow">OBJETIVO CLÍNICO</span>
                      <h4>{targetLabel(target)}</h4>
                    </div>
                    <div className="admin-training-comparison-actions">
                      <span className="admin-training-comparison-count">
                        {candidates.length} modelos evaluados · {eligibleCandidates.length} elegibles
                      </span>
                      <span className="admin-training-best-model">
                        Ganador elegible: {winner.model}
                      </span>
                    </div>
                  </header>

                  <div className="admin-training-chart-block">
                    <div className="admin-training-chart-title">
                      <div><strong>Gráfica 1 · Heatmap de elegibilidad</strong><span>Validación · cada celda compara la métrica con su umbral obligatorio</span></div>
                      <button type="button" className="btn btn-secondary admin-training-download" onClick={() => void handleDownloadComparison(target, 1, candidates)} disabled={downloadingTarget !== null}>
                        {downloadingTarget === `${target}:1` ? "Generando..." : "Descargar gráfica 1"}
                      </button>
                    </div>
                    <div className="admin-training-policy-heatmap" role="table" aria-label={`Cumplimiento de umbrales por modelo para ${targetLabel(target)}`}>
                      <div className="admin-training-policy-row admin-training-policy-header" role="row">
                        <span role="columnheader">Modelo</span>
                        {SELECTION_METRICS.map((item) => <span role="columnheader" key={item.key}>{item.label}<small>≥ {item.threshold.toFixed(2)}</small></span>)}
                        <span role="columnheader">Elegibilidad</span>
                      </div>
                      {candidates.map((candidate) => (
                        <div className="admin-training-policy-row" role="row" key={`${target}-eligibility-${candidate.model}`}>
                          <strong role="rowheader">{candidate.model}{candidate.model === winner.model ? " · GANADOR" : ""}</strong>
                          {SELECTION_METRICS.map((item) => {
                            const value = rawCandidateMetric(candidate, item.key);
                            const passed = isMetricPassing(value, item.threshold);
                            const shadeValue = item.key === "mcc" || item.key === "kappa" ? (value ?? -1) : (metricPercent(value) ?? 0);
                            return <span role="cell" className={passed ? "is-passing" : "is-failing"} key={`${candidate.model}-${item.key}`} style={{ background: validationHeatmapColor(shadeValue, item.threshold) }} title={`${item.label}: ${metricLabel(candidate, item.key)} · umbral ${item.threshold.toFixed(2)} · ${passed ? "cumple" : "no cumple"}`}>{metricLabel(candidate, item.key)}<small>{value === null ? "Sin dato" : passed ? "Cumple" : "No cumple"}</small></span>;
                          })}
                          <span role="cell" className={isCandidateEligible(candidate) ? "admin-training-eligible" : "admin-training-ineligible"}>{isCandidateEligible(candidate) ? "ELEGIBLE" : "NO ELEGIBLE"}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="admin-training-chart-block">
                    <div className="admin-training-chart-title">
                      <strong>Gráfica 2 · Matthews Correlation Coefficient (MCC)</strong>
                      <div><span>Validación · MCC real (−1 a 1) · umbral 0.40</span><button type="button" className="btn btn-secondary admin-training-download" onClick={() => void handleDownloadComparison(target, 2, candidates)} disabled={downloadingTarget !== null}>{downloadingTarget === `${target}:2` ? "Generando..." : "Descargar gráfica 2"}</button></div>
                    </div>
                    <div
                      className="admin-training-mcc-comparison"
                      role="list"
                      aria-label={`Comparativa MCC de los modelos para ${targetLabel(target)}`}
                    >
                      {candidates.map((candidate) => {
                        const mcc = rawCandidateMetric(candidate, "mcc");
                        const clampedMcc = Math.max(-1, Math.min(1, mcc ?? 0));
                        const barWidth = Math.abs(clampedMcc) * 50;
                        const barLeft = clampedMcc >= 0 ? 50 : 50 - barWidth;
                        return (
                          <div className="admin-training-mcc-row" role="listitem" key={`${target}-mcc-${candidate.model}`}>
                            <span className="admin-training-bar-label">{candidate.model}</span>
                            <div className="admin-training-mcc-track">
                              <span className="admin-training-mcc-zero" />
                              <span className={`admin-training-mcc-bar ${isMetricPassing(mcc, ELIGIBILITY_THRESHOLDS.mcc) ? "is-passing" : "is-failing"}`} style={{ left: `${barLeft}%`, width: `${barWidth}%` }} />
                            </div>
                            <strong>{mcc === null ? "—" : mcc.toFixed(3)}</strong>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="admin-training-chart-block">
                    <div className="admin-training-chart-title">
                      <strong>Gráfica 3 · Heatmap de todas las métricas</strong>
                      <div><span>Incluye métricas fuera del ámbito de selección</span><button type="button" className="btn btn-secondary admin-training-download" onClick={() => void handleDownloadComparison(target, 3, candidates)} disabled={downloadingTarget !== null}>{downloadingTarget === `${target}:3` ? "Generando..." : "Descargar gráfica 3"}</button></div>
                    </div>
                    <div className="admin-training-full-heatmap" role="table" aria-label={`Heatmap de todas las métricas para ${targetLabel(target)}`}>
                      <div className="admin-training-full-heatmap-row admin-training-full-heatmap-head" role="row">
                        <span role="columnheader">Modelo</span>
                        {COMPARISON_METRICS.map((item) => <span role="columnheader" key={item.key}>{item.label}</span>)}
                      </div>
                      {candidates.map((candidate) => (
                        <div className="admin-training-full-heatmap-row" role="row" key={`heatmap-${target}-${candidate.model}`}>
                          <strong role="rowheader">{candidate.model}</strong>
                          {COMPARISON_METRICS.map((item) => {
                            const value = rawCandidateMetric(candidate, item.key);
                            return (
                              <span
                                role="cell"
                                key={`${candidate.model}-${item.key}`}
                                title={`${candidate.model} · ${item.label}: ${metricLabel(candidate, item.key)}`}
                                style={{ background: informativeHeatmapColor(value, item.key) }}
                              >
                                {metricLabel(candidate, item.key)}
                              </span>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedTest && (
                    <div className="admin-training-test-summary">
                      <strong>TEST final · {report.selectedModel || "Modelo seleccionado"}</strong>
                      <span>Accuracy {asPercent(selectedTest.accuracy)}</span>
                      <span>F1 {asPercent(selectedTest.f1)}</span>
                      <span>AUC {asPercent(selectedTest.auc)}</span>
                      {sourceReport.selectedModel && sourceReport.selectedModel !== testCandidate?.model && (
                        <span className="admin-training-test-reference">
                          Vigente {sourceReport.selectedModel}: AUC TEST {asPercent(sourceReport.testMetrics?.auc)}
                        </span>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
            <p className="panel-subtitle">No hay objetivos con modelos elegibles en la corrida actual. Se requieren los cinco umbrales; ningún modelo por debajo de ellos se selecciona ni se publica. La calidad normalizada histórica se conserva en Imágenes de diagnóstico.</p>
        )}
      </section>

      {status?.manifest?.dataSources && (
        <div className="admin-training-data-summary">
          <strong>Origen del entrenamiento</strong>
          <span>Histórico: {status.manifest.dataSources.localRows ?? "—"}</span>
          <span>Firebase: {status.manifest.dataSources.firebaseRows ?? 0}</span>
          <span>Duplicados retirados: {status.manifest.dataSources.duplicatesRemoved ?? 0}</span>
          <span>Pacientes coincidentes: {status.manifest.dataSources.matchedExistingPatients ?? 0}</span>
          {!!status.manifest.dataSources.targetConflicts && (
            <span className="is-warning">
              Conflictos de target: {status.manifest.dataSources.targetConflicts}
            </span>
          )}
        </div>
      )}

      <div className="panel admin-training-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Imágenes de diagnóstico</h3>
            <p className="panel-subtitle">Matrices de confusión, ROC, importancia de variables y calidad normalizada informativa (sin participación en selección).</p>
          </div>
          <span className="admin-patients-count">{status?.images.length ?? 0} archivos</span>
        </div>

        {status?.images.length ? (
          <div className="admin-training-gallery">
            {status.images.map((image) => (
              <figure className="admin-training-image-card" key={image.path}>
                <img src={image.url} alt={`Resultado ${image.name}`} loading="lazy" />
                <figcaption>{image.path}</figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="panel-subtitle">No se han generado imágenes todavía.</p>
        )}
      </div>
    </section>
  );
}
