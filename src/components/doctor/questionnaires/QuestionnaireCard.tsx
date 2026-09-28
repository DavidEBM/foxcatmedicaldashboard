import type {
  Questionnaire,
} from "@/types/doctor-questionnaires";

interface QuestionnaireCardProps {
  questionnaire: Questionnaire;
  patientName?: string | null;
}

export default function QuestionnaireCard({
  questionnaire,
  patientName,
}: QuestionnaireCardProps) {
  return (
    <article className="questionnaire-card">
      <div>
        <span className="eyebrow">
          Formulario seleccionado
        </span>

        <strong>
          {questionnaire.title}
        </strong>

        <p>
          {questionnaire.purpose ||
            "Sin indicacion especifica."}
        </p>

        <p>
          Paciente:{" "}
          {patientName ||
            "Sin paciente seleccionado"}
        </p>
      </div>

      {questionnaire.qrDataUrl && (
        <img
          src={questionnaire.qrDataUrl}
          alt={`QR de ${questionnaire.title}`}
          className="questionnaire-qr"
        />
      )}

      {questionnaire.url && (
        <a
          className="ghost-button questionnaire-link"
          href={questionnaire.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir formulario
        </a>
      )}
    </article>
  );
}

