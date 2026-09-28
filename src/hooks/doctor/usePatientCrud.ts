"use client";

import { useState } from "react";

import type { Patient } from "@/types/doctor-patients";

type CrudMode =
  | "create"
  | "edit"
  | "view"
  | "delete"
  | "appointment"
  | null;

export function usePatientCrud() {
  const [open, setOpen] =
    useState(false);

  const [mode, setMode] =
    useState<CrudMode>(null);

  const [patient, setPatient] =
    useState<Patient | null>(null);

  function openCreate() {
    setPatient(null);
    setMode("create");
    setOpen(true);
  }

  function openEdit(
    selectedPatient: Patient
  ) {
    setPatient(selectedPatient);
    setMode("edit");
    setOpen(true);
  }

  function openView(
    selectedPatient: Patient
  ) {
    setPatient(selectedPatient);
    setMode("view");
    setOpen(true);
  }

  function openDelete(
    selectedPatient: Patient
  ) {
    setPatient(selectedPatient);
    setMode("delete");
    setOpen(true);
  }

  function openAppointment(
    selectedPatient: Patient
  ) {
    setPatient(selectedPatient);
    setMode("appointment");
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setMode(null);
    setPatient(null);
  }

  return {
    open,
    mode,
    patient,

    openCreate,
    openEdit,
    openView,
    openDelete,
    openAppointment,

    close,
  };
}