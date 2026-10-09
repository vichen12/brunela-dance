import { SkHero, SkMetricas, SkFilas } from "@/components/skeleton";

/** Anuncios: alta arriba y listado abajo. */
export default function Loading() {
  return (
    <main style={{ fontFamily: "inherit" }}>
      <SkHero />
      <div style={{ marginTop: 20 }}><SkMetricas n={3} /></div>
      <div style={{ marginTop: 22 }}><SkFilas n={5} /></div>
    </main>
  );
}
