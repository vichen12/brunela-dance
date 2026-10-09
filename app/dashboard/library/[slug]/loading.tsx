import { Sk, SkTarjeta } from "@/components/skeleton";

/**
 * Detalle de clase: el reproductor enmarcado domina la pantalla y al costado
 * va la tarjeta del progreso con su anillo. El esqueleto tiene esa forma.
 */
const CSS = `
.fcsk { max-width: 1440px; margin: 0 auto; padding: clamp(16px, 2.6vw, 32px) clamp(16px, 3.4vw, 48px) 96px; }
.fcsk-grilla { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: clamp(20px, 2.6vw, 36px); align-items: start; }
.fcsk-video { padding: 10px; border-radius: 32px; background: #fff; border: 1px solid #F3E3DC; box-shadow: 0 34px 70px -34px rgba(176, 70, 70, 0.35); }
@media (max-width: 1020px) { .fcsk-grilla { grid-template-columns: minmax(0, 1fr); } }
`;

export default function Loading() {
  return (
    <main style={{ minHeight: "100vh", background: "#fff" }}>
      <style>{CSS}</style>
      <section className="fcsk">
        <Sk h={38} w={130} r={99} style={{ marginBottom: 20 }} />
        <div className="fcsk-grilla">
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            <div className="fcsk-video">
              <div className="sk" style={{ aspectRatio: "16/9", borderRadius: 22, backgroundImage: "linear-gradient(90deg, #FFF3EF 25%, #FBE6DF 50%, #FFF3EF 75%)" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 4px 2px" }}>
              <Sk h={26} w={110} r={99} />
              <Sk h={38} w={360} r={12} style={{ maxWidth: "100%" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <Sk h={34} w={90} r={99} />
                <Sk h={34} w={140} r={99} />
              </div>
            </div>
            <SkTarjeta style={{ display: "grid", gap: 12 }}>
              <Sk h={16} w={160} />
              <Sk h={12} w="90%" />
              <Sk h={12} w="70%" />
            </SkTarjeta>
          </div>
          <SkTarjeta style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <Sk h={16} w={110} />
            <Sk h={148} w={148} r={999} />
            <Sk h={28} w={160} r={99} />
            <Sk h={11} w="80%" />
          </SkTarjeta>
        </div>
      </section>
    </main>
  );
}
