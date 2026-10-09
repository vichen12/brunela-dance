import { Sk } from "@/components/skeleton";

/**
 * Esqueleto de la biblioteca: la tarjeta de cabecera, el buscador en pildora,
 * las categorias y la grilla de tarjetas con la portada adentro. Misma forma
 * que la pagina, para que nada salte al llegar.
 */
const HERO = "linear-gradient(120deg, #FFF1EC 0%, #FFF7F3 55%, #FFEFE6 100%)";

export default function LibraryLoading() {
  return (
    <main className="pb-20 md:pb-28" style={{ minHeight: "100vh", background: "#fff" }}>
      <section style={{ maxWidth: 1440, margin: "0 auto", padding: "clamp(20px, 3vw, 40px) clamp(16px, 3.4vw, 48px) 0" }}>
        <div style={{ background: HERO, border: "1px solid #F3E3DC", borderRadius: 32, padding: "clamp(24px, 3.2vw, 40px) clamp(22px, 3.2vw, 44px)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ width: 170, height: 28, borderRadius: 99, background: "#fff" }} />
          <Sk h={42} w={300} r={14} style={{ maxWidth: "100%" }} />
          <Sk h={14} w={420} style={{ maxWidth: "90%" }} />
        </div>

        <Sk h={52} w={520} r={99} style={{ maxWidth: "100%", marginTop: 22 }} />
        <div style={{ display: "flex", gap: 8, marginTop: 22, overflow: "hidden" }}>
          {[96, 80, 110, 90, 120, 84].map((w, i) => <Sk key={i} h={38} w={w} r={99} style={{ flexShrink: 0 }} />)}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(270px, 100%), 1fr))", gap: 24, marginTop: 30 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid #F3E3DC", borderRadius: 28, padding: 10, display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="sk" style={{ aspectRatio: "16/11", borderRadius: 20, backgroundImage: "linear-gradient(90deg, #FFF3EF 25%, #FBE6DF 50%, #FFF3EF 75%)" }} />
              <div style={{ padding: "2px 8px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
                <Sk h={22} w={86} r={99} />
                <Sk h={16} w="80%" />
                <Sk h={11} w="45%" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
