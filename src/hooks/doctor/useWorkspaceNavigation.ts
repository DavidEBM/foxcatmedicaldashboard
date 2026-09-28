"use client";

import {
  useCallback,
  useRef,
} from "react";

import type {
  WorkspaceWidgetId,
} from "@/types/doctor-workspace";

interface UseWorkspaceNavigationOptions {
  workspaceId?: string;
  patientWidgetId?: WorkspaceWidgetId;
  behavior?: ScrollBehavior;
}

interface UseWorkspaceNavigationReturn {
  workspaceRef: React.RefObject<HTMLDivElement | null>;
  goToTop: () => void;
  goToPatient: () => void;
  goToEnd: () => void;
  scrollToWidget: (
    widgetId: WorkspaceWidgetId
  ) => void;
}

export function useWorkspaceNavigation({
  workspaceId,
  patientWidgetId = "patient-summary",
  behavior = "smooth",
}: UseWorkspaceNavigationOptions = {}): UseWorkspaceNavigationReturn {
  const workspaceRef =
    useRef<HTMLDivElement | null>(null);

  /*
   * Busca el workspace sin asumir que sea
   * el contenedor encargado del scroll.
   */
  const getWorkspaceElement =
    useCallback(() => {
      if (workspaceRef.current) {
        return workspaceRef.current;
      }

      if (
        workspaceId &&
        typeof document !== "undefined"
      ) {
        return document.getElementById(
          workspaceId
        ) as HTMLDivElement | null;
      }

      return null;
    }, [workspaceId]);

  /*
   * Busca un widget visible dentro del workspace.
   */
  const getWidgetElement =
    useCallback(
      (
        widgetId: WorkspaceWidgetId
      ) => {
        const workspace =
          getWorkspaceElement();

        if (!workspace) {
          return null;
        }

        if (
          typeof CSS === "undefined" ||
          typeof CSS.escape !== "function"
        ) {
          return null;
        }

        return workspace.querySelector<HTMLElement>(
          `[data-widget-id="${CSS.escape(
            widgetId
          )}"]`
        );
      },
      [getWorkspaceElement]
    );

  /*
   * Desplaza hasta un widget concreto.
   */
  const scrollToWidget =
    useCallback(
      (
        widgetId: WorkspaceWidgetId
      ) => {
        const widget =
          getWidgetElement(
            widgetId
          );

        if (!widget) {
          return;
        }

        widget.scrollIntoView({
          behavior,
          block: "start",
          inline: "nearest",
        });
      },
      [
        behavior,
        getWidgetElement,
      ]
    );

  /*
   * Ir al principio real de la página.
   */
  const goToTop =
    useCallback(() => {
      if (
        typeof window ===
        "undefined"
      ) {
        return;
      }

      window.scrollTo({
        top: 0,
        left: 0,
        behavior,
      });
    }, [behavior]);

  /*
   * Ir directamente al widget
   * principal del paciente.
   */
  const goToPatient =
    useCallback(() => {
      scrollToWidget(
        patientWidgetId
      );
    }, [
      patientWidgetId,
      scrollToWidget,
    ]);

  /*
   * Ir al final real del documento.
   */
  const goToEnd =
    useCallback(() => {
      if (
        typeof window ===
        "undefined" ||
        typeof document ===
        "undefined"
      ) {
        return;
      }

      const documentHeight =
        Math.max(
          document.body
            .scrollHeight,

          document.documentElement
            .scrollHeight,

          document.body
            .offsetHeight,

          document.documentElement
            .offsetHeight,

          document.documentElement
            .clientHeight
        );

      window.scrollTo({
        top: documentHeight,
        left: 0,
        behavior,
      });
    }, [behavior]);

  return {
    workspaceRef,
    goToTop,
    goToPatient,
    goToEnd,
    scrollToWidget,
  };
}