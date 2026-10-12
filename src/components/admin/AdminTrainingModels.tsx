"use client";

import { useEffect, useMemo, useState } from "react";

import {
  setActiveTrainingModel,
  subscribeToAdminModels,
  type AdminModel,
} from "@/services/firebase/admin-models";
import type { AdminUser } from "@/services/firebase/admin-users";

type SourceMode = "firebase" | "firebase_dataset" | "dataset";

const SOURCE_LABELS: Record<SourceMode, string> = {
  firebase: "Solo Firebase",
  firebase_dataset: "Firebase + dataset",
  dataset: "Solo dataset",
};

function metricValue(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return `${(numeric <= 1 ? numeric * 100 : numeric).toFixed(1)}%`;
}

export default function AdminTrainingModels({ currentAdmin }: { currentAdmin: AdminUser }) {
  const [models, setModels] = useState<AdminModel[]>([]);
  const [sourceFilter, setSourceFilter] = useState<SourceMode | "__all__">("__all__");
  const [targetFilter, setTargetFilter] = useState("__all__");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => subscribeToAdminModels(setModels, (cause) => {
    setError(cause instanceof Error ? cause.message : "No se pudieron cargar los modelos.");
  }), []);

  const targets = useMemo(
    () => [...new Set(models.filter((model) => model.eligible && model.winner).map((model) => model.target).filter(Boolean))],
    [models],
  );

  const winners = useMemo(() => models
    .filter((model) => model.winner && model.eligible)
    .filter((model) => sourceFilter === "__all__" || model.sourceMode === sourceFilter)
    .filter((model) => targetFilter === "__all__" || model.target === targetFilter)
    .sort((left, right) => `${left.target}-${left.sourceMode}-${left.name}`.localeCompare(`${right.target}-${right.sourceMode}-${right.name}`)),
  [models, sourceFilter, targetFilter]);

  async function activate(model: AdminModel) {
    if (!model.sourceMode || !model.target || saving) return;
    const key = model.id;
    try {
      setSaving(key);
      setError("");
      const sameGroup = models.filter((candidate) => (
        candidate.id !== model.id
        && candidate.target === model.target
        && candidate.sourceMode === model.sourceMode
        && candidate.active
      ));
      await Promise.all([
        ...sameGroup.map((candidate) => setActiveTrainingModel({
          modelId: candidate.id,
          adminUid: currentAdmin.uid,
          active: false,
        })),
        setActiveTrainingModel({
          modelId: model.id,
          adminUid: currentAdmin.uid,
          active: true,
        }),
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo activar el modelo.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="admin-module">
      <div className="admin-module-header">
        <div>
          <span className="admin-eyebrow">INTELIGENCIA ARTIFICIAL</span>
          <h2>Modelos de IA</h2>
          <p>Activa el ganador elegible que utilizará el dashboard médico, según el origen de datos y el target.</p>
        </div>
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="admin-filters">
        <label className="form-group">
          <span>Origen</span>
          <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as SourceMode | "__all__")}>
            <option value="__all__">Todos</option>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="form-group">
          <span>Target</span>
          <select value={targetFilter} onChange={(event) => setTargetFilter(event.target.value)}>
            <option value="__all__">Todos</option>
            {targets.map((target) => <option key={target} value={target}>{target}</option>)}
          </select>
        </label>
      </div>
      {!winners.length ? (
        <div className="admin-empty-state">
          <h3>No hay ganadores elegibles registrados</h3>
          <p>Ejecuta un entrenamiento y verifica que cumpla todos los umbrales de VALIDATION.</p>
        </div>
      ) : (
        <div className="users-table-container">
          <table className="users-table">
            <thead><tr><th>Modelo</th><th>Target</th><th>Origen</th><th>Métricas VALIDATION</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {winners.map((model) => (
                <tr key={model.id}>
                  <td><strong>{model.name || model.modelName || model.id}</strong></td>
                  <td>{model.target}</td>
                  <td>{model.sourceMode ? SOURCE_LABELS[model.sourceMode] : "—"}</td>
                  <td>
                    Accuracy {metricValue(model.validationMetrics?.accuracy)} ·
                    F1 {metricValue(model.validationMetrics?.f1)} ·
                    AUC {metricValue(model.validationMetrics?.auc)}
                  </td>
                  <td>{model.active ? "Activo" : "Inactivo"}</td>
                  <td>
                    <button type="button" className="btn btn-primary" disabled={model.active || saving !== null} onClick={() => void activate(model)}>
                      {saving === model.id ? "Activando..." : model.active ? "Activo" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
