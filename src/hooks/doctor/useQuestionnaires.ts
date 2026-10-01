"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  Questionnaire,
} from "@/types/doctor-questionnaires";

import {
  createQuestionnaire,
  getSelectedQuestionnaire,
  loadQuestionnaires,
  removeQuestionnaire,
  saveQuestionnaires,
} from "@/lib/doctor/questionnaires";

export function useQuestionnaires() {
  const [questionnaires, setQuestionnaires] =
    useState<Questionnaire[]>([]);

  const [
    selectedQuestionnaireId,
    setSelectedQuestionnaireId,
  ] = useState("");

  const [hydrated, setHydrated] =
    useState(false);

  useEffect(() => {
    const stored =
      loadQuestionnaires();

    // Hydrate browser storage into React state once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuestionnaires(stored);

    setSelectedQuestionnaireId(
      stored[0]?.id || ""
    );

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    saveQuestionnaires(
      questionnaires
    );
  }, [questionnaires, hydrated]);

  const selectedQuestionnaire =
    useMemo(
      () =>
        getSelectedQuestionnaire(
          questionnaires,
          selectedQuestionnaireId
        ),
      [
        questionnaires,
        selectedQuestionnaireId,
      ]
    );

  const addQuestionnaire =
    useCallback(
      (
        data: Omit<
          Questionnaire,
          "id"
        >
      ) => {
        const questionnaire =
          createQuestionnaire(data);

        setQuestionnaires(
          (current) => [
            ...current,
            questionnaire,
          ]
        );

        setSelectedQuestionnaireId(
          questionnaire.id
        );

        return questionnaire;
      },
      []
    );

  const deleteQuestionnaire =
    useCallback(
      (questionnaireId: string) => {
        setQuestionnaires(
          (current) => {
            const next =
              removeQuestionnaire(
                current,
                questionnaireId
              );

            setSelectedQuestionnaireId(
              (currentSelected) => {
                if (
                  currentSelected !==
                  questionnaireId
                ) {
                  return currentSelected;
                }

                return (
                  next[0]?.id || ""
                );
              }
            );

            return next;
          }
        );
      },
      []
    );

  return {
    questionnaires,
    selectedQuestionnaire,
    selectedQuestionnaireId,
    hydrated,

    setSelectedQuestionnaireId,

    addQuestionnaire,
    deleteQuestionnaire,
  };
}
