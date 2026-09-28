"use client";

import { useMemo } from "react";

import type {
  DoctorIdentityView,
  DoctorUser,
} from "@/types/doctor";

import { buildDoctorIdentityView } from "@/lib/doctor/doctor-identity";

interface UseDoctorIdentityOptions {
  user: DoctorUser | null | undefined;
  doctorRole?: string;
}

export function useDoctorIdentity({
  user,
  doctorRole,
}: UseDoctorIdentityOptions): DoctorIdentityView {
  return useMemo(
    () =>
      buildDoctorIdentityView(
        user,
        doctorRole
      ),
    [user, doctorRole]
  );
}