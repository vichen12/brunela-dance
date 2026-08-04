import { SkHero, SkFilas } from "@/components/skeleton";

/** Programas: filas plegables con sus dias. */
export default function Loading() {
  return (
    <main style={{ fontFamily: "inherit" }}>
      <SkHero />
      <div style={{ marginTop: 22 }}><SkFilas n={6} /></div>
    </main>
  );
}
