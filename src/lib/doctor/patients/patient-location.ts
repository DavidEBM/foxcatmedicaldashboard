export interface RegionProfile {
  label?: string;
  altitude?: number;
  elevation?: number;
  [key: string]: unknown;
}

export function normalizeRegionName(
  value: unknown
): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}