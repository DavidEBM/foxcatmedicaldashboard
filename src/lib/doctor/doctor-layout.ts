import type {
  WidgetKey,
  WidgetSize,
} from "@/types/doctor-widgets";

import type {
  WidgetMinimumSize,
  WidgetShape,
} from "@/types/doctor-layout";

export interface WidgetLayoutElement {
  widgetKey: WidgetKey;
  width?: number;
  classNames?: string[];
}

export interface DashboardDimensions {
  width: number;
}

export function normalizeWidgetOrder(
  order: WidgetKey[] | undefined,
  defaultWidgetOrder: WidgetKey[],
  widgetCatalog: Record<
    WidgetKey,
    unknown
  >
): WidgetKey[] {
  const uniqueKnownKeys = [
    ...new Set(
      (order || []).filter(
        (key) => !!widgetCatalog[key]
      )
    ),
  ];

  const missingKeys =
    defaultWidgetOrder.filter(
      (key) =>
        !uniqueKnownKeys.includes(key)
    );

  return [
    ...uniqueKnownKeys,
    ...missingKeys,
  ];
}

export function moveWidgetBefore(
  list: WidgetKey[],
  draggedKey: WidgetKey,
  insertBeforeKey: WidgetKey | null,
  defaultWidgetOrder: WidgetKey[],
  widgetCatalog: Record<
    WidgetKey,
    unknown
  >
): WidgetKey[] {
  const base =
    normalizeWidgetOrder(
      list,
      defaultWidgetOrder,
      widgetCatalog
    ).filter(
      (key) => key !== draggedKey
    );

  if (
    !insertBeforeKey ||
    !base.includes(insertBeforeKey)
  ) {
    return [
      ...base,
      draggedKey,
    ];
  }

  const insertIndex =
    base.indexOf(insertBeforeKey);

  base.splice(
    insertIndex,
    0,
    draggedKey
  );

  return base;
}

/* -------------------------------------------------------------------------- */
/* Widget dimensions                                                          */
/* -------------------------------------------------------------------------- */

export function getWidgetMinimums(
  widget: WidgetLayoutElement
): WidgetMinimumSize {
  const currentWidth =
    Math.round(widget.width || 0);

  const classNames =
    new Set(
      widget.classNames || []
    );

  if (
    classNames.has("widget-wide")
  ) {
    return currentWidth >= 820
      ? {
          width: 700,
          height: 220,
        }
      : {
          width: 640,
          height: 280,
        };
  }

  if (
    classNames.has("widget-form")
  ) {
    return {
      width: 480,
      height: 420,
    };
  }

  if (
    classNames.has("widget-list")
  ) {
    return {
      width: 560,
      height: 320,
    };
  }

  if (
    classNames.has("widget-ai")
  ) {
    return currentWidth >= 760
      ? {
          width: 620,
          height: 260,
        }
      : {
          width: 460,
          height: 340,
        };
  }

  if (
    widget.widgetKey ===
      "consultation-analysis"
  ) {
    return currentWidth >= 700
      ? {
          width: 520,
          height: 260,
        }
      : {
          width: 340,
          height: 280,
        };
  }

  return {
    width: 340,
    height: 280,
  };
}

export function clampWidgetSize(
  widget: WidgetLayoutElement,
  size: WidgetSize,
  dashboardWidth: number
): WidgetSize {
  const requestedWidth =
    Number(
      size?.width ||
        widget.width ||
        0
    );

  const safeDashboardWidth =
    Math.max(
      220,
      Math.round(
        dashboardWidth - 28
      )
    );

  const effectiveWidth =
    Math.min(
      safeDashboardWidth,
      Math.max(
        220,
        requestedWidth || 0
      )
    );

  let minimums:
    WidgetMinimumSize;

  const classNames =
    new Set(
      widget.classNames || []
    );

  if (
    classNames.has("widget-wide")
  ) {
    minimums =
      effectiveWidth >= 820
        ? {
            width: 700,
            height: 220,
          }
        : {
            width: 640,
            height: 280,
          };
  } else if (
    classNames.has("widget-form")
  ) {
    minimums = {
      width: 480,
      height: 420,
    };
  } else if (
    classNames.has("widget-list")
  ) {
    minimums = {
      width: 560,
      height: 320,
    };
  } else if (
    classNames.has("widget-ai")
  ) {
    minimums =
      effectiveWidth >= 760
        ? {
            width: 620,
            height: 260,
          }
        : {
            width: 460,
            height: 340,
          };
  } else if (
    widget.widgetKey ===
      "consultation-analysis"
  ) {
    minimums =
      effectiveWidth >= 700
        ? {
            width: 520,
            height: 260,
          }
        : {
            width: 340,
            height: 280,
          };
  } else {
    minimums =
      getWidgetMinimums(widget);
  }

  return {
    width: Math.min(
      safeDashboardWidth,
      Math.max(
        minimums.width,
        Number(
          size?.width ||
            minimums.width
        )
      )
    ),

    height: Math.max(
      minimums.height,
      Number(
        size?.height ||
          minimums.height
      )
    ),
  };
}

export function getWidgetShape(
  widget: WidgetLayoutElement
): WidgetShape {
  if (!widget) {
    return "default";
  }

  const width =
    Math.round(
      widget.width || 0
    );

  if (
    widget.widgetKey ===
    "patient-overview"
  ) {
    return width >= 820
      ? "wide"
      : "stacked";
  }

  if (
    widget.widgetKey ===
    "medic-ai"
  ) {
    return width >= 760
      ? "wide"
      : "stacked";
  }

  if (
    widget.widgetKey ===
      "consultation-analysis"
  ) {
    return width >= 700
      ? "wide"
      : "stacked";
  }

  return "default";
}

