import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, Lock, PlayCircle } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { BrunelaFooter } from "@/components/ui/hover-footer";
import { T } from "@/components/language-provider";
import { PrecioConOferta } from "@/components/precio-con-oferta";
import { leerPacksEnVenta } from "@/src/features/studio/packs-en-venta";
import { getClasesDelPack, precio } from "@/src/features/studio/packs";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

async function buscar(slug: string) {
  return (await leerPacksEnVenta()).find((p) => p.slug === slug) ?? null;
}

/** La tarjeta que se ve al pegar el enlace en WhatsApp o Instagram. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const pack = await buscar((await params).slug);
  if (!pack) return { title: "Packs de clases · Brunela Dance Trainer" };
  const titulo = `${pack.name_i18n?.es ?? pack.slug} · Brunela Dance Trainer`;
  const descripcion = pack.description_i18n?.es || "Un pack de clases de ballet con un solo pago, tuyas para siempre.";
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/packs/${pack.slug}` },
    openGraph: { title: titulo, description: descripcion, url: `/packs/${pack.slug}`, images: [pack.cover_image_url || "/brand/og.png"] },
  };
}

/**
 * Un pack, para compartir. Se ve entero sin cuenta: la cuenta se pide recien al
 * tocar comprar (/registro?pack=, que a quien ya tiene sesion la lleva a pagar).
 *
 * ⚠️ getClasesDelPack devuelve titulo, duracion y portada: nunca con que
 *    reproducir la clase. Lo que vende el pack se puede mirar; verlo, no.
 */
export default async function PackPublicoPage({ params }: Props) {
  const pack = await buscar((await params).slug);
  if (!pack) notFound();
  const clases = await getClasesDelPack(pack.id);
  // Ficha de producto para Google: nombre, precio y que se puede comprar.
  const ficha = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: pack.name_i18n?.es ?? pack.slug,
    description: pack.description_i18n?.es || undefined,
    image: pack.cover_image_url || "https://bruneladance.com/brand/og.png",
    brand: { "@type": "Brand", name: "Brunela Dance Trainer" },
    offers: {
      "@type": "Offer",
      url: `https://bruneladance.com/packs/${pack.slug}`,
      priceCurrency: pack.currency.toUpperCase(),
      price: ((pack.oferta?.precioCentimos ?? pack.price_cents) / 100).toFixed(2),
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ficha).replace(/</g, "\\u003c") }} />
      <Navbar />
      <main className="sistema lp lp-tienda">
        <div className="lpk">
          <Link href={"/packs" as never} className="lpk-volver">
            <ArrowLeft size={15} strokeWidth={2.4} aria-hidden /> <T id="packs.all" />
          </Link>

          <div className="lpk-cabeza">
            {pack.cover_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pack.cover_image_url} alt="" className="lpk-portada" />
            )}
            <div className="lpk-datos">
              <h1 className="lpk-nombre">{pack.name_i18n?.es ?? pack.slug}</h1>
              {pack.description_i18n?.es && <p className="lpk-desc">{pack.description_i18n.es}</p>}
              <p className="lp-pack-precio">
                {pack.oferta ? <PrecioConOferta centimos={pack.price_cents} moneda={pack.currency} oferta={pack.oferta} /> : precio(pack.price_cents, pack.currency)}
                <span><T id="packs.oneTime" /> · <T id="packs.forever" /></span>
              </p>
              {pack.solo_para ? (
                <>
                  <span className="lp-pack-solo">
                    <Lock size={12} strokeWidth={2.6} aria-hidden />
                    <T id="packs.onlyFor" replacements={{ planes: pack.solo_para }} />
                  </span>
                  <Link href={"/#planes" as never} className="lp-pack-accion"><T id="packs.seePlans" /> <ArrowRight size={15} strokeWidth={2.4} aria-hidden /></Link>
                </>
              ) : (
                <Link href={`/registro?pack=${pack.slug}` as never} className="lp-pack-accion"><T id="packs.cta" /> <ArrowRight size={15} strokeWidth={2.4} aria-hidden /></Link>
              )}
            </div>
          </div>

          <h2 className="lpk-subtitulo">
            {clases.length === 1 ? <T id="packs.oneClass" /> : <T id="packs.nClasses" replacements={{ n: clases.length }} />}
          </h2>
          <ul className="lpk-clases">
            {clases.map((c) => (
              <li key={c.slug} className="lpk-clase">
                <span className="lpk-clase-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.portada ? <img src={c.portada} alt="" loading="lazy" /> : <PlayCircle size={20} strokeWidth={2} aria-hidden />}
                </span>
                <span className="lpk-clase-txt">
                  <strong>{c.titulo}</strong>
                  {c.minutos > 0 && <small><Clock size={12} strokeWidth={2.4} aria-hidden /> {c.minutos} min</small>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <BrunelaFooter />
    </>
  );
}
