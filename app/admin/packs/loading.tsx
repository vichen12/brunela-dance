import { SkHero, SkFilas } from "@/components/skeleton";

/** Packs: el formulario de alta arriba y la lista debajo. */
export default function Loading() {
  return (
    <main style={{ fontFamily: "inherit" }}>
      <SkHero />
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "26px 28px" }}>
        <div className="sk" style={{ height: 96, borderRadius: 22, marginBottom: 18 }} />
        <SkFilas n={4} alto={74} />
      </div>
    </main>
  );
}
