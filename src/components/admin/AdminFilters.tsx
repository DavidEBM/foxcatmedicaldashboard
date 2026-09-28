"use client";

import type { ChangeEvent } from "react";

export interface AdminFiltersState {
  search: string;
  role: string;
  status: string;
}

interface AdminFiltersProps {
  filters: AdminFiltersState;
  roles?: string[];
  statuses?: string[];
  onChange: (filters: AdminFiltersState) => void;
  onClear?: () => void;
}

export default function AdminFilters({
  filters,
  roles = [],
  statuses = [],
  onChange,
  onClear,
}: AdminFiltersProps) {
  const handleChange =
    (field: keyof AdminFiltersState) =>
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLSelectElement
      >
    ) => {
      onChange({
        ...filters,
        [field]: event.target.value,
      });
    };

  function handleClear() {
    const emptyFilters: AdminFiltersState = {
      search: "",
      role: "",
      status: "",
    };

    onChange(emptyFilters);
    onClear?.();
  }

  return (
    <section className="panel admin-filters-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">
            Filtros
          </h3>

          <p className="panel-subtitle">
            Busca y filtra la información del
            panel administrativo.
          </p>
        </div>
      </div>

      <div className="admin-filters">
        <div className="form-group">
          <label htmlFor="admin-filter-search">
            Buscar
          </label>

          <input
            id="admin-filter-search"
            type="search"
            value={filters.search}
            onChange={handleChange("search")}
            placeholder="Buscar..."
            autoComplete="off"
          />
        </div>

        <div className="form-group">
          <label htmlFor="admin-filter-role">
            Rol
          </label>

          <select
            id="admin-filter-role"
            value={filters.role}
            onChange={handleChange("role")}
          >
            <option value="">Todos</option>

            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="admin-filter-status">
            Estado
          </label>

          <select
            id="admin-filter-status"
            value={filters.status}
            onChange={handleChange("status")}
          >
            <option value="">Todos</option>

            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-filters-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleClear}
          >
            Limpiar filtros
          </button>
        </div>
      </div>
    </section>
  );
}