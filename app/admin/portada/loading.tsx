import { SkHero, SkFormulario } from "@/components/skeleton";

/**
 * Portada: dos bloques de formulario -- el tráiler con los certificados, y el
 * FAQ. Es una pantalla lenta de verdad: lee `landing_texts` y `landing_faq`
 * contra Fráncfort antes de pintar nada.
 */
export default function Loading() {
  return (
    <main style={{ fontFamily: "inherit" }}>
      <SkHero />
      <div style={{ marginTop: 22, display: "grid", gap: 16 }}>
        <SkFormulario campos={3} />
        <SkFormulario campos={4} />
      </div>
    </main>
  );
}
