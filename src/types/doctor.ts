export interface DoctorProfile {
  displayName?: string;
  photoUrl?: string;
  role?: string;
}

export interface DoctorUser {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  role?: string | null;
}

export interface DoctorIdentity {
  displayName: string;
  photoUrl: string;
  role: string;
  email: string;
}

export interface DoctorIdentityView {
  name: string;
  photo: string;
  role: string;
  email: string;
  roleDescription: string;
  panelLabel: string;
}