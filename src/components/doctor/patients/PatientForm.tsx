"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { Patient, PatientFormValues } from "@/types/doctor-patients";
import { buildPatientPayload, getInitialPatientFormValues, validatePatientForm } from "@/lib/doctor/patient-form";
import { createPatient, updatePatient } from "@/services/firebase/patient.service";
import { readFileAsDataUrl } from "@/lib/doctor/doctor-utils";

interface PatientFormProps {
  mode: "create" | "edit";
  patient?: Patient | null;
  cities: string[];
  doctorId: string;
  onSuccess?: () => void;
  onCancel: () => void;
  onStatus?: (message: string, type: "success" | "error") => void;
}

type FieldProps = {
  label: string;
  value: string;
  type?: "text" | "number";
  step?: string;
  min?: string;
  required?: boolean;
  children?: ReactNode;
  onChange: (value: string) => void;
};

function Field({ label, value, type = "text", step, min, required = false, children, onChange }: FieldProps) {
  return (
    <label className="patient-form-field">
      <span>{label}{required && <b className="patient-required-mark" aria-hidden="true">*</b>}</span>
      {children ?? (
        <input type={type} step={step} min={min} value={value} aria-required={required} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function SelectField({ label, value, options, required = false, onChange }: { label: string; value: string; options: string[]; required?: boolean; onChange: (value: string) => void }) {
  return (
    <Field label={label} value={value} required={required} onChange={onChange}>
      <span className="patient-select-wrap">
        <select value={value} aria-required={required} onChange={(event) => onChange(event.target.value)}>
          <option value="">Seleccionar</option>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <span aria-hidden="true">⌄</span>
      </span>
    </Field>
  );
}

const yesNoOptions = ["Si", "No"];

export default function PatientForm({ mode, patient, cities, doctorId, onSuccess, onCancel, onStatus }: PatientFormProps) {
  const [values, setValues] = useState<PatientFormValues>(() => getInitialPatientFormValues(patient ?? undefined));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const setValue = (field: keyof PatientFormValues, value: string) => {
    setFormError(null);
    setValues((current) => ({ ...current, [field]: value }));
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validatePatientForm(values);
    if (validation) {
      setFormError(validation);
      onStatus?.(validation, "error");
      return;
    }

    setSaving(true);
    try {
      let photoUrl = values.photoUrl;
      if (values.photoFile && values.photoFile.size > 0) photoUrl = await readFileAsDataUrl(values.photoFile);
      const payload = buildPatientPayload({ ...values, photoUrl });
      if (mode === "edit" && patient?.id) {
        await updatePatient(patient.id, payload);
        onStatus?.("Paciente actualizado correctamente.", "success");
      } else {
        await createPatient(payload, doctorId);
        onStatus?.("Paciente creado correctamente.", "success");
      }
      onSuccess?.();
    } catch (error) {
      console.error(error);
      setFormError("No se pudo guardar el paciente. Revisa los datos e inténtalo nuevamente.");
      onStatus?.("No se pudo guardar el paciente.", "error");
    } finally {
      setSaving(false);
    }
  }

  const numericFields: Array<{ field: keyof PatientFormValues; label: string; step?: string }> = [
    { field: "bloodPressureDiastolic", label: "Presión diastólica" },
    { field: "pulse", label: "Pulso bpm" },
    { field: "glucose", label: "Glucosa mg/dL" },
    { field: "oxygenSaturation", label: "Saturación O2 %", step: "0.1" },
    { field: "respiratoryRate", label: "Frecuencia respiratoria" },
    { field: "hemoglobin", label: "Hemoglobina g/dL", step: "0.1" },
    { field: "creatinine", label: "Creatinina mg/dL", step: "0.1" },
    { field: "bmi", label: "IMC", step: "0.1" },
    { field: "packHistory", label: "Carga tabaquica (pack-years)", step: "0.1" },
  ];

  return (
    <form className="patient-form patient-form-clinical" onSubmit={handleSubmit}>
      <section className="patient-form-section">
        <h3>IDENTIFICACION MINIMA OBLIGATORIA</h3>
        <p className="patient-form-required-note"><b>*</b> Datos obligatorios para crear el registro.</p>
        {formError && <div className="patient-form-alert" role="alert" aria-live="assertive"><strong>No se puede crear el paciente</strong><span>{formError}</span></div>}
        <div className="patient-form-grid">
          <Field required label="Nombre completo" value={values.name} onChange={(value) => setValue("name", value)} />
          <Field required label="Documento / cedula" value={values.documentId} onChange={(value) => setValue("documentId", value)} />
          <Field required label="Edad actual" type="number" min="0" value={values.age} onChange={(value) => setValue("age", value)} />
          <Field required label="Condicion principal" value={values.condition} onChange={(value) => setValue("condition", value)} />
          <SelectField required label="Estado del paciente" value={values.status} options={["Estable", "Riesgo", "Critico"]} onChange={(value) => setValue("status", value)} />
          <SelectField label="Ciudad de consulta" value={values.locationCity} options={cities} onChange={(value) => setValue("locationCity", value)} />
        </div>
      </section>

      <section className="patient-form-section">
        <h3>SIGNOS, LABORATORIO Y CONTEXTO RESPIRATORIO</h3>
        <div className="patient-form-grid">
          <label className="patient-form-field patient-upload-field">
            <span>Foto opcional del paciente</span>
            <span className="patient-file-control">
              <span className="patient-file-button">Seleccionar archivo</span>
              <span className="patient-file-name">{values.photoFile?.name || "Ningún archivo seleccionado"}</span>
            </span>
            <input type="file" accept="image/*" onChange={(event) => setValues((current) => ({ ...current, photoFile: event.target.files?.[0] ?? null }))} />
          </label>
          <Field label="Presión sistólica" type="number" min="0" value={values.bloodPressureSystolic} onChange={(value) => setValue("bloodPressureSystolic", value)} />
          {numericFields.map(({ field, label, step }) => (
            <Field key={field} label={label} type="number" min="0" step={step} value={String(values[field])} onChange={(value) => setValue(field, value)} />
          ))}
          <SelectField label="COPD GOLD" value={values.copdGold} options={["1", "2", "3", "4", "No Presenta"]} onChange={(value) => setValue("copdGold", value)} />
          <SelectField label="EPOC confirmado" value={values.copdConfirmed} options={yesNoOptions} onChange={(value) => setValue("copdConfirmed", value)} />
          <SelectField label="Estado de tabaquismo" value={values.smokingStatus} options={["Nunca", "Exfumador", "Activo", "Alta carga", "No Presenta"]} onChange={(value) => setValue("smokingStatus", value)} />
        </div>
      </section>

      <section className="patient-form-section">
        <h3>APARTADO CARDIOVASCULAR</h3>
        <div className="patient-form-grid">
          <Field label="ECG / hallazgo electrocardiografico" value={values.ecg} onChange={(value) => setValue("ecg", value)} />
          <Field label="BNP pg/mL" type="number" min="0" value={values.bnp} onChange={(value) => setValue("bnp", value)} />
          <SelectField label="Antecedente de falla cardiaca" value={values.heartFailureHistory} options={yesNoOptions} onChange={(value) => setValue("heartFailureHistory", value)} />
          <SelectField label="Antecedentes coronarios" value={values.coronaryHistory} options={yesNoOptions} onChange={(value) => setValue("coronaryHistory", value)} />
          <SelectField label="Arritmias" value={values.arrhythmias} options={yesNoOptions} onChange={(value) => setValue("arrhythmias", value)} />
        </div>
      </section>

      <section className="patient-form-section">
        <h3>CONSULTA, AREA Y AGENDA</h3>
        <div className="patient-form-grid">
          <Field label="Area / servicio" value={values.ward} onChange={(value) => setValue("ward", value)} />
          <Field label="Habitacion / cama" value={values.room} onChange={(value) => setValue("room", value)} />
          {([[
            "appointmentTime", "Hora de consulta",
          ], ["monitoringTime", "Hora de monitoreo"], ["labTime", "Hora de laboratorio"]] as Array<[keyof PatientFormValues, string]>).map(([field, label]) => (
            <label className="patient-form-field patient-time-field" key={field}>
              <span>{label} <em>{String(values[field]) || "--:-- ----"}</em></span>
              <input type="time" value={String(values[field])} onChange={(event) => setValue(field, event.target.value)} />
            </label>
          ))}
        </div>
      </section>

      <label className="patient-form-field patient-notes-field">
        <span>Notas clinicas o seguimiento</span>
        <textarea value={values.notes} onChange={(event) => setValue("notes", event.target.value)} />
      </label>

      <div className="patient-modal-actions">
        <button type="submit" className="patient-modal-primary" disabled={saving}>{saving ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Crear paciente"}</button>
        <button type="button" className="patient-modal-secondary" onClick={onCancel} disabled={saving}>Cancelar</button>
      </div>
    </form>
  );
}
