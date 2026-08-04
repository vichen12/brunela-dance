import { SkHero, SkMetricas, SkFilas } from "@/components/skeleton";

/** Alumnas: fila de totales y el listado paginado. */
export default function Loading() {
  return (
    <main style={{ fontFamily: "inherit" }}>
      <SkHero />
      <div style={{ marginTop: 20 }}><SkMetricas n={4} /></div>
      <div style={{ marginTop: 22 }}><SkFilas n={8} alto={74} /></div>
    </main>
  );
}
