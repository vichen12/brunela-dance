import Link from "next/link";
import { requestPasswordResetAction } from "@/src/features/auth/actions";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : null;
  const success = typeof params.success === "string" ? params.success : null;

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
      <div aria-hidden style={{ position: "absolute", bottom: 0, right: 0, width: "40%", height: "40%", background: "radial-gradient(ellipse at 100% 100%, rgba(190,24,93,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: "480px", position: "relative", zIndex: 1 }}>
        {/* Back link */}
        <Link
          href="/sign-in"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9d8a98", marginBottom: "2.5rem", textDecoration: "none" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Volver al ingreso
        </Link>

        {/* Card */}
        <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderRadius: "2rem", border: "1px solid rgba(190,24,93,0.1)", boxShadow: "0 8px 48px rgba(190,24,93,0.08), 0 0 0 1px rgba(255,255,255,0.8)", padding: "clamp(2rem, 5vw, 3rem)" }}>
          <div style={{ width: 48, height: 48, borderRadius: "14px", background: "linear-gradient(135deg, #fce7f3, #fbcfe8)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#be185d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>

          <p style={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.3em", textTransform: "uppercase", color: "#be185d", marginBottom: "0.6rem" }}>
            Recuperar acceso
          </p>
          <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "2.2rem", lineHeight: 0.95, color: "#1c1917", marginBottom: "0.75rem" }}>
            Restablecer contrasena.
          </h1>
          <p style={{ fontSize: "0.84rem", color: "#78716c", lineHeight: 1.85, marginBottom: "2rem" }}>
            Ingresa tu email y te enviamos un enlace seguro. Expira en 60 minutos.
          </p>

          {success ? (
            <div style={{ borderRadius: "1rem", border: "1px solid #bbf7d0", background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", padding: "1.1rem 1.25rem", marginBottom: "1.5rem" }}>
              <p style={{ fontSize: "0.84rem", fontWeight: 600, color: "#15803d", lineHeight: 1.6 }}>{success}</p>
              <Link href="/sign-in" className="button-primary" style={{ display: "inline-flex", marginTop: "1rem" }}>
                Ir al ingreso
              </Link>
            </div>
          ) : (
            <form action={requestPasswordResetAction} className="form-shell">
              <div>
                <label className="field-label" htmlFor="email">Email</label>
                <input id="email" name="email" placeholder="tu@email.com" required autoComplete="email" type="email" />
              </div>

              {error ? (
                <div style={{ borderRadius: 12, border: "1px solid rgba(217,105,119,0.3)", background: "rgba(255,238,242,0.95)", padding: "0.85rem 1rem", fontSize: "0.82rem", fontWeight: 600, color: "#b83251" }}>
                  {error}
                </div>
              ) : null}

              <button className="button-primary w-full" type="submit">
                Enviar enlace
              </button>
            </form>
          )}
        </div>

        <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.75rem", color: "#b09aab" }}>
          Si la cuenta no existe, el sistema no lo revelara por privacidad.
        </p>
      </div>
    </main>
  );
}
