"use client";

import type { ReactNode } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { WorkspaceWidgetId } from "@/types/doctor-workspace";
import type { ResizeDirection } from "@/hooks/doctor/useWorkspacePointer";

export interface DoctorWidgetProps {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;

  accent?:
    | "purple"
    | "blue"
    | "green"
    | "red";

  children: ReactNode;

  minimized?: boolean;
  focused?: boolean;

  onFocus?: () => void;

  resizeState?: {
    widgetId: WorkspaceWidgetId;
    isArmed: boolean;
    isResizing: boolean;
    onResizePointerDown?: (
      event: ReactPointerEvent<HTMLElement>,
      widgetId: WorkspaceWidgetId,
      direction: ResizeDirection
    ) => void;
  };
}

export default function DoctorWidget({
  id,
  title,
  subtitle,
  icon,
  accent = "purple",
  children,
  minimized = false,
  focused = false,
  onFocus,
  resizeState,
}: DoctorWidgetProps) {
  const resizeHandles: Array<[ResizeDirection, string]> = [
    ["n", "ns-resize"], ["ne", "nesw-resize"],
    ["e", "ew-resize"], ["se", "nwse-resize"],
    ["s", "ns-resize"], ["sw", "nesw-resize"],
    ["w", "ew-resize"], ["nw", "nwse-resize"],
  ];

  const showResize = resizeState?.isArmed || resizeState?.isResizing;
  return (
    <article
      id={`doctor-widget-${id}`}
      className={[
        "doctor-widget",
        `doctor-widget-${accent}`,
        minimized ? "is-minimized" : "",
        focused ? "is-focused" : "",
        resizeState?.isArmed ? "is-resize-armed" : "",
        resizeState?.isResizing ? "is-resizing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onFocus}
    >
      {/* ==================================================
          HEADER
          ================================================== */}

      <header className="doctor-widget-header">
        <div className="doctor-widget-heading">
          {icon && (
            <span
              className="doctor-widget-icon"
              aria-hidden="true"
            >
              {icon}
            </span>
          )}

          <div className="doctor-widget-title-group">
            <h3>{title}</h3>

            {subtitle && (
              <span>{subtitle}</span>
            )}
          </div>
        </div>
      </header>

      {/* ==================================================
          BODY
          ================================================== */}

      {!minimized && (
        <div className="doctor-widget-body">
          {children}
        </div>
      )}

      {/* ==================================================
          MINIMIZED
          ================================================== */}

      {minimized && (
        <div className="doctor-widget-minimized-label">
          Widget minimizado
        </div>
      )}

      {showResize && resizeState && (
        <div className="doctor-widget-resize-overlay" aria-hidden="true">
          {resizeHandles.map(([direction, cursor]) => (
            <button
              key={direction}
              type="button"
              className={`doctor-widget-resize-handle doctor-widget-resize-handle-${direction}`}
              data-widget-resize-handle="true"
              aria-label={`Redimensionar widget ${id} hacia ${direction}`}
              style={{
                cursor,
                top: direction.includes("n") ? 0 : direction.includes("s") ? "auto" : 12,
                bottom: direction.includes("s") ? 0 : direction.includes("n") ? "auto" : 12,
                left: direction.includes("w") ? 0 : direction.includes("e") ? "auto" : 12,
                right: direction.includes("e") ? 0 : direction.includes("w") ? "auto" : 12,
                width: direction === "n" || direction === "s" ? "calc(100% - 24px)" : direction === "e" || direction === "w" ? 12 : 24,
                height: direction === "e" || direction === "w" ? "calc(100% - 24px)" : direction === "n" || direction === "s" ? 12 : 24,
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                resizeState.onResizePointerDown?.(event, resizeState.widgetId, direction);
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            />
          ))}
        </div>
      )}
    </article>
  );
}
