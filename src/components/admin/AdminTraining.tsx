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
  publishedThisRun?: boolean;
  thresholdMet?: boolean;
  split?: { train?: number; validation?: number; test?: number };
  testMetrics?: Record<string, unknown>;
  algorithmsTested?: ModelCandidate[];
}

interface ModelCandidate {
  model: string;
  available?: boolean;
  validationScore?: number;
  cvMeanScore?: number;
  cvStdScore?: number;
  validationThresholdMet?: boolean;
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

function ratio(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric > 1 ? numeric / 100 : numeric));
}

function candidateMetric(candidate: ModelCandidate, key: string): number {
  const normalizedMetrics = candidate.validationMetrics?.normalizedMetrics;
  if (normalizedMetrics && typeof normalizedMetrics === "object") {
    const normalizedValue = (normalizedMetrics as Record<string, unknown>)[key];
    if (normalizedValue !== undefined) return ratio(normalizedValue);
  }

  const rawValue = candidate.validationMetrics?.[key];
  if (key === "mcc" || key === "kappa") {
    const numeric = Number(rawValue);
    if (Number.isFinite(numeric)) {
      return Math.max(0, Math.min(1, (numeric + 1) / 2));
    }
  }

  return ratio(rawValue);
}

function candidateQuality(candidate: ModelCandidate): number {
  return ratio(
    candidate.validationMetrics?.normalizedQuality ?? candidate.validationScore,
  );
}

function candidateSelectionRank(candidate: ModelCandidate): number[] {
  const validationScore = Number(candidate.validationScore);
  const cvStdScore = Number(candidate.cvStdScore);
  const cvMeanScore = Number(candidate.cvMeanScore);
  return [
    candidate.validationThresholdMet ? 1 : 0,
    Number.isFinite(validationScore) ? validationScore : Number.NEGATIVE_INFINITY,
    Number.isFinite(cvStdScore) ? -cvStdScore : Number.NEGATIVE_INFINITY,
    Number.isFinite(cvMeanScore) ? cvMeanScore : Number.NEGATIVE_INFINITY,
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
    && candidate.testEvaluationAvailable
    && !!candidate.testMetrics
    && Object.keys(candidate.testMetrics).length > 0
  ));
}

const COMPARISON_METRICS = [
  { key: "accuracy", label: "Accuracy" },
  { key: "f1", label: "F1" },
  { key: "auc", label: "AUC" },
  { key: "precision", label: "Precisión" },
  { key: "recallSensitivity", label: "Sensibilidad" },
  { key: "mcc", label: "MCC*" },
  { key: "kappa", label: "Kappa*" },
] as const;

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

function heatmapColor(value: number): string {
  const red = Math.round(235 - value * 115);
  const green = Math.round(246 - value * 55);
  const blue = Math.round(241 - value * 70);
  return `rgb(${red}, ${green}, ${blue})`;
}

async function downloadComparisonImage(
  target: string,
  label: string,
  candidates: ModelCandidate[],
  selectedModel: string | null | undefined,
  testMetrics: Record<string, unknown> | undefined,
): Promise<void> {
  const width = 1600;
  const margin = 60;
  const barLabelWidth = 250;
  const barTrackX = margin + barLabelWidth;
  const barTrackWidth = 1110;
  const valueX = barTrackX + barTrackWidth + 24;
  const barStartY = 230;
  const barRowHeight = 42;
  const mccStartY = barStartY + candidates.length * barRowHeight + 110;
  const heatmapY = mccStartY + candidates.length * barRowHeight + 86;
  const modelColumnWidth = 250;
  const metricColumnWidth = (width - margin * 2 - modelColumnWidth) / COMPARISON_METRICS.length;
  const heatmapHeaderHeight = 42;
  const heatmapRowHeight = 36;
  const testY = heatmapY + heatmapHeaderHeight + candidates.length * heatmapRowHeight + 34;
  const height = testY + (testMetrics ? 94 : 52);

  const barRows = candidates.map((candidate, index) => {
    const quality = candidateQuality(candidate);
    const y = barStartY + index * barRowHeight;
    const modelLabel = index === 0 ? `${candidate.model} [MEJOR]` : candidate.model;
    return `
      <text x="${margin}" y="${y + 22}" class="label">${escapeXml(truncateLabel(modelLabel, 28))}</text>
      <rect x="${barTrackX}" y="${y + 8}" width="${barTrackWidth}" height="16" rx="8" fill="#eeeafa" />
      <rect x="${barTrackX}" y="${y + 8}" width="${Math.max(3, quality * barTrackWidth)}" height="16" rx="8" fill="#7867b7" />
      <text x="${valueX}" y="${y + 22}" class="value">${(quality * 100).toFixed(1)}%</text>`;
  }).join("");

  const mccRows = candidates.map((candidate, index) => {
    const mcc = candidateMetric(candidate, "mcc");
    const y = mccStartY + index * barRowHeight;
    const modelLabel = index === 0 ? `${candidate.model} [MEJOR]` : candidate.model;
    return `
      <text x="${margin}" y="${y + 22}" class="label">${escapeXml(truncateLabel(modelLabel, 28))}</text>
      <rect x="${barTrackX}" y="${y + 8}" width="${barTrackWidth}" height="16" rx="8" fill="#e4f0f2" />
      <rect x="${barTrackX}" y="${y + 8}" width="${Math.max(3, mcc * barTrackWidth)}" height="16" rx="8" fill="#4f96a6" />
      <text x="${valueX}" y="${y + 22}" class="value">${(mcc * 100).toFixed(1)}%</text>`;
  }).join("");

  const heatmapHeader = COMPARISON_METRICS.map((item, index) => {
    const x = margin + modelColumnWidth + index * metricColumnWidth;
    return `<text x="${x + metricColumnWidth / 2}" y="${heatmapY + 27}" class="header" text-anchor="middle">${escapeXml(item.label)}</text>`;
  }).join("");

  const heatmapRows = candidates.map((candidate, rowIndex) => {
    const y = heatmapY + heatmapHeaderHeight + rowIndex * heatmapRowHeight;
    const modelLabel = rowIndex === 0 ? `${candidate.model} [MEJOR]` : candidate.model;
    const cells = COMPARISON_METRICS.map((item, metricIndex) => {
      const value = candidateMetric(candidate, item.key);
      const x = margin + modelColumnWidth + metricIndex * metricColumnWidth;
      return `
        <rect x="${x + 2}" y="${y + 2}" width="${metricColumnWidth - 4}" height="${heatmapRowHeight - 4}" rx="4" fill="${heatmapColor(value)}" />
        <text x="${x + metricColumnWidth / 2}" y="${y + 24}" class="cell" text-anchor="middle">${(value * 100).toFixed(1)}%</text>`;
    }).join("");
    return `
      <text x="${margin}" y="${y + 24}" class="label">${escapeXml(truncateLabel(modelLabel, 28))}</text>
      ${cells}`;
  }).join("");

  const testSummary = testMetrics
    ? `<rect x="${margin}" y="${testY}" width="${width - margin * 2}" height="70" rx="10" fill="#e7f3ed" stroke="#78b89a" />
       <text x="${margin + 20}" y="${testY + 27}" class="test-title">TEST final - ${escapeXml(selectedModel || "Modelo seleccionado")}</text>
       <text x="${margin + 20}" y="${testY + 51}" class="test-value">Accuracy ${escapeXml(asPercent(testMetrics.accuracy))}</text>
       <text x="${margin + 220}" y="${testY + 51}" class="test-value">F1 ${escapeXml(asPercent(testMetrics.f1))}</text>
       <text x="${margin + 380}" y="${testY + 51}" class="test-value">AUC ${escapeXml(asPercent(testMetrics.auc))}</text>`
    : `<text x="${margin}" y="${testY + 25}" class="note">TEST final no disponible en este objetivo.</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#ffffff" />
    <style>
      .title { fill: #292735; font: 700 30px Arial, sans-serif; }
      .subtitle { fill: #656273; font: 400 16px Arial, sans-serif; }
      .section { fill: #292735; font: 700 18px Arial, sans-serif; }
      .header { fill: #656273; font: 700 12px Arial, sans-serif; }
      .label { fill: #4f4c5c; font: 400 14px Arial, sans-serif; }
      .value { fill: #292735; font: 700 14px Arial, sans-serif; }
      .cell { fill: #292735; font: 700 12px Arial, sans-serif; }
      .test-title { fill: #2f6c51; font: 700 15px Arial, sans-serif; }
      .test-value { fill: #4f4c5c; font: 400 14px Arial, sans-serif; }
      .note { fill: #656273; font: 400 13px Arial, sans-serif; }
    </style>
    <text x="${margin}" y="58" class="title">Comparativa VS de modelos</text>
    <text x="${margin}" y="88" class="subtitle">Objetivo clinico: ${escapeXml(label)} - ${candidates.length} modelos con datos reales</text>
    <text x="${margin}" y="154" class="section">Grafica 1 - Calidad normalizada en validacion</text>
    ${barRows}
    <text x="${margin}" y="${mccStartY - 28}" class="section">Grafica 2 - Matthews Correlation Coefficient (MCC)</text>
    ${mccRows}
    <text x="${margin}" y="${heatmapY - 28}" class="section">Grafica 3 - Heatmap de metricas en validacion</text>
    <text x="${margin}" y="${heatmapY + 27}" class="header">Modelo</text>
    ${heatmapHeader}
    ${heatmapRows}
    ${testSummary}
    <text x="${margin}" y="${height - 18}" class="note">Las metricas de validacion se comparan entre modelos; TEST corresponde solo al modelo seleccionado.</text>
  </svg>`;

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
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("El navegador no pudo crear el lienzo de descarga.");
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("No se pudo convertir la comparativa a PNG."));
      }, "image/png");
    });
    const pngUrl = URL.createObjectURL(pngBlob);
    const safeTarget = target.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "");
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = `comparativa-modelos-${safeTarget || "objetivo"}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
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
  const [starting, setStarting] = useState(false);
  const [downloadingTarget, setDownloadingTarget] = useState<string | null>(null);
  const [error, setError] = useState("");

  const getToken = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("La sesión administrativa no está disponible.");
    return user.getIdToken();
  }, []);

  const loadStatus = useCallback(async () => {
    const token = await getToken();
    const response = await fetch("/api/admin/ml", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = await response.json() as TrainingStatusResponse & { error?: string };
    if (!response.ok) throw new Error(payload.error || "No se pudo cargar el estado ML.");
    setStatus(payload);
    if (payload.latestRun && !runId) {
      setJob(payload.latestRun);
    }
  }, [getToken, runId]);

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
          await loadStatus();
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

  async function handleDownloadComparison(
    target: string,
    report: ModelReport,
    candidates: ModelCandidate[],
  ) {
    if (downloadingTarget) return;
    try {
      setDownloadingTarget(target);
      setError("");
      const testCandidate = runTestCandidate(report, candidates);
      await downloadComparisonImage(
        target,
        targetLabel(target),
        candidates,
        testCandidate?.model,
        testCandidate?.testMetrics,
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
                <em className={report.thresholdMet ? "is-good" : "is-warning"}>
                  {report.thresholdMet ? "Umbrales cumplidos" : "Requiere revisión"}
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
              Las barras y el heatmap son VALIDATION. El bloque TEST corresponde al modelo evaluado en esta corrida; el resultado vigente puede pertenecer a una corrida anterior.
            </p>
            <p className="admin-training-comparison-note">
              MCC y Kappa se muestran normalizados a 0-100% con la formula (valor + 1) / 2.
            </p>
            <p className="admin-training-comparison-note">
              El orden del ranking usa el mismo criterio del entrenamiento: umbrales, validationScore, menor variabilidad CV y mayor media CV.
            </p>
            <p>
              Las barras y el heatmap usan las métricas reales de validación de cada algoritmo.
              El TEST final se muestra únicamente para el modelo seleccionado.
            </p>
          </div>
        </div>

        {reports.some(([, report]) => report.algorithmsTested?.length) ? (
          <div className="admin-training-comparison-grid">
            {reports.map(([target, sourceReport]) => {
              const candidates = [...(sourceReport.algorithmsTested || [])]
                .filter((candidate) => candidate.available !== false)
                .sort(compareCandidatesBySelection);
              const testCandidate = runTestCandidate(sourceReport, candidates);
              const selectedTest = testCandidate?.testMetrics;
              const report: ModelReport = {
                ...sourceReport,
                selectedModel: testCandidate?.model || sourceReport.selectedModel,
                testMetrics: testCandidate?.testMetrics || sourceReport.testMetrics,
              };

              if (!candidates.length) return null;

              return (
                <article className="admin-training-comparison" key={`comparison-${target}`}>
                  <header className="admin-training-comparison-header">
                    <div>
                      <span className="admin-eyebrow">OBJETIVO CLÍNICO</span>
                      <h4>{targetLabel(target)}</h4>
                    </div>
                    <div className="admin-training-comparison-actions">
                      <span className="admin-training-comparison-count">
                        {candidates.length} modelos
                      </span>
                      <span className="admin-training-best-model">
                        Mejor: {candidates[0]?.model || "Sin datos"}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary admin-training-download"
                        onClick={() => void handleDownloadComparison(target, report, candidates)}
                        disabled={downloadingTarget !== null}
                      >
                        {downloadingTarget === target ? "Generando..." : "Descargar PNG"}
                      </button>
                    </div>
                  </header>

                  <div className="admin-training-chart-block">
                    <div className="admin-training-chart-title">
                      <strong>Gráfica 1 · Calidad normalizada VS</strong>
                      <span>Validación · porcentaje</span>
                    </div>
                    <div className="admin-training-bar-chart" role="img" aria-label={`Comparativa de calidad normalizada para ${targetLabel(target)}`}>
                      {candidates.map((candidate) => {
                        const quality = candidateQuality(candidate);
                        return (
                          <div className="admin-training-bar-row" key={`${target}-${candidate.model}`}>
                            <span className="admin-training-bar-label">{candidate.model}</span>
                            <div className="admin-training-bar-track">
                              <span style={{ width: `${quality * 100}%` }} />
                            </div>
                            <strong>{(quality * 100).toFixed(1)}%</strong>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="admin-training-chart-block">
                    <div className="admin-training-chart-title">
                      <strong>Gráfica 2 · Matthews Correlation Coefficient (MCC)</strong>
                      <span>Validación · 0–100% normalizado</span>
                    </div>
                    <div
                      className="admin-training-bar-chart admin-training-mcc-chart"
                      role="img"
                      aria-label={`Comparativa MCC de los modelos para ${targetLabel(target)}`}
                    >
                      {candidates.map((candidate) => {
                        const mcc = candidateMetric(candidate, "mcc");
                        return (
                          <div className="admin-training-bar-row" key={`${target}-mcc-${candidate.model}`}>
                            <span className="admin-training-bar-label">{candidate.model}</span>
                            <div className="admin-training-bar-track admin-training-mcc-bar-track">
                              <span style={{ width: `${mcc * 100}%` }} />
                            </div>
                            <strong>{(mcc * 100).toFixed(1)}%</strong>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="admin-training-chart-block">
                    <div className="admin-training-chart-title">
                      <strong>Gráfica 3 · Heatmap de métricas</strong>
                      <span>Validación · escala 0–100%</span>
                    </div>
                    <div className="admin-training-heatmap" role="table" aria-label={`Heatmap de métricas para ${targetLabel(target)}`}>
                      <div className="admin-training-heatmap-row admin-training-heatmap-head" role="row">
                        <span role="columnheader">Modelo</span>
                        {COMPARISON_METRICS.map((item) => <span role="columnheader" key={item.key}>{item.label}</span>)}
                      </div>
                      {candidates.map((candidate) => (
                        <div className="admin-training-heatmap-row" role="row" key={`heatmap-${target}-${candidate.model}`}>
                          <strong role="rowheader">{candidate.model}</strong>
                          {COMPARISON_METRICS.map((item) => {
                            const value = candidateMetric(candidate, item.key);
                            return (
                              <span
                                role="cell"
                                key={`${candidate.model}-${item.key}`}
                                title={`${candidate.model} · ${item.label}: ${(value * 100).toFixed(1)}%`}
                                style={{ background: `linear-gradient(90deg, rgba(120, 184, 154, ${0.18 + value * 0.72}), rgba(120, 169, 200, ${0.12 + value * 0.45}))` }}
                              >
                                {(value * 100).toFixed(1)}%
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
          <p className="panel-subtitle">El manifiesto actual no contiene el detalle comparativo de los modelos.</p>
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
            <p className="panel-subtitle">Matrices de confusión, ROC, importancia de variables y comparativas.</p>
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
