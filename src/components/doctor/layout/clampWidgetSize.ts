import type {
  WorkspaceStyle,
  WorkspaceWidgetLayout,
  WorkspaceWidgetSize,
} from "@/types/doctor-workspace";

interface ClampWidgetSizeOptions {
  layout: WorkspaceWidgetLayout;
  size: WorkspaceWidgetSize;
  style: WorkspaceStyle;
}

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(Math.max(value, min), max);
}

export function clampWidgetSize({
  layout,
  size,
  style,
}: ClampWidgetSizeOptions): WorkspaceWidgetSize {
  const minWidth = Math.max(
    1,
    layout.constraints?.minWidth ??
      style.widgetMinWidth
  );

  const maxWidth = Math.max(
    minWidth,
    layout.constraints?.maxWidth ??
      Number.POSITIVE_INFINITY
  );

  const minHeight = Math.max(
    1,
    layout.constraints?.minHeight ??
      style.widgetMinHeight
  );

  const maxHeight = Math.max(
    minHeight,
    layout.constraints?.maxHeight ??
      Number.POSITIVE_INFINITY
  );

  const width = clamp(
    Number.isFinite(size.width)
      ? size.width
      : minWidth,
    minWidth,
    maxWidth
  );

  const height = clamp(
    Number.isFinite(size.height)
      ? size.height
      : minHeight,
    minHeight,
    maxHeight
  );

  return {
    width,
    height,
  };
}