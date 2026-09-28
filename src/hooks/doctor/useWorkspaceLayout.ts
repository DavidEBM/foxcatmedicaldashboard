"use client";

import {
  useCallback,
  useMemo,
  useState,
} from "react";

import type {
  WorkspaceStyle,
  WorkspaceWidgetId,
  WorkspaceWidgetLayout,
} from "@/types/doctor-workspace";

import { calculateWorkspaceLayout } from "@/components/doctor/layout/calculateWorkspaceLayout";
import { GENERIC_WIDGET_SIZE, WIDGET_SIZE_CONFIG, getWidgetSizeConfig } from "@/components/doctor/layout/widgetSizing";
import type { ResizeDirection } from "./useWorkspacePointer";

/* =========================================================
   TYPES
========================================================= */

interface UseWorkspaceLayoutOptions {
  initialLayouts: WorkspaceWidgetLayout[];
  initialStyle?: Partial<WorkspaceStyle>;
}

interface ResponsiveWidgetMinimum {
  width: number;
  height: number;
}

type DefaultWidgetDimensions = typeof GENERIC_WIDGET_SIZE;

interface ResolvedWidgetConstraints {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}

/* =========================================================
   DEFAULT STYLE
========================================================= */

const DEFAULT_WORKSPACE_STYLE: WorkspaceStyle = {
  columns: 3,

  gap: 20,

  rowGap: 20,

  horizontalPadding: 12,

  verticalPadding: 12,

  widgetMinWidth: 300,

  widgetMinHeight: 220,

  widgetRadius: 16,
};

const INITIAL_CONTAINER_WIDTH = 1200;

/* =========================================================
   RESPONSIVE MINIMUMS
========================================================= */

/*
 * Estos valores NO representan el tamaño inicial.
 *
 * Representan el tamaño mínimo que un usuario puede
 * alcanzar mediante resize.
 *
 * PC:
 *   mínimo global = 320 × 220
 *
 * Tablet:
 *   mínimo global = 280 × 200
 *
 * Celular:
 *   mínimo global = 240 × 180
 *
 * El mínimo real de cada widget será:
 *
 *   max(
 *     mínimo responsive,
 *     mínimo específico del widget
 *   )
 */

const RESPONSIVE_WIDGET_MINIMUMS = {
  desktop: {
    width: 1,
    height: 1,
  },

  tablet: {
    width: 280,
    height: 200,
  },

  mobile: {
    width: 240,
    height: 180,
  },
} satisfies Record<
  "desktop" | "tablet" | "mobile",
  ResponsiveWidgetMinimum
>;

/*
 * Breakpoints utilizados solamente para decidir
 * el mínimo permitido.
 *
 * No controlan directamente el tamaño del widget.
 */
const TABLET_BREAKPOINT = 1024;
const MOBILE_BREAKPOINT = 600;

/* =========================================================
   DEFAULT WIDGET DIMENSIONS
========================================================= */

const DEFAULT_WIDGET_DIMENSIONS: Record<string, DefaultWidgetDimensions> = {
  ...WIDGET_SIZE_CONFIG,
  __generic__: GENERIC_WIDGET_SIZE,
  /*
   * Información básica del paciente.
   */
  "patient-summary": {
    width: 360,
    height: 300,

    minWidth: 300,
    maxWidth: 700,

    minHeight: 240,
    maxHeight: 700,
  },

  /*
   * Indicadores de riesgo.
   */
  risk: {
    width: 320,
    height: 280,

    minWidth: 280,
    maxWidth: 600,

    minHeight: 220,
    maxHeight: 600,
  },

  /*
   * Signos vitales.
   */
  vitals: {
    width: 520,
    height: 320,

    minWidth: 360,
    maxWidth: 900,

    minHeight: 260,
    maxHeight: 700,
  },

  /*
   * Evaluación clínica.
   */
  assessment: {
    width: 520,
    height: 360,

    minWidth: 360,
    maxWidth: 900,

    minHeight: 280,
    maxHeight: 800,
  },

  /*
   * Recomendaciones.
   */
  recommendations: {
    width: 520,
    height: 360,

    minWidth: 360,
    maxWidth: 900,

    minHeight: 280,
    maxHeight: 900,
  },

  /*
   * Agenda.
   */
  schedule: {
    width: 420,
    height: 340,

    minWidth: 320,
    maxWidth: 800,

    minHeight: 260,
    maxHeight: 800,
  },
};

// La configuración central prevalece sobre cualquier valor histórico del layout.
Object.assign(DEFAULT_WIDGET_DIMENSIONS, WIDGET_SIZE_CONFIG);

/* =========================================================
   GENERIC DEFAULTS
========================================================= */

/* =========================================================
   HELPERS
========================================================= */

function finiteOr(
  value: number | undefined,
  fallback: number
): number {
  return Number.isFinite(value)
    ? Number(value)
    : fallback;
}

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}


/* =========================================================
   RESPONSIVE MINIMUM
========================================================= */

function getResponsiveWidgetMinimum(
  containerWidth: number
): ResponsiveWidgetMinimum {
  const width =
    finiteOr(
      containerWidth,
      INITIAL_CONTAINER_WIDTH
    );

  /*
   * CELULAR
   */
  if (
    width <= MOBILE_BREAKPOINT
  ) {
    return {
      ...RESPONSIVE_WIDGET_MINIMUMS.mobile,
    };
  }

  /*
   * TABLET
   */
  if (
    width <= TABLET_BREAKPOINT
  ) {
    return {
      ...RESPONSIVE_WIDGET_MINIMUMS.tablet,
    };
  }

  /*
   * PC
   */
  return {
    ...RESPONSIVE_WIDGET_MINIMUMS.desktop,
  };
}

/* =========================================================
   NORMALIZE ORDERS
========================================================= */

function normalizeOrders(
  layouts: WorkspaceWidgetLayout[]
): WorkspaceWidgetLayout[] {
  return [...layouts]
    .sort(
      (a, b) =>
        finiteOr(a.order, 0) -
        finiteOr(b.order, 0)
    )
    .map(
      (
        layout,
        index
      ) => ({
        ...layout,
        order: index,
      })
    );
}

/* =========================================================
   RESOLVE DEFAULT DIMENSIONS
========================================================= */

function getDefaultDimensions(
  id: WorkspaceWidgetId
): DefaultWidgetDimensions {
  return getWidgetSizeConfig(id);
}

/* =========================================================
   RESOLVE CONSTRAINTS
========================================================= */

function resolveConstraints(
  layout: WorkspaceWidgetLayout,
  defaults: DefaultWidgetDimensions,
  containerWidth: number
): ResolvedWidgetConstraints {
  const responsiveMinimum =
    getResponsiveWidgetMinimum(
      containerWidth
    );

  /*
   * El mínimo efectivo es el mayor entre:
   *
   * 1. mínimo del dispositivo
   * 2. mínimo específico del widget
   * 3. mínimo configurado explícitamente
   */
  const minWidth =
    Math.max(
      1,

      responsiveMinimum.width,
      defaults.minWidth
    );

  const minHeight =
    Math.max(
      1,

      responsiveMinimum.height,
      defaults.minHeight
    );

  /*
   * Los máximos siempre deben quedar por
   * encima de los mínimos efectivos.
   */
  const maxWidth =
    Math.max(
      minWidth,

      defaults.maxWidth
    );

  const maxHeight =
    Math.max(
      minHeight,

      defaults.maxHeight
    );

  return {
    minWidth,

    maxWidth,

    minHeight,

    maxHeight,
  };
}

/* =========================================================
   APPLY DEFAULT DIMENSIONS
========================================================= */

function applyDefaultWidgetDimensions(
  layouts: WorkspaceWidgetLayout[],
  containerWidth: number
): WorkspaceWidgetLayout[] {
  return layouts.map(
    (layout) => {
      const defaults =
        getDefaultDimensions(
          layout.id
        );

      const constraints =
        resolveConstraints(
          layout,
          defaults,
          containerWidth
        );

      const existingWidth =
        finiteOr(
          layout.width,
          0
        );

      const existingHeight =
        finiteOr(
          layout.height,
          0
        );

      /*
       * Si el tamaño existente está por debajo
       * del mínimo permitido, se considera inválido
       * para un nuevo/recuperado layout.
       *
       * En ese caso utilizamos el tamaño inicial
       * específico del widget.
       */
      const width =
        existingWidth >=
        constraints.minWidth
          ? existingWidth
          : defaults.width;

      const height =
        existingHeight >=
        constraints.minHeight
          ? existingHeight
          : defaults.height;

      /*
       * El tamaño inicial específico también
       * debe respetar los límites.
       */
      const safeWidth =
        Math.min(
          constraints.maxWidth,

          Math.max(
            constraints.minWidth,
            width
          )
        );

      const safeHeight =
        Math.min(
          constraints.maxHeight,

          Math.max(
            constraints.minHeight,
            height
          )
        );

      return {
        ...layout,

        width:
          Math.round(
            safeWidth
          ),

        height:
          Math.round(
            safeHeight
          ),

        constraints: {
          ...layout.constraints,
          minWidth: constraints.minWidth,
          maxWidth: constraints.maxWidth,
          minHeight: constraints.minHeight,
          maxHeight: constraints.maxHeight,
        },
      };
    }
  );
}

/* =========================================================
   CALCULATE REFLOW
========================================================= */

function calculateReflowedLayouts(
  layouts: WorkspaceWidgetLayout[],
  style: WorkspaceStyle,
  containerWidth: number
): WorkspaceWidgetLayout[] {
  if (
    !Number.isFinite(
      containerWidth
    ) ||
    containerWidth <= 0
  ) {
    return layouts;
  }

  /*
   * IMPORTANTE:
   *
   * Antes del reflow normalizamos las constraints
   * para que calculateWorkspaceLayout también conozca
   * los mínimos responsive.
   */
  const layoutsWithConstraints =
    applyDefaultWidgetDimensions(
      layouts,
      containerWidth
    );

  return calculateWorkspaceLayout({
    layouts:
      normalizeOrders(
        layoutsWithConstraints
      ),

    style,

    containerWidth,
  });
}

/* =========================================================
   CLAMP SIZE
========================================================= */

function clampLayoutSize(
  layout: WorkspaceWidgetLayout,
  width: number,
  height: number,
  style: WorkspaceStyle,
  containerWidth: number
): {
  width: number;
  height: number;
} {
  const responsiveMinimum =
    getResponsiveWidgetMinimum(
      containerWidth
    );

  const constraints =
    layout.constraints;

  /*
   * El mínimo efectivo durante RESIZE.
   *
   * Nunca permitimos que el usuario reduzca
   * el widget por debajo del mínimo responsive
   * ni del mínimo específico del widget.
   */
  const minWidth =
    Math.max(
      1,

      responsiveMinimum.width,

      constraints?.minWidth ??
        style.widgetMinWidth
    );

  const minHeight =
    Math.max(
      1,

      responsiveMinimum.height,

      constraints?.minHeight ??
        style.widgetMinHeight
    );

  const maxWidth =
    Math.max(
      minWidth,

      constraints?.maxWidth ??
        Number.POSITIVE_INFINITY
    );

  const maxHeight =
    Math.max(
      minHeight,

      constraints?.maxHeight ??
        Number.POSITIVE_INFINITY
    );

  /*
   * x ya es una coordenada absoluta dentro
   * del canvas.
   *
   * No debemos volver a sumar/restar
   * horizontalPadding incorrectamente.
   */
  const currentX =
    Math.max(
      0,
      finiteOr(
        layout.x,
        0
      )
    );

  const horizontalPadding =
    Math.max(
      0,
      finiteOr(
        style.horizontalPadding,
        0
      )
    );

  /*
   * Ancho máximo físicamente disponible.
   */
  const availableWidth =
    Math.max(
      1,
      containerWidth -
        currentX -
        horizontalPadding
    );

  const effectiveMaxWidth =
    Math.min(
      maxWidth,
      availableWidth
    );

  /*
   * Si el canvas es más pequeño que el mínimo
   * responsive, permitimos el ancho físico
   * disponible en lugar de producir overflow.
   */
  const effectiveMinWidth =
    Math.min(
      minWidth,
      effectiveMaxWidth
    );

  const safeWidth =
    clamp(
      width,
      effectiveMinWidth,
      effectiveMaxWidth
    );

  const safeHeight =
    clamp(
      height,
      minHeight,
      maxHeight
    );

  return {
    width:
      Math.round(
        safeWidth
      ),

    height:
      Math.round(
        safeHeight
      ),
  };
}

/* =========================================================
   HOOK
========================================================= */

export function useWorkspaceLayout({
  initialLayouts,
  initialStyle,
}: UseWorkspaceLayoutOptions) {
  /* =======================================================
     STYLE
  ======================================================= */

  const [
    style,
    setStyle,
  ] = useState<WorkspaceStyle>(
    () => ({
      ...DEFAULT_WORKSPACE_STYLE,
      ...initialStyle,
    })
  );

  /* =======================================================
     CONTAINER WIDTH
  ======================================================= */

  const [
    containerWidth,
    setContainerWidthState,
  ] = useState(
    INITIAL_CONTAINER_WIDTH
  );

  /* =======================================================
     INITIAL LAYOUTS
  ======================================================= */

  const [
    layouts,
    setLayouts,
  ] = useState<
    WorkspaceWidgetLayout[]
  >(() => {
    const resolvedStyle: WorkspaceStyle =
      {
        ...DEFAULT_WORKSPACE_STYLE,
        ...initialStyle,
      };

    /*
     * Primero:
     *
     * - tamaño inicial
     * - mínimos responsive
     * - constraints
     *
     * Después:
     *
     * - posición
     * - distribución
     */
    const initialized =
      applyDefaultWidgetDimensions(
        initialLayouts,
        INITIAL_CONTAINER_WIDTH
      );

    return calculateReflowedLayouts(
      initialized,
      resolvedStyle,
      INITIAL_CONTAINER_WIDTH
    );
  });

  /* =======================================================
     SET CONTAINER WIDTH
  ======================================================= */

  const setContainerWidth =
    useCallback(
      (width: number) => {
        if (
          !Number.isFinite(
            width
          ) ||
          width <= 0
        ) {
          return;
        }

        const normalizedWidth =
          Math.round(width);

        setContainerWidthState(
          (currentWidth) =>
            currentWidth ===
            normalizedWidth
              ? currentWidth
              : normalizedWidth
        );

        /*
         * El cambio de viewport sí requiere
         * recalcular la distribución.
         *
         * El tamaño actual se conserva siempre
         * que siga siendo válido.
         */
        setLayouts(
          (currentLayouts) =>
            calculateReflowedLayouts(
              currentLayouts,
              style,
              normalizedWidth
            )
        );
      },
      [style]
    );

  /* =======================================================
     VISIBLE
  ======================================================= */

  const visibleLayouts =
    useMemo(
      () =>
        layouts
          .filter(
            (layout) =>
              layout.visible
          )
          .sort(
            (a, b) =>
              finiteOr(
                a.order,
                0
              ) -
              finiteOr(
                b.order,
                0
              )
          ),
      [layouts]
    );

  /* =======================================================
     ORDERED
  ======================================================= */

  const orderedLayouts =
    useMemo(
      () =>
        [...layouts].sort(
          (a, b) =>
            finiteOr(
              a.order,
              0
            ) -
            finiteOr(
              b.order,
              0
            )
        ),
      [layouts]
    );

  /* =======================================================
     UPDATE LAYOUT
  ======================================================= */

  const updateLayout =
    useCallback(
      (
        id: WorkspaceWidgetId,
        changes: Partial<WorkspaceWidgetLayout>
      ) => {
        setLayouts(
          (current) =>
            current.map(
              (layout) =>
                layout.id === id
                  ? {
                      ...layout,
                      ...changes,
                    }
                  : layout
            )
        );
      },
      []
    );

  /* =======================================================
     TOGGLE
  ======================================================= */

  const toggleWidget =
    useCallback(
      (
        id: WorkspaceWidgetId
      ) => {
        setLayouts(
          (current) => {
            const updated =
              current.map(
                (layout) =>
                  layout.id === id
                    ? {
                        ...layout,
                        visible:
                          !layout.visible,
                      }
                    : layout
              );

            return calculateReflowedLayouts(
              updated,
              style,
              containerWidth
            );
          }
        );
      },
      [
        style,
        containerWidth,
      ]
    );

  /* =======================================================
     SHOW
  ======================================================= */

  const showWidget =
    useCallback(
      (
        id: WorkspaceWidgetId
      ) => {
        setLayouts(
          (current) => {
            const updated =
              current.map(
                (layout) =>
                  layout.id === id
                    ? {
                        ...layout,
                        visible: true,
                      }
                    : layout
              );

            return calculateReflowedLayouts(
              updated,
              style,
              containerWidth
            );
          }
        );
      },
      [
        style,
        containerWidth,
      ]
    );

  /* =======================================================
     HIDE
  ======================================================= */

  const hideWidget =
    useCallback(
      (
        id: WorkspaceWidgetId
      ) => {
        setLayouts(
          (current) => {
            const updated =
              current.map(
                (layout) =>
                  layout.id === id
                    ? {
                        ...layout,
                        visible: false,
                      }
                    : layout
              );

            return calculateReflowedLayouts(
              updated,
              style,
              containerWidth
            );
          }
        );
      },
      [
        style,
        containerWidth,
      ]
    );

  /* =======================================================
     MOVE FIRST
  ======================================================= */

  const moveWidgetToFirst =
    useCallback(
      (
        id: WorkspaceWidgetId
      ) => {
        setLayouts(
          (current) => {
            const ordered =
              normalizeOrders(
                current
              );

            const target =
              ordered.find(
                (layout) =>
                  layout.id === id
              );

            if (!target) {
              return current;
            }

            const remaining =
              ordered.filter(
                (layout) =>
                  layout.id !== id
              );

            return calculateReflowedLayouts(
              [
                target,
                ...remaining,
              ],
              style,
              containerWidth
            );
          }
        );
      },
      [
        style,
        containerWidth,
      ]
    );

  /* =======================================================
     MOVE LAST
  ======================================================= */

  const moveWidgetToLast =
    useCallback(
      (
        id: WorkspaceWidgetId
      ) => {
        setLayouts(
          (current) => {
            const ordered =
              normalizeOrders(
                current
              );

            const target =
              ordered.find(
                (layout) =>
                  layout.id === id
              );

            if (!target) {
              return current;
            }

            const remaining =
              ordered.filter(
                (layout) =>
                  layout.id !== id
              );

            return calculateReflowedLayouts(
              [
                ...remaining,
                target,
              ],
              style,
              containerWidth
            );
          }
        );
      },
      [
        style,
        containerWidth,
      ]
    );

  /* =======================================================
     UPDATE POSITION
  ======================================================= */

  const updatePosition =
    useCallback(
      (
        id: WorkspaceWidgetId,
        x: number,
        y: number
      ) => {
        updateLayout(
          id,
          {
            x: Math.max(
              0,
              finiteOr(
                x,
                0
              )
            ),

            y: Math.max(
              0,
              finiteOr(
                y,
                0
              )
            ),
          }
        );
      },
      [updateLayout]
    );

  /* =======================================================
     UPDATE SIZE
  ======================================================= */

  const updateSize =
    useCallback(
      (
        id: WorkspaceWidgetId,
        width: number,
        height: number,
        direction: ResizeDirection = "se"
      ) => {
        if (
          !Number.isFinite(
            width
          ) ||
          !Number.isFinite(
            height
          )
        ) {
          return;
        }

        setLayouts((current) => {
          const next = current.map((layout) => {
            if (layout.id !== id) return layout;
            const safeSize = clampLayoutSize(layout, width, height, style, containerWidth);
            return { ...layout, width: safeSize.width, height: safeSize.height };
          });

          const resized = next.find((layout) => layout.id === id);
          if (!resized) return next;

          const verticalPadding = Math.max(0, finiteOr(style.verticalPadding, 0));
          const horizontalPadding = Math.max(0, finiteOr(style.horizontalPadding, 0));
          const gap = 16;
          const growsEast = direction.includes("e");
          const growsWest = direction.includes("w");
          const growsSouth = direction.includes("s");
          const growsNorth = direction.includes("n");

          const intersects = (a: typeof resized, b: typeof resized) =>
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y;

          const visible = next
            .filter((layout) => layout.visible !== false)
            .sort((a, b) => a.order - b.order);

          /* Empuja los widgets que invaden el nuevo rectángulo del ancla. */
          for (const item of visible) {
            if (item.id === id || !intersects(item, resized)) continue;

            if (growsEast) item.x = resized.x + resized.width + gap;
            else if (growsWest) item.x = Math.max(horizontalPadding, resized.x - item.width - gap);
            else if (growsSouth) item.y = resized.y + resized.height + gap;
            else if (growsNorth) item.y = Math.max(verticalPadding, resized.y - item.height - gap);
          }

          /* Compacta el eje de desplazamiento para que al reducir no queden huecos. */
          const movingHorizontally = growsEast || growsWest;
          const movingForward = growsEast || growsSouth;
          const moving = visible
            .filter((layout) => layout.id !== id)
            .sort((a, b) => (movingHorizontally ? a.x - b.x : a.y - b.y) || a.order - b.order);

          for (const item of moving) {
            const blockers = visible.filter((candidate) => {
              if (candidate.id === item.id) return false;
              const sameCrossAxis = movingHorizontally
                ? item.y < candidate.y + candidate.height && item.y + item.height > candidate.y
                : item.x < candidate.x + candidate.width && item.x + item.width > candidate.x;
              const isBefore = movingHorizontally
                ? candidate.x < item.x
                : candidate.y < item.y;
              const isAfter = movingHorizontally
                ? candidate.x > item.x
                : candidate.y > item.y;
              return sameCrossAxis && (movingForward ? isBefore : isAfter);
            });

            if (movingHorizontally) {
              const limit = movingForward
                ? Math.max(...blockers.filter((b) => b.x < item.x).map((b) => b.x + b.width + gap), horizontalPadding)
                : Math.min(...blockers.filter((b) => b.x > item.x).map((b) => b.x - item.width - gap), Number.POSITIVE_INFINITY);
              if (Number.isFinite(limit)) item.x = limit;
            } else {
              const limit = movingForward
                ? Math.max(...blockers.filter((b) => b.y < item.y).map((b) => b.y + b.height + gap), verticalPadding)
                : Math.min(...blockers.filter((b) => b.y > item.y).map((b) => b.y - item.height - gap), Number.POSITIVE_INFINITY);
              if (Number.isFinite(limit)) item.y = limit;
            }
          }

          /* Después de cualquier resize, reconstruir el packing visible
           * evita conservar columnas/filas históricas que ya no existen. */
          return calculateReflowedLayouts(
            next,
            style,
            containerWidth
          );
        });
      },
      [
        containerWidth,
        style,
      ]
    );

  /* =======================================================
     UPDATE STYLE
  ======================================================= */

  const updateStyle =
    useCallback(
      (
        changes: Partial<WorkspaceStyle>
      ) => {
        const nextStyle: WorkspaceStyle =
          {
            ...style,
            ...changes,
          };

        setStyle(
          nextStyle
        );

        /*
         * Cambiar el estilo del workspace
         * sí requiere recalcular la distribución.
         */
        setLayouts(
          (currentLayouts) =>
            calculateReflowedLayouts(
              currentLayouts,
              nextStyle,
              containerWidth
            )
        );
      },
      [
        style,
        containerWidth,
      ]
    );

  /* =======================================================
     RESET LAYOUTS
  ======================================================= */

  const resetLayouts =
    useCallback(
      (
        nextLayouts: WorkspaceWidgetLayout[]
      ) => {
        const initialized =
          applyDefaultWidgetDimensions(
            nextLayouts,
            containerWidth
          );

        setLayouts(
          calculateReflowedLayouts(
            initialized,
            style,
            containerWidth
          )
        );
      },
      [
        style,
        containerWidth,
      ]
    );

  /* =======================================================
     RESET STYLE
  ======================================================= */

  const resetStyle =
    useCallback(() => {
      setStyle(
        DEFAULT_WORKSPACE_STYLE
      );

      setLayouts(
        (current) =>
          calculateReflowedLayouts(
            current,
            DEFAULT_WORKSPACE_STYLE,
            containerWidth
          )
      );
    }, [
      containerWidth,
    ]);

  /* =======================================================
     RESET WORKSPACE
  ======================================================= */

  const resetWorkspace =
    useCallback(
      (
        nextLayouts: WorkspaceWidgetLayout[]
      ) => {
        const initialized =
          applyDefaultWidgetDimensions(
            nextLayouts,
            containerWidth
          );

        setStyle(
          DEFAULT_WORKSPACE_STYLE
        );

        setLayouts(
          calculateReflowedLayouts(
            initialized,
            DEFAULT_WORKSPACE_STYLE,
            containerWidth
          )
        );
      },
      [containerWidth]
    );

  /* =======================================================
     RETURN
  ======================================================= */

  return {
    layouts,

    orderedLayouts,

    visibleLayouts,

    style,

    containerWidth,

    setContainerWidth,

    updateLayout,

    toggleWidget,

    showWidget,

    hideWidget,

    moveWidgetToFirst,

    moveWidgetToLast,

    updatePosition,

    updateSize,

    updateStyle,

    resetLayouts,

    resetStyle,

    resetWorkspace,
  };
}

