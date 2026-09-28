"use client";

import type { ClinicalCurvePoint } from "@/types/doctor-clinical";

interface ClinicalCurveProps {
  points: ClinicalCurvePoint[];
  xLabel: string;
}

export default function ClinicalCurve({
  points,
  xLabel,
}: ClinicalCurveProps) {
  if (!points.length) {
    return null;
  }

  const width = 280;
  const height = 120;
  const plotLeft = 28;
  const plotTop = 12;
  const plotWidth = 230;
  const plotHeight = 78;

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));

  const toX = (value: number) =>
    plotLeft +
    ((value - minX) /
      Math.max(1, maxX - minX)) *
      plotWidth;

  const toY = (value: number) =>
    plotTop +
    (1 - value / 100) * plotHeight;

  const path = points
    .map(
      (point, index) =>
        `${index ? "L" : "M"} ${toX(point.x).toFixed(
          1,
        )} ${toY(point.y).toFixed(1)}`,
    )
    .join(" ");

  return (
    <svg
      className="clinical-curve"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Curva ${xLabel} contra riesgo`}
    >
      <path
        d={`M ${plotLeft} ${plotTop} V ${
          plotTop + plotHeight
        } H ${plotLeft + plotWidth}`}
        className="curve-axis"
      />

      <path
        d={path}
        className="curve-line"
      />

      {points.map((point) => (
        <circle
          key={`${point.x}-${point.y}`}
          cx={toX(point.x)}
          cy={toY(point.y)}
          r={point.active ? 5 : 3}
          className={
            point.active
              ? "curve-point active"
              : "curve-point"
          }
        />
      ))}

      <text
        x={plotLeft}
        y={height - 10}
        className="curve-label"
      >
        {xLabel}
      </text>

      <text
        x={plotLeft + plotWidth - 48}
        y={plotTop + 10}
        className="curve-label"
      >
        Riesgo
      </text>
    </svg>
  );
}