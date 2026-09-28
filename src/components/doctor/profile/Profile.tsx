"use client";

import { useState } from "react";

export interface UserProfile {
  firstName: string;
  lastName?: string;

  documentType: string;
  documentNumber: string;

  age: number;
  birthYear: number;
  birthMonth?: number;
  birthDay?: number;

  phone?: string;
  address?: string;
  city?: string;

  photoBase64?: string;
}

interface ProfileProps {
  profile: UserProfile;
  onSave?: (profile: UserProfile) => Promise<void>;
}

function calculateAge(
  year: number,
  month?: number,
  day?: number
): number {
  const today = new Date();

  const birthDate = new Date(
    year,
    (month || 1) - 1,
    day || 1
  );

  let age =
    today.getFullYear() -
    birthDate.getFullYear();

  const currentMonth = today.getMonth();
  const birthMonth = birthDate.getMonth();

  if (
    currentMonth < birthMonth ||
    (currentMonth === birthMonth &&
      today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return Math.max(age, 0);
}

function calculateBirthYearFromAge(age: number): number {
  return new Date().getFullYear() - age;
}

export default function Profile({
  profile,
  onSave,
}: ProfileProps) {
  const [form, setForm] = useState<UserProfile>({
    ...profile,
    age: profile.age || 0,
    birthYear: profile.birthYear || 0,
  });

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const updateField = <K extends keyof UserProfile>(
    field: K,
    value: UserProfile[K]
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateBirthDate = (
    field: "birthYear" | "birthMonth" | "birthDay",
    value: number | undefined
  ) => {
    setForm((current) => {
      const next = {
        ...current,
        [field]: value,
      };

      if (next.birthYear) {
        next.age = calculateAge(
          next.birthYear,
          next.birthMonth,
          next.birthDay
        );
      }

      return next;
    });
  };

  const handleAgeChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const age = Number(event.target.value);

    if (!age) {
      setForm((current) => ({
        ...current,
        age: 0,
      }));

      return;
    }

    const birthYear =
      calculateBirthYearFromAge(age);

    setForm((current) => ({
      ...current,
      age,
      birthYear,

      /*
       * Al introducir solamente la edad,
       * eliminamos día y mes porque no conocemos
       * esos datos.
       */
      birthMonth: undefined,
      birthDay: undefined,
    }));
  };

  const handlePhotoChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const maxSize = 2 * 1024 * 1024;

    if (file.size > maxSize) {
      setStatus(
        "La imagen no puede superar los 2 MB."
      );
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        updateField(
          "photoBase64",
          reader.result
        );
      }
    };

    reader.readAsDataURL(file);
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!form.firstName.trim()) {
      setStatus("El nombre es obligatorio.");
      return;
    }

    if (!form.documentType) {
      setStatus(
        "El tipo de documento es obligatorio."
      );
      return;
    }

    if (!form.documentNumber.trim()) {
      setStatus(
        "El número de documento es obligatorio."
      );
      return;
    }

    if (
      !form.age ||
      form.age < 1 ||
      form.age > 120
    ) {
      setStatus("La edad no es válida.");
      return;
    }

    if (
      !form.birthYear ||
      form.birthYear < 1900 ||
      form.birthYear >
        new Date().getFullYear()
    ) {
      setStatus(
        "El año de nacimiento no es válido."
      );
      return;
    }

    try {
      setSaving(true);
      setStatus("Guardando cambios...");

      if (onSave) {
        await onSave(form);
      }

      setStatus(
        "Perfil actualizado correctamente."
      );
    } catch (error) {
      console.error(
        "Error guardando perfil:",
        error
      );

      setStatus(
        "No fue posible guardar los cambios."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="profile">
      <header className="profile-header">
        <div className="profile-image-container">
          {form.photoBase64 ? (
            <img
              src={form.photoBase64}
              alt={`Foto de ${form.firstName}`}
              className="profile-image"
            />
          ) : (
            <div
              className="profile-image-placeholder"
              aria-hidden="true"
            >
              {form.firstName
                ?.charAt(0)
                .toUpperCase() || "U"}
            </div>
          )}

          <label
            htmlFor="profile-photo"
            className="profile-image-button"
          >
            Cambiar imagen
          </label>

          <input
            id="profile-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoChange}
            hidden
          />
        </div>

        <div>
          <h1>
            {form.firstName || "Usuario"}{" "}
            {form.lastName || ""}
          </h1>

          <p>Información personal</p>
        </div>
      </header>

      <form
        className="profile-form"
        onSubmit={handleSubmit}
      >
        <div className="input-group">
          <label htmlFor="firstName">
            Nombre *
          </label>

          <input
            id="firstName"
            type="text"
            value={form.firstName}
            onChange={(event) =>
              updateField(
                "firstName",
                event.target.value
              )
            }
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="lastName">
            Apellidos
          </label>

          <input
            id="lastName"
            type="text"
            value={form.lastName || ""}
            onChange={(event) =>
              updateField(
                "lastName",
                event.target.value
              )
            }
          />
        </div>

        <div className="input-group">
          <label htmlFor="documentType">
            Tipo de documento *
          </label>

          <select
            id="documentType"
            value={form.documentType}
            onChange={(event) =>
              updateField(
                "documentType",
                event.target.value
              )
            }
            required
          >
            <option value="">
              Selecciona
            </option>

            <option value="CC">
              Cédula de ciudadanía
            </option>

            <option value="CE">
              Cédula de extranjería
            </option>

            <option value="TI">
              Tarjeta de identidad
            </option>

            <option value="PASSPORT">
              Pasaporte
            </option>
          </select>
        </div>

        <div className="input-group">
          <label htmlFor="documentNumber">
            Número de documento *
          </label>

          <input
            id="documentNumber"
            type="text"
            value={form.documentNumber}
            onChange={(event) =>
              updateField(
                "documentNumber",
                event.target.value
              )
            }
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="birthYear">
            Año de nacimiento *
          </label>

          <input
            id="birthYear"
            type="number"
            min="1900"
            max={new Date().getFullYear()}
            value={form.birthYear || ""}
            onChange={(event) =>
              updateBirthDate(
                "birthYear",
                event.target.value
                  ? Number(event.target.value)
                  : undefined
              )
            }
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="birthMonth">
            Mes de nacimiento
          </label>

          <select
            id="birthMonth"
            value={form.birthMonth || ""}
            onChange={(event) =>
              updateBirthDate(
                "birthMonth",
                event.target.value
                  ? Number(event.target.value)
                  : undefined
              )
            }
          >
            <option value="">
              No suministrado
            </option>

            <option value="1">Enero</option>
            <option value="2">Febrero</option>
            <option value="3">Marzo</option>
            <option value="4">Abril</option>
            <option value="5">Mayo</option>
            <option value="6">Junio</option>
            <option value="7">Julio</option>
            <option value="8">Agosto</option>
            <option value="9">Septiembre</option>
            <option value="10">Octubre</option>
            <option value="11">Noviembre</option>
            <option value="12">Diciembre</option>
          </select>
        </div>

        <div className="input-group">
          <label htmlFor="birthDay">
            Día de nacimiento
          </label>

          <input
            id="birthDay"
            type="number"
            min="1"
            max="31"
            value={form.birthDay || ""}
            onChange={(event) =>
              updateBirthDate(
                "birthDay",
                event.target.value
                  ? Number(event.target.value)
                  : undefined
              )
            }
          />
        </div>

        <div className="input-group">
          <label htmlFor="age">
            Edad *
          </label>

          <input
            id="age"
            type="number"
            min="1"
            max="120"
            value={form.age || ""}
            onChange={handleAgeChange}
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="phone">
            Teléfono
          </label>

          <input
            id="phone"
            type="tel"
            value={form.phone || ""}
            onChange={(event) =>
              updateField(
                "phone",
                event.target.value
              )
            }
          />
        </div>

        <div className="input-group">
          <label htmlFor="city">
            Ciudad
          </label>

          <input
            id="city"
            type="text"
            value={form.city || ""}
            onChange={(event) =>
              updateField(
                "city",
                event.target.value
              )
            }
          />
        </div>

        <div className="input-group">
          <label htmlFor="address">
            Dirección
          </label>

          <input
            id="address"
            type="text"
            value={form.address || ""}
            onChange={(event) =>
              updateField(
                "address",
                event.target.value
              )
            }
          />
        </div>

        {status && (
          <div
            className="auth-status"
            role="status"
            aria-live="polite"
          >
            {status}
          </div>
        )}

        <button
          type="submit"
          className="login-btn"
          disabled={saving}
        >
          {saving
            ? "Guardando..."
            : "Guardar cambios"}
        </button>
      </form>
    </section>
  );
}