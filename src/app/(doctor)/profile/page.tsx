"use client";

import Profile from "@/components/doctor/profile/Profile";

export default function DoctorProfilePage() {
  const profile = {
    firstName: "",
    lastName: "",
    documentType: "",
    documentNumber: "",
    age: 0,
    birthYear: 0,
  };

  return <Profile profile={profile} />;
}