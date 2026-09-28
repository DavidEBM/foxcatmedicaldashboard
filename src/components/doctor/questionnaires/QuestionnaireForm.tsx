"use client";

import {
  FormEvent,
  useState,
} from "react";

import type {
  Questionnaire,
} from "@/types/doctor-questionnaires";

import {
  readFileAsDataUrl,
} from "@/lib/doctor/doctor-utils";

interface QuestionnaireFormProps {
  onCreate: (
    questionnaire: Omit<
      Questionnaire,
      "id"
    >
  ) => void;
}

export default function QuestionnaireForm({
  onCreate,
}: QuestionnaireFormProps) {
  const [title, setTitle] =
    useState("");

  const [purpose, setPurpose] =
    useState("");

  const [url, setUrl] =
    useState("");

  const [qrFile, setQrFile] =
    useState<File | null>(null);

  const [saving, setSaving] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    try {
      setSaving(true);

      let qrDataUrl: string | undefined;

      if (qrFile) {
        qrDataUrl =
          await readFileAsDataUrl(
            qrFile
          );
      }

      onCreate({
        title,
        purpose,
        url,
        qrDataUrl,
      });

      setTitle("");
      setPurpose("");
      setUrl("");
      setQrFile(null);

      event.currentTarget.reset();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="patient-form questionnaire-form"
      onSubmit={handleSubmit}
    >
      <div className="field-grid">
        <input
          type="text"
          name="title"
          placeholder="Nombre del cuestionario"
          value={title}
          onChange={(event) =>
            setTitle(event.target.value)
          }
          required
        />

        <input
          type="text"
          name="purpose"
          placeholder="Uso clinico: CAT, disnea, adherencia, cardiaco..."
          value={purpose}
          onChange={(event) =>
            setPurpose(event.target.value)
          }
        />

        <input
          type="url"
          name="url"
          placeholder="Link de Google/Microsoft Forms"
          value={url}
          onChange={(event) =>
            setUrl(event.target.value)
          }
        />

        <label className="time-field upload-field">
          <span>
            QR opcional del formulario
          </span>

          <input
            type="file"
            name="qrFile"
            accept="image/*"
            onChange={(event) =>
              setQrFile(
                event.target.files?.[0] ||
                  null
              )
            }
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={saving}
      >
        {saving
          ? "Guardando..."
          : "Guardar cuestionario"}
      </button>
    </form>
  );
}

