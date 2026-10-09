import { Sk, SkTarjeta } from "@/components/skeleton";

/** Clases: cifras, el alta plegada y tarjetas horizontales con portada. */
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
        {Array.from({ length: 3 }, (_, i) => (
          <SkTarjeta key={i} style={{ padding: "18px 20px" }}>
            <Sk h={12} w={90} />
            <Sk h={34} w={60} r={12} style={{ marginTop: 12 }} />
            <Sk h={10} w={120} style={{ marginTop: 10 }} />
          </SkTarjeta>
        ))}
      </div>
      <Sk h={74} r={24} style={{ marginTop: 14 }} />
      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <SkTarjeta key={i} style={{ padding: 14, borderRadius: 28, display: "flex", gap: 22, alignItems: "center" }}>
            <Sk h={140} w={220} r={20} style={{ flexShrink: 0, maxWidth: "40%" }} />
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              <Sk h={22} w={90} r={99} />
              <Sk h={20} w="60%" r={10} />
              <Sk h={28} w="80%" r={99} />
            </div>
          </SkTarjeta>
        ))}
      </div>
    </main>
  );
}
