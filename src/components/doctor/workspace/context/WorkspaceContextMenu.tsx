"use client";

import { useEffect, useRef } from "react";

interface WorkspaceContextMenuProps {
  x: number;
  y: number;
  onChangeStyles: () => void;
  onGoToTop: () => void;
  onGoToPatient: () => void;
  onGoToEnd: () => void;
  onClose: () => void;
}

export default function WorkspaceContextMenu({
  x,
  y,
  onChangeStyles,
  onGoToTop,
  onGoToPatient,
  onGoToEnd,
  onClose,
}: WorkspaceContextMenuProps) {
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

  const handleChangeStyles = () => {
    onChangeStyles();
    onClose();
  };

  const handleGoToTop = () => {
    onGoToTop();
    onClose();
  };

  const handleGoToPatient = () => {
    onGoToPatient();
    onClose();
  };

  const handleGoToEnd = () => {
    onGoToEnd();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="workspace-context-menu workspace-area-context-menu"
      role="menu"
      aria-label="Acciones del espacio de trabajo"
      style={{
        position: "fixed",
        left: typeof window === "undefined" ? x : Math.max(8, Math.min(x, window.innerWidth - 294)),
        top: typeof window === "undefined" ? y : Math.max(8, Math.min(y, window.innerHeight - 250)),
      }}
    >
      <div className="workspace-context-menu-header">
        <strong>Espacio de trabajo</strong>
        <span>Acciones</span>
      </div>

      <div className="workspace-context-menu-divider" />

      <button
        type="button"
        className="workspace-context-menu-item"
        role="menuitem"
        onClick={handleChangeStyles}
      >
        <span
          className="workspace-context-menu-item-icon"
          aria-hidden="true"
        >
          ⚙
        </span>

        <span className="workspace-context-menu-item-content">
          <strong>Cambiar estilos</strong>
          <small>Personalizar la distribución</small>
        </span>
      </button>

      <button
        type="button"
        className="workspace-context-menu-item"
        role="menuitem"
        onClick={handleGoToTop}
      >
        <span
          className="workspace-context-menu-item-icon"
          aria-hidden="true"
        >
          ↑
        </span>

        <span className="workspace-context-menu-item-content">
          <strong>Ir al principio</strong>
          <small>Volver al inicio del workspace</small>
        </span>
      </button>

      <button
        type="button"
        className="workspace-context-menu-item"
        role="menuitem"
        onClick={handleGoToPatient}
      >
        <span
          className="workspace-context-menu-item-icon"
          aria-hidden="true"
        >
          ●
        </span>

        <span className="workspace-context-menu-item-content">
          <strong>Ir a paciente</strong>
          <small>Mostrar información del paciente</small>
        </span>
      </button>

      <button
        type="button"
        className="workspace-context-menu-item"
        role="menuitem"
        onClick={handleGoToEnd}
      >
        <span
          className="workspace-context-menu-item-icon"
          aria-hidden="true"
        >
          ↓
        </span>

        <span className="workspace-context-menu-item-content">
          <strong>Ir al final</strong>
          <small>Mostrar el último widget visible</small>
        </span>
      </button>
    </div>
  );
}
