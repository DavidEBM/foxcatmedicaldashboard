"use client";

import QuestionnaireForm from "./QuestionnaireForm";
import QuestionnaireCard from "./QuestionnaireCard";

import { useQuestionnaires } from "@/hooks/doctor/useQuestionnaires";

interface QuestionnairesWidgetProps {
  patientName?: string | null;
}

export default function QuestionnairesWidget({
  patientName,
}: QuestionnairesWidgetProps) {
  const {
    questionnaires,
    selectedQuestionnaire,
    selectedQuestionnaireId,
    setSelectedQuestionnaireId,
    addQuestionnaire,
    deleteQuestionnaire,
  } = useQuestionnaires();

  return (
    <section className="questionnaires-widget">
      <QuestionnaireForm
        onCreate={addQuestionnaire}
      />

      <div className="questionnaire-selector">
        <select
          value={selectedQuestionnaireId}
          onChange={(event) =>
            setSelectedQuestionnaireId(
              event.target.value
            )
          }
        >
          <option value="">
            Seleccionar cuestionario para mostrar
          </option>

          {questionnaires.map(
            (questionnaire) => (
              <option
                key={questionnaire.id}
                value={questionnaire.id}
              >
                {questionnaire.title}
              </option>
            )
          )}
        </select>

        <button
          type="button"
          className="ghost-button danger"
          disabled={!selectedQuestionnaire}
          onClick={() => {
            if (!selectedQuestionnaire) {
              return;
            }

            deleteQuestionnaire(
              selectedQuestionnaire.id
            );
          }}
        >
          Eliminar
        </button>
      </div>

      <div className="questionnaire-display">
        {selectedQuestionnaire ? (
          <QuestionnaireCard
            questionnaire={
              selectedQuestionnaire
            }
            patientName={patientName}
          />
        ) : (
          <div className="empty-state">
            Guarda un link o una imagen QR
            para mostrar el cuestionario que
            el medico seleccione.
          </div>
        )}
      </div>
    </section>
  );
}
