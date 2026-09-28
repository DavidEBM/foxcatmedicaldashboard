export interface Questionnaire {
  id: string;
  title: string;
  purpose: string;
  url: string;
  qrDataUrl?: string;
}

export interface QuestionnaireFormData {
  title: string;
  purpose: string;
  url: string;
  qrFile: File | null;
}
