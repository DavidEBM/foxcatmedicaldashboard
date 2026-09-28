"use client";

import {
  useEffect,
  useState,
} from "react";

/* =========================================================
   TYPES
   ========================================================= */

interface UseWorkspaceResponsiveOptions {
  mobileBreakpoint?: number;
  tabletBreakpoint?: number;
}

interface UseWorkspaceResponsiveReturn {
  width: number;
  height: number;

  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;

  isInteractive: boolean;
  isStatic: boolean;
}

/* =========================================================
   DEFAULT BREAKPOINTS
   ========================================================= */

const DEFAULT_MOBILE_BREAKPOINT =
  768;

const DEFAULT_TABLET_BREAKPOINT =
  1024;

/* =========================================================
   INITIAL VIEWPORT
   ========================================================= */

/*
 * IMPORTANTE:
 *
 * No usamos window durante la inicialización
 * del estado.
 *
 * Esto garantiza que:
 *
 * SSR       -> width = 0
 * Hydration -> width = 0
 *
 * y solamente después de montar el componente
 * obtenemos el viewport real.
 */
const INITIAL_VIEWPORT = {
  width: 0,
  height: 0,
};

/* =========================================================
   HOOK
   ========================================================= */

export function useWorkspaceResponsive({
  mobileBreakpoint =
    DEFAULT_MOBILE_BREAKPOINT,

  tabletBreakpoint =
    DEFAULT_TABLET_BREAKPOINT,
}: UseWorkspaceResponsiveOptions = {}): UseWorkspaceResponsiveReturn {
  const [
    viewport,
    setViewport,
  ] = useState(
    INITIAL_VIEWPORT
  );

  /* =======================================================
     CLIENT VIEWPORT
     ======================================================= */

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        width:
          window.innerWidth,

        height:
          window.innerHeight,
      });
    };

    /*
     * Primera medición después
     * de la hidratación.
     */
    updateViewport();

    const handleResize = () => {
      updateViewport();
    };

    window.addEventListener(
      "resize",
      handleResize
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize
      );
    };
  }, []);

  /* =======================================================
     BREAKPOINTS
     ======================================================= */

  const hasViewport =
    viewport.width > 0;

  const isMobile =
    hasViewport &&
    viewport.width <=
      mobileBreakpoint;

  const isTablet =
    hasViewport &&
    viewport.width >
      mobileBreakpoint &&
    viewport.width <=
      tabletBreakpoint;

  const isDesktop =
    hasViewport &&
    viewport.width >
      tabletBreakpoint;

  /* =======================================================
     WORKSPACE MODE
     ======================================================= */

  /*
   * Durante SSR/hydration:
   *
   * isInteractive = false
   *
   * Después del montaje:
   *
   * > 1024 -> interactive
   * <= 1024 -> static
   */
  const isInteractive =
    isDesktop;

  const isStatic =
    hasViewport &&
    !isDesktop;

  /* =======================================================
     RETURN
     ======================================================= */

  return {
    width:
      viewport.width,

    height:
      viewport.height,

    isMobile,

    isTablet,

    isDesktop,

    isInteractive,

    isStatic,
  };
}