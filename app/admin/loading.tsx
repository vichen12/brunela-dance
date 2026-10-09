import { Sk, SkTarjeta } from "@/components/skeleton";

/** Resumen: bienvenida, cuatro cifras, clases recientes y el estudio al costado. */
export default function Loading() {
  return (
    <main style={{ fontFamily: "inherit" }}>
      {/* La tarjeta de bienvenida en rubor, como AdminCabecera. */}
      <div style={{
        borderRadius: 32, border: "1px solid #F3E3DC", padding: "clamp(24px, 3.4vw, 40px) clamp(22px, 3.4vw, 44px)",
        background: "linear-gradient(120deg, #FFF1EC 0%, #FFF7F3 55%, #FFEFE6 100%)",
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap",
      }}>
        <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 12 }}>
          <Sk h={26} w={170} r={99} style={{ backgroundImage: "none", background: "#fff" }} />
          <Sk h={44} w={320} r={16} style={{ maxWidth: "100%" }} />
          <Sk h={14} w={440} style={{ maxWidth: "100%" }} />
        </div>
        <Sk h={48} w={170} r={99} />
      </div>
      <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <SkTarjeta key={i} style={{ padding: "18px 20px" }}>
            <Sk h={12} w={90} />
            <Sk h={34} w={60} r={12} style={{ marginTop: 12 }} />
            <Sk h={10} w={120} style={{ marginTop: 10 }} />
          </SkTarjeta>
        ))}
      </div>
      <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 22 }}>
        <SkTarjeta style={{ borderRadius: 28 }}>
          <Sk h={22} w={180} r={10} />
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 14 }}>
            {Array.from({ length: 4 }, (_, i) => <Sk key={i} h={190} r={22} />)}
          </div>
        </SkTarjeta>
        <SkTarjeta style={{ borderRadius: 28 }}>
          <Sk h={16} w={110} />
          <Sk h={50} w={90} r={14} style={{ marginTop: 14 }} />
          <Sk h={14} r={99} style={{ marginTop: 20 }} />
          {Array.from({ length: 4 }, (_, i) => <Sk key={i} h={14} w="85%" style={{ marginTop: 14 }} />)}
        </SkTarjeta>
      </div>
    </main>
  );
}
