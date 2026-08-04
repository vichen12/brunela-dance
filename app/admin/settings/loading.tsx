import { SkHero, SkFormulario } from "@/components/skeleton";

/** Ajustes: bloques de formulario acotados. */
export default function Loading() {
  return (
    <main style={{ fontFamily: "inherit" }}>
      <SkHero />
      <div style={{ marginTop: 22, display: "grid", gap: 16 }}>
        <SkFormulario campos={3} />
        <SkFormulario campos={2} />
      </div>
    </main>
  );
}
