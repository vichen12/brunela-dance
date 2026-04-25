import Image from "next/image";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { ArcGalleryHero } from "@/components/ui/arc-gallery-hero-component";
import { BrunelaFooter } from "@/components/ui/hover-footer";
import { InteractiveSelector } from "@/components/ui/interactive-selector";

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
        backgroundImage: "radial-gradient(circle, rgba(217,52,56,0.08) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }}
    />
  );
}

function BrandGlow() {
  return (
    <>
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "64vh",
          zIndex: 0,
          pointerEvents: "none",
          background: "radial-gradient(ellipse 80% 70% at 50% 0%, rgba(255,218,218,0.95) 0%, transparent 62%)",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "48vh",
          zIndex: 0,
          pointerEvents: "none",
          background: "radial-gradient(ellipse 70% 60% at 50% 100%, rgba(235,116,120,0.24) 0%, transparent 64%)",
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
    title: "Tecnica",
    text: "Alineacion, control y limpieza del movimiento.",
  },
  {
    title: "Progresion",
    text: "Planes con objetivos concretos para entrenar con direccion.",
  },
  {
    title: "Cuerpo consciente",
    text: "Activacion correcta para mejorar sin forzar.",
  },
  {
    title: "Acompanamiento",
    text: "Contenido en crecimiento y sesiones en vivo.",
  },
];

const aboutHighlights = ["Ballet", "Pilates", "PBT", "Contemporary Technique", "RAD CPD Credits"];

const plans = [
  {
    name: "Corps de Ballet",
    price: "20",
    annual: "192",
    badge: null,
    featured: false,
    oneLine: "Biblioteca completa para entrenar cuando quieras.",
    includes: ["Biblioteca ilimitada", "Clases on demand", "Ballet, flexibilidad y tecnica", "Progresion clara"],
  },
  {
    name: "Solista",
    price: "39",
    annual: "374,40",
    badge: "El mas elegido",
    featured: true,
    oneLine: "Courses estructurados para objetivos concretos.",
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
            <p className="section-kicker">Estudio Online</p>
            <h2 className="section-title">Un m&eacute;todo estructurado para mejorar tu t&eacute;cnica</h2>
            <p className="section-lead">
              Una plataforma dise&ntilde;ada para acompa&ntilde;arte en cada etapa: clases, planes de trabajo y sesiones en vivo.
            </p>
          </div>

          <div className="method-grid">
            {methodCards.map((item) => (
              <div className="method-card" key={item.title}>
                <span>{item.title}</span>
                <p>{item.text}</p>
              </div>
            ))}
          </div>

          <p className="method-callout">
            Si est&aacute;s aqu&iacute;, es porque quieres mejorar y tomar tu proceso en serio. Me alegra acompa&ntilde;arte en ese camino.
          </p>
        </div>
      </section>

      <section id="clases" className="landing-section previews-section">
        <div className="section-head">
          <div>
            <p className="section-kicker">Preview del contenido</p>
            <h2 className="section-title">Explora el estudio online</h2>
          </div>
          <p className="section-lead compact">Tres ejemplos para entender r&aacute;pido el tipo de trabajo que vas a encontrar.</p>
        </div>

        <InteractiveSelector />
      </section>

      <section id="sobre" className="about-section">
        <div className="about-mark" aria-hidden>
          <Image src="/brand/isologo-icon.png" alt="" fill sizes="420px" style={{ objectFit: "contain" }} />
        </div>

        <div className="about-shell">
          <div className="about-photo">
            <Image
              src="/fotos-landing/about-hero.jpg.jpg"
              alt="Brunela"
              fill
              sizes="(max-width: 900px) 82vw, 360px"
              style={{ objectFit: "cover", objectPosition: "top center" }}
            />
          </div>

          <div className="about-copy">
            <p className="section-kicker">Sobre m&iacute;</p>
            <h2 className="section-title">Bailarina profesional en t&eacute;cnica y entrenamiento para danza</h2>
            <p className="section-lead">
              Trabajo en el desarrollo t&eacute;cnico del bailar&iacute;n desde un enfoque consciente del cuerpo. Mi foco est&aacute; en
              la alineaci&oacute;n, el control y la activaci&oacute;n correcta para mejorar sin generar lesiones.
            </p>

            <div className="about-tags">
              {aboutHighlights.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>

            <div className="about-stats">
              <div>
                <strong>+15</strong>
                <span>a&ntilde;os de experiencia</span>
              </div>
              <div>
                <strong>4</strong>
                <span>&aacute;reas de formaci&oacute;n</span>
              </div>
            </div>

            <Link className="brand-button" href="/#planes">
              Ver membres&iacute;as
            </Link>
          </div>
        </div>
      </section>

      <section id="planes" className="landing-section plans-section">
        <div className="plans-head">
          <p className="section-kicker">Membres&iacute;as</p>
          <h2 className="section-title">Elige tu plan. Un Estudio Online completo.</h2>
          <p className="section-lead compact">Cancela cuando quieras y cambia de plan en cualquier momento.</p>
        </div>

        <div className="plans-grid">
          {plans.map((plan) => (
            <article className={`plan-card-new ${plan.featured ? "is-featured" : ""}`} key={plan.name}>
              {plan.badge && <span className="plan-badge">{plan.badge}</span>}

              <div className="plan-top">
                <h3>{plan.name}</h3>
                <p>{plan.oneLine}</p>
              </div>

              <div className="plan-price">
                <strong>
                  {plan.price}
                  <span>&euro;</span>
                </strong>
                <p>al mes</p>
              </div>

              <p className="annual-note">
                Anual: {plan.annual}&euro; / a&ntilde;o
                <span>20% menos</span>
              </p>

              <ul>
                {plan.includes.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    {item}
                  </li>
                ))}
              </ul>

              <Link href="/sign-in" className="plan-action">
                Comenzar prueba gratis
              </Link>
            </article>
          ))}
        </div>
      </section>

      <div style={{ position: "relative", zIndex: 1 }}>
        <BrunelaFooter />
      </div>
    </>
  );
}
