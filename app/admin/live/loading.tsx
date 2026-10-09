import { SkHero, SkMetricas, SkFilas } from "@/components/skeleton";

/** Sesiones en vivo: proximas y pasadas. */
export default function Loading() {
  return (
    <main style={{ fontFamily: "inherit" }}>
      <SkHero />
      <div style={{ marginTop: 20 }}><SkMetricas n={3} /></div>
      <div style={{ marginTop: 22 }}><SkFilas n={6} /></div>
    </main>
  );
}
