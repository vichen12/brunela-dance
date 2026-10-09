import { SkHero, SkFilas } from "@/components/skeleton";

/** Sesiones privadas: cabecera, la proxima y la lista. */
export default function Loading() {
  return (
    <main style={{ fontFamily: "inherit" }}>
      <SkHero />
      <div style={{ marginTop: 20 }}><SkFilas n={3} alto={110} /></div>
    </main>
  );
}
