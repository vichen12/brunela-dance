import { SkHero, SkGrid } from "@/components/skeleton";

/** Calendario: cabecera y la grilla del mes. */
export default function Loading() {
  return (
    <main style={{ fontFamily: "inherit" }}>
      <SkHero conBoton />
      <div style={{ marginTop: 22 }}><SkGrid n={14} ratio="7/5" /></div>
    </main>
  );
}
