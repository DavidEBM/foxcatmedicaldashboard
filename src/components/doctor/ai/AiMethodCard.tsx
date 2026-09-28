"use client";

import type { AiMethod } from "@/types/doctor-ai";
import {
  getAiMethodStatusLabel,
  getAiMethodTone,
} from "@/lib/doctor/doctor-ai";

interface AiMethodCardProps {
  method: AiMethod;
}

export default function AiMethodCard({
  method,
}: AiMethodCardProps) {
  return (
    <article
      className="ai-method-card"
      data-tone={getAiMethodTone(method.status)}
    >
      <div className="ai-method-head">
        <strong>{method.name}</strong>

        <span className="soft-badge">
          {getAiMethodStatusLabel(method.status)}
        </span>
      </div>

      <p>{method.role}</p>

      <p className="ai-detail">
        {method.why}
      </p>

      <div className="ai-inline">
        <span className="soft-pill">
          {method.window}
        </span>

        <span className="soft-pill">
          {method.signal}
        </span>

        <span className="soft-pill">
          Confianza {Number(method.confidence || 0)}%
        </span>
      </div>
    </article>
  );
}