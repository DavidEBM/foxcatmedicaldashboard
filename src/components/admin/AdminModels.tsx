"use client";

import {
  useMemo,
  useState,
  type FormEvent,
} from "react";

export interface AdminModel {
  id: string;
  name: string;
  description?: string;
  version?: string;
  provider?: string;
  status: "active" | "inactive";
  createdAt?: unknown;
  updatedAt?: unknown;
}

interface AdminModelsProps {
  models?: AdminModel[];
  loading?: boolean;
  error?: string;
  onCreate?: (
    model: Omit<AdminModel, "id">
  ) => void | Promise<void>;
  onUpdate?: (
    id: string,
    data: Partial<Omit<AdminModel, "id">>
  ) => void | Promise<void>;
  onDelete?: (
    id: string
  ) => void | Promise<void>;
}

interface AdminModelForm {
  name: string;
  description: string;
  version: string;
  provider: string;
  status: AdminModel["status"];
}

const EMPTY_FORM: AdminModelForm = {
  name: "",
  description: "",
  version: "",
  provider: "",
  status: "active",
};

export default function AdminModels({
  models = [],
  loading = false,
  error = "",
  onCreate,
  onUpdate,
  onDelete,
}: AdminModelsProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("");

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [form, setForm] =
    useState<AdminModelForm>(EMPTY_FORM);

  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] =
    useState("");

  const filteredModels = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return models
      .filter((model) => {
        if (
          statusFilter &&
          model.status !== statusFilter
        ) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const searchableText = [
          model.name,
          model.description,
          model.version,
          model.provider,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(
          normalizedSearch
        );
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name, "es", {
          sensitivity: "base",
        })
      );
  }, [models, search, statusFilter]);

  function handleFormChange(
    field: keyof AdminModelForm,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]:
        field === "status"
          ? (value as AdminModel["status"])
          : value,
    }));

    setLocalError("");
  }

  function startCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setLocalError("");
  }

  function startEdit(model: AdminModel) {
    setEditingId(model.id);

    setForm({
      name: model.name || "",
      description: model.description || "",
      version: model.version || "",
      provider: model.provider || "",
      status: model.status || "active",
    });

    setLocalError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setLocalError("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const name = form.name.trim();

    if (!name) {
      setLocalError(
        "El nombre del modelo es obligatorio."
      );
      return;
    }

    try {
      setSaving(true);
      setLocalError("");

      const data = {
        name,
        description: form.description.trim(),
        version: form.version.trim(),
        provider: form.provider.trim(),
        status: form.status,
      };

      if (editingId) {
        if (!onUpdate) {
          return;
        }

        await onUpdate(editingId, data);
      } else {
        if (!onCreate) {
          return;
        }

        await onCreate(data);
      }

      cancelEdit();
    } catch (submitError) {
      console.error(
        "Error guardando modelo:",
        submitError
      );

      setLocalError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible guardar el modelo."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(
    model: AdminModel
  ) {
    if (!onDelete || saving) {
      return;
    }

    const confirmed = window.confirm(
      `¿Confirmas eliminar el modelo "${model.name}"?\n\nEsta acción no se puede deshacer.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setLocalError("");

      await onDelete(model.id);

      if (editingId === model.id) {
        cancelEdit();
      }
    } catch (deleteError) {
      console.error(
        "Error eliminando modelo:",
        deleteError
      );

      setLocalError(
        deleteError instanceof Error
          ? deleteError.message
          : "No fue posible eliminar el modelo."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-module">
      <div className="admin-module-header">
        <div>
          <span className="admin-eyebrow">
            INTELIGENCIA ARTIFICIAL
          </span>

          <h2>Modelos de IA</h2>

          <p>
            Administra los modelos de
            inteligencia artificial disponibles
            en Foxcat Medical.
          </p>
        </div>

        {onCreate && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={startCreate}
            disabled={saving}
          >
            + Nuevo modelo
          </button>
        )}
      </div>

      {(error || localError) && (
        <div
          className="alert alert-error"
          role="alert"
        >
          {error || localError}
        </div>
      )}

      <div className="panel">
        <div className="admin-filters">
          <div className="form-group">
            <label htmlFor="admin-model-search">
              Buscar
            </label>

            <input
              id="admin-model-search"
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Nombre, proveedor o versión..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="admin-model-status">
              Estado
            </label>

            <select
              id="admin-model-status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">
                Inactivos
              </option>
            </select>
          </div>
        </div>
      </div>

      {editingId !== null && (
        <form
          className="panel admin-model-form"
          onSubmit={handleSubmit}
        >
          <div className="panel-header">
            <div>
              <h3 className="panel-title">
                Editar modelo
              </h3>

              <p className="panel-subtitle">
                Actualiza la configuración del
                modelo seleccionado.
              </p>
            </div>
          </div>

          <div className="admin-filters">
            <div className="form-group">
              <label htmlFor="admin-model-name">
                Nombre
              </label>

              <input
                id="admin-model-name"
                type="text"
                value={form.name}
                onChange={(event) =>
                  handleFormChange(
                    "name",
                    event.target.value
                  )
                }
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="admin-model-provider">
                Proveedor
              </label>

              <input
                id="admin-model-provider"
                type="text"
                value={form.provider}
                onChange={(event) =>
                  handleFormChange(
                    "provider",
                    event.target.value
                  )
                }
                placeholder="Proveedor"
              />
            </div>

            <div className="form-group">
              <label htmlFor="admin-model-version">
                Versión
              </label>

              <input
                id="admin-model-version"
                type="text"
                value={form.version}
                onChange={(event) =>
                  handleFormChange(
                    "version",
                    event.target.value
                  )
                }
                placeholder="Ej. 1.0.0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="admin-model-form-status">
                Estado
              </label>

              <select
                id="admin-model-form-status"
                value={form.status}
                onChange={(event) =>
                  handleFormChange(
                    "status",
                    event.target.value
                  )
                }
              >
                <option value="active">
                  Activo
                </option>

                <option value="inactive">
                  Inactivo
                </option>
              </select>
            </div>

            <div className="form-group admin-model-description">
              <label htmlFor="admin-model-description">
                Descripción
              </label>

              <textarea
                id="admin-model-description"
                value={form.description}
                onChange={(event) =>
                  handleFormChange(
                    "description",
                    event.target.value
                  )
                }
                rows={4}
                placeholder="Descripción del modelo..."
              />
            </div>

            <div className="admin-filters-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={cancelEdit}
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving
                  ? "Guardando..."
                  : "Guardar modelo"}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">
              Modelos registrados
            </h3>

            <p className="panel-subtitle">
              {filteredModels.length} modelo
              {filteredModels.length === 1
                ? ""
                : "s"} encontrado
              {filteredModels.length === 1
                ? ""
                : "s"}.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="panel-subtitle">
            Consultando modelos...
          </p>
        ) : filteredModels.length === 0 ? (
          <div className="admin-empty-state">
            <div className="admin-empty-icon">
              ◇
            </div>

            <h3>No hay modelos</h3>

            <p>
              No existen modelos que coincidan
              con los filtros actuales.
            </p>
          </div>
        ) : (
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Proveedor</th>
                  <th>Versión</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filteredModels.map((model) => (
                  <tr key={model.id}>
                    <td>
                      <strong>
                        {model.name}
                      </strong>

                      {model.description && (
                        <small>
                          {model.description}
                        </small>
                      )}
                    </td>

                    <td>
                      {model.provider || "—"}
                    </td>

                    <td>
                      {model.version || "—"}
                    </td>

                    <td>
                      <span
                        className={
                          model.status === "active"
                            ? "soft-badge"
                            : "soft-badge inactive"
                        }
                      >
                        {model.status === "active"
                          ? "Activo"
                          : "Inactivo"}
                      </span>
                    </td>

                    <td>
                      <div className="admin-table-actions">
                        {onUpdate && (
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() =>
                              startEdit(model)
                            }
                            disabled={saving}
                          >
                            Editar
                          </button>
                        )}

                        {onDelete && (
                          <button
                            type="button"
                            className="ghost-button danger"
                            onClick={() =>
                              handleDelete(model)
                            }
                            disabled={saving}
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}