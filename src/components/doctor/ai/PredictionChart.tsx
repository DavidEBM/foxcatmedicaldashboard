"use client";

import type {
  PredictionTimelinePoint,
} from "@/types/doctor-ai-validation";

interface PredictionChartProps {
  timeline: PredictionTimelinePoint[];
}

export default function PredictionChart({
  timeline,
}: PredictionChartProps) {
  if (!timeline.length) {
    return (
      <div className="ai-validation-empty-chart">
        No hay suficientes puntos para representar
        la curva.
      </div>
    );
  }

  const width = 520;
  const height = 190;

  const left = 46;
  const right = 18;
  const top = 16;
  const bottom = 42;

  const chartWidth =
    width - left - right;

  const chartHeight =
    height - top - bottom;

  const maxHours = Math.max(
    ...timeline.map(
      (point) => point.hours,
    ),
    720,
  );

  const toX = (hours: number) =>
    left +
    (hours / maxHours) *
      chartWidth;

  const toY = (risk: number) =>
    top +
    (1 - risk / 100) *
      chartHeight;

  const path = timeline
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${toX(
          point.hours,
        ).toFixed(1)} ${toY(
          point.risk,
        ).toFixed(1)}`,
    )
    .join(" ");

  const yGrid = [
    0,
    25,
    50,
    75,
    100,
  ];

  return (
    <div className="ai-validation-chart">
      <svg
        className="ai-validation-chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Riesgo estimado respecto al tiempo"
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

        <path
          d={path}
          className="ai-validation-risk-line"
        />

        {timeline.map((point) => (
          <circle
            key={`${point.hours}-${point.risk}`}
            cx={toX(point.hours)}
            cy={toY(point.risk)}
            r="4"
            className="ai-validation-risk-point"
          />
        ))}

        {timeline.map((point) => (
          <text
            key={`label-${point.hours}`}
            x={toX(point.hours)}
            y={height - 18}
            textAnchor="middle"
            className="ai-validation-axis-label"
          >
            {point.label}
          </text>
        ))}
      </svg>
    </div>
  );
}