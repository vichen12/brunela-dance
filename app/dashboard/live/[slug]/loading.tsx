import { Sk, SkTarjeta } from "@/components/skeleton";

/** Perfil de una clase en vivo: portada grande, texto y la tarjeta de reserva. */
export default function Loading() {
  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Sk h={38} w={150} r={99} />
        <Sk h={300} w="100%" r={32} />
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260, display: "grid", gap: 12, alignContent: "start" }}>
            <Sk h={26} w={140} r={99} />
            <Sk h={44} w="75%" r={12} />
            <Sk h={16} w="40%" />
            <Sk h={14} w="90%" />
            <Sk h={14} w="80%" />
          </div>
          <SkTarjeta style={{ width: 340, maxWidth: "100%", display: "grid", gap: 12 }}>
            <Sk h={40} w={160} r={99} />
            <Sk h={22} w="60%" />
            <Sk h={50} w="100%" r={99} />
          </SkTarjeta>
        </div>
      </section>
    </main>
  );
}
