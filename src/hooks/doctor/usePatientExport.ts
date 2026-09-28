"use client";

import { useCallback, useState } from "react";

import type { Patient } from "@/types/doctor-patients";

import {
  ALL_PATIENTS_FILENAME,
  buildAllPatientRows,
  buildSelectedPatientRows,
  getSelectedPatientFilename,
} from "@/lib/doctor/patient-export";

import { downloadExcel } from "@/lib/doctor/excel-export";

interface UsePatientExportOptions {
  onStatus?: (
    message: string,
    type: "success" | "error"
  ) => void;
}

export function usePatientExport(
  options: UsePatientExportOptions = {}
) {
  const [exporting, setExporting] = useState(false);

  const exportSelectedPatient = useCallback(
    (patient: Patient | null) => {
      if (!patient) {
        options.onStatus?.(
          "Selecciona un paciente para exportar su historia clínica.",
          "error"
        );
        return;
      }

      try {
        setExporting(true);

        const rows = buildSelectedPatientRows(patient);

        downloadExcel(
          rows,
          "HistoriaClinica",
          getSelectedPatientFilename(patient)
        );

        options.onStatus?.(
          "Historia clínica exportada correctamente.",
          "success"
        );
      } catch (error) {
        console.error(error);

        options.onStatus?.(
          "No se pudo exportar la historia clínica.",
          "error"
        );
      } finally {
        setExporting(false);
      }
    },
    [options]
  );

  const exportAllPatients = useCallback(
    (patients: Patient[]) => {
      if (!patients.length) {
        options.onStatus?.(
          "No hay pacientes para exportar.",
          "error"
        );
        return;
      }

      try {
        setExporting(true);

        const rows = buildAllPatientRows(patients);

        downloadExcel(
          rows,
          "Pacientes",
          ALL_PATIENTS_FILENAME
        );

        options.onStatus?.(
          "Pacientes exportados correctamente.",
          "success"
        );
      } catch (error) {
        console.error(error);

        options.onStatus?.(
          "No se pudieron exportar los pacientes.",
          "error"
        );
      } finally {
        setExporting(false);
      }
    },
    [options]
  );

  return {
    exporting,
    exportSelectedPatient,
    exportAllPatients,
  };
}