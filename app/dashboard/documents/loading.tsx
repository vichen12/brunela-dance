import { SkHero, SkGrid, Sk } from "@/components/skeleton";

/** Documentos: filtros y rejilla de archivos. */
export default function Loading() {
  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">
        <SkHero />
        <div style={{ display: "flex", gap: 6 }}>
          {[70, 90, 84, 76].map((w, i) => <Sk key={i} h={34} w={w} r={99} />)}
        </div>
        <SkGrid n={6} ratio="16/9" />
      </section>
    </main>
  );
}
