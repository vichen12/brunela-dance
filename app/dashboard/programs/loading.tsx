import { SkHero, SkGrid } from "@/components/skeleton";

/** Programas: rejilla de tarjetas. */
export default function Loading() {
  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">
        <SkHero />
        <SkGrid n={6} />
      </section>
    </main>
  );
}
