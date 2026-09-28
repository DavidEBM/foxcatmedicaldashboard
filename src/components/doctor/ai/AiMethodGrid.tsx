"use client";

import type { AiMethod } from "@/types/doctor-ai";
import AiMethodCard from "./AiMethodCard";

interface AiMethodGridProps {
  methods: AiMethod[];
}

export default function AiMethodGrid({
  methods,
}: AiMethodGridProps) {
  if (!methods.length) {
    return (
      <div className="empty-state">
        No hay métodos IA disponibles para este caso.
      </div>
    );
  }

  return (
    <div className="ai-method-grid">
      {methods.map((method) => (
        <AiMethodCard
          key={`${method.name}-${method.status}`}
          method={method}
        />
      ))}
    </div>
  );
}