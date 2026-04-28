import Image from "next/image";
import Link from "next/link";
import { ArcGalleryHero } from "@/components/ui/arc-gallery-hero-component";
import { BrunelaFooter } from "@/components/ui/hover-footer";
import { InteractiveSelector } from "@/components/ui/interactive-selector";
import { PricingPlans } from "@/components/pricing-plans";
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

const plans = [
  {
    name: "Corps de Ballet",
    price: "20",
    annual: "192",
    badge: null,
    featured: false,
    oneLine: "Biblioteca completa para entrenar cuando quieras.",
    includes: ["Biblioteca ilimitada", "Clases a demanda", "Ballet, flexibilidad y tecnica", "Progresion clara"],
  },
  {
    name: "Solista",
    price: "39",
    annual: "374,40",
    badge: "El mas elegido",
    featured: true,
    oneLine: "Programas estructurados para objetivos concretos.",
    includes: ["Todo Corps de Ballet", "Planes para pies, rotacion y flexibilidad", "Entrenamiento guiado", "Mayor precision tecnica"],
  },
  {
    name: "Principal",
    price: "69",
    annual: "662,40",
    badge: "Con clases en vivo",
    featured: false,
    oneLine: "La experiencia completa con acompanamiento privado.",
    includes: ["Todo Solista", "2 clases privadas en vivo al mes", "Reserva por calendario", "Orientacion mas cercana"],
  },
] as const;

export default function HomePage() {
  return (
    <>
      <GrainTexture />
      <DotGrid />
      <BrandGlow />

      <div style={{ position: "relative", zIndex: 1 }}>
        <ArcGalleryHero images={heroImages} />
      </div>

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
            <T id="method.callout" />
          </p>
        </div>
      </section>

      <section id="clases" className="landing-section previews-section">
        <div className="section-head">
          <div>
            <p className="section-kicker">
              <T id="previews.kicker" />
            </p>
            <h2 className="section-title">
              <T id="previews.title" />
            </h2>
          </div>
          <p className="section-lead compact">
            <T id="previews.lead" />
          </p>
        </div>

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
            <p className="about-lead">
              <T id="about.lead" />
            </p>

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

        <PricingPlans plans={plans} />
      </section>

      <div style={{ position: "relative", zIndex: 1 }}>
        <BrunelaFooter />
      </div>
    </>
  );
}
