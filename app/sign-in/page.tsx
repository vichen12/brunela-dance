import Link from "next/link";
import { SignInForm } from "@/components/sign-in-form";
import { getDictionary } from "@/src/i18n/messages";

const copy = getDictionary("es");

type SignInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : null;
  const success = typeof params.success === "string" ? params.success : null;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : null;

  return (
    <main
      style={{ minHeight: "100vh", display: "grid", position: "relative", overflow: "hidden" }}
      className="lg:grid-cols-[1fr_1.15fr] flex flex-col"
    >
      {/* ── Global background glows ── */}
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", backgroundImage: "radial-gradient(ellipse 90% 80% at 10% 0%, #fbcfe8 0%, transparent 55%), radial-gradient(ellipse 70% 70% at 90% 10%, #fce7f3 0%, transparent 55%)", opacity: 0.75 }} />
      <div aria-hidden style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "55vh", zIndex: 0, pointerEvents: "none", background: "radial-gradient(ellipse 80% 80% at 50% 100%, #fdf2f8 0%, transparent 65%)", opacity: 0.85 }} />

      {/* ── Left: editorial panel ── */}
      <div
        className="relative hidden lg:flex items-center justify-center overflow-hidden"
        style={{
          background: "linear-gradient(155deg, rgba(252,231,243,0.88) 0%, rgba(253,242,248,0.72) 55%, rgba(255,255,255,0.55) 100%)",
          backdropFilter: "blur(4px)",
          borderRight: "1px solid rgba(252,231,243,0.7)",
          zIndex: 1,
          padding: "clamp(5rem, 8vh, 7rem) clamp(3rem, 5vw, 5rem)",
        }}
      >
        {/* ── Improved ballet arabesque SVG ── */}
        <svg
          viewBox="0 0 480 700"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
          style={{
            position: "absolute",
            right: "-4%",
            top: "50%",
            transform: "translateY(-50%)",
            height: "82%",
            width: "auto",
            opacity: 0.13,
            pointerEvents: "none",
          }}
        >
          {/* Hair bun */}
          <circle cx="222" cy="76" r="10" stroke="#be185d" strokeWidth="2"/>
          <path d="M 213 84 Q 216 88 222 90 Q 228 88 231 84" stroke="#be185d" strokeWidth="1.6" strokeLinecap="round"/>

          {/* Head */}
          <circle cx="220" cy="100" r="24" stroke="#be185d" strokeWidth="2.6"/>

          {/* Neck */}
          <path d="M 215 124 Q 213 136 212 148" stroke="#be185d" strokeWidth="2.6" strokeLinecap="round"/>

          {/* Shoulder line */}
          <path d="M 184 164 Q 212 156 240 164" stroke="#be185d" strokeWidth="2.4" strokeLinecap="round"/>

          {/* Torso spine — elegant curve for arabesque */}
          <path d="M 218 148 Q 214 182 212 216 Q 210 238 208 258" stroke="#be185d" strokeWidth="2.8" strokeLinecap="round"/>

          {/* Front arm — extended forward and gently up */}
          <path d="M 240 164 Q 286 152 330 136 Q 366 122 400 106" stroke="#be185d" strokeWidth="2.4" strokeLinecap="round"/>
          {/* Front wrist / hand */}
          <path d="M 400 106 Q 414 98 420 88" stroke="#be185d" strokeWidth="2" strokeLinecap="round"/>
          <path d="M 418 90 Q 416 82 410 78" stroke="#be185d" strokeWidth="1.6" strokeLinecap="round"/>

          {/* Back arm — going back and slightly low */}
          <path d="M 184 164 Q 148 158 110 148 Q 82 140 60 130" stroke="#be185d" strokeWidth="2.4" strokeLinecap="round"/>
          {/* Back wrist / hand */}
          <path d="M 60 130 Q 50 124 46 114" stroke="#be185d" strokeWidth="1.8" strokeLinecap="round"/>

          {/* Tutu — outer layer */}
          <path d="M 180 252 Q 166 272 158 288 Q 184 274 208 266 Q 232 274 258 288 Q 250 272 236 252" stroke="#be185d" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
          {/* Tutu — inner layer (slightly smaller, more opaque) */}
          <path d="M 186 248 Q 174 264 168 278 Q 190 267 208 262 Q 226 267 248 278 Q 242 264 230 248" stroke="#be185d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          {/* Tutu — subtle third layer */}
          <path d="M 192 244 Q 184 258 180 270 Q 196 263 208 260 Q 220 263 236 270 Q 232 258 224 244" stroke="#be185d" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>

          {/* Standing leg — straight, slight angle */}
          <path d="M 208 258 Q 204 320 200 390 Q 198 430 196 468" stroke="#be185d" strokeWidth="2.8" strokeLinecap="round"/>

          {/* Standing foot — demi-pointe */}
          <path d="M 196 468 Q 194 482 191 490" stroke="#be185d" strokeWidth="2.4" strokeLinecap="round"/>
          <path d="M 191 490 Q 182 496 170 494" stroke="#be185d" strokeWidth="2" strokeLinecap="round"/>
          {/* Toe box */}
          <path d="M 170 494 Q 162 492 158 486" stroke="#be185d" strokeWidth="1.6" strokeLinecap="round"/>

          {/* Arabesque leg — extended back and high */}
          <path d="M 214 262 Q 252 298 298 326 Q 346 354 392 372 Q 424 384 452 380" stroke="#be185d" strokeWidth="2.8" strokeLinecap="round"/>
          {/* Arabesque pointed foot */}
          <path d="M 452 380 Q 466 374 472 364" stroke="#be185d" strokeWidth="2.2" strokeLinecap="round"/>
          <path d="M 470 366 Q 468 358 462 354" stroke="#be185d" strokeWidth="1.6" strokeLinecap="round"/>

          {/* Floor line */}
          <line x1="106" y1="542" x2="292" y2="542" stroke="#be185d" strokeWidth="1.4" strokeLinecap="round" opacity="0.65"/>

          {/* Barre posts */}
          <line x1="106" y1="534" x2="106" y2="608" stroke="#be185d" strokeWidth="1.4" strokeLinecap="round" opacity="0.45"/>
          <line x1="292" y1="534" x2="292" y2="608" stroke="#be185d" strokeWidth="1.4" strokeLinecap="round" opacity="0.45"/>

          {/* Decorative dots */}
          <circle cx="44" cy="56" r="2.8" fill="#be185d" opacity="0.35"/>
          <circle cx="454" cy="460" r="2.2" fill="#be185d" opacity="0.3"/>
          <circle cx="28" cy="340" r="1.8" fill="#be185d" opacity="0.25"/>
          <circle cx="440" cy="200" r="1.6" fill="#be185d" opacity="0.22"/>
          <circle cx="472" cy="580" r="2" fill="#be185d" opacity="0.2"/>
          <circle cx="140" cy="580" r="1.5" fill="#be185d" opacity="0.18"/>
        </svg>

        {/* ── Centered editorial content (no logo, no chip) ── */}
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: "26rem" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "clamp(3rem, 4.5vw, 4.8rem)", lineHeight: 0.9, color: "#1c1917", marginBottom: "1.6rem" }}>
            Entrá a tu<br />estudio.
          </h1>

          <p style={{ fontSize: "0.88rem", color: "#78716c", lineHeight: 1.95, marginBottom: "2.5rem" }}>
            Un espacio privado con biblioteca, programas y clases en vivo para bailarinas que practican con foco.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", textAlign: "left", maxWidth: "22rem", margin: "0 auto" }}>
            {[
              { label: "Biblioteca", desc: "Clases on demand para tu plan" },
              { label: "Progreso", desc: "Retoma exactamente donde lo dejaste" },
              { label: "En vivo", desc: "Reserva y accede en tiempo real" },
            ].map((f) => (
              <div key={f.label} style={{ display: "flex", gap: "0.9rem", alignItems: "center" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#ec4899", flexShrink: 0 }} />
                <span style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#1c1917" }}>{f.label}</span>
                <span style={{ fontSize: "0.78rem", color: "#9d8a98" }}>— {f.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: form panel ── */}
      <div
        style={{
          background: "rgba(255,255,255,0.76)",
          backdropFilter: "blur(28px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "clamp(5.5rem, 9vh, 6.5rem) clamp(1.5rem, 6vw, 4rem)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ width: "100%", maxWidth: "400px" }}>

          {/* Mobile brand — visible only on small screens */}
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <Link href="/" style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", textDecoration: "none", lineHeight: 1 }}>
              <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "2rem", color: "#1c1917" }}>Brunela</span>
              <span style={{ fontSize: "0.46rem", fontWeight: 800, letterSpacing: "0.3em", textTransform: "uppercase", color: "#be185d", marginTop: "3px" }}>Studio</span>
            </Link>
          </div>

          <p style={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.3em", textTransform: "uppercase", color: "#be185d", marginBottom: "0.65rem" }}>
            Member sign in
          </p>
          <h2 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "clamp(2.2rem, 4vw, 2.9rem)", lineHeight: 0.93, color: "#1c1917", marginBottom: "0.7rem" }}>
            Volver al estudio.
          </h2>
          <p style={{ fontSize: "0.82rem", color: "#9d8a98", lineHeight: 1.85, marginBottom: "2rem" }}>
            {copy.auth.description}
          </p>

          <SignInForm error={error} success={success} callbackUrl={callbackUrl} />

          <div style={{ marginTop: "1.75rem", display: "flex", flexWrap: "wrap", gap: "0.2rem 0.5rem", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "#b09aab" }}>No sos miembro?</span>
            <Link href="/#planes" style={{ fontSize: "0.75rem", color: "#be185d", fontWeight: 600, textDecoration: "none" }}>Ver planes</Link>
            <span style={{ fontSize: "0.75rem", color: "#d4c4d0" }}>·</span>
            <Link href="/" style={{ fontSize: "0.75rem", color: "#b09aab", textDecoration: "none" }}>Volver al home</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
