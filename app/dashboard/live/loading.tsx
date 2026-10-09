import { SkHero, SkTarjeta, Sk } from "@/components/skeleton";

/**
 * En vivo: la cabecera y tres tarjetas con su bloque de fecha a la izquierda,
 * la misma forma que la pantalla real para que no salte al cargar.
 * La animacion vive en globals.css (.sk).
 */
export default function LiveLoading() {
  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">
        <SkHero />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <SkTarjeta key={i} style={{ display: "flex", gap: 20, alignItems: "stretch" }}>
              <Sk h={108} w={92} r={22} />
              <div style={{ flex: 1, display: "grid", gap: 10, alignContent: "start", paddingTop: 4 }}>
                <Sk h={22} w={130} r={99} />
                <Sk h={24} w="55%" r={10} />
                <Sk h={12} w="80%" />
                <Sk h={44} w={180} r={99} />
              </div>
            </SkTarjeta>
          ))}
        </div>
      </section>
    </main>
  );
}
