import type {
  PredictionTimelinePoint,
} from "@/types/doctor-ai-validation";

export function clampPercent(value: unknown): number {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(0, Math.round(numeric)),
  );
}

export function normalizeHours(value: unknown): number {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }

  return Math.round(numeric);
}

export function formatHorizon(hours: unknown): string {
  const value = normalizeHours(hours);

  if (value < 24) {
    return `${value} horas`;
  }

  if (value <= 24) {
    return "24 horas";
  }

  if (value <= 168) {
    return "7 días";
  }

  if (value <= 336) {
    return "14 días";
  }

  return "30 días";
}

export function interpolateRisk(
  startRisk: unknown,
  endRisk: unknown,
  progress: unknown,
): number {
  const start = Number(startRisk) || 0;
  const end = Number(endRisk) || 0;

  const factor = Math.min(
    1,
    Math.max(0, Number(progress) || 0),
  );

  return clampPercent(
    start + (end - start) * factor,
  );
}

export function buildPredictionTimeline(
  startRisk: unknown,
  endRisk: unknown,
): PredictionTimelinePoint[] {
  const initial = clampPercent(startRisk);
  const final = clampPercent(endRisk);

  const horizons = [
    {
      hours: 24,
      label: "24 h",
    },
    {
      hours: 168,
      label: "7 días",
    },
    {
      hours: 336,
      label: "14 días",
    },
    {
      hours: 720,
      label: "30 días",
    },
  ];

  return horizons.map((item) => ({
    ...item,
    risk: interpolateRisk(
      initial,
      final,
      item.hours / 720,
    ),
  }));
}
