"use client";

import { useMemo, useState } from "react";

import type {
  PredictionTimelinePoint,
} from "@/types/doctor-ai-validation";

import {
  clampPercent,
  normalizeHours,
} from "@/lib/doctor/ai-validation/timeline";

interface PredictionChartProps {
  timeline: PredictionTimelinePoint[];
}

const HORIZONS = [
  { hours: 24, label: "24 h", longLabel: "24 horas" },
  { hours: 168, label: "7 d", longLabel: "7 días" },
  { hours: 336, label: "14 d", longLabel: "14 días" },
  { hours: 720, label: "30 d", longLabel: "30 días" },
];

function formatAvailableWindow(hours: number): string {
  if (hours < 24) {
    return `${hours} h`;
  }

  if (hours % 24 === 0) {
    return `${hours / 24} días`;
  }

  return `${hours} h`;
}

function getChartPoints(timeline: PredictionTimelinePoint[]) {
  const byHour = new Map<number, PredictionTimelinePoint>();

  timeline.forEach((point) => {
    const hours = normalizeHours(point.hours);
    if (hours <= 0 || !Number.isFinite(Number(point.risk))) {
      return;
    }

    byHour.set(hours, {
      ...point,
      hours,
      risk: clampPercent(point.risk),
      label: point.label || formatAvailableWindow(hours),
    });
  });

  return Array.from(byHour.values()).sort(
    (left, right) => left.hours - right.hours,
  );
}

export default function PredictionChart({
  timeline,
}: PredictionChartProps) {
  const points = useMemo(
    () => getChartPoints(timeline),
    [timeline],
  );

  const maxAvailableHours = points.length
    ? Math.max(...points.map((point) => point.hours))
    : 0;

  const availableHorizons = HORIZONS.filter(
    (horizon) => points.some(
      (point) => point.hours === horizon.hours,
    ),
  );

  const defaultHorizon = availableHorizons.at(-1)?.hours
    ?? maxAvailableHours;

  const [selectedHorizon, setSelectedHorizon] = useState(defaultHorizon);

  if (!points.length) {
    return (
      <div className="ai-validation-empty-chart" role="status">
        No hay datos temporales suficientes para representar el riesgo.
      </div>
    );
  }

  const effectiveHorizon = selectedHorizon > 0 && selectedHorizon <= maxAvailableHours
    ? selectedHorizon
    : defaultHorizon;

  const chartEndHours = Math.max(
    1,
    Math.min(effectiveHorizon || maxAvailableHours, maxAvailableHours),
  );
  const chartPoints = points.filter(
    (point) => point.hours <= chartEndHours,
  );

  const width = 520;
  const height = 210;
  const left = 48;
  const right = 18;
  const top = 20;
  const bottom = 48;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;

  const toX = (hours: number) =>
    left + (hours / chartEndHours) * chartWidth;

  const toY = (risk: number) =>
    top + (1 - clampPercent(risk) / 100) * chartHeight;

  const path = chartPoints
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${toX(point.hours).toFixed(1)} ${toY(point.risk).toFixed(1)}`,
    )
    .join(" ");

  const yGrid = [0, 25, 50, 75, 100];
  const selectedLabel = HORIZONS.find(
    (horizon) => horizon.hours === effectiveHorizon,
  )?.longLabel ?? formatAvailableWindow(chartEndHours);
  const hasLimitedCoverage = maxAvailableHours < 720;

  return (
    <div className="ai-validation-chart">
      <div className="ai-validation-chart-topline">
        <span>Riesgo (%) vs. tiempo</span>
        <span>{points.length} {points.length === 1 ? "punto" : "puntos"}</span>
      </div>

      <div
        className="ai-validation-horizon-selector"
        role="tablist"
        aria-label="Ventana temporal del riesgo"
      >
        {HORIZONS.map((horizon) => {
          const available = points.some(
            (point) => point.hours === horizon.hours,
          );
          const active = effectiveHorizon === horizon.hours;

          return (
            <button
              key={horizon.hours}
              type="button"
              role="tab"
              aria-selected={active}
              aria-disabled={!available}
              disabled={!available}
              title={available
                ? `Ver ventana de ${horizon.longLabel}`
                : `No hay datos hasta ${horizon.longLabel}`}
              className={active ? "is-active" : ""}
              onClick={() => setSelectedHorizon(horizon.hours)}
            >
              {horizon.label}
            </button>
          );
        })}
      </div>

      <svg
        className="ai-validation-chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Riesgo estimado hasta ${selectedLabel}`}
      >
        {yGrid.map((value) => (
          <g key={value}>
            <line
              x1={left}
              y1={toY(value)}
              x2={left + chartWidth}
              y2={toY(value)}
              className="ai-validation-grid-line"
            />
            <text
              x={left - 8}
              y={toY(value) + 4}
              textAnchor="end"
              className="ai-validation-axis-label"
            >
              {value}%
            </text>
          </g>
        ))}

        <line
          x1={left}
          y1={top}
          x2={left}
          y2={top + chartHeight}
          className="ai-validation-axis"
        />
        <line
          x1={left}
          y1={top + chartHeight}
          x2={left + chartWidth}
          y2={top + chartHeight}
          className="ai-validation-axis"
        />

        <text
          x={left}
          y={height - 10}
          textAnchor="start"
          className="ai-validation-axis-label"
        >
          Ahora
        </text>

        {chartPoints.length > 1 && (
          <path
            d={path}
            className="ai-validation-risk-line"
          />
        )}

        {chartPoints.map((point) => (
          <g key={`${point.hours}-${point.risk}`}>
            <circle
              cx={toX(point.hours)}
              cy={toY(point.risk)}
              r="5"
              className="ai-validation-risk-point"
            />
            <text
              x={toX(point.hours)}
              y={toY(point.risk) - 10}
              textAnchor="middle"
              className="ai-validation-point-label"
            >
              {point.risk}%
            </text>
            <text
              x={toX(point.hours)}
              y={height - 25}
              textAnchor="middle"
              className="ai-validation-axis-label"
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>

      <div className="ai-validation-chart-footnote">
        <span>Ventana mostrada: <strong>{selectedLabel}</strong></span>
        {hasLimitedCoverage && (
          <span className="is-limited">
            Alternativa disponible: hasta {formatAvailableWindow(maxAvailableHours)}
          </span>
        )}
      </div>
    </div>
  );
}
