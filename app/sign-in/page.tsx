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
      style={{ minHeight: "100vh", display: "grid", position: "relative" }}
      className="lg:grid-cols-[1fr_1.15fr] flex flex-col"
    >
      {/* ── Global background glows ── */}
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", backgroundImage: "radial-gradient(ellipse 90% 80% at 10% 0%, #fbcfe8 0%, transparent 55%), radial-gradient(ellipse 70% 70% at 90% 10%, #fce7f3 0%, transparent 55%)", opacity: 0.75 }} />
      <div aria-hidden style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "55vh", zIndex: 0, pointerEvents: "none", background: "radial-gradient(ellipse 80% 80% at 50% 100%, #fdf2f8 0%, transparent 65%)", opacity: 0.85 }} />

      {/* ── Ballet dancer SVG — shared between mobile banner and desktop panel ── */}
      {(() => {
        const DancerSvg = ({ opacity = 0.13 }: { opacity?: number }) => (
          <svg
            viewBox="0 0 480 700"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
            style={{ width: "100%", height: "100%", pointerEvents: "none" }}
          >
            {/* Hair bun */}
            <circle cx="222" cy="72" r="11" stroke="#be185d" strokeWidth="2.2" opacity={opacity}/>
            {/* Connecting bun to head */}
            <path d="M 212 78 Q 216 86 222 88 Q 228 86 232 78" stroke="#be185d" strokeWidth="2" strokeLinecap="round" opacity={opacity}/>

            {/* Head — moved down slightly to close bun gap */}
            <circle cx="220" cy="106" r="26" stroke="#be185d" strokeWidth="2.6" opacity={opacity}/>

            {/* Neck — starts at exact bottom of head (cy+r = 132), meets torso at same x */}
            <path d="M 220 132 Q 218 144 216 156" stroke="#be185d" strokeWidth="2.8" strokeLinecap="round" opacity={opacity}/>

            {/* Shoulder line — crosses through the neck end point */}
            <path d="M 182 168 Q 216 158 244 168" stroke="#be185d" strokeWidth="2.4" strokeLinecap="round" opacity={opacity}/>

            {/* Torso spine — continuous from neck bottom */}
            <path d="M 216 156 Q 214 188 212 220 Q 210 240 208 260" stroke="#be185d" strokeWidth="2.8" strokeLinecap="round" opacity={opacity}/>

            {/* Front arm */}
            <path d="M 244 168 Q 290 154 334 138 Q 368 124 402 108" stroke="#be185d" strokeWidth="2.4" strokeLinecap="round" opacity={opacity}/>
            <path d="M 402 108 Q 416 100 422 90" stroke="#be185d" strokeWidth="2" strokeLinecap="round" opacity={opacity}/>
            <path d="M 420 92 Q 418 84 412 80" stroke="#be185d" strokeWidth="1.6" strokeLinecap="round" opacity={opacity}/>

            {/* Back arm */}
            <path d="M 182 168 Q 146 160 108 150 Q 80 142 58 132" stroke="#be185d" strokeWidth="2.4" strokeLinecap="round" opacity={opacity}/>
            <path d="M 58 132 Q 48 126 44 116" stroke="#be185d" strokeWidth="1.8" strokeLinecap="round" opacity={opacity}/>

            {/* Tutu layers */}
            <path d="M 178 254 Q 164 274 156 290 Q 182 276 208 268 Q 234 276 260 290 Q 252 274 238 254" stroke="#be185d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={opacity}/>
            <path d="M 185 250 Q 173 266 167 280 Q 190 269 208 264 Q 226 269 249 280 Q 243 266 231 250" stroke="#be185d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={opacity * 0.85}/>
            <path d="M 192 246 Q 183 260 179 272 Q 196 265 208 262 Q 220 265 237 272 Q 233 260 224 246" stroke="#be185d" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" opacity={opacity * 0.7}/>

            {/* Standing leg */}
            <path d="M 208 260 Q 204 322 200 392 Q 198 432 196 470" stroke="#be185d" strokeWidth="2.8" strokeLinecap="round" opacity={opacity}/>
            <path d="M 196 470 Q 194 484 191 492" stroke="#be185d" strokeWidth="2.4" strokeLinecap="round" opacity={opacity}/>
            <path d="M 191 492 Q 182 498 170 496" stroke="#be185d" strokeWidth="2" strokeLinecap="round" opacity={opacity}/>
            <path d="M 170 496 Q 162 494 158 488" stroke="#be185d" strokeWidth="1.6" strokeLinecap="round" opacity={opacity}/>

            {/* Arabesque leg */}
            <path d="M 214 264 Q 252 300 300 328 Q 348 356 394 374 Q 426 386 454 382" stroke="#be185d" strokeWidth="2.8" strokeLinecap="round" opacity={opacity}/>
            <path d="M 454 382 Q 468 376 474 366" stroke="#be185d" strokeWidth="2.2" strokeLinecap="round" opacity={opacity}/>
            <path d="M 472 368 Q 470 360 464 356" stroke="#be185d" strokeWidth="1.6" strokeLinecap="round" opacity={opacity}/>

            {/* Floor & barre */}
            <line x1="106" y1="544" x2="292" y2="544" stroke="#be185d" strokeWidth="1.4" strokeLinecap="round" opacity={opacity * 0.65}/>
            <line x1="106" y1="536" x2="106" y2="610" stroke="#be185d" strokeWidth="1.4" strokeLinecap="round" opacity={opacity * 0.45}/>
            <line x1="292" y1="536" x2="292" y2="610" stroke="#be185d" strokeWidth="1.4" strokeLinecap="round" opacity={opacity * 0.45}/>

            {/* Decorative dots */}
            <circle cx="44" cy="56" r="2.8" fill="#be185d" opacity={opacity * 0.35}/>
            <circle cx="454" cy="460" r="2.2" fill="#be185d" opacity={opacity * 0.3}/>
            <circle cx="28" cy="340" r="1.8" fill="#be185d" opacity={opacity * 0.25}/>
            <circle cx="440" cy="200" r="1.6" fill="#be185d" opacity={opacity * 0.22}/>
          </svg>
        );

        return (
          <>
            {/* Mobile: compact banner at top with dancer behind text */}
            <div
              className="relative flex lg:hidden items-center justify-center overflow-hidden"
              style={{
                background: "linear-gradient(155deg, rgba(252,231,243,0.9) 0%, rgba(253,242,248,0.75) 100%)",
                padding: "2.5rem 1.5rem 2rem",
                minHeight: 180,
                zIndex: 1,
              }}
            >
              <div style={{ position: "absolute", inset: 0, opacity: 1 }}>
                <DancerSvg opacity={0.18} />
              </div>
              <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
                <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "2.4rem", lineHeight: 0.92, color: "#1c1917", marginBottom: "0.6rem" }}>
                  Entrá a tu estudio.
                </h1>
                <p style={{ fontSize: "0.8rem", color: "#78716c", lineHeight: 1.6 }}>
                  Biblioteca, programas y clases en vivo.
                </p>
              </div>
            </div>

            {/* Desktop: full editorial left panel */}
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
              <div style={{ position: "absolute", right: "-4%", top: "50%", transform: "translateY(-50%)", height: "82%", width: "auto", aspectRatio: "480/700" }}>
                <DancerSvg opacity={0.13} />
              </div>

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
          </>
        );
      })()}

      {/* ── Right: form panel ── */}
      <div
        style={{
          background: "rgba(255,255,255,0.76)",
          backdropFilter: "blur(28px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          /* 64px navbar + extra breathing room */
          padding: "clamp(7rem, 11vh, 8rem) clamp(1.5rem, 6vw, 4rem) clamp(3rem, 6vh, 5rem)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ width: "100%", maxWidth: "400px" }}>

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
