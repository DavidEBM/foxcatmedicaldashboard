"use client";

import {
  useCallback,
  useState,
} from "react";

import type {
  WorkspaceStyle,
  WorkspaceStyleDraft,
} from "@/types/doctor-workspace";

interface UseWorkspaceStyleEditorOptions {
  style: WorkspaceStyle;
  onConfirm: (
    style: WorkspaceStyle
  ) => void;
}

interface UseWorkspaceStyleEditorReturn {
  isOpen: boolean;
  draft: WorkspaceStyleDraft;
  openEditor: () => void;
  closeEditor: () => void;
  updateDraft: (
    changes: Partial<WorkspaceStyle>
  ) => void;
  confirm: () => void;
  cancel: () => void;
  resetDraft: () => void;
}

export function useWorkspaceStyleEditor({
  style,
  onConfirm,
}: UseWorkspaceStyleEditorOptions): UseWorkspaceStyleEditorReturn {
  const createDraft = useCallback(
    (): WorkspaceStyleDraft => ({
      original: { ...style },
      draft: { ...style },
    }),
    [style]
  );

  const [isOpen, setIsOpen] =
    useState(false);

  const [draft, setDraft] =
    useState<WorkspaceStyleDraft>(
      createDraft
    );

  const openEditor = useCallback(() => {
    setDraft(createDraft());
    setIsOpen(true);
  }, [createDraft]);

  const closeEditor = useCallback(() => {
    setIsOpen(false);
  }, []);

  const updateDraft = useCallback(
    (changes: Partial<WorkspaceStyle>) => {
      setDraft((current) => ({
        ...current,
        draft: {
          ...current.draft,
          ...changes,
        },
      }));
    },
    []
  );

  const confirm = useCallback(() => {
    onConfirm({
      ...draft.draft,
    });

    setDraft({
      original: {
        ...draft.draft,
      },
      draft: {
        ...draft.draft,
      },
    });

    setIsOpen(false);
  }, [draft.draft, onConfirm]);

  const cancel = useCallback(() => {
    setDraft({
      original: {
        ...draft.original,
      },
      draft: {
        ...draft.original,
      },
    });

    setIsOpen(false);
  }, [draft.original]);

  const resetDraft = useCallback(() => {
    setDraft({
      original: {
        ...draft.original,
      },
      draft: {
        ...draft.original,
      },
    });
  }, [draft.original]);

  return {
    isOpen,
    draft,
    openEditor,
    closeEditor,
    updateDraft,
    confirm,
    cancel,
    resetDraft,
  };
}