import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { BrunelaFooter } from "@/components/ui/hover-footer";
import { T } from "@/components/language-provider";
import { PacksPublicos } from "@/components/packs-publicos";
import { leerPacksEnVenta } from "@/src/features/studio/packs-en-venta";

/** Un minuto de cache: es el enlace que se comparte en Instagram. Las acciones del panel la refrescan al toque. */
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Packs de clases · Brunela Dance Trainer",
  description: "Clases de ballet con un solo pago, tuyas para siempre. Sin suscripción ni renovación.",
  alternates: { canonical: "/packs" },
  openGraph: { title: "Packs de clases · Brunela Dance Trainer", description: "Clases de ballet con un solo pago, tuyas para siempre.", url: "/packs", images: ["/brand/og.png"] },
};

export default async function PacksPage() {
  const packs = await leerPacksEnVenta();
  return (
    <>
      <Navbar />
      <main className="sistema lp lp-tienda">
        {/* El titulo de la pagina para Google y lectores de pantalla; el que se ve es el de la seccion. */}
        <h1 className="sr-only">Packs de clases de ballet de Brunela Dance Trainer</h1>
        {packs.length > 0 ? (
          <PacksPublicos packs={packs} />
        ) : (
          <div className="lp-tienda-vacia">
            <h2 className="lp-packs-titulo"><T id="packs.emptyTitle" /></h2>
            <p className="lp-bajada"><T id="packs.emptyLead" /></p>
          </div>
        )}
      </main>
      <BrunelaFooter />
    </>
  );
}
