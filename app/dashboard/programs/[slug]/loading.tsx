import { SkHero, SkFilas } from "@/components/skeleton";

/** Detalle de programa: la lista de dias. */
export default function Loading() {
  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">
        <SkHero />
        <SkFilas n={7} alto={70} />
      </section>
    </main>
  );
}
