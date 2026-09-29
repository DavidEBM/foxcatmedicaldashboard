import Image from "next/image";

interface AppLoadingScreenProps {
  message?: string;
}

export default function AppLoadingScreen({
  message = "Validando sesión y cargando información clínica…",
}: AppLoadingScreenProps) {
  return (
    <main className="loading-page" aria-busy="true" aria-live="polite">
      <section className="loading-card">
        <Image
          src="/icons/logo.png"
          alt="Foxcat Medical"
          width={82}
          height={82}
          className="loading-logo"
        />
        <span className="loading-eyebrow">Espacio clínico seguro</span>
        <h1>Foxcat Medical</h1>
        <p>{message}</p>
        <div className="loading-spinner" role="status" aria-label="Cargando" />
      </section>
    </main>
  );
}
