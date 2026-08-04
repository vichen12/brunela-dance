import { SkHero, SkFilas } from "@/components/skeleton";

/** Clases: listado con acciones a la derecha. */
export default function Loading() {
  return (
    <main style={{ fontFamily: "inherit" }}>
      <SkHero />
      <div style={{ marginTop: 22 }}><SkFilas n={8} /></div>
    </main>
  );
}
