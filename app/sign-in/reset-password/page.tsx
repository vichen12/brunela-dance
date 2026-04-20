import { ResetPasswordForm } from "@/components/reset-password-form";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(5rem, 8vh, 6rem) clamp(1rem, 4vw, 2rem)",
        background: "linear-gradient(145deg, #fdf2f8 0%, #fff 50%, #fdf2f8 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glows */}
      <div aria-hidden style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "80%", height: "50%", background: "radial-gradient(ellipse at 50% 0%, rgba(190,24,93,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: "480px", position: "relative", zIndex: 1 }}>
        {/* Card */}
        <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderRadius: "2rem", border: "1px solid rgba(190,24,93,0.1)", boxShadow: "0 8px 48px rgba(190,24,93,0.08), 0 0 0 1px rgba(255,255,255,0.8)", padding: "clamp(2rem, 5vw, 3rem)" }}>
          <div style={{ width: 48, height: 48, borderRadius: "14px", background: "linear-gradient(135deg, #fce7f3, #fbcfe8)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#be185d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>

          <p style={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.3em", textTransform: "uppercase", color: "#be185d", marginBottom: "0.6rem" }}>
            Nueva contrasena
          </p>
          <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "2.2rem", lineHeight: 0.95, color: "#1c1917", marginBottom: "0.75rem" }}>
            Acceso renovado.
          </h1>
          <p style={{ fontSize: "0.84rem", color: "#78716c", lineHeight: 1.85, marginBottom: "2rem" }}>
            Elegí una contrasena segura. Minimo 8 caracteres con letras y numeros.
          </p>

          <ResetPasswordForm error={error} />
        </div>
      </div>
    </main>
  );
}
