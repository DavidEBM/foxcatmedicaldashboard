"use client";

import {
  useEffect,
  useRef,
} from "react";

import type {
  WorkspaceWidgetId,
} from "@/types/doctor-workspace";

interface WidgetContextMenuProps {
  widgetId: WorkspaceWidgetId;
  x: number;
  y: number;
  onHide: (widgetId: WorkspaceWidgetId) => void;
  onMoveToFirst: (widgetId: WorkspaceWidgetId) => void;
  onMoveToLast: (widgetId: WorkspaceWidgetId) => void;
  onResize: (widgetId: WorkspaceWidgetId) => void;
  onClose: () => void;
}

export default function WidgetContextMenu({
  widgetId,
  x,
  y,
  onHide,
  onMoveToFirst,
  onMoveToLast,
  onResize,
  onClose,
}: WidgetContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener(
      "pointerdown",
      handlePointerDown
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [onClose]);

  const handleHide = () => {
    onHide(widgetId);
    onClose();
  };

  const handleMoveToFirst = () => {
    onMoveToFirst(widgetId);
    onClose();
  };

  const handleMoveToLast = () => {
    onMoveToLast(widgetId);
    onClose();
  };

  const handleResize = () => {
    onResize(widgetId);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="workspace-context-menu widget-context-menu"
      role="menu"
      aria-label="Acciones del widget"
      style={{
        position: "fixed",
        left: typeof window === "undefined" ? x : Math.max(8, Math.min(x, window.innerWidth - 294)),
        top: typeof window === "undefined" ? y : Math.max(8, Math.min(y, window.innerHeight - 270)),
      }}
    >
      <div className="workspace-context-menu-header">
        <strong>Widget</strong>
        <span>Acciones</span>
      </div>

      <div className="workspace-context-menu-divider" />

      <button type="button" className="workspace-context-menu-item" role="menuitem" onClick={handleResize}>
        <span className="workspace-context-menu-item-icon" aria-hidden="true">↔</span>
        <span className="workspace-context-menu-item-content">
          <strong>Redimensionar</strong>
          <small>Ajustar tamaño y posición del widget</small>
        </span>
      </button>

      <button
        type="button"
        className="workspace-context-menu-item"
        role="menuitem"
        onClick={handleHide}
      >
        <span
          className="workspace-context-menu-item-icon"
          aria-hidden="true"
        >
          ◌
        </span>

        <span className="workspace-context-menu-item-content">
          <strong>Ocultar</strong>
          <small>Quitar del espacio de trabajo</small>
        </span>
      </button>

      <button
        type="button"
        className="workspace-context-menu-item"
        role="menuitem"
        onClick={handleMoveToFirst}
      >
        <span
          className="workspace-context-menu-item-icon"
          aria-hidden="true"
        >
          ↑
        </span>

        <span className="workspace-context-menu-item-content">
          <strong>Pasar al primero</strong>
          <small>Colocar en la primera posición</small>
        </span>
      </button>

      <button
        type="button"
        className="workspace-context-menu-item"
        role="menuitem"
        onClick={handleMoveToLast}
      >
        <span
          className="workspace-context-menu-item-icon"
          aria-hidden="true"
        >
          ↓
        </span>

        <span className="workspace-context-menu-item-content">
          <strong>Pasar al último</strong>
          <small>Colocar en la última posición</small>
        </span>
      </button>
    </div>
  );
}
