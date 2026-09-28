import type {
  DoctorIdentityView,
  DoctorUser,
} from "@/types/doctor";

import {
  createAvatarDataUri,
  getDoctorIdentity,
} from "@/lib/doctor/doctor-utils";

export function buildDoctorIdentityView(
  user: DoctorUser | null | undefined,
  doctorRole?: string
): DoctorIdentityView {
  const {
    displayName,
    photoUrl,
  } = getDoctorIdentity(user, {});

  const name =
    displayName || "Médico sin nombre";

  const role =
    doctorRole || "Médico general";

  const photo =
    photoUrl ||
    createAvatarDataUri(
      name,
      "#f9d6dd",
      "#dce9ff"
    );

  const email =
    user?.email || "Sin correo";

  return {
    name,
    photo,
    role,
    email,
    roleDescription:
      `Rol: ${role} | Perfil autenticado con panel IA clínico.`,
    panelLabel:
      `Médico: ${name}`,
  };
}