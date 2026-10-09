import { SkHero, SkFilas } from "@/components/skeleton";

/** Mi perfil: cabecera, foto y formulario. */
export default function Loading() {
  return (
    <main style={{ fontFamily: "inherit" }}>
      <SkHero />
      <div style={{ marginTop: 20 }}><SkFilas n={3} alto={90} /></div>
    </main>
  );
}
