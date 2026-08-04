import { SkHero, SkMetricas, SkGrid } from "@/components/skeleton";

/** Resumen: cuatro metricas arriba y la rejilla de accesos rapidos. */
export default function Loading() {
  return (
    <main style={{ fontFamily: "inherit" }}>
      <SkHero />
      <div style={{ marginTop: 20 }}><SkMetricas n={4} /></div>
      <div style={{ marginTop: 22 }}><SkGrid n={8} ratio="3/2" /></div>
    </main>
  );
}
