import { Sk, SkTarjeta } from "@/components/skeleton";

/** Detalle de clase: el reproductor domina la pantalla, asi que el esqueleto tambien. */
export default function Loading() {
  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">
        <Sk style={{ aspectRatio: "16/9" }} r={22} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Sk h={12} w={130} />
          <Sk h={38} w={360} r={12} />
          <Sk h={13} w="72%" />
        </div>
        <SkTarjeta style={{ display: "grid", gap: 10 }}>
          {[0, 1, 2].map((i) => <Sk key={i} h={40} r={12} />)}
        </SkTarjeta>
      </section>
    </main>
  );
}
