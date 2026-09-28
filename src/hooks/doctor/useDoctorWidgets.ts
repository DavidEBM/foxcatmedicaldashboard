"use client";

import { useCallback, useMemo, useState } from "react";

import type {
  QuickAccessItem,
  WidgetDefinition,
  WidgetKey,
  WidgetSize,
} from "@/types/doctor-widgets";

import {
  getAddableWidgetKeys,
  getVisibleWidgetKeys,
  moveWidgetBefore,
  normalizeQuickAccessItems,
  normalizeWidgetOrder,
} from "@/lib/doctor/doctor-widgets";

interface UseDoctorWidgetsOptions {
  defaultWidgetOrder: WidgetKey[];
  widgetCatalog: Record<WidgetKey, WidgetDefinition>;
  initialLayoutOrder?: WidgetKey[];
  initialHiddenWidgetKeys?: WidgetKey[];
  initialQuickAccessItems?: QuickAccessItem[];
  initialWidgetSizes?: Partial<Record<WidgetKey, WidgetSize>>;
}

export function useDoctorWidgets({
  defaultWidgetOrder,
  widgetCatalog,
  initialLayoutOrder,
  initialHiddenWidgetKeys = [],
  initialQuickAccessItems = [],
  initialWidgetSizes = {},
}: UseDoctorWidgetsOptions) {
  const [layoutOrder, setLayoutOrder] = useState<WidgetKey[]>(
    normalizeWidgetOrder(
      initialLayoutOrder ?? defaultWidgetOrder,
      defaultWidgetOrder
    )
  );

  const [hiddenWidgetKeys, setHiddenWidgetKeys] =
    useState<WidgetKey[]>(initialHiddenWidgetKeys);

  const [quickAccessItems, setQuickAccessItems] =
    useState<QuickAccessItem[]>(
      normalizeQuickAccessItems(
        initialQuickAccessItems,
        widgetCatalog
      )
    );

  const [widgetSizes, setWidgetSizes] =
    useState<Partial<Record<WidgetKey, WidgetSize>>>(
      initialWidgetSizes
    );

  const [layoutEditMode, setLayoutEditMode] =
    useState(false);

  const visibleWidgetKeys = useMemo(
    () =>
      getVisibleWidgetKeys(
        layoutOrder,
        hiddenWidgetKeys,
        widgetCatalog
      ),
    [layoutOrder, hiddenWidgetKeys, widgetCatalog]
  );

  const addableWidgetKeys = useMemo(
    () =>
      getAddableWidgetKeys(
        defaultWidgetOrder,
        hiddenWidgetKeys
      ),
    [defaultWidgetOrder, hiddenWidgetKeys]
  );

  const addWidget = useCallback(
    (widgetKey: WidgetKey) => {
      if (!widgetCatalog[widgetKey]) {
        return;
      }

      setHiddenWidgetKeys((current) =>
        current.filter((key) => key !== widgetKey)
      );

      setLayoutOrder((current) => {
        const next = current.filter(
          (key) => key !== widgetKey
        );

        next.push(widgetKey);

        return next;
      });
    },
    [widgetCatalog]
  );

  const removeWidget = useCallback(
    (widgetKey: WidgetKey) => {
      if (visibleWidgetKeys.length <= 1) {
        return false;
      }

      setHiddenWidgetKeys((current) =>
        Array.from(new Set([...current, widgetKey]))
      );

      setQuickAccessItems((current) =>
        current.filter(
          (item) =>
            !(
              item.type === "widget" &&
              item.target === widgetKey
            )
        )
      );

      return true;
    },
    [visibleWidgetKeys.length]
  );

  const moveWidget = useCallback(
    (
      widgetKey: WidgetKey,
      beforeKey: WidgetKey | null
    ) => {
      setLayoutOrder((current) =>
        moveWidgetBefore(
          current,
          widgetKey,
          beforeKey
        )
      );
    },
    []
  );

  const updateWidgetSize = useCallback(
    (widgetKey: WidgetKey, size: WidgetSize) => {
      setWidgetSizes((current) => ({
        ...current,
        [widgetKey]: size,
      }));
    },
    []
  );

  const addQuickAccess = useCallback(
    (item: QuickAccessItem) => {
      setQuickAccessItems((current) =>
        normalizeQuickAccessItems(
          [...current, item],
          widgetCatalog
        )
      );
    },
    [widgetCatalog]
  );

  const removeQuickAccess = useCallback(
    (id: string) => {
      setQuickAccessItems((current) =>
        current.filter((item) => item.id !== id)
      );
    },
    []
  );

  return {
    layoutOrder,
    hiddenWidgetKeys,
    quickAccessItems,
    widgetSizes,
    layoutEditMode,

    visibleWidgetKeys,
    addableWidgetKeys,

    setLayoutOrder,
    setHiddenWidgetKeys,
    setQuickAccessItems,
    setWidgetSizes,

    setLayoutEditMode,

    addWidget,
    removeWidget,
    moveWidget,
    updateWidgetSize,

    addQuickAccess,
    removeQuickAccess,
  };
}