import type {
  WorkspaceWidgetId,
  WorkspaceWidgetLayout,
} from "@/types/doctor-workspace";

function normalizeOrder(
  layouts: WorkspaceWidgetLayout[]
): WorkspaceWidgetLayout[] {
  return layouts.map((layout, index) => ({
    ...layout,
    order: index,
  }));
}

export function reorderWidgets(
  layouts: WorkspaceWidgetLayout[],
  widgetId: WorkspaceWidgetId,
  direction: "first" | "last"
): WorkspaceWidgetLayout[] {
  const ordered = [...layouts].sort(
    (a, b) => a.order - b.order
  );

  const targetIndex = ordered.findIndex(
    (layout) => layout.id === widgetId
  );

  if (targetIndex === -1) {
    return layouts;
  }

  const target = ordered[targetIndex];

  const remaining = ordered.filter(
    (layout) => layout.id !== widgetId
  );

  const reordered =
    direction === "first"
      ? [target, ...remaining]
      : [...remaining, target];

  return normalizeOrder(reordered);
}

export function moveWidgetToFirst(
  layouts: WorkspaceWidgetLayout[],
  widgetId: WorkspaceWidgetId
): WorkspaceWidgetLayout[] {
  return reorderWidgets(layouts, widgetId, "first");
}

export function moveWidgetToLast(
  layouts: WorkspaceWidgetLayout[],
  widgetId: WorkspaceWidgetId
): WorkspaceWidgetLayout[] {
  return reorderWidgets(layouts, widgetId, "last");
}