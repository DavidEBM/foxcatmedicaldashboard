"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

import type {
  WorkspaceInteractionMode,
  WorkspaceWidgetId,
  WorkspaceWidgetLayout,
  WorkspaceStyle,
} from "@/types/doctor-workspace";

import type { ResizeDirection } from "@/hooks/doctor/useWorkspacePointer";

/* =========================================================
   TYPES
========================================================= */

interface WorkspaceCanvasProps {
  layouts: WorkspaceWidgetLayout[];
  style: WorkspaceStyle;

  onContainerWidthChange?: (
    width: number
  ) => void;

  mode?: WorkspaceInteractionMode;

  activeWidgetId?: WorkspaceWidgetId | null;

  isResizing?: boolean;

  isResizeArmed?: boolean;

  isInteractive?: boolean;

  onWidgetPointerDown?: (
    event: ReactPointerEvent<HTMLElement>,
    widgetId: WorkspaceWidgetId
  ) => void;

  onWidgetPointerUp?: (
    event: ReactPointerEvent<HTMLElement>,
    widgetId: WorkspaceWidgetId
  ) => void;

  onWidgetDoubleClick?: (
    event: ReactMouseEvent<HTMLElement>,
    widgetId: WorkspaceWidgetId
  ) => void;

  onResizePointerDown?: (
    event: ReactPointerEvent<HTMLElement>,
    widgetId: WorkspaceWidgetId,
    direction?: ResizeDirection
  ) => void;

  onWidgetContextMenu?: (
    event: ReactMouseEvent<HTMLElement>,
    widgetId: WorkspaceWidgetId
  ) => void;

  onWorkspaceContextMenu?: (
    event: ReactMouseEvent<HTMLElement>
  ) => void;

  renderWidget: (
    layout: WorkspaceWidgetLayout,
    resizeState?: {
      isArmed: boolean;
      isResizing: boolean;
      onResizePointerDown?: (
        event: ReactPointerEvent<HTMLElement>,
        widgetId: WorkspaceWidgetId,
        direction: ResizeDirection
      ) => void;
    }
  ) => React.ReactNode;
}

/* =========================================================
   SAFE NUMBER
========================================================= */

function safeNumber(
  value: number,
  fallback: number
): number {
  return Number.isFinite(value)
    ? value
    : fallback;
}

/* =========================================================
   SAFE INTEGER
========================================================= */

function safeInteger(
  value: number,
  fallback: number
): number {
  return Math.max(
    1,
    Math.floor(
      safeNumber(
        value,
        fallback
      )
    )
  );
}

/* =========================================================
   CANVAS HEIGHT
========================================================= */

function getCanvasHeight(
  layouts: WorkspaceWidgetLayout[],
  style: WorkspaceStyle
): number {
  const verticalPadding =
    Math.max(
      0,
      safeNumber(
        style.verticalPadding,
        0
      )
    );

  const minimumHeight =
    Math.max(
      320,
      safeNumber(
        style.widgetMinHeight,
        220
      ) +
        verticalPadding * 2
    );

  if (
    layouts.length === 0
  ) {
    return minimumHeight;
  }

  const maxBottom =
    layouts.reduce(
      (
        currentMax,
        layout
      ) => {
        const y =
          Math.max(
            0,
            safeNumber(
              layout.y,
              verticalPadding
            )
          );

        const height =
          Math.max(
            1,
            safeNumber(
              layout.height,
              style.widgetMinHeight
            )
          );

        return Math.max(
          currentMax,
          y + height
        );
      },
      0
    );

  return Math.max(
    minimumHeight,
    Math.ceil(
      maxBottom +
        verticalPadding
    )
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function WorkspaceCanvas({
  layouts,
  style,
  onContainerWidthChange,
  mode = "default",
  activeWidgetId = null,
  isResizing = false,
  isResizeArmed = false,
  isInteractive = false,
  onWidgetPointerDown,
  onWidgetPointerUp,
  onWidgetDoubleClick,
  onResizePointerDown,
  onWidgetContextMenu,
  onWorkspaceContextMenu,
  renderWidget,
}: WorkspaceCanvasProps) {
  const canvasRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const reportedWidthRef =
    useRef(0);

  const [
    canvasWidth,
    setCanvasWidth,
  ] = useState(0);

  /* =======================================================
     CONTAINER WIDTH
  ======================================================= */

  useEffect(() => {
    const element =
      canvasRef.current;

    if (!element) {
      return;
    }

    const reportWidth = () => {
      const width =
        Math.round(
          element.clientWidth
        );

      if (
        width <= 0
      ) {
        return;
      }

      setCanvasWidth(
        (current) =>
          current === width
            ? current
            : width
      );

      if (
        reportedWidthRef.current !==
        width
      ) {
        reportedWidthRef.current =
          width;

        onContainerWidthChange?.(
          width
        );
      }
    };

    reportWidth();

    if (
      typeof ResizeObserver ===
      "undefined"
    ) {
      window.addEventListener(
        "resize",
        reportWidth
      );

      return () => {
        window.removeEventListener(
          "resize",
          reportWidth
        );
      };
    }

    const observer =
      new ResizeObserver(
        reportWidth
      );

    observer.observe(
      element
    );
    window.addEventListener("resize", reportWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", reportWidth);
    };
  }, [
    onContainerWidthChange,
  ]);

  /* =======================================================
     VISIBLE WIDGETS
  ======================================================= */

  const visibleLayouts =
    layouts
      .filter(
        (layout) =>
          layout.visible
      )
      .sort(
        (a, b) =>
          safeNumber(
            a.order,
            0
          ) -
          safeNumber(
            b.order,
            0
          )
      );

  /* =======================================================
     CONTEXT MENU
  ======================================================= */

  const handleWorkspaceContextMenu = (
    event: ReactMouseEvent<HTMLDivElement>
  ) => {
    if (
      !isInteractive
    ) {
      return;
    }

    const target =
      event.target as HTMLElement;

    /*
     * Si el evento pertenece a un widget,
     * el widget controla su propio menú.
     */
    if (
      target.closest(
        "[data-widget-id]"
      )
    ) {
      return;
    }

    event.preventDefault();

    onWorkspaceContextMenu?.(
      event
    );
  };

  const handleWidgetContextMenu = (
    event: ReactMouseEvent<HTMLElement>,
    widgetId: WorkspaceWidgetId
  ) => {
    if (
      !isInteractive
    ) {
      return;
    }

    event.preventDefault();

    event.stopPropagation();

    onWidgetContextMenu?.(
      event,
      widgetId
    );
  };

  /* =======================================================
     CANVAS HEIGHT
  ======================================================= */

  const canvasHeight =
    getCanvasHeight(
      visibleLayouts,
      style
    );

  /* =======================================================
     CANVAS STYLE
  ======================================================= */

  const horizontalPadding =
    Math.max(
      0,
      safeNumber(
        style.horizontalPadding,
        0
      )
    );

  const verticalPadding =
    Math.max(
      0,
      safeNumber(
        style.verticalPadding,
        0
      )
    );

  const canvasStyle: CSSProperties =
    {
      position:
        "relative",

      width:
        "100%",

      minWidth:
        0,

      minHeight:
        isInteractive
          ? canvasHeight
          : 0,

      boxSizing:
        "border-box",

      padding:
        isInteractive
          ? 0
          : `${verticalPadding}px ${horizontalPadding}px`,

      /*
       * El canvas controla horizontalmente
       * los widgets para evitar invasión
       * visual de otras zonas.
       */
      overflowX:
        isInteractive
          ? "hidden"
          : "auto",

      /*
       * La altura puede crecer con los widgets.
       */
      overflowY:
        "visible",

      isolation:
        "isolate",

      /*
       * Evita que el navegador interprete
       * los gestos como desplazamiento durante
       * una interacción directa.
       */
      touchAction:
        isInteractive
          ? "none"
          : "auto",
    };

  /* =======================================================
     STATIC MODE
  ======================================================= */

  if (
    !isInteractive
  ) {
    const configuredColumns =
      safeInteger(style.columns, 1);
    const configuredGap =
      Math.max(0, safeNumber(style.gap, 0));
    const minimumWidgetWidth =
      Math.max(1, safeNumber(style.widgetMinWidth, 280));
    const availableStaticWidth =
      Math.max(1, canvasWidth - horizontalPadding * 2);
    const columnsByMinimumWidth =
      Math.max(
        1,
        Math.floor(
          (availableStaticWidth + configuredGap) /
            (minimumWidgetWidth + configuredGap)
        )
      );

    canvasStyle.display =
      "grid";

    canvasStyle.gridTemplateColumns =
      `repeat(${Math.min(configuredColumns, columnsByMinimumWidth)}, minmax(${minimumWidgetWidth}px, 1fr))`;

    canvasStyle.gridAutoRows =
      `minmax(${Math.max(1, safeNumber(style.widgetMinHeight, 180))}px, auto)`;

    canvasStyle.columnGap =
      configuredGap;

    canvasStyle.rowGap =
      Math.max(
        0,
        safeNumber(
          style.rowGap,
          0
        )
      );

    canvasStyle.touchAction =
      "auto";
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div
      ref={canvasRef}
      className={[
        "workspace-canvas",

        isInteractive
          ? "workspace-canvas-interactive"
          : "workspace-canvas-static",

        isResizing
          ? "is-resizing"
          : "",

        isResizeArmed
          ? "is-resize-armed"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}

      style={
        canvasStyle
      }

      onContextMenu={
        handleWorkspaceContextMenu
      }

      data-workspace-canvas="true"

      data-canvas-width={
        canvasWidth
      }

      data-workspace-mode={
        mode
      }

      data-active-widget-id={
        activeWidgetId ??
        undefined
      }
    >
      {visibleLayouts.map(
        (layout) => {
          /* =================================================
             DIMENSIONS
          ================================================= */

          const width =
            Math.max(
              1,
              safeNumber(
                layout.width,
                style.widgetMinWidth
              )
            );

          const height =
            Math.max(
              1,
              safeNumber(
                layout.height,
                style.widgetMinHeight
              )
            );

          /*
           * En modo interactivo, x/y son coordenadas
           * absolutas dentro del canvas.
           *
           * No volvemos a sumar padding aquí porque
           * calculateWorkspaceLayout() ya trabaja
           * con coordenadas que parten del padding.
           */
          const x =
            Math.max(
              0,
              safeNumber(
                layout.x,
                horizontalPadding
              )
            );

          const y =
            Math.max(
              0,
              safeNumber(
                layout.y,
                verticalPadding
              )
            );

          /* =================================================
             ACTIVE
          ================================================= */

          const isActive =
            activeWidgetId ===
            layout.id;

          const widgetIsResizing =
            isResizing &&
            isActive;

          const widgetIsResizeArmed =
            isResizeArmed &&
            isActive;

          /* =================================================
             WIDGET STYLE
          ================================================= */

          const widgetStyle:
            CSSProperties =
            isInteractive
              ? {
                  position:
                    "absolute",

                  left:
                    x,

                  top:
                    y,

                  width,

                  height,

                  minWidth:
                    0,

                  minHeight:
                    0,

                  maxWidth:
                    "none",

                  maxHeight:
                    "none",

                  margin:
                    0,

                  padding:
                    0,

                  borderRadius:
                    Math.max(
                      0,
                      safeNumber(
                        style.widgetRadius,
                        0
                      )
                    ),

                  boxSizing:
                    "border-box",

                  overflow:
                    "hidden",

                  zIndex:
                    widgetIsResizing
                      ? 100
                      : isActive
                        ? 20
                        : 1,

                  touchAction:
                    "none",

                  userSelect:
                    widgetIsResizing
                      ? "none"
                      : "auto",

                  WebkitUserSelect:
                    widgetIsResizing
                      ? "none"
                      : "auto",
                }
              : {
                  position:
                    "relative",

                  width:
                    "100%",

                  minWidth:
                    0,

                  minHeight:
                    height,

                  margin:
                    0,

                  borderRadius:
                    Math.max(
                      0,
                      safeNumber(
                        style.widgetRadius,
                        0
                      )
                    ),

                  boxSizing:
                    "border-box",

                  overflow:
                    "hidden",

                  gridColumn:
                    "span 1",
                };

          /* =================================================
             WIDGET
          ================================================= */

          return (
            <article
              key={
                layout.id
              }

              data-widget-id={
                layout.id
              }

              data-widget-visible="true"

              data-widget-order={
                layout.order
              }

              data-widget-width={
                width
              }

              data-widget-height={
                height
              }

              className={[
                "workspace-canvas-widget",

                isInteractive
                  ? "is-interactive"
                  : "is-static",

                isActive
                  ? "is-active"
                  : "",

                widgetIsResizing
                  ? "is-resizing"
                  : "",

                widgetIsResizeArmed
                  ? "is-resize-armed"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}

              style={
                widgetStyle
              }

              /* =============================================
                 POINTER DOWN
              ============================================= */

              onPointerDown={(
                event
              ) => {
                /*
                 * Nunca dejamos que el pointerdown
                 * del handle llegue al widget.
                 */
                const target =
                  event.target as HTMLElement;

                if (
                  target.closest(
                    "[data-widget-resize-handle='true']"
                  )
                ) {
                  return;
                }

                onWidgetPointerDown?.(
                  event,
                  layout.id
                );
              }}

              /* =============================================
                 POINTER UP
              ============================================= */

              onPointerUp={(
                event
              ) => {
                onWidgetPointerUp?.(
                  event,
                  layout.id
                );
              }}

              /* =============================================
                 DOUBLE CLICK
              ============================================= */

              onDoubleClick={(
                event
              ) => {
                onWidgetDoubleClick?.(
                  event,
                  layout.id
                );
              }}

              /* =============================================
                 CONTEXT MENU
              ============================================= */

              onContextMenu={(
                event
              ) =>
                handleWidgetContextMenu(
                  event,
                  layout.id
                )
              }
            >
              {/* =============================================
                  CONTENT
              ============================================= */}

              <div
                className="workspace-canvas-widget-content"

                style={{
                  position:
                    "absolute",

                  inset:
                    0,

                  width:
                    "auto",

                  height:
                    "auto",

                  minWidth:
                    0,

                  minHeight:
                    0,

                  maxWidth:
                    "100%",

                  maxHeight:
                    "none",

                  boxSizing:
                    "border-box",

                  overflow:
                    "hidden",

                  touchAction:
                    isInteractive
                      ? "none"
                      : "auto",
                }}
              >
                {renderWidget(
                  layout,
                  {
                    isArmed: widgetIsResizeArmed,
                    isResizing: widgetIsResizing,
                    onResizePointerDown,
                  }
                )}
              </div>

              {/* =============================================
                  RESIZE HANDLE
              ============================================= */}

              {isInteractive &&
                (widgetIsResizeArmed || widgetIsResizing) && (
                ([
                  ["n", "top", "left", "right", "ns-resize"],
                  ["ne", "top", "right", "right", "nesw-resize"],
                  ["e", "right", "top", "bottom", "ew-resize"],
                  ["se", "bottom", "right", "right", "nwse-resize"],
                  ["s", "bottom", "left", "right", "ns-resize"],
                  ["sw", "bottom", "left", "left", "nesw-resize"],
                  ["w", "left", "top", "bottom", "ew-resize"],
                  ["nw", "top", "left", "left", "nwse-resize"],
                ] as const).map(([direction, , , , cursor]) => (
                <button
                  key={direction}
                  type="button"

                  className={[
                    "workspace-widget-resize-handle",

                    widgetIsResizing
                      ? "is-active"
                      : "",

                    widgetIsResizeArmed
                      ? "is-armed"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}

                  data-widget-resize-handle="true"

                  data-widget-id={
                    layout.id
                  }

                  aria-label={`Redimensionar widget ${layout.id} hacia ${direction}`}

                  tabIndex={-1}

                  style={{
                    position:
                      "absolute",

                    top: direction.includes("n") ? 0 : direction.includes("s") ? "auto" : 10,
                    bottom: direction.includes("s") ? 0 : direction.includes("n") ? "auto" : 10,
                    left: direction.includes("w") ? 0 : direction.includes("e") ? "auto" : 10,
                    right: direction.includes("e") ? 0 : direction.includes("w") ? "auto" : 10,
                    width: direction === "n" || direction === "s" ? "calc(100% - 24px)" : direction === "e" || direction === "w" ? 14 : 30,
                    height: direction === "e" || direction === "w" ? "calc(100% - 24px)" : direction === "n" || direction === "s" ? 14 : 30,

                    minWidth:
                      28,

                    minHeight:
                      28,

                    margin:
                      0,

                    padding:
                      0,

                    border:
                      0,

                    background:
                      "transparent",

                    cursor,

                    zIndex:
                      200,

                    touchAction:
                      "none",

                    userSelect:
                      "none",

                    WebkitUserSelect:
                      "none",

                    boxSizing:
                      "border-box",

                    display:
                      "block",

                    pointerEvents:
                      "auto",
                  }}

                  /* =========================================
                     START RESIZE
                  ========================================= */

                  onPointerDown={(
                    event
                  ) => {
                    event.preventDefault();

                    event.stopPropagation();

                    onResizePointerDown?.(
                      event,
                      layout.id,
                      direction
                    );
                  }}

                  /* =========================================
                     CLICK
                  ========================================= */

                  onClick={(
                    event
                  ) => {
                    event.preventDefault();

                    event.stopPropagation();
                  }}

                  /* =========================================
                     DOUBLE CLICK
                  ========================================= */

                  onDoubleClick={(
                    event
                  ) => {
                    event.preventDefault();

                    event.stopPropagation();
                  }}
                >
                  <span
                    aria-hidden="true"

                    style={{
                      position:
                        "absolute",

                      right: direction.includes("e") ? 5 : direction.includes("w") ? "auto" : 5,
                      left: direction.includes("w") ? 5 : "auto",
                      bottom: direction.includes("s") ? 5 : direction.includes("n") ? "auto" : 5,
                      top: direction.includes("n") ? 5 : "auto",

                      width:
                        11,

                      height:
                        11,

                      borderRight: direction.includes("e") ? "2px solid currentColor" : "0",
                      borderLeft: direction.includes("w") ? "2px solid currentColor" : "0",
                      borderBottom: direction.includes("s") ? "2px solid currentColor" : "0",
                      borderTop: direction.includes("n") ? "2px solid currentColor" : "0",

                      opacity:
                        widgetIsResizing
                          ? 0.9
                          : 0.55,

                      pointerEvents:
                        "none",

                      boxSizing:
                        "border-box",
                    }}
                  />
                </button>
                )))}
            </article>
          );
        }
      )}

      {/* ===================================================
          EMPTY STATE
      =================================================== */}

      {visibleLayouts.length ===
        0 && (
        <div
          className="workspace-canvas-empty"

          aria-live="polite"

          style={{
            gridColumn:
              "1 / -1",

            width:
              "100%",

            minWidth:
              0,

            boxSizing:
              "border-box",
          }}
        >
          <strong>
            No hay widgets visibles
          </strong>

          <span>
            Usa el menú de widgets
            para mostrar contenido
            en este espacio.
          </span>
        </div>
      )}
    </div>
  );
}
