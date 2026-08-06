import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { ArcGalleryHero } from "@/components/ui/arc-gallery-hero-component";
import { BrunelaFooter } from "@/components/ui/hover-footer";
import { InteractiveSelector } from "@/components/ui/interactive-selector";
import { PricingPlans } from "@/components/pricing-plans";
import { PacksPublicos, type PackPublico } from "@/components/packs-publicos";
import { getSubscriptionCatalog } from "@/src/lib/stripe/catalog";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { VideoShowcase } from "@/components/video-showcase";
import { T } from "@/components/language-provider";
import type { PublicMessageKey } from "@/src/i18n/public";

function GrainTexture() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        opacity: 0.028,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat",
        backgroundSize: "200px 200px",
      }}
    />
  );
}

function DotGrid() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        backgroundImage: "radial-gradient(circle, rgba(217,52,56,0.045) 1px, transparent 1px)",
        backgroundSize: "26px 26px",
      }}
    />
  );
}

function MovementTexture() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        opacity: 0.16,
        backgroundImage: `
          url("/brand/isologo-icon.png"),
          url("/brand/isologo-icon.png"),
          radial-gradient(circle at 14% 18%, rgba(230,79,85,0.18) 0 1px, transparent 2px),
          radial-gradient(circle at 82% 24%, rgba(217,52,56,0.12) 0 34px, transparent 36px),
          radial-gradient(circle at 24% 78%, rgba(230,79,85,0.1) 0 46px, transparent 48px)
        `,
        backgroundPosition: "7% 22%, 92% 68%, 0 0, 0 0, 0 0",
        backgroundRepeat: "no-repeat, no-repeat, repeat, no-repeat, no-repeat",
        backgroundSize: "110px auto, 150px auto, 34px 34px, auto, auto",
        filter: "saturate(0.9)",
      }}
    />
  );
}

function BrandGlow() {
  return (
    <>
      {/* top bloom — wide, warm, rich */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: "-8vh",
          left: 0,
          right: 0,
          height: "72vh",
          zIndex: 0,
          pointerEvents: "none",
          background: "radial-gradient(ellipse 95% 85% at 50% 0%, rgba(255,210,212,1) 0%, rgba(255,238,238,0.75) 44%, transparent 72%)",
        }}
      />
      {/* left accent */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: "10vh",
          left: 0,
          width: "40vw",
          height: "60vh",
          zIndex: 0,
          pointerEvents: "none",
          background: "radial-gradient(ellipse 80% 60% at 0% 50%, rgba(255,218,218,0.32) 0%, transparent 65%)",
        }}
      />
      {/* right accent */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: "20vh",
          right: 0,
          width: "35vw",
          height: "55vh",
          zIndex: 0,
          pointerEvents: "none",
          background: "radial-gradient(ellipse 70% 55% at 100% 50%, rgba(235,116,120,0.18) 0%, transparent 65%)",
        }}
      />
      {/* bottom glow */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "55vh",
          zIndex: 0,
          pointerEvents: "none",
          background: "radial-gradient(ellipse 80% 65% at 50% 110%, rgba(230,79,85,0.22) 0%, transparent 65%)",
        }}
      />
    </>
  );
}

const heroImages = [
  "/fotos-landing/Ballet.jpg",
  "/fotos-landing/about-1.jpg",
  "/fotos-landing/Stretching.jpg",
  "/fotos-landing/Pilates Reformer.jpg",
  "/fotos-landing/Progressing Ballet Technique.jpg",
  "/fotos-landing/pbt.jpg",
  "/fotos-landing/about-2.jpg",
  "/fotos-landing/pct.jpg",
  "/fotos-landing/stretching1.jpg",
  "/fotos-landing/pilates.jpg",
  "/fotos-landing/Pilates Mat.png",
  "/fotos-landing/about-hero.jpg.jpg",
];

const galleryImages = [
  "/fotos-landing/Ballet.jpg",
  "/fotos-landing/about-1.jpg",
  "/fotos-landing/Stretching.jpg",
  "/fotos-landing/Pilates Reformer.jpg",
  "/fotos-landing/Progressing Ballet Technique.jpg",
  "/fotos-landing/pbt.jpg",
  "/fotos-landing/about-2.jpg",
  "/fotos-landing/pct.jpg",
  "/fotos-landing/stretching1.jpg",
  "/fotos-landing/pilates.jpg",
  "/fotos-landing/Pilates Mat.png",
  "/fotos-landing/Progressing Contemporary Technique.jpg",
] as const;

const methodCards = [
  {
    title: "method.card1.title",
    label: "01",
    text: "method.card1.text",
  },
  {
    title: "method.card2.title",
    label: "02",
    text: "method.card2.text",
  },
  {
    title: "method.card3.title",
    label: "03",
    text: "method.card3.text",
  },
  {
    title: "method.card4.title",
    label: "04",
    text: "method.card4.text",
  },
] as const;

const aboutHighlights = ["Ballet", "Pilates", "PBT", "PCT", "RAD CPD Credits"];

const aboutCards = [
  { title: "about.card1.title", text: "about.card1.text" },
  { title: "about.card2.title", text: "about.card2.text" },
  { title: "about.card3.title", text: "about.card3.text" },
  { title: "about.card4.title", text: "about.card4.text" },
] as const;

// El `tier` ata cada tarjeta al enum membership_tier de la base. Sin el, lo
// unico que unia la landing con los planes reales era `name`, que es un texto
// de presentacion y ademas se traduce a cuatro idiomas: no habia forma de saber
// que plan eligio la alumna.
const plans = [
  {
    tier: "corps_de_ballet",
    name: "Corps de Ballet",
    price: "16",
    annual: "154",
    badge: null,
    featured: false,
    oneLine: "Accedé a una biblioteca completa de clases diseñadas para mejorar tu técnica como bailarín.",
    includes: [
      "Acceso ilimitado a toda la biblioteca",
      "Clases disponibles en cualquier momento y desde cualquier lugar",
      "Contenido estructurado para mejorar tu técnica de forma progresiva",
      "Trabajo técnico sólido y consciente",
    ],
  },
  {
    tier: "solista",
    name: "Solista",
    price: "31",
    annual: "299",
    badge: "El más elegido",
    featured: true,
    oneLine: "Planes de trabajo estructurados con objetivos específicos.",
    includes: [
      "Acceso a planes estructurados",
      "Trabajo más profundo y enfocado en objetivos concretos",
      "Mayor claridad en el entrenamiento",
      "Progresión más guiada y detallada",
    ],
  },
  {
    tier: "principal",
    name: "Principal",
    price: "59",
    annual: "559",
    badge: "Experiencia completa con clases en vivo",
    featured: false,
    oneLine: "Experiencia completa y personalizada con clases en vivo.",
    includes: [
      "Acceso completo a todos los contenidos y planes",
      "2 clases en vivo al mes con reserva",
      "Acompañamiento más personalizado",
      "Mayor seguimiento en tu progreso",
    ],
  },
] as const;

function InfinitePhotoCarousel() {
  const rows = [galleryImages.slice(0, 6), galleryImages.slice(6)];

  return (
    <section className="photo-marquee-section" aria-label="Galería de entrenamiento">
      <div className="photo-marquee-fade left" aria-hidden="true" />
      <div className="photo-marquee-fade right" aria-hidden="true" />

      {rows.map((row, rowIndex) => (
        <div className="photo-marquee-row" data-direction={rowIndex === 0 ? "left" : "right"} key={rowIndex}>
          <div className="photo-marquee-track">
            {[...row, ...row].map((src, index) => (
              <figure className="photo-marquee-card" key={`${src}-${index}`}>
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="(max-width: 720px) 72vw, 360px"
                  style={{ objectFit: "cover", objectPosition: "center" }}
                />
              </figure>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/**
 * ⚠️ LA PORTADA SE REGENERA CADA 5 MINUTOS, NO EN CADA VISITA.
 *
 *   Cuando empezo a leer la base dejo de ser estatica sin que nada lo dijera:
 *   la consulta a Supabase vuelve dinamica la ruta, asi que cada visitante
 *   pasaba a pagar un viaje a Frankfurt mas el render. Es la pagina de mas
 *   trafico, la que decide conversion y la que mide Google.
 *
 *   Con esto vuelve a servirse desde el CDN. Y NO introduce demora para
 *   Brunela: las acciones de /admin/precios y /admin/packs llaman a
 *   `revalidatePath("/")`, asi que un cambio de precio se ve al instante. Los
 *   5 minutos son solo la red de seguridad por si alguna escritura futura se
 *   olvida de revalidar.
 */
export const revalidate = 300;

/**
 * Los precios salen de la base; el texto de venta sigue aca.
 *
 * ⚠️ ESTA ES LA PRIMERA VEZ QUE LA LANDING LEE LA BASE. Hasta hoy era 100%
 *    estatica y `HomePage` no era async.
 *
 * POR QUE SE MEZCLA Y NO SE TRAE TODO
 *   El importe es lo que Brunela cambia desde /admin/precios, y si la portada
 *   no lo refleja el panel no sirve para nada. El resto -- el nombre, la frase,
 *   la lista de lo que incluye -- es texto de venta, se traduce a cuatro idiomas
 *   y todavia no es editable. Cuando lo sea (ver el pendiente de la landing en
 *   CLAUDE.md) tambien saldra de aca.
 *
 * ⚠️ SI LA BASE NO CONTESTA, SE USAN LOS IMPORTES DE ABAJO. Una portada que
 *    muestra un precio viejo es un problema; una portada caida es peor.
 */
async function preciosDeLaBase(): Promise<Record<string, { mes: string; anual: string }>> {
  try {
    const catalogo = await getSubscriptionCatalog();
    if (!catalogo) return {};
    return Object.fromEntries(
      catalogo.tiers.map((t) => [t.tier, { mes: String(t.amount_monthly), anual: String(t.amount_yearly) }])
    );
  } catch {
    return {};
  }
}

/**
 * Los packs de la portada.
 *
 * ⚠️ LEE LA VISTA `packs_publicos`, NUNCA la tabla. La vista no tiene ids de
 *    video ni price ids de Stripe: la restriccion la impone Postgres y no un
 *    comentario. Esta pagina es publica, asi que el radio de un error es
 *    internet entero.
 */
async function packsDeLaPortada(): Promise<PackPublico[]> {
  try {
    const supabase = createSupabaseAdminClient();

    /**
     * ⚠️ NO SE ANUNCIA LO QUE NO SE PUEDE COBRAR.
     *
     *    Publicar comprueba el price del modo activo, pero corre UNA VEZ. Al
     *    pasar a produccion, un pack publicado en prueba sigue publicado y sin
     *    price de live: aparece en la portada, alguien lo toca y recibe un
     *    error. En la PORTADA eso es peor que adentro -- es la primera
     *    impresion de alguien que todavia no es clienta.
     *
     *    Los price ids NO se leen de la vista, que a proposito no los expone:
     *    se piden aparte y solo para armar una lista de slugs vendibles. Nunca
     *    llegan al render.
     */
    const modoEsLive = /^(?:sk|rk)_live_/.test((process.env.STRIPE_SECRET_KEY ?? "").trim());
    const columna = modoEsLive ? "stripe_price_id_live" : "stripe_price_id_test";

    const [{ data }, { data: vendibles }] = await Promise.all([
      supabase
        .from("packs_publicos")
        .select("slug, name_i18n, description_i18n, price_cents, currency, cover_image_url, is_featured, cantidad_clases")
        .order("display_order"),
      supabase.from("packs").select("slug").not(columna, "is", null),
    ]);

    const sePuedeCobrar = new Set(((vendibles ?? []) as { slug: string }[]).map((p) => p.slug));
    return ((data ?? []) as PackPublico[]).filter((p) => sePuedeCobrar.has(p.slug));
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [precios, packs] = await Promise.all([preciosDeLaBase(), packsDeLaPortada()]);

  const plansConPrecio = plans.map((p) => {
    const dePanel = precios[p.tier];
    return dePanel ? { ...p, price: dePanel.mes, annual: dePanel.anual } : p;
  });

  return (
    <>
      <Navbar />
      <GrainTexture />
      <DotGrid />
      <MovementTexture />
      <BrandGlow />

      <div style={{ position: "relative", zIndex: 1 }}>
        <ArcGalleryHero images={heroImages} />
      </div>

      <InfinitePhotoCarousel />

      <VideoShowcase />

      <section className="landing-section method-section">
        <div className="method-shell">
          <div className="method-copy">
            <p className="section-kicker">
              <T id="method.kicker" />
            </p>
            <h2 className="method-title">
              <T id="method.title" />
            </h2>
            <p className="method-lead">
              <T id="method.lead" />
            </p>
          </div>

          <div className="method-grid">
            {methodCards.map((item) => (
              <div className="method-card" key={item.title}>
                <small>{item.label}</small>
                <span>
                  <T id={item.title as PublicMessageKey} />
                </span>
                <p>
                  <T id={item.text as PublicMessageKey} />
                </p>
              </div>
            ))}
          </div>

          <p className="method-callout">
            <span>
              <T id="method.calloutIntro" />
            </span>
            <strong>
              <T id="method.calloutEmphasis" />
            </strong>
          </p>
        </div>
      </section>

      <section id="clases" className="landing-section previews-section">
        <InteractiveSelector />
      </section>

      <section id="sobre" className="about-section">
        <div className="about-shell">
          <div className="about-media">
            <div className="about-photo">
              <Image
                src="/fotos-landing/about-hero.jpg.jpg"
                alt="Brunela"
                fill
                sizes="(max-width: 900px) 88vw, 470px"
                style={{ objectFit: "cover", objectPosition: "top center" }}
              />
            </div>
          </div>

          <div className="about-copy">
            <p className="section-kicker">
              <T id="about.kicker" />
            </p>
            <h2 className="about-title">
              <T id="about.title" />
            </h2>
            <div className="about-bio-grid">
              {aboutCards.map((card) => (
                <article className="about-bio-card" key={card.title}>
                  <span>
                    <T id={card.title as PublicMessageKey} />
                  </span>
                  <p>
                    <T id={card.text as PublicMessageKey} />
                  </p>
                </article>
              ))}
            </div>

            <div className="about-tags">
              {aboutHighlights.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>

            <div className="about-bottom-row">
              <div className="about-stat-line">
                <strong>+15</strong>
                <span>
                  <T id="about.statYears" />
                </span>
              </div>
              <div className="about-stat-line">
                <strong>4</strong>
                <span>
                  <T id="about.statAreas" />
                </span>
              </div>
              <Link className="brand-button" href="/#planes">
                <T id="about.button" />
              </Link>
            </div>

            <a
              className="about-portfolio-card"
              href="https://brune-dance.vercel.app"
              target="_blank"
              rel="noreferrer"
            >
              <div className="about-portfolio-card-text">
                <p className="about-portfolio-card-label"><T id="about.portfolio.label" /></p>
                <p className="about-portfolio-card-desc"><T id="about.portfolio.desc" /></p>
              </div>
              <span className="about-portfolio-card-arrow">
                <svg width="16" height="16" viewBox="0 0 13 13" fill="none" aria-hidden>
                  <path d="M2 11L11 2M11 2H5M11 2V8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </a>
          </div>
        </div>
      </section>

      <section id="planes" className="landing-section plans-section">
        <div className="plans-head">
          <p className="section-kicker">
            <T id="plans.kicker" />
          </p>
          <h2 className="section-title">
            <T id="plans.title" />
          </h2>
          <p className="section-lead compact">
            <T id="plans.lead" />
          </p>
        </div>

        <PricingPlans plans={plansConPrecio} />

        {/* Los packs sólo aparecen si Brunela marcó alguno para la portada. Sin
            packs no queda un hueco ni un título huérfano. */}
        {packs.length > 0 && <PacksPublicos packs={packs} />}
      </section>

      <div style={{ position: "relative", zIndex: 1 }}>
        <BrunelaFooter />
      </div>
    </>
  );
}
