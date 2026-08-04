import { SkHero, SkTarjeta, Sk } from "@/components/skeleton";

/** Ficha de alumna: numeros de un vistazo y despues plan, objetivos y clases. */
export default function Loading() {
  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">
        <SkHero conBoton />
        <SkTarjeta style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 20 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i}><Sk h={30} w={54} r={8} /><Sk h={10} w={90} style={{ marginTop: 8 }} /></div>
          ))}
        </SkTarjeta>
        {[0, 1, 2].map((i) => (
          <SkTarjeta key={i}>
            <Sk h={18} w={190} r={8} />
            <div style={{ display: "grid", gap: 9, marginTop: 16 }}>
              {[0, 1, 2].map((k) => <Sk key={k} h={44} r={14} />)}
            </div>
          </SkTarjeta>
        ))}
      </section>
    </main>
  );
}
