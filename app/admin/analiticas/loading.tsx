import { SkHero, SkMetricas, SkTarjeta, Sk } from "@/components/skeleton";

/** Analiticas: cuatro numeros y despues los bloques con nombre de pregunta. */
export default function Loading() {
  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">
        <SkHero conBoton />
        <SkMetricas n={4} />
        {[0, 1, 2, 3].map((i) => (
          <SkTarjeta key={i}>
            <Sk h={20} w={280} r={8} />
            <div style={{ display: "grid", gap: 9, marginTop: 18 }}>
              {[0, 1, 2].map((k) => <Sk key={k} h={46} r={14} />)}
            </div>
          </SkTarjeta>
        ))}
      </section>
    </main>
  );
}
