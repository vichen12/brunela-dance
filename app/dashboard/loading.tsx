import { Sk, SkTarjeta } from "@/components/skeleton";

/**
 * Esqueleto del inicio de la alumna. Tiene la MISMA forma que la pagina: la
 * tarjeta del saludo, tres cifras pastel, "Continua viendo" y la fila "Para
 * hoy". La animacion vive en globals.css (.sk); el tono calido lo pone Sk.
 */
const HERO = "linear-gradient(120deg, #FFF1EC 0%, #FFF7F3 55%, #FFEFE6 100%)";
const PASTELES = ["#FFF2EE", "#FFF4E8", "#FFF4E8"];

export default function DashboardLoading() {
  return (
    <main className="pb-20 md:pb-10" style={{ minHeight: "100vh", background: "#fff" }}>
      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "clamp(20px, 3vw, 36px) clamp(16px, 3vw, 32px)", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Saludo */}
        <div style={{ background: HERO, border: "1px solid #F3E3DC", borderRadius: 32, padding: "clamp(24px, 3.4vw, 38px) clamp(22px, 3.4vw, 40px)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ width: 170, height: 28, borderRadius: 99, background: "#fff" }} />
          <Sk h={40} w={340} r={14} style={{ maxWidth: "100%" }} />
          <Sk h={14} w={260} style={{ maxWidth: "80%" }} />
        </div>

        {/* Cifras */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          {PASTELES.map((fondo, i) => (
            <div key={i} style={{ background: fondo, borderRadius: 24, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ width: 44, height: 44, borderRadius: 15, background: "#fff", flexShrink: 0 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Sk h={26} w={44} r={10} />
                <Sk h={11} w={80} />
              </div>
            </div>
          ))}
        </div>

        {/* Continua viendo */}
        <SkTarjeta style={{ borderRadius: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Sk h={36} w={36} r={13} />
            <Sk h={14} w={140} />
          </div>
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <Sk w={190} h={119} r={20} style={{ maxWidth: "100%" }} />
            <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 10 }}>
              <Sk h={22} w={90} r={99} />
              <Sk h={16} w="70%" />
              <Sk h={8} w="100%" r={99} />
            </div>
          </div>
        </SkTarjeta>

        {/* Para hoy */}
        <div>
          <Sk h={18} w={180} style={{ marginBottom: 14 }} />
          <div style={{ display: "flex", gap: 14, overflow: "hidden" }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ flex: "0 0 auto", width: 220, background: "#fff", border: "1px solid #F3E3DC", borderRadius: 24, padding: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                <Sk h={153} r={18} />
                <Sk h={20} w={80} r={99} style={{ marginLeft: 6 }} />
                <Sk h={13} w="75%" style={{ margin: "0 6px 8px" }} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
