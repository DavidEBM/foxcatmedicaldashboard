import type {
  Questionnaire,
} from "@/types/doctor-questionnaires";

export const QUESTIONNAIRES_STORAGE_KEY =
  "foxcat_questionnaires";

export function getSelectedQuestionnaire(
  questionnaires: Questionnaire[],
  selectedQuestionnaireId: string
): Questionnaire | null {
  return (
    questionnaires.find(
      (item) =>
        item.id === selectedQuestionnaireId
    ) ||
    questionnaires[0] ||
    null
  );
}

export function loadQuestionnaires(): Questionnaire[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(
      QUESTIONNAIRES_STORAGE_KEY
    );

    const parsed = JSON.parse(raw || "[]");

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

export function saveQuestionnaires(
  questionnaires: Questionnaire[]
): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(
    QUESTIONNAIRES_STORAGE_KEY,
    JSON.stringify(questionnaires)
  );
}

export function createQuestionnaire(
  data: Omit<Questionnaire, "id">
): Questionnaire {
  return {
    id: crypto.randomUUID(),
    title: data.title.trim(),
    purpose: data.purpose.trim(),
    url: data.url.trim(),
    qrDataUrl: data.qrDataUrl,
  };
}

export function removeQuestionnaire(
  questionnaires: Questionnaire[],
  questionnaireId: string
): Questionnaire[] {
  return questionnaires.filter(
    (item) => item.id !== questionnaireId
  );
}
