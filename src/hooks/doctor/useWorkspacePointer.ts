"use client";

import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  WorkspaceInteractionMode,
  WorkspaceWidgetId,
  WorkspaceWidgetLayout,
  WorkspaceWidgetSize,
  WorkspaceStyle,
} from "@/types/doctor-workspace";

/* =========================================================
   TYPES
========================================================= */

interface PointerPosition {
  x: number;
  y: number;
}

export type ResizeDirection =
  | "n" | "ne" | "e" | "se"
  | "s" | "sw" | "w" | "nw";

interface ResizePosition {
  x: number;
  y: number;
}

interface ResizeSession {
  widgetId: WorkspaceWidgetId;
  pointerId: number;

  startX: number;
  startY: number;

  startWidth: number;
  startHeight: number;
  startLeft: number;
  startTop: number;
  direction: ResizeDirection;

  lastWidth: number;
  lastHeight: number;
  lastLeft: number;
  lastTop: number;
}

interface UseWorkspacePointerOptions {
  enabled?: boolean;

  layouts?: WorkspaceWidgetLayout[];

  style?: WorkspaceStyle;

  onResize?: (
    widgetId: WorkspaceWidgetId,
    size: WorkspaceWidgetSize,
    position: ResizePosition,
    direction: ResizeDirection
  ) => void;

  onResizeStart?: (
    widgetId: WorkspaceWidgetId
  ) => void;

  onResizeArm?: (
    widgetId: WorkspaceWidgetId
  ) => void;

  onResizeEnd?: (
    widgetId: WorkspaceWidgetId
  ) => void;
}

interface UseWorkspacePointerReturn {
  mode: WorkspaceInteractionMode;

  activeWidgetId:
    | WorkspaceWidgetId
    | null;

  pointerPosition:
    | PointerPosition
    | null;

  isResizing: boolean;

  isResizeArmed: boolean;

  handleWidgetPointerDown: (
    event: ReactPointerEvent<HTMLElement>,
    widgetId: WorkspaceWidgetId
  ) => void;

  handleWidgetPointerUp: (
    event: ReactPointerEvent<HTMLElement>,
    widgetId: WorkspaceWidgetId
  ) => void;

  handleWidgetDoubleClick: (
    event: ReactMouseEvent<HTMLElement>,
    widgetId: WorkspaceWidgetId
  ) => void;

  handleResizePointerDown: (
    event: ReactPointerEvent<HTMLElement>,
    widgetId: WorkspaceWidgetId,
    direction?: ResizeDirection
  ) => void;

  armResize: (widgetId: WorkspaceWidgetId) => void;

  startResize: (
    widgetId: WorkspaceWidgetId,
    pointerId?: number
  ) => void;

  stopResize: () => void;

  cancelInteraction: () => void;

  confirmResize: () => void;

  cancelResize: () => void;
}

/* =========================================================
   CONSTANTS
========================================================= */

const POINTER_LISTENER_OPTIONS: AddEventListenerOptions = {
  passive: false,
};

/*
 * Evita renders innecesarios cuando el navegador
 * produce movimientos de menos de 1px.
 */
const RESIZE_EPSILON = 1;

/*
 * Breakpoints sincronizados con useWorkspaceLayout.ts.
 */
const MOBILE_BREAKPOINT = 600;
const TABLET_BREAKPOINT = 1024;

/* =========================================================
   RESPONSIVE MINIMUMS
========================================================= */

function getResponsiveMinimums(): {
  width: number;
  height: number;
} {
  if (
    typeof window === "undefined"
  ) {
    return {
      width: 1,
      height: 1,
    };
  }

  const viewportWidth =
    window.innerWidth;

  /*
   * CELULAR
   */
  if (
    viewportWidth <=
    MOBILE_BREAKPOINT
  ) {
    return {
      width: 240,
      height: 180,
    };
  }

  /*
   * TABLET
   */
  if (
    viewportWidth <=
    TABLET_BREAKPOINT
  ) {
    return {
      width: 280,
      height: 200,
    };
  }

  /*
   * PC
   */
  return {
    width: 1,
    height: 1,
  };
}

/* =========================================================
   NUMERIC HELPERS
========================================================= */

function finiteOr(
  value: number | undefined,
  fallback: number
): number {
  return Number.isFinite(value)
    ? Number(value)
    : fallback;
}

function positiveOr(
  value: number | undefined,
  fallback: number
): number {
  if (
    !Number.isFinite(value) ||
    Number(value) <= 0
  ) {
    return fallback;
  }

  return Number(value);
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
   SIZE CALCULATION
========================================================= */

function calculateSafeWidgetSize(
  layout: WorkspaceWidgetLayout,
  requested: WorkspaceWidgetSize,
  style?: WorkspaceStyle
): WorkspaceWidgetSize {
  const responsive =
    getResponsiveMinimums();

  /*
   * Mínimo específico configurado para el widget.
   */
  const widgetMinWidth =
    finiteOr(
      layout.constraints?.minWidth,
      0
    );

  const widgetMinHeight =
    finiteOr(
      layout.constraints?.minHeight,
      0
    );

  /*
   * El mínimo global del style NO se fuerza
   * por encima del mínimo responsive en dispositivos
   * pequeños.
   *
   * La prioridad es:
   *
   * responsive minimum
   * +
   * widget minimum
   *
   * El style funciona como fallback para widgets
   * que no tienen un mínimo específico.
   */
  const styleMinWidth =
    finiteOr(
      style?.widgetMinWidth,
      0
    );

  const styleMinHeight =
    finiteOr(
      style?.widgetMinHeight,
      0
    );

  /*
   * Para PC mantenemos también el mínimo global
   * del workspace.
   *
   * En tablet/celular no permitimos que el style
   * de 300px impida utilizar el mínimo responsive.
   */
  const isDesktop =
    responsive.width >= 320;

  const requestedMinWidth =
    Math.max(
      1,

      responsive.width,

      widgetMinWidth,

      isDesktop
        ? styleMinWidth
        : 0
    );

  const requestedMinHeight =
    Math.max(
      1,

      responsive.height,

      widgetMinHeight,

      isDesktop
        ? styleMinHeight
        : 0
    );

  /*
   * Máximos específicos.
   */
  const maxWidth =
    Math.max(
      requestedMinWidth,

      positiveOr(
        layout.constraints?.maxWidth,
        Number.POSITIVE_INFINITY
      )
    );

  const maxHeight =
    Math.max(
      requestedMinHeight,

      positiveOr(
        layout.constraints?.maxHeight,
        Number.POSITIVE_INFINITY
      )
    );

  /*
   * Tamaño solicitado.
   */
  const requestedWidth =
    Math.max(
      1,

      finiteOr(
        requested.width,
        layout.width
      )
    );

  const requestedHeight =
    Math.max(
      1,

      finiteOr(
        requested.height,
        layout.height
      )
    );

  /*
   * Clamp final.
   */
  return {
    width: clamp(
      requestedWidth,
      requestedMinWidth,
      maxWidth
    ),

    height: clamp(
      requestedHeight,
      requestedMinHeight,
      maxHeight
    ),
  };
}

/* =========================================================
   HOOK
========================================================= */

export function useWorkspacePointer({
  enabled = true,
  layouts = [],
  style,
  onResize,
  onResizeStart,
  onResizeEnd,
  onResizeArm,
}: UseWorkspacePointerOptions = {}): UseWorkspacePointerReturn {
  /* =======================================================
     STATE
  ======================================================= */

  const [
    mode,
    setMode,
  ] =
    useState<WorkspaceInteractionMode>(
      "default"
    );

  const [
    activeWidgetId,
    setActiveWidgetId,
  ] =
    useState<WorkspaceWidgetId | null>(
      null
    );

  const [
    pointerPosition,
    setPointerPosition,
  ] =
    useState<PointerPosition | null>(
      null
    );

  const [
    isResizing,
    setIsResizing,
  ] =
    useState(false);

  const [
    isResizeArmed,
    setIsResizeArmed,
  ] = useState(false);

  /* =======================================================
     REFS
  ======================================================= */

  const resizeSessionRef =
    useRef<ResizeSession | null>(
      null
    );

  const activeWidgetIdRef =
    useRef<WorkspaceWidgetId | null>(
      null
    );

  const resizeHandleRef =
    useRef<HTMLElement | null>(
      null
    );

  const resizeEndNotifiedRef =
    useRef(false);

  const resizeArmedWidgetIdRef =
    useRef<WorkspaceWidgetId | null>(null);

  const layoutsRef =
    useRef<WorkspaceWidgetLayout[]>(
      layouts
    );

  const styleRef =
    useRef<WorkspaceStyle | undefined>(
      style
    );

  const enabledRef =
    useRef(enabled);

  const onResizeRef =
    useRef(onResize);

  const onResizeStartRef =
    useRef(onResizeStart);

  const onResizeArmRef =
    useRef(onResizeArm);

  const onResizeEndRef =
    useRef(onResizeEnd);

  /*
   * Mantener siempre las referencias actualizadas.
   */
  useEffect(() => {
    layoutsRef.current =
      layouts;
  }, [layouts]);

  useEffect(() => {
    styleRef.current =
      style;
  }, [style]);

  useEffect(() => {
    enabledRef.current =
      enabled;
  }, [enabled]);

  useEffect(() => {
    onResizeRef.current =
      onResize;
  }, [onResize]);

  useEffect(() => {
    onResizeStartRef.current =
      onResizeStart;
  }, [onResizeStart]);

  useEffect(() => {
    onResizeArmRef.current = onResizeArm;
  }, [onResizeArm]);

  useEffect(() => {
    onResizeEndRef.current =
      onResizeEnd;
  }, [onResizeEnd]);

  /* =======================================================
     FINISH RESIZE
  ======================================================= */

  const finishResize =
    useCallback(() => {
      const session =
        resizeSessionRef.current;

      /*
       * No hay resize activo.
       */
      if (!session) {
        setIsResizing(false);
        setMode("default");
        return;
      }

      /*
       * Notificar exactamente una vez.
       */
      if (
        !resizeEndNotifiedRef.current
      ) {
        resizeEndNotifiedRef.current =
          true;

        onResizeEndRef.current?.(
          session.widgetId
        );
      }

      /*
       * Liberar pointer capture.
       */
      const resizeHandle =
        resizeHandleRef.current;

      if (
        resizeHandle &&
        typeof resizeHandle.releasePointerCapture ===
          "function"
      ) {
        try {
          if (
            resizeHandle.hasPointerCapture(
              session.pointerId
            )
          ) {
            resizeHandle.releasePointerCapture(
              session.pointerId
            );
          }
        } catch {
          /*
           * Algunos navegadores pueden lanzar
           * una excepción si el pointer ya fue liberado.
           */
        }
      }

      /*
       * Limpiar referencias.
       */
      resizeHandleRef.current =
        null;

      resizeSessionRef.current =
        null;

      activeWidgetIdRef.current =
        null;

      /*
       * Limpiar estado React.
       */
      setIsResizing(false);

      setActiveWidgetId(
        null
      );

      setPointerPosition(
        null
      );

      setMode("default");
    }, []);

  /* =======================================================
     POINTER MOVE
  ======================================================= */

  const handleResizeMove =
    useCallback(
      (event: PointerEvent) => {
        if (
          !enabledRef.current
        ) {
          return;
        }

        const session =
          resizeSessionRef.current;

        if (!session) {
          return;
        }

        /*
         * Ignorar otros pointers.
         */
        if (
          event.pointerId !==
          session.pointerId
        ) {
          return;
        }

        /*
         * Evitar scroll/selección del navegador.
         */
        event.preventDefault();

        const currentLayouts =
          layoutsRef.current;

        const layout =
          currentLayouts.find(
            (item) =>
              item.id ===
              session.widgetId
          );

        if (!layout) {
          finishResize();
          return;
        }

        /*
         * Delta respecto al inicio exacto.
         */
        const deltaX =
          event.clientX -
          session.startX;

        const deltaY =
          event.clientY -
          session.startY;

        /*
         * Nuevo tamaño solicitado.
         */
        const growsLeft = session.direction.includes("w");
        const growsRight = session.direction.includes("e");
        const growsTop = session.direction.includes("n");
        const growsBottom = session.direction.includes("s");

        const requestedSize = {
          width: session.startWidth + (growsRight ? deltaX : growsLeft ? -deltaX : 0),
          height: session.startHeight + (growsBottom ? deltaY : growsTop ? -deltaY : 0),
        };

        /*
         * Aplicar mínimos y máximos.
         */
        const finalSize =
          calculateSafeWidgetSize(
            layout,
            requestedSize,
            styleRef.current
          );

        const finalLeft = growsLeft
          ? session.startLeft + session.startWidth - finalSize.width
          : session.startLeft;
        const finalTop = growsTop
          ? session.startTop + session.startHeight - finalSize.height
          : session.startTop;

        /*
         * Evitar renders cuando el tamaño
         * prácticamente no ha cambiado.
         */
        const widthChanged =
          Math.abs(
            finalSize.width -
              session.lastWidth
          ) >=
          RESIZE_EPSILON;

        const heightChanged =
          Math.abs(
            finalSize.height -
              session.lastHeight
          ) >=
          RESIZE_EPSILON;

        const leftChanged = Math.abs(finalLeft - session.lastLeft) >= RESIZE_EPSILON;
        const topChanged = Math.abs(finalTop - session.lastTop) >= RESIZE_EPSILON;

        /*
         * Siempre actualizamos la posición
         * del puntero, incluso si el tamaño
         * no cambió.
         */
        setPointerPosition({
          x: event.clientX,
          y: event.clientY,
        });

        if (
          !widthChanged &&
          !heightChanged &&
          !leftChanged &&
          !topChanged
        ) {
          return;
        }

        /*
         * Guardar inmediatamente el tamaño
         * aplicado.
         */
        session.lastWidth =
          finalSize.width;

        session.lastHeight =
          finalSize.height;
        session.lastLeft = finalLeft;
        session.lastTop = finalTop;

        /*
         * SOLO width / height.
         *
         * El hook de layout se encarga de no
         * modificar x/y/order/visible.
         */
        onResizeRef.current?.(
          session.widgetId,
          finalSize,
          { x: finalLeft, y: finalTop },
          session.direction
        );
      },
      [finishResize]
    );

  /* =======================================================
     POINTER UP
  ======================================================= */

  const handlePointerUp =
    useCallback(
      (event: PointerEvent) => {
        const session =
          resizeSessionRef.current;

        if (!session) {
          return;
        }

        if (
          event.pointerId !==
          session.pointerId
        ) {
          return;
        }

        event.preventDefault();

        const armedWidgetId = session.widgetId;
        finishResize();

        // Ending the drag does not confirm the edit. Keep the widget armed
        // until the doctor explicitly confirms or cancels it.
        resizeArmedWidgetIdRef.current = armedWidgetId;
        activeWidgetIdRef.current = armedWidgetId;
        setActiveWidgetId(armedWidgetId);
        setMode("resize");
      },
      [finishResize]
    );

  /* =======================================================
     POINTER CANCEL
  ======================================================= */

  const handlePointerCancel =
    useCallback(
      (event: PointerEvent) => {
        const session =
          resizeSessionRef.current;

        if (!session) {
          return;
        }

        if (
          event.pointerId !==
          session.pointerId
        ) {
          return;
        }

        finishResize();
      },
      [finishResize]
    );

  /* =======================================================
     KEYBOARD ESCAPE
  ======================================================= */

  const handleKeyDown =
    useCallback(
      (event: KeyboardEvent) => {
        if (
          event.key !== "Escape"
        ) {
          return;
        }

        if (
          !resizeSessionRef.current
        ) {
          return;
        }

        event.preventDefault();

        finishResize();
      },
      [finishResize]
    );

  /* =======================================================
     GLOBAL POINTER LISTENERS
  ======================================================= */

  useEffect(() => {
    if (
      !enabled ||
      !isResizing
    ) {
      return;
    }

    window.addEventListener(
      "pointermove",
      handleResizeMove,
      POINTER_LISTENER_OPTIONS
    );

    window.addEventListener(
      "pointerup",
      handlePointerUp,
      POINTER_LISTENER_OPTIONS
    );

    window.addEventListener(
      "pointercancel",
      handlePointerCancel,
      POINTER_LISTENER_OPTIONS
    );

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "pointermove",
        handleResizeMove,
        POINTER_LISTENER_OPTIONS
      );

      window.removeEventListener(
        "pointerup",
        handlePointerUp,
        POINTER_LISTENER_OPTIONS
      );

      window.removeEventListener(
        "pointercancel",
        handlePointerCancel,
        POINTER_LISTENER_OPTIONS
      );

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    enabled,
    isResizing,
    handleResizeMove,
    handlePointerUp,
    handlePointerCancel,
    handleKeyDown,
  ]);

  /* Keep the visual pointer aligned with the real mouse while the
   * interactive workspace is active. Resize-only tracking made the
   * cursor appear to jump or disappear after the first interaction. */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      setPointerPosition({
        x: event.clientX,
        y: event.clientY,
      });
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [enabled]);

  /* =======================================================
     WIDGET POINTER DOWN
  ======================================================= */

  const handleWidgetPointerDown =
    useCallback(
      (
        event: ReactPointerEvent<HTMLElement>,
        widgetId: WorkspaceWidgetId
      ) => {
        if (
          !enabledRef.current
        ) {
          return;
        }

        /*
         * No seleccionar con botón derecho,
         * botón central, etc.
         */
        if (
          event.pointerType ===
            "mouse" &&
          event.button !== 0
        ) {
          return;
        }

        /*
         * Si el evento procede del resize handle,
         * no hacemos nada aquí.
         *
         * El handle tiene su propio handler.
         */
        const target =
          event.target as HTMLElement | null;

        if (
          target?.closest(
            ".workspace-widget-resize-handle"
          )
        ) {
          return;
        }

        activeWidgetIdRef.current =
          widgetId;

        setActiveWidgetId(
          widgetId
        );

        setPointerPosition({
          x: event.clientX,
          y: event.clientY,
        });
      },
      []
    );

  /* =======================================================
     WIDGET POINTER UP
  ======================================================= */

  const handleWidgetPointerUp =
    useCallback(
      (
        _event: ReactPointerEvent<HTMLElement>,
        _widgetId: WorkspaceWidgetId
      ) => {
        /*
         * No finalizamos el resize desde aquí.
         *
         * El resize se controla exclusivamente
         * mediante la sesión global.
         */
      },
      []
    );

  /* =======================================================
     DOUBLE CLICK
  ======================================================= */

  const handleWidgetDoubleClick =
    useCallback(
      (
        event: ReactMouseEvent<HTMLElement>,
        widgetId: WorkspaceWidgetId
      ) => {
        if (
          !enabledRef.current
        ) {
          return;
        }

        if (
          event.button !== 0
        ) {
          return;
        }

        /*
         * Nunca iniciar resize mediante
         * doble click.
         */
        event.preventDefault();
        event.stopPropagation();

        /*
         * Si estamos redimensionando,
         * ignoramos el doble click.
         */
        if (
          resizeSessionRef.current
        ) {
          return;
        }

        const layout =
          layoutsRef.current.find(
            (item) =>
              item.id ===
              widgetId
          );

        if (!layout) {
          return;
        }

        activeWidgetIdRef.current =
          widgetId;

        setActiveWidgetId(
          widgetId
        );

        setPointerPosition({
          x: event.clientX,
          y: event.clientY,
        });

        setMode("default");

        /*
         * Restaurar inmediatamente el modo
         * normal después de la selección.
         */
      },
      []
    );

  const armResize = useCallback(
    (widgetId: WorkspaceWidgetId) => {
      if (!enabledRef.current || !layoutsRef.current.some((item) => item.id === widgetId)) {
        return;
      }

      resizeArmedWidgetIdRef.current = widgetId;
      activeWidgetIdRef.current = widgetId;
      setActiveWidgetId(widgetId);
      setPointerPosition(null);
      setIsResizeArmed(true);
      setMode("resize");
      onResizeArmRef.current?.(widgetId);
    },
    []
  );

  /* =======================================================
     RESIZE HANDLE POINTER DOWN
  ======================================================= */

  const handleResizePointerDown =
    useCallback(
      (
        event: ReactPointerEvent<HTMLElement>,
        widgetId: WorkspaceWidgetId,
        direction: ResizeDirection = "se"
      ) => {
        if (
          !enabledRef.current
        ) {
          return;
        }

        if (resizeArmedWidgetIdRef.current !== widgetId) {
          return;
        }

        /*
         * Solo botón izquierdo en mouse.
         */
        if (
          event.pointerType ===
            "mouse" &&
          event.button !== 0
        ) {
          return;
        }

        /*
         * Detener completamente la propagación.
         *
         * Esto evita:
         * - seleccionar el widget
         * - iniciar drag
         * - abrir context menu
         * - activar doble click accidental
         */
        event.preventDefault();
        event.stopPropagation();

        /*
         * Si existía otra sesión,
         * terminarla primero.
         */
        if (
          resizeSessionRef.current
        ) {
          finishResize();
        }

        const layout =
          layoutsRef.current.find(
            (item) =>
              item.id ===
              widgetId
          );

        if (!layout) {
          return;
        }

        /*
         * Normalizar el tamaño inicial.
         */
        const initialSize =
          calculateSafeWidgetSize(
            layout,
            {
              width:
                layout.width,

              height:
                layout.height,
            },
            styleRef.current
          );

        /*
         * Crear sesión.
         */
        resizeSessionRef.current =
          {
            widgetId,

            pointerId:
              event.pointerId,

            startX:
              event.clientX,

            startY:
              event.clientY,

            startWidth:
              initialSize.width,

            startHeight:
              initialSize.height,

            startLeft: layout.x,

            startTop: layout.y,

            direction,

            lastWidth:
              initialSize.width,

            lastHeight:
              initialSize.height,

            lastLeft: layout.x,

            lastTop: layout.y,
          };

        resizeEndNotifiedRef.current =
          false;

        /*
         * Guardar exactamente el elemento
         * que inició el resize.
         */
        resizeHandleRef.current =
          event.currentTarget;

        activeWidgetIdRef.current =
          widgetId;

        setActiveWidgetId(
          widgetId
        );

        setPointerPosition({
          x: event.clientX,
          y: event.clientY,
        });

        setMode("resize");

        setIsResizing(true);

        onResizeStartRef.current?.(
          widgetId
        );

        /*
         * Captura absoluta del pointer.
         *
         * Esto permite continuar el resize
         * aunque el cursor salga del handle,
         * del widget o incluso de su contenedor.
         */
        try {
          event.currentTarget.setPointerCapture(
            event.pointerId
          );
        } catch {
          /*
           * Fallback silencioso.
           */
        }
      },
      [finishResize]
    );

  /* =======================================================
     PUBLIC START RESIZE
  ======================================================= */

  const startResize =
    useCallback(
      (
        widgetId: WorkspaceWidgetId,
        pointerId?: number
      ) => {
        if (
          !enabledRef.current ||
          pointerId === undefined
        ) {
          return;
        }

        const layout =
          layoutsRef.current.find(
            (item) =>
              item.id ===
              widgetId
          );

        if (!layout) {
          return;
        }

        const position =
          pointerPosition;

        /*
         * No inventar una posición inicial.
         */
        if (!position) {
          return;
        }

        if (
          resizeSessionRef.current
        ) {
          finishResize();
        }

        const initialSize =
          calculateSafeWidgetSize(
            layout,
            {
              width:
                layout.width,

              height:
                layout.height,
            },
            styleRef.current
          );

        resizeSessionRef.current =
          {
            widgetId,

            pointerId,

            startX:
              position.x,

            startY:
              position.y,

            startWidth:
              initialSize.width,

            startHeight:
              initialSize.height,

            startLeft: layout.x,

            startTop: layout.y,

            direction: "se",

            lastWidth:
              initialSize.width,

            lastHeight:
              initialSize.height,

            lastLeft: layout.x,

            lastTop: layout.y,
          };

        resizeEndNotifiedRef.current =
          false;

        activeWidgetIdRef.current =
          widgetId;

        setActiveWidgetId(
          widgetId
        );

        setIsResizing(true);

        setMode("resize");

        onResizeStartRef.current?.(
          widgetId
        );
      },
      [
        finishResize,
        pointerPosition,
      ]
    );

  /* =======================================================
     STOP RESIZE
  ======================================================= */

  const stopResize =
    useCallback(() => {
      finishResize();
    }, [finishResize]);

  /* =======================================================
     CANCEL INTERACTION
  ======================================================= */

  const cancelInteraction =
    useCallback(() => {
      finishResize();
    }, [finishResize]);

  const confirmResize =
    useCallback(() => {
      resizeArmedWidgetIdRef.current = null;
      setIsResizeArmed(false);
      finishResize();
    }, [finishResize]);

  const cancelResize =
    useCallback(() => {
      resizeArmedWidgetIdRef.current = null;
      setIsResizeArmed(false);
      finishResize();
    }, [finishResize]);

/* =======================================================
   DISABLE CLEANUP
======================================================= */

useEffect(() => {
  if (enabled) {
    return;
  }

  /*
   * Si la interacción se deshabilita,
   * únicamente limpiamos las referencias mutables.
   *
   * No hacemos setState() dentro del effect.
   * El return del hook ya expone:
   *
   * - mode = "default"
   * - activeWidgetId = null
   * - pointerPosition = null
   * - isResizing = false
   *
   * cuando enabled === false.
   */
  resizeSessionRef.current =
    null;

  resizeHandleRef.current =
    null;

  activeWidgetIdRef.current =
    null;

  resizeArmedWidgetIdRef.current =
    null;

  resizeEndNotifiedRef.current =
    false;
}, [enabled]);

  /* =======================================================
     UNMOUNT CLEANUP
  ======================================================= */

  useEffect(() => {
    return () => {
      const session =
        resizeSessionRef.current;

      const handle =
        resizeHandleRef.current;

      /*
       * Intentar liberar pointer capture
       * antes de desmontar.
       */
      if (
        session &&
        handle &&
        typeof handle.hasPointerCapture ===
          "function"
      ) {
        try {
          if (
            handle.hasPointerCapture(
              session.pointerId
            )
          ) {
            handle.releasePointerCapture(
              session.pointerId
            );
          }
        } catch {
          /*
           * Ignorar errores de cleanup.
           */
        }
      }

      resizeSessionRef.current =
        null;

      resizeHandleRef.current =
        null;

      activeWidgetIdRef.current =
        null;
    };
  }, []);

  /* =======================================================
     RETURN
  ======================================================= */

  return {
    mode: enabled
      ? mode
      : "default",

    activeWidgetId:
      enabled
        ? activeWidgetId
        : null,

    pointerPosition:
      enabled
        ? pointerPosition
        : null,

    isResizing:
      enabled &&
      isResizing,

    isResizeArmed:
      enabled &&
      isResizeArmed,

    handleWidgetPointerDown,

    handleWidgetPointerUp,

    handleWidgetDoubleClick,

    handleResizePointerDown,

    armResize,

    startResize,

    stopResize,

    cancelInteraction,

    confirmResize,

    cancelResize,
  };
}
