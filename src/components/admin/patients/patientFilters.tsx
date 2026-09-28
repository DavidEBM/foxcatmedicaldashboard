"use client";

import type { ChangeEvent } from "react";

export interface PatientFiltersState {
  search: string;
  status: string;
  doctor: string;
  location: string;
}

interface PatientFiltersProps {
  filters: PatientFiltersState;
  doctors?: Array<{
    id: string;
    displayName: string;
  }>;
  statuses?: string[];
  locations?: string[];
  onChange: (
    filters: PatientFiltersState
  ) => void;
}

const UNASSIGNED_DOCTOR_VALUE =
  "__unassigned__";

export default function PatientFilters({
  filters,
  doctors = [],
  statuses = [],
  locations = [],
  onChange,
}: PatientFiltersProps) {
  const handleChange =
    (field: keyof PatientFiltersState) =>
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
    onChange({
      search: "",
      status: "",
      doctor: "",
      location: "",
    });
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">
            Filtros de pacientes
          </h3>

          <p className="panel-subtitle">
            Busca y filtra los pacientes
            registrados.
          </p>
        </div>
      </div>

      <div className="admin-filters">
        <div className="form-group">
          <label htmlFor="patient-search">
            Buscar
          </label>

          <input
            id="patient-search"
            type="search"
            value={filters.search}
            onChange={handleChange("search")}
            placeholder="Nombre o documento..."
          />
        </div>

        <div className="form-group">
          <label htmlFor="patient-status">
            Estado
          </label>

          <select
            id="patient-status"
            value={filters.status}
            onChange={handleChange("status")}
          >
            <option value="">
              Todos
            </option>

            {statuses.map((status) => (
              <option
                key={status}
                value={status}
              >
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="patient-doctor">
            Médico
          </label>

          <select
            id="patient-doctor"
            value={filters.doctor}
            onChange={handleChange("doctor")}
          >
            <option value="">
              Todos
            </option>

            <option
              value={
                UNASSIGNED_DOCTOR_VALUE
              }
            >
              Sin médico
            </option>

            {doctors.map((doctor) => (
              <option
                key={doctor.id}
                value={doctor.id}
              >
                {doctor.displayName}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="patient-location">
            Ubicación
          </label>

          <select
            id="patient-location"
            value={filters.location}
            onChange={handleChange("location")}
          >
            <option value="">
              Todas
            </option>

            {locations.map((location) => (
              <option
                key={location}
                value={location}
              >
                {location}
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
    </div>
  );
}