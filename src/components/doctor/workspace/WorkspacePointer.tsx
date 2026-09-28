"use client";

import type {
  WorkspaceInteractionMode,
  WorkspaceWidgetId,
} from "@/types/doctor-workspace";

interface PointerPosition {
  x: number;
  y: number;
}

interface WorkspacePointerProps {
  enabled?: boolean;
  mode?: WorkspaceInteractionMode;
  pointerPosition?: PointerPosition | null;
  activeWidgetId?: WorkspaceWidgetId | null;
}

export default function WorkspacePointer({
  enabled = false,
  mode = "default",
  pointerPosition = null,
  activeWidgetId = null,
}: WorkspacePointerProps) {
  if (!enabled || !pointerPosition) {
    return null;
  }

  const isResizeMode =
    mode === "resize";

  return (
    <div
      className={[
        "workspace-pointer-layer",
        isResizeMode
          ? "is-resizing"
          : "",
        activeWidgetId
          ? "has-active-widget"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      <div
        className="workspace-pointer"
        style={{
          left: pointerPosition.x,
          top: pointerPosition.y,
        }}
      >
        <span className="workspace-pointer-dot" />

        {isResizeMode && (
          <span className="workspace-pointer-resize-indicator">
            ↘
          </span>
        )}
      </div>
    </div>
  );
}
