import Image from "next/image";
import Link from "next/link";
import { ArcGalleryHero } from "@/components/ui/arc-gallery-hero-component";
import { BrunelaFooter } from "@/components/ui/hover-footer";
import { InteractiveSelector } from "@/components/ui/interactive-selector";
import { PricingPlans } from "@/components/pricing-plans";
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

const plans = [
  {
    name: "Corps de Ballet",
    price: "20",
    annual: "192",
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
    name: "Solista",
    price: "39",
    annual: "374,40",
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
    name: "Principal",
    price: "69",
    annual: "662,40",
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

export default function HomePage() {
  return (
    <>
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
                <p className="about-portfolio-card-label">MI PORTFOLIO</p>
                <p className="about-portfolio-card-desc">Conocé más sobre mi trayectoria, formación y trabajo artístico.</p>
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

        <PricingPlans plans={plans} />
      </section>

      <div style={{ position: "relative", zIndex: 1 }}>
        <BrunelaFooter />
      </div>
    </>
  );
}
