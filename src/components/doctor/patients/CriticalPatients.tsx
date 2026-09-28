"use client";

import { useMemo } from "react";
import type { Patient } from "@/types/doctor-patients";

interface CriticalPatientsProps {
  patients: Patient[];
  getPatientRiskScore?: (patient: Patient) => number;
  onSelect?: (patient: Patient) => void;
}

export default function CriticalPatients({
  patients,
  getPatientRiskScore = (patient) =>
    patient.oxygenSaturation < 92 ? 3 : patient.respiratoryRate >= 22 ? 2 : 0,
  onSelect,
}: CriticalPatientsProps) {
  const criticalPatients = useMemo(
    () => [...patients].sort((a, b) => getPatientRiskScore(b) - getPatientRiskScore(a)).slice(0, 4),
    [getPatientRiskScore, patients],
  );

  return (
    <div className="doctor-widget-list">
      {criticalPatients.map((patient) => (
        <button type="button" className="doctor-widget-list-item" key={patient.id} onClick={() => onSelect?.(patient)}>
          <div><strong>{patient.name}</strong><span>{patient.condition} · Riesgo {getPatientRiskScore(patient)}</span></div>
        </button>
      ))}
    </div>
  );
}
