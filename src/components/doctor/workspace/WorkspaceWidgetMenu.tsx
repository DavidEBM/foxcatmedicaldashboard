"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  PointerEvent,
} from "react";

export interface WorkspaceWidgetMenuItem {
  id: string;
  title: string;
  shortTitle: string;
  icon: string;
}

export interface WorkspaceWidgetMenuLayout {
  id: string;
  visible: boolean;
}

interface WorkspaceWidgetMenuProps {
  widgets: WorkspaceWidgetMenuItem[];
  layouts: WorkspaceWidgetMenuLayout[];
  onToggleWidget: (id: string) => void;
  onRequestClose?: () => void;
}

const DRAG_THRESHOLD = 5;

export default function WorkspaceWidgetMenu({
  widgets,
  layouts,
  onToggleWidget,
  onRequestClose,
}: WorkspaceWidgetMenuProps) {
  const menuRef = useRef<HTMLElement | null>(null);
  const trackRef =
    useRef<HTMLDivElement | null>(null);

  const pointerIdRef =
    useRef<number | null>(null);

  const startXRef =
    useRef(0);

  const startScrollLeftRef =
    useRef(0);

  const draggedRef =
    useRef(false);

  const [isDragging, setIsDragging] =
    useState(false);

  useEffect(() => {
    if (!onRequestClose) return;
    const handleOutsidePointer = (event: globalThis.PointerEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest(".doctor-topbar-workspace-toggle") ||
        (menuRef.current && menuRef.current.contains(target))
      ) {
        return;
      }

      if (menuRef.current) {
        onRequestClose();
      }
    };
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer);
  }, [onRequestClose]);

  /* ========================================================
     POINTER DOWN
  ======================================================== */

  const handlePointerDown = (
    event: PointerEvent<HTMLDivElement>
  ) => {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    /*
     * Solo botón primario del mouse.
     * En touch/pointer no se restringe.
     */
    if (
      event.pointerType === "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    pointerIdRef.current =
      event.pointerId;

    startXRef.current =
      event.clientX;

    startScrollLeftRef.current =
      track.scrollLeft;

    draggedRef.current = false;

  };

  /* ========================================================
     POINTER MOVE
  ======================================================== */

  const handlePointerMove = (
    event: PointerEvent<HTMLDivElement>
  ) => {
    const track = trackRef.current;

    if (
      !track ||
      pointerIdRef.current !==
        event.pointerId
    ) {
      return;
    }

    const deltaX =
      event.clientX -
      startXRef.current;

    /*
     * Mientras no se supere el umbral,
     * sigue considerándose un posible click.
     */
    if (
      !draggedRef.current &&
      Math.abs(deltaX) <
        DRAG_THRESHOLD
    ) {
      return;
    }

    draggedRef.current = true;

    setIsDragging(true);

    if (!track.hasPointerCapture(event.pointerId)) {
      track.setPointerCapture(event.pointerId);
    }

    /*
     * Desplazamiento horizontal del track.
     */
    track.scrollLeft =
      startScrollLeftRef.current -
      deltaX;

    /*
     * Evita selección de texto y
     * comportamiento de drag nativo.
     */
    event.preventDefault();
  };

  /* ========================================================
     POINTER END
  ======================================================== */

  const handlePointerEnd = (
    event: PointerEvent<HTMLDivElement>
  ) => {
    const track = trackRef.current;

    if (
      track &&
      track.hasPointerCapture(
        event.pointerId
      )
    ) {
      track.releasePointerCapture(
        event.pointerId
      );
    }

    pointerIdRef.current = null;

    setIsDragging(false);

    /*
     * draggedRef se mantiene hasta el click
     * para evitar activar un widget después
     * de un desplazamiento.
     */
  };

  /* ========================================================
     CLICK
  ======================================================== */

  const handleItemClick = (
    id: string
  ) => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }

    onToggleWidget(id);
  };

  /* ========================================================
     POINTER CANCEL
  ======================================================== */

  const handlePointerCancel = (
    event: PointerEvent<HTMLDivElement>
  ) => {
    const track = trackRef.current;

    if (
      track &&
      track.hasPointerCapture(
        event.pointerId
      )
    ) {
      track.releasePointerCapture(
        event.pointerId
      );
    }

    pointerIdRef.current = null;

    draggedRef.current = false;

    setIsDragging(false);
  };

  /* ========================================================
     RENDER
  ======================================================== */

  return (
    <section
      ref={menuRef}
      className={[
        "workspace-widget-menu",
        isDragging
          ? "is-dragging"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Widgets del espacio de trabajo"
    >
      <div className="workspace-widget-menu-inner">
        <div
          ref={trackRef}
          className="workspace-widget-menu-track"
          role="toolbar"
          aria-label="Selector de widgets"
          onPointerDown={
            handlePointerDown
          }
          onPointerMove={
            handlePointerMove
          }
          onPointerUp={
            handlePointerEnd
          }
          onPointerCancel={
            handlePointerCancel
          }
        >
          {widgets.map((widget) => {
            const layout =
              layouts.find(
                (item) =>
                  item.id === widget.id
              );

            const visible =
              layout?.visible ??
              false;

            return (
              <button
                key={widget.id}
                type="button"
                className={[
                  "workspace-widget-menu-item",
                  visible
                    ? "is-visible"
                    : "is-hidden",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={visible}
                aria-label={
                  visible
                    ? `Ocultar ${widget.title}`
                    : `Mostrar ${widget.title}`
                }
                title={
                  visible
                    ? `Ocultar ${widget.title}`
                    : `Mostrar ${widget.title}`
                }
                onClick={() =>
                  handleItemClick(
                    widget.id
                  )
                }
              >
                <span
                  className="workspace-widget-menu-icon"
                  aria-hidden="true"
                >
                  {widget.icon}
                </span>

                <span className="workspace-widget-menu-label">
                  {widget.shortTitle}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
