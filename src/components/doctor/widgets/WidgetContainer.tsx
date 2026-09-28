"use client";

import type { ReactNode } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { WorkspaceWidgetId } from "@/types/doctor-workspace";
import type { ResizeDirection } from "@/hooks/doctor/useWorkspacePointer";

import DoctorWidget from "./DoctorWidget";

export interface DashboardWidget {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;

  accent?:
    | "purple"
    | "blue"
    | "green"
    | "red";

  content: ReactNode;

  defaultVisible?: boolean;
}

interface WidgetContainerProps {
  widgets: DashboardWidget[];
  resizeState?: {
    isArmed: boolean;
    isResizing: boolean;
    onResizePointerDown?: (
      event: ReactPointerEvent<HTMLElement>,
      widgetId: WorkspaceWidgetId,
      direction: ResizeDirection
    ) => void;
  };
}

export default function WidgetContainer({
  widgets,
  resizeState,
}: WidgetContainerProps) {
  const visibleWidgets = widgets.filter(
    (widget) =>
      widget.defaultVisible !== false
  );

  return (
    <section
      className="doctor-widget-container"
      aria-label="Widgets del panel médico"
    >
      <div className="doctor-widget-grid">
        {visibleWidgets.map((widget) => (
          <DoctorWidget
            key={widget.id}
            id={widget.id}
            title={widget.title}
            subtitle={widget.subtitle}
            icon={widget.icon}
            accent={widget.accent}
            resizeState={resizeState ? {
              ...resizeState,
              widgetId: widget.id,
            } : undefined}
          >
            {widget.content}
          </DoctorWidget>
        ))}
      </div>
    </section>
  );
}

