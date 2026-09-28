"use client";

import Image from "next/image";

import type { DoctorUser } from "@/types/doctor";

import { useDoctorIdentity } from "@/hooks/doctor/useDoctorIdentity";

interface DoctorTopbarProps {
  user: DoctorUser;
  doctorRole?: string;
}

export function DoctorTopbar({
  user,
  doctorRole,
}: DoctorTopbarProps) {
  const doctor = useDoctorIdentity({
    user,
    doctorRole,
  });

  return (
    <header className="doctor-topbar">
      <div className="doctor-profile">
        <Image
          src={doctor.photo}
          alt={`Foto de ${doctor.name}`}
          width={40}
          height={40}
          className="doctor-profile-photo"
          unoptimized
        />

        <div className="doctor-profile-info">
          <strong>{doctor.name}</strong>

          <span>{doctor.role}</span>
        </div>
      </div>
    </header>
  );
}
