import { SkHero, SkFilas } from "@/components/skeleton";

/** Mi agenda: cabecera y el calendario. */
export default function Loading() {
  return (
    <main style={{ fontFamily: "inherit" }}>
      <SkHero />
      <div style={{ marginTop: 20 }}><SkFilas n={4} alto={90} /></div>
    </main>
  );
}
