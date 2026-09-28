"use client";

import { useCallback, useState } from "react";

import type {
  WorkspaceAction,
  WorkspaceState,
} from "@/types/doctor-workspace";

export function useDoctorWorkspace() {
  const [workspace, setWorkspace] = useState<WorkspaceState>({
    action: null,
    visible: false,
  });

  const openWorkspace = useCallback((action: WorkspaceAction) => {
    setWorkspace({
      action,
      visible: true,
    });
  }, []);

  const closeWorkspace = useCallback(() => {
    setWorkspace({
      action: null,
      visible: false,
    });
  }, []);

  return {
    workspace,
    openWorkspace,
    closeWorkspace,
  };
}