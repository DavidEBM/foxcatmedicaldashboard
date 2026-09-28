export interface DoctorProfile {
  displayName?: string;
  photoUrl?: string;
}

export interface DoctorIdentity {
  displayName: string;
  photoUrl: string;
}

export interface RegionProfile {
  name?: string;
  altitude?: number;
  oxygenAdjustment?: number;
  [key: string]: unknown;
}

export interface TrainingProfile {
  locationElevations?: Record<
    string,
    number
  >;

  [key: string]: unknown;
}

