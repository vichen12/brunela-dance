import { SkHero, SkFilas } from "@/components/skeleton";

/** Invitar alumna: la cabecera y el formulario. */
export default function Loading() {
  return (
    <main style={{ fontFamily: "inherit" }}>
      <SkHero />
      <div style={{ marginTop: 20 }}><SkFilas n={3} /></div>
    </main>
  );
}
