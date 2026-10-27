import { Sk, SkTarjeta } from "@/components/skeleton";

/** Categorias: aviso, alta plegada y grilla de tarjetas. */
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
      <Sk h={74} r={24} style={{ marginTop: 14 }} />
      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap: 18 }}>
        {Array.from({ length: 8 }, (_, i) => (
          <SkTarjeta key={i} style={{ padding: 10, borderRadius: 28 }}>
            <Sk h={110} r={20} />
            <div style={{ padding: "14px 10px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
              <Sk h={22} w={100} r={99} />
              <Sk h={20} w="70%" r={10} />
              <Sk h={40} w={150} r={99} />
            </div>
          </SkTarjeta>
        ))}
      </div>
    </main>
  );
}
