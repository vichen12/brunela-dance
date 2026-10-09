import { SkHero, SkFilas } from "@/components/skeleton";

/** Packs: cabecera y tarjetas. */
export default function Loading() {
  return (
    <main style={{ fontFamily: "inherit" }}>
      <SkHero />
      <div style={{ marginTop: 20 }}><SkFilas n={3} alto={120} /></div>
    </main>
  );
}
