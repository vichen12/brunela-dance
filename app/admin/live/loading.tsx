import { SkHero, SkFilas } from "@/components/skeleton";

/** Sesiones en vivo: proximas y pasadas. */
export default function Loading() {
  return (
    <main style={{ fontFamily: "inherit" }}>
      <SkHero />
      <div style={{ marginTop: 22 }}><SkFilas n={6} /></div>
    </main>
  );
}
