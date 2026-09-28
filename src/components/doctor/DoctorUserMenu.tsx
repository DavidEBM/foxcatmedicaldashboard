"use client";

import type { DoctorUser } from "@/types/doctor";

import { useDoctorIdentity } from "@/hooks/doctor/useDoctorIdentity";

interface DoctorUserMenuProps {
  user: DoctorUser;
  doctorRole?: string;
}

export function DoctorUserMenu({
  user,
  doctorRole,
}: DoctorUserMenuProps) {
  const doctor = useDoctorIdentity({
    user,
    doctorRole,
  });

  return (
    <div className="doctor-user-menu">
      <div className="doctor-user-header">
        <img
          src={doctor.photo}
          alt={`Foto de ${doctor.name}`}
          width={48}
          height={48}
        />

        <div>
          <strong>{doctor.name}</strong>
          <span>{doctor.role}</span>
        </div>
      </div>

      <div className="doctor-user-details">
        <p>
          <strong>Nombre:</strong>{" "}
          {doctor.name}
        </p>

        <p>
          <strong>Correo:</strong>{" "}
          {doctor.email}
        </p>

        <p>{doctor.roleDescription}</p>
      </div>
    </div>
  );
}

