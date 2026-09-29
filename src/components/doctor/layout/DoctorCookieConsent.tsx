"use client";

interface DoctorCookieConsentProps {
  onAccept: () => void;
  onDecline: () => void;
}

export default function DoctorCookieConsent({
  onAccept,
  onDecline,
}: DoctorCookieConsentProps) {
  return (
    <aside
      className="doctor-cookie-consent"
      role="dialog"
      aria-labelledby="doctor-cookie-consent-title"
      aria-describedby="doctor-cookie-consent-description"
    >
      <div className="doctor-cookie-consent-copy">
        <span className="doctor-cookie-consent-eyebrow">Preferencias del panel</span>
        <h2 id="doctor-cookie-consent-title">¿Quieres guardar tus preferencias?</h2>
        <p id="doctor-cookie-consent-description">
          Usaremos cookies funcionales para recordar el modo claro u oscuro, los widgets activos u ocultos y
          el último paciente abierto en este navegador. No se guardarán estas
          preferencias sin tu autorización.
        </p>
      </div>

      <div className="doctor-cookie-consent-actions">
        <button type="button" className="doctor-cookie-consent-secondary" onClick={onDecline}>
          Ahora no
        </button>
        <button type="button" className="doctor-cookie-consent-primary" onClick={onAccept}>
          Aceptar cookies
        </button>
      </div>
    </aside>
  );
}
