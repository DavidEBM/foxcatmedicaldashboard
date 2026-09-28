"use client";

import { useState } from "react";

import type {
  Patient,
  PatientFormValues,
} from "@/types/doctor-patients";

import {
  buildPatientPayload,
  getInitialPatientFormValues,
  validatePatientForm,
} from "@/lib/doctor/patient-form";

import {
  createPatient,
  updatePatient,
} from "@/services/firebase/patient.service";

import {
  readFileAsDataUrl,
} from "@/lib/doctor/doctor-utils";

interface PatientFormProps {
  mode: "create" | "edit";
  patient?: Patient | null;
  cities: string[];
  doctorId: string;

  onSuccess?: () => void;

  onCancel: () => void;

  onStatus?: (
    message: string,
    type: "success" | "error"
  ) => void;
}

export default function PatientForm({
  mode,
  patient,
  cities,
  doctorId,
  onSuccess,
  onCancel,
  onStatus,
}: PatientFormProps) {
  const [values, setValues] =
    useState<PatientFormValues>(() =>
      getInitialPatientFormValues(
        patient ?? undefined
      )
    );

  const [saving, setSaving] =
    useState(false);

  function updateField<
    K extends keyof PatientFormValues
  >(
    field: K,
    value: PatientFormValues[K]
  ) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const validation =
      validatePatientForm(values);

    if (validation) {
      onStatus?.(
        validation,
        "error"
      );
      return;
    }

    setSaving(true);

    try {
      let photoUrl = values.photoUrl;

      if (
        values.photoFile &&
        values.photoFile.size > 0
      ) {
        photoUrl =
          await readFileAsDataUrl(
            values.photoFile
          );
      }

      const payload =
        buildPatientPayload({
          ...values,
          photoUrl,
        });

      if (
        mode === "edit" &&
        patient?.id
      ) {
        await updatePatient(
          patient.id,
          payload
        );

        onStatus?.(
          "Paciente actualizado correctamente.",
          "success"
        );
      } else {
        await createPatient(
          payload,
          doctorId
        );

        onStatus?.(
          "Paciente creado correctamente en Firebase.",
          "success"
        );
      }

      onSuccess?.();
    } catch (error) {
      console.error(error);

      onStatus?.(
        "No se pudo guardar el paciente.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="patient-form"
      onSubmit={handleSubmit}
    >
      <section>
        <h3>
          Identificación mínima obligatoria
        </h3>

        <div className="field-grid">
          <input
            type="text"
            placeholder="Nombre completo"
            value={values.name}
            onChange={(event) =>
              updateField(
                "name",
                event.target.value
              )
            }
            required
          />

          <input
            type="text"
            placeholder="Documento / cédula"
            value={values.documentId}
            onChange={(event) =>
              updateField(
                "documentId",
                event.target.value
              )
            }
            required
          />

          <input
            type="number"
            min="0"
            placeholder="Edad actual"
            value={values.age}
            onChange={(event) =>
              updateField(
                "age",
                event.target.value
              )
            }
            required
          />

          <input
            type="text"
            placeholder="Condición principal"
            value={values.condition}
            onChange={(event) =>
              updateField(
                "condition",
                event.target.value
              )
            }
            required
          />

          <select
            value={values.status}
            onChange={(event) =>
              updateField(
                "status",
                event.target
                  .value as PatientFormValues["status"]
              )
            }
            required
          >
            <option value="">
              Estado del paciente
            </option>
            <option value="Estable">
              Estable
            </option>
            <option value="Riesgo">
              Riesgo
            </option>
            <option value="Critico">
              Crítico
            </option>
          </select>

          <select
            value={values.locationCity}
            onChange={(event) =>
              updateField(
                "locationCity",
                event.target.value
              )
            }
          >
            <option value="">
              Ciudad de consulta
            </option>

            {cities.map((city) => (
              <option
                key={city}
                value={city}
              >
                {city}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section>
        <h3>
          Signos, laboratorio y contexto respiratorio
        </h3>

        <div className="field-grid">
          <label className="time-field upload-field">
            <span>
              Foto opcional del paciente
            </span>

            <input
              type="file"
              accept="image/*"
              onChange={(event) =>
                updateField(
                  "photoFile",
                  event.target.files?.[0] ??
                    null
                )
              }
            />
          </label>

          <input
            type="number"
            min="0"
            placeholder="Presión sistólica"
            value={
              values.bloodPressureSystolic
            }
            onChange={(event) =>
              updateField(
                "bloodPressureSystolic",
                event.target.value
              )
            }
          />

          <input
            type="number"
            min="0"
            placeholder="Presión diastólica"
            value={
              values.bloodPressureDiastolic
            }
            onChange={(event) =>
              updateField(
                "bloodPressureDiastolic",
                event.target.value
              )
            }
          />

          <input
            type="number"
            min="0"
            placeholder="Pulso bpm"
            value={values.pulse}
            onChange={(event) =>
              updateField(
                "pulse",
                event.target.value
              )
            }
          />

          <input
            type="number"
            min="0"
            placeholder="Glucosa mg/dL"
            value={values.glucose}
            onChange={(event) =>
              updateField(
                "glucose",
                event.target.value
              )
            }
          />

          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            placeholder="Saturación O₂ %"
            value={
              values.oxygenSaturation
            }
            onChange={(event) =>
              updateField(
                "oxygenSaturation",
                event.target.value
              )
            }
          />

          <input
            type="number"
            min="0"
            placeholder="Frecuencia respiratoria"
            value={
              values.respiratoryRate
            }
            onChange={(event) =>
              updateField(
                "respiratoryRate",
                event.target.value
              )
            }
          />

          <input
            type="number"
            step="0.1"
            min="0"
            placeholder="Hemoglobina g/dL"
            value={values.hemoglobin}
            onChange={(event) =>
              updateField(
                "hemoglobin",
                event.target.value
              )
            }
          />

          <input
            type="number"
            step="0.1"
            min="0"
            placeholder="Creatinina mg/dL"
            value={values.creatinine}
            onChange={(event) =>
              updateField(
                "creatinine",
                event.target.value
              )
            }
          />

          <input
            type="number"
            step="0.1"
            min="0"
            placeholder="IMC"
            value={values.bmi}
            onChange={(event) =>
              updateField(
                "bmi",
                event.target.value
              )
            }
          />

          <input
            type="number"
            min="0"
            placeholder="Carga tabáquica (pack-years)"
            value={values.packHistory}
            onChange={(event) =>
              updateField(
                "packHistory",
                event.target.value
              )
            }
          />

          <select
            value={values.copdGold}
            onChange={(event) =>
              updateField(
                "copdGold",
                event.target.value
              )
            }
          >
            <option value="">
              COPD GOLD
            </option>
            <option value="1">
              GOLD 1
            </option>
            <option value="2">
              GOLD 2
            </option>
            <option value="3">
              GOLD 3
            </option>
            <option value="4">
              GOLD 4
            </option>
          </select>

          <select
            value={values.smokingStatus}
            onChange={(event) =>
              updateField(
                "smokingStatus",
                event.target.value as PatientFormValues["smokingStatus"]
              )
            }
          >
            <option value="">
              Estado de tabaquismo
            </option>
            <option value="Nunca">
              Nunca
            </option>
            <option value="Exfumador">
              Exfumador
            </option>
            <option value="Activo">
              Activo
            </option>
            <option value="Alta carga">
              Alta carga
            </option>
          </select>
        </div>
      </section>

      <section>
        <h3>
          Apartado cardiovascular
        </h3>

        <div className="field-grid">
          <input
            type="text"
            placeholder="ECG / hallazgo electrocardiográfico"
            value={values.ecg}
            onChange={(event) =>
              updateField(
                "ecg",
                event.target.value
              )
            }
          />

          <input
            type="number"
            min="0"
            placeholder="BNP pg/mL"
            value={values.bnp}
            onChange={(event) =>
              updateField(
                "bnp",
                event.target.value
              )
            }
          />

          <select
            value={
              values.heartFailureHistory
            }
            onChange={(event) =>
              updateField(
                "heartFailureHistory",
                event.target.value
              )
            }
          >
            <option value="">
              Antecedente de falla cardíaca
            </option>
            <option value="No">
              No
            </option>
            <option value="Si">
              Sí
            </option>
          </select>

          <select
            value={
              values.coronaryHistory
            }
            onChange={(event) =>
              updateField(
                "coronaryHistory",
                event.target.value
              )
            }
          >
            <option value="">
              Antecedentes coronarios
            </option>
            <option value="No">
              No
            </option>
            <option value="Si">
              Sí
            </option>
          </select>

          <select
            value={values.arrhythmias}
            onChange={(event) =>
              updateField(
                "arrhythmias",
                event.target.value
              )
            }
          >
            <option value="">
              Arritmias
            </option>
            <option value="No">
              No
            </option>
            <option value="Si">
              Sí
            </option>
          </select>
        </div>
      </section>

      <section>
        <h3>
          Consulta, área y agenda
        </h3>

        <div className="field-grid">
          <input
            type="text"
            placeholder="Área / servicio"
            value={values.ward}
            onChange={(event) =>
              updateField(
                "ward",
                event.target.value
              )
            }
          />

          <input
            type="text"
            placeholder="Habitación / cama"
            value={values.room}
            onChange={(event) =>
              updateField(
                "room",
                event.target.value
              )
            }
          />

          <label className="time-field">
            <span>
              Hora de consulta
            </span>

            <input
              type="time"
              value={
                values.appointmentTime
              }
              onChange={(event) =>
                updateField(
                  "appointmentTime",
                  event.target.value
                )
              }
            />
          </label>

          <label className="time-field">
            <span>
              Hora de monitoreo
            </span>

            <input
              type="time"
              value={
                values.monitoringTime
              }
              onChange={(event) =>
                updateField(
                  "monitoringTime",
                  event.target.value
                )
              }
            />
          </label>

          <label className="time-field">
            <span>
              Hora de laboratorio
            </span>

            <input
              type="time"
              value={values.labTime}
              onChange={(event) =>
                updateField(
                  "labTime",
                  event.target.value
                )
              }
            />
          </label>
        </div>
      </section>

      <textarea
        placeholder="Notas clínicas o seguimiento"
        value={values.notes}
        onChange={(event) =>
          updateField(
            "notes",
            event.target.value
          )
        }
      />

      <div className="patient-modal-actions">
        <button
          type="submit"
          disabled={saving}
        >
          {saving
            ? "Guardando..."
            : mode === "edit"
              ? "Guardar cambios"
              : "Crear paciente"}
        </button>

        <button
          type="button"
          className="ghost-button"
          onClick={onCancel}
          disabled={saving}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
