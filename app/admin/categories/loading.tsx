import { SkHero, SkFilas } from "@/components/skeleton";

/** Categorias: listado corto. */
export default function Loading() {
  return (
    <main style={{ fontFamily: "inherit" }}>
      <SkHero />
      <div style={{ marginTop: 22 }}><SkFilas n={6} /></div>
    </main>
  );
}
