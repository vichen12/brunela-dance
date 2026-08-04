import { SkHero, SkTarjeta, Sk } from "@/components/skeleton";

/** Planes: tres tarjetas de precio, una al lado de la otra. */
export default function Loading() {
  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">
        <SkHero />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <SkTarjeta key={i} style={{ display: "grid", gap: 12 }}>
              <Sk h={12} w={100} />
              <Sk h={38} w={140} r={10} />
              {[0, 1, 2, 3].map((k) => <Sk key={k} h={11} w={`${65 + k * 7}%`} />)}
              <Sk h={46} r={999} style={{ marginTop: 6 }} />
            </SkTarjeta>
          ))}
        </div>
      </section>
    </main>
  );
}
