import { SkHero, SkFormulario } from "@/components/skeleton";

/**
 * Precios: es la pantalla MAS LENTA del panel.
 *
 * Consulta a Stripe el importe real de cada identificador para poder avisar si
 * no coincide con lo que se anuncia: hasta 12 llamadas de los planes mas 2 por
 * pack, todas en paralelo pero por red. Sin esqueleto se ve colgada, y el
 * primer instinto es volver a tocar el enlace.
 */
export default function Loading() {
  return (
    <main style={{ fontFamily: "inherit" }}>
      <SkHero />
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "26px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="sk" style={{ height: 42, borderRadius: 14 }} />
        <SkFormulario campos={6} />
        <SkFormulario campos={3} />
      </div>
    </main>
  );
}
