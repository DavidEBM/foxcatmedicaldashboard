import type {
  QuickAccessItem,
  WidgetDefinition,
  WidgetKey,
} from "@/types/doctor-widgets";

export function normalizeQuickAccessItems(
  items: QuickAccessItem[] | undefined,
  widgetCatalog: Record<WidgetKey, WidgetDefinition>
): QuickAccessItem[] {
  return (items ?? [])
    .filter((item) => item?.type && item?.target)
    .map((item, index) => ({
      id:
        item.id ||
        `qa-${item.type}-${item.target}-${index}`.replace(
          /[^a-z0-9-]/gi,
          "-"
        ),
      type: item.type,
      target: item.target,
      label:
        item.label ||
        (item.type === "widget"
          ? widgetCatalog[item.target as WidgetKey]?.label ??
            item.target
          : item.target),
    }));
}

export function getVisibleWidgetKeys(
  layoutOrder: WidgetKey[],
  hiddenWidgetKeys: WidgetKey[],
  widgetCatalog: Record<WidgetKey, WidgetDefinition>
): WidgetKey[] {
  const hidden = new Set(hiddenWidgetKeys);

  return layoutOrder.filter(
    (key) => !hidden.has(key) && !!widgetCatalog[key]
  );
}

export function getAddableWidgetKeys(
  defaultWidgetOrder: WidgetKey[],
  hiddenWidgetKeys: WidgetKey[]
): WidgetKey[] {
  const hidden = new Set(hiddenWidgetKeys);

  return defaultWidgetOrder.filter((key) =>
    hidden.has(key)
  );
}

export function getDefaultInsertBeforeKey(
  widgetKey: WidgetKey,
  defaultWidgetOrder: WidgetKey[],
  hiddenWidgetKeys: WidgetKey[]
): WidgetKey | null {
  const index = defaultWidgetOrder.indexOf(widgetKey);

  if (index === -1) {
    return null;
  }

  const hidden = new Set(hiddenWidgetKeys);

  for (
    let current = index + 1;
    current < defaultWidgetOrder.length;
    current++
  ) {
    const candidate = defaultWidgetOrder[current];

    if (!hidden.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function moveWidgetBefore(
  order: WidgetKey[],
  widgetKey: WidgetKey,
  beforeKey: WidgetKey | null
): WidgetKey[] {
  const next = order.filter((key) => key !== widgetKey);

  if (!beforeKey) {
    next.push(widgetKey);
    return next;
  }

  const index = next.indexOf(beforeKey);

  if (index === -1) {
    next.push(widgetKey);
    return next;
  }

  next.splice(index, 0, widgetKey);

  return next;
}

export function normalizeWidgetOrder(
  order: WidgetKey[],
  defaultWidgetOrder: WidgetKey[]
): WidgetKey[] {
  const valid = new Set(defaultWidgetOrder);
  const normalized = order.filter((key) => valid.has(key));

  for (const key of defaultWidgetOrder) {
    if (!normalized.includes(key)) {
      normalized.push(key);
    }
  }

  return normalized;
}