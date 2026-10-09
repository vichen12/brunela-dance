import { SkHero, SkMetricas, SkTarjeta, Sk } from "@/components/skeleton";

/** Analiticas: cuatro numeros y despues los bloques con nombre de pregunta. */
export default function Loading() {
  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <section style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
