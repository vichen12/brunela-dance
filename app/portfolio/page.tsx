import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowDown,
  ArrowUpRight,
  Award,
  CalendarDays,
  CirclePlay,
  Dumbbell,
  Feather,
  Flower2,
  Footprints,
  Globe,
  GraduationCap,
  ListChecks,
  MapPin,
  Plane,
  Quote,
  Sparkles,
  Star,
  Theater,
  Users,
  Video,
  Waves,
} from "lucide-react";
import { FaFacebookF, FaInstagram, FaTiktok, FaWhatsapp, FaYoutube } from "react-icons/fa";
import { Navbar } from "@/components/navbar";
import { BrunelaFooter } from "@/components/ui/hover-footer";
import { T } from "@/components/language-provider";
import { LandingMovimiento } from "@/components/landing-movimiento";
import { Contador, ImagenT, LineaDeTiempo, TRico } from "@/components/portfolio/portfolio-cliente";
import type { PublicMessageKey } from "@/src/i18n/public";

/**
 * El portfolio de Brunela (2026-10-25). Antes era una web aparte
 * (brune-dance.vercel.app) con fotos viejas y otra estetica; ahora vive aca,
 * con la de la landing y las fotos de la sesion real.
 *
 * El contenido es el de esa web, entero. Lo que NO se trajo, a proposito:
 *   - "Clases online · proximamente": ya existen, asi que se invita al estudio.
 *   - el formulario de contacto: no tenia a donde mandar; queda WhatsApp.
 *   - el "Diseñado por" del pie.
 *
 * En los cuatro idiomas de la landing: todo texto visible pasa por las claves
 * `portfolio.*` de src/i18n/public.ts. Quedan sin traducir solo los nombres
 * propios (Brunela, disciplinas, titulos de ballet, redes).
 *
 * El movimiento reusa components/landing-movimiento.tsx (`data-lp-revelar`,
 * `data-lp-retraso`, `data-lp-parallax`); el CSS de las entradas esta abajo,
 * acotado a `.pf`, porque el de la landing esta acotado a `.lp`.
 */

export const metadata: Metadata = {
  title: "Portfolio · Brunela Dance Trainer",
  description:
    "Bailarina, coreógrafa y profesora de Argentina radicada en Barcelona. Trayectoria, formación y trabajo artístico de Brunela.",
};

const WHATSAPP = "https://wa.me/34612491637";

type K = PublicMessageKey;

const CIFRAS: { num: string; titulo: K; sub: K | string; Icono: typeof Star }[] = [
  { num: "2002", titulo: "portfolio.stat1.title", sub: "portfolio.stat1.sub", Icono: Footprints },
  { num: "15+", titulo: "portfolio.stat2.title", sub: "portfolio.stat2.sub", Icono: GraduationCap },
  { num: "9", titulo: "portfolio.stat3.title", sub: "portfolio.stat3.sub", Icono: Theater },
  { num: "RAD", titulo: "portfolio.stat4.title", sub: "Royal Academy of Dance", Icono: Award },
];

const CAPITULOS: { numero: string; fechas: string; hoy?: boolean; titulo: K; alt: K; foto: string; parrafos: K[]; Icono: typeof Star }[] = [
  {
    numero: "01",
    fechas: "2002 – 2010",
    titulo: "portfolio.ch1.title",
    alt: "portfolio.ch1.alt",
    foto: "/fotos-landing/c-tul.jpg",
    parrafos: ["portfolio.ch1.p1", "portfolio.ch1.p2", "portfolio.ch1.p3"],
    Icono: Star,
  },
  {
    numero: "02",
    fechas: "2011 – 2019",
    titulo: "portfolio.ch2.title",
    alt: "portfolio.ch2.alt",
    foto: "/fotos-landing/c-cambre.jpg",
    parrafos: ["portfolio.ch2.p1", "portfolio.ch2.p2", "portfolio.ch2.p3"],
    Icono: GraduationCap,
  },
  {
    numero: "03",
    fechas: "2020 – ",
    hoy: true,
    titulo: "portfolio.ch3.title",
    alt: "portfolio.ch3.alt",
    foto: "/fotos-landing/c-split.jpg",
    parrafos: ["portfolio.ch3.p1", "portfolio.ch3.p2", "portfolio.ch3.p3"],
    Icono: Plane,
  },
];

// Los nombres de las disciplinas son nombres propios: no se traducen.
const DISCIPLINAS: { etiqueta: K; titulo: string; sigla?: string; texto: K; Icono: typeof Star }[] = [
  { etiqueta: "portfolio.disc1.tag", titulo: "Progressing Ballet Technique", sigla: "PBT", texto: "portfolio.disc1.text", Icono: Footprints },
  { etiqueta: "portfolio.disc2.tag", titulo: "Progressing Contemporary Technique", sigla: "PCT", texto: "portfolio.disc2.text", Icono: Waves },
  { etiqueta: "portfolio.disc3.tag", titulo: "Ballet", texto: "portfolio.disc3.text", Icono: Feather },
  { etiqueta: "portfolio.disc4.tag", titulo: "Stretching", texto: "portfolio.disc4.text", Icono: Flower2 },
  { etiqueta: "portfolio.disc5.tag", titulo: "Pilates Reformer", texto: "portfolio.disc5.text", Icono: Dumbbell },
  { etiqueta: "portfolio.disc6.tag", titulo: "Pilates Mat", texto: "portfolio.disc6.text", Icono: Activity },
];

const GALERIA: { src: string; alt: K; pos?: string }[] = [
  { src: "/fotos-landing/m-piso.jpg", alt: "portfolio.gallery.alt1" },
  { src: "/fotos-landing/m-cou.jpg", alt: "portfolio.gallery.alt2" },
  { src: "/fotos-landing/m-cintas.jpg", alt: "portfolio.gallery.alt3" },
  { src: "/fotos-landing/m-mermaid.jpg", alt: "portfolio.gallery.alt4" },
  { src: "/fotos-landing/m-pelota.jpg", alt: "portfolio.gallery.alt5" },
  { src: "/fotos-landing/m-barra2.jpg", alt: "portfolio.gallery.alt6" },
];

const ESTUDIO: { texto: K; Icono: typeof Star }[] = [
  { texto: "portfolio.studio.feat1", Icono: CirclePlay },
  { texto: "portfolio.studio.feat2", Icono: ListChecks },
  { texto: "portfolio.studio.feat3", Icono: Video },
  { texto: "portfolio.studio.feat4", Icono: Users },
];

const REDES = [
  { href: "https://www.instagram.com/brunela.dance", label: "Instagram", sub: "@brunela.dance · 30K+", Icono: FaInstagram },
  { href: "https://www.tiktok.com/@brunela.dance", label: "TikTok", sub: "@brunela.dance", Icono: FaTiktok },
  { href: "https://www.youtube.com/@bruneladance", label: "YouTube", sub: "@bruneladance", Icono: FaYoutube },
  { href: "https://www.facebook.com/brunela.dance", label: "Facebook", sub: "brunela.dance", Icono: FaFacebookF },
];

const CINTA = ["Ballet", "PBT", "PCT", "Pilates Reformer", "Pilates Mat", "Stretching", "Royal Academy of Dance", "Barcelona"];

function esClave(x: string): x is K {
  return x.startsWith("portfolio.");
}

function Titulo({ como: Tag = "h2", principal, acento, clase = "" }: { como?: "h2" | "h3"; principal: K; acento: K; clase?: string }) {
  return (
    <Tag className={"pf-h2 " + clase}>
      <T id={principal} /> <em><T id={acento} /></em>
    </Tag>
  );
}

export default function PortfolioPage() {
  return (
    <>
      <style>{CSS}</style>
      <LandingMovimiento />
      <Navbar />
      <main className="pf">
        {/* ── Portada ─────────────────────────────────────────────── */}
        <section className="pf-hero">
          <span className="pf-blob pf-blob--a" data-lp-parallax="0.10" aria-hidden />
          <span className="pf-blob pf-blob--b" data-lp-parallax="-0.06" aria-hidden />

          <div className="pf-hero-txt">
            <p className="pf-kicker pf-entra" style={{ "--d": "0ms" } as React.CSSProperties}>
              <MapPin size={14} strokeWidth={2.4} aria-hidden /> <T id="portfolio.hero.kicker" />
            </p>
            <h1 className="pf-h1">
              <span className="pf-entra" style={{ "--d": "90ms" } as React.CSSProperties}>Brunela</span>
              <em className="pf-entra" style={{ "--d": "200ms" } as React.CSSProperties}>
                <T id="portfolio.hero.accent" />
                <svg className="pf-trazo" viewBox="0 0 300 18" preserveAspectRatio="none" aria-hidden>
                  <path d="M2 13 C 60 3, 120 3, 170 9 S 260 16, 298 5" />
                </svg>
              </em>
            </h1>
            <p className="pf-lede pf-entra" style={{ "--d": "320ms" } as React.CSSProperties}>
              <T id="portfolio.hero.lede" />
            </p>
            <div className="pf-botones pf-entra" style={{ "--d": "420ms" } as React.CSSProperties}>
              <Link className="pf-btn pf-btn--lleno" href="/#planes">
                <T id="portfolio.hero.cta" /> <ArrowUpRight size={16} strokeWidth={2.2} aria-hidden />
              </Link>
              <a className="pf-btn" href={WHATSAPP} target="_blank" rel="noreferrer">
                <FaWhatsapp size={16} aria-hidden /> <T id="portfolio.hero.write" />
              </a>
            </div>
            <div className="pf-creds pf-entra" style={{ "--d": "520ms" } as React.CSSProperties}>
              <span className="pf-creds-label"><Award size={14} strokeWidth={2.2} aria-hidden /> <T id="portfolio.hero.creds" /></span>
              <ul>
                {["PBT", "PCT", "Pilates", "RAD"].map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          </div>

          <div className="pf-hero-arte">
            <span className="pf-hero-marco" aria-hidden />
            <div className="pf-hero-foto">
              <ImagenT src="/fotos-landing/puerta.avif" altId="portfolio.hero.alt" fill priority sizes="(max-width: 900px) 92vw, 520px" style={{ objectFit: "cover", objectPosition: "center 30%" }} />
            </div>
            <svg className="pf-sello" viewBox="0 0 200 200" aria-hidden>
              <defs>
                <path id="pf-circulo" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
              </defs>
              <circle cx="100" cy="100" r="98" className="pf-sello-fondo" />
              <text>
                <textPath href="#pf-circulo">BALLET · PBT · PCT · PILATES · STRETCHING ·</textPath>
              </text>
            </svg>
            <span className="pf-sello-centro" aria-hidden><Sparkles size={22} strokeWidth={1.8} /></span>
            <span className="pf-guion" aria-hidden><T id="portfolio.hero.since" /></span>

            <div className="pf-flota pf-flota--a" data-lp-parallax="0.05">
              <span className="pf-flota-icono"><GraduationCap size={18} strokeWidth={2} aria-hidden /></span>
              <span><strong>15+</strong><small><T id="portfolio.hero.badgeYears" /></small></span>
            </div>
            <div className="pf-flota pf-flota--b" data-lp-parallax="-0.04">
              <span className="pf-flota-icono"><FaInstagram size={17} aria-hidden /></span>
              <span><strong>30K+</strong><small><T id="portfolio.hero.badgeFollowers" /></small></span>
            </div>
          </div>

          <a className="pf-bajar" href="#historia">
            <T id="portfolio.hero.scroll" /> <span><ArrowDown size={15} strokeWidth={2.2} aria-hidden /></span>
          </a>
        </section>

        {/* ── Cinta de disciplinas ────────────────────────────────── */}
        <div className="pf-cinta" aria-hidden>
          <div className="pf-cinta-pista">
            {[0, 1].map((vuelta) => (
              <div key={vuelta} className="pf-cinta-tramo">
                {CINTA.map((c) => (
                  <span key={c}>{c}<Sparkles size={18} strokeWidth={1.6} /></span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── Cifras ──────────────────────────────────────────────── */}
        <section className="pf-cifras" aria-label="En números">
          {CIFRAS.map((c, i) => (
            <div key={c.num} className="pf-cifra" data-lp-revelar data-lp-retraso={String(i * 110)}>
              <span className="pf-cifra-icono"><c.Icono size={20} strokeWidth={1.9} aria-hidden /></span>
              <strong><Contador valor={c.num} /></strong>
              <span className="pf-cifra-titulo"><T id={c.titulo} /></span>
              <small>{esClave(c.sub) ? <T id={c.sub} /> : c.sub}</small>
            </div>
          ))}
        </section>

        {/* ── Conóceme ────────────────────────────────────────────── */}
        <section className="pf-conoceme">
          <div className="pf-conoceme-arte" data-lp-revelar>
            <span className="pf-conoceme-marco" aria-hidden />
            <div className="pf-conoceme-foto pf-zoom">
              <ImagenT src="/fotos-landing/sobre-mi.jpg" altId="portfolio.about.alt" fill sizes="(max-width: 900px) 88vw, 440px" style={{ objectFit: "cover", objectPosition: "top center" }} />
            </div>
            <div className="pf-viaje">
              <Plane size={16} strokeWidth={2} aria-hidden />
              <span><T id="portfolio.about.journey" /></span>
            </div>
          </div>
          <div className="pf-conoceme-txt">
            <p className="pf-kicker" data-lp-revelar><span className="pf-raya" aria-hidden /> <T id="portfolio.about.kicker" /></p>
            <div data-lp-revelar data-lp-retraso="80">
              <Titulo principal="portfolio.about.title" acento="portfolio.about.titleAccent" />
            </div>
            <p className="pf-p" data-lp-revelar data-lp-retraso="160"><T id="portfolio.about.text" /></p>
            <ul className="pf-datos" data-lp-revelar data-lp-retraso="220">
              <li><MapPin size={16} strokeWidth={2} aria-hidden /> <T id="portfolio.about.fact1" /></li>
              <li><Plane size={16} strokeWidth={2} aria-hidden /> <T id="portfolio.about.fact2" /></li>
              <li><Globe size={16} strokeWidth={2} aria-hidden /> <T id="portfolio.about.fact3" /></li>
            </ul>
            <blockquote className="pf-cita" data-lp-revelar data-lp-retraso="280">
              <Quote className="pf-cita-icono" size={34} strokeWidth={1.4} aria-hidden />
              <p><T id="portfolio.about.quote" /></p>
              <footer>— Brunela</footer>
            </blockquote>
            <ul className="pf-chips" aria-label="Especialidades" data-lp-revelar data-lp-retraso="340">
              {DISCIPLINAS.map((d) => (
                <li key={d.titulo}><span><d.Icono size={13} strokeWidth={2.2} aria-hidden /></span>{d.sigla ?? d.titulo}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Trayectoria ─────────────────────────────────────────── */}
        <section className="pf-historia" id="historia">
          <header className="pf-cabeza" data-lp-revelar>
            <p className="pf-kicker"><span className="pf-raya" aria-hidden /> <T id="portfolio.story.kicker" /> <span className="pf-raya" aria-hidden /></p>
            <Titulo principal="portfolio.story.title" acento="portfolio.story.titleAccent" />
            <p className="pf-p pf-p--centro"><T id="portfolio.story.lead" /></p>
          </header>
          <ol className="pf-capitulos">
            <LineaDeTiempo />
            {CAPITULOS.map((c, i) => (
              <li key={c.numero} className={"pf-capitulo" + (i % 2 ? " es-par" : "")}>
                <span className="pf-hito" aria-hidden data-lp-revelar>
                  <c.Icono size={20} strokeWidth={1.9} />
                </span>
                <div className="pf-capitulo-foto pf-zoom" data-lp-revelar>
                  <ImagenT src={c.foto} altId={c.alt} fill sizes="(max-width: 900px) 88vw, 460px" style={{ objectFit: "cover" }} />
                  <span className="pf-capitulo-num" aria-hidden>{c.numero}</span>
                </div>
                <div className="pf-capitulo-txt" data-lp-revelar data-lp-retraso="120">
                  <p className="pf-capitulo-cabeza">
                    <span className="pf-capitulo-etq"><T id="portfolio.story.chapter" /> {c.numero}</span>
                    <span className="pf-fechas">
                      <CalendarDays size={13} strokeWidth={2.2} aria-hidden /> {c.fechas}{c.hoy && <T id="portfolio.story.today" />}
                    </span>
                  </p>
                  <h3 className="pf-h3"><T id={c.titulo} /></h3>
                  {c.parrafos.map((p) => (
                    <p key={p} className="pf-capitulo-p"><TRico id={p} /></p>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Formación ───────────────────────────────────────────── */}
        <section className="pf-formacion">
          <header className="pf-cabeza" data-lp-revelar>
            <p className="pf-kicker"><span className="pf-raya" aria-hidden /> <T id="portfolio.method.kicker" /> <span className="pf-raya" aria-hidden /></p>
            <Titulo principal="portfolio.method.title" acento="portfolio.method.titleAccent" />
            <p className="pf-p pf-p--centro"><T id="portfolio.method.lead" /></p>
          </header>
          <div className="pf-disciplinas">
            {DISCIPLINAS.map((d, i) => (
              <article key={d.titulo} className="pf-disciplina" data-lp-revelar data-lp-retraso={String((i % 3) * 110)}>
                <div className="pf-disciplina-arriba">
                  <span className="pf-disciplina-icono"><d.Icono size={22} strokeWidth={1.8} aria-hidden /></span>
                  <span className="pf-disciplina-num" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                </div>
                <span className="pf-etiqueta"><T id={d.etiqueta} /></span>
                <h3>{d.titulo}{d.sigla && <small> ({d.sigla})</small>}</h3>
                <p><T id={d.texto} /></p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Galería ─────────────────────────────────────────────── */}
        <section className="pf-galeria-sec">
          <header className="pf-galeria-cabeza" data-lp-revelar>
            <div>
              <p className="pf-kicker"><Sparkles size={14} strokeWidth={2.2} aria-hidden /> <T id="portfolio.gallery.kicker" /></p>
              <Titulo principal="portfolio.gallery.title" acento="portfolio.gallery.titleAccent" />
            </div>
            <a className="pf-galeria-ig" href="https://www.instagram.com/brunela.dance" target="_blank" rel="noreferrer">
              <FaInstagram size={16} aria-hidden /> @brunela.dance <ArrowUpRight size={15} strokeWidth={2.2} aria-hidden />
            </a>
          </header>
          <div className="pf-galeria">
            {GALERIA.map((g, i) => (
              <figure key={g.src} className={`pf-galeria-foto pf-zoom pf-g${i + 1}`} data-lp-revelar data-lp-retraso={String((i % 3) * 90)}>
                <ImagenT src={g.src} altId={g.alt} fill sizes="(max-width: 700px) 92vw, 50vw" style={{ objectFit: "cover" }} />
                <figcaption><span>{String(i + 1).padStart(2, "0")}</span><T id={g.alt} /></figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ── Estudio online + contacto ───────────────────────────── */}
        <section className="pf-cierre">
          <div className="pf-estudio" data-lp-revelar>
            <span className="pf-estudio-anillo pf-estudio-anillo--a" aria-hidden />
            <span className="pf-estudio-anillo pf-estudio-anillo--b" aria-hidden />
            <p className="pf-kicker pf-kicker--claro"><CirclePlay size={14} strokeWidth={2.4} aria-hidden /> <T id="portfolio.studio.kicker" /></p>
            <Titulo principal="portfolio.studio.title" acento="portfolio.studio.titleAccent" clase="pf-h2--claro" />
            <p className="pf-estudio-p"><T id="portfolio.studio.text" /></p>
            <ul className="pf-estudio-lista">
              {ESTUDIO.map((e) => (
                <li key={e.texto}><span><e.Icono size={16} strokeWidth={2} aria-hidden /></span><T id={e.texto} /></li>
              ))}
            </ul>
            <Link className="pf-btn pf-btn--blanco" href="/#planes">
              <T id="portfolio.studio.cta" /> <ArrowUpRight size={16} strokeWidth={2.2} aria-hidden />
            </Link>
          </div>
          <div className="pf-contacto" data-lp-revelar data-lp-retraso="120">
            <p className="pf-kicker"><span className="pf-raya" aria-hidden /> <T id="portfolio.contact.kicker" /></p>
            <Titulo principal="portfolio.contact.title" acento="portfolio.contact.titleAccent" />
            <p className="pf-p"><T id="portfolio.contact.text" /></p>
            <a className="pf-whatsapp" href={WHATSAPP} target="_blank" rel="noreferrer">
              <span className="pf-whatsapp-icono"><FaWhatsapp size={22} aria-hidden /></span>
              <span className="pf-whatsapp-txt"><small>WhatsApp</small>+34 612 491 637</span>
              <ArrowUpRight className="pf-whatsapp-flecha" size={18} strokeWidth={2.2} aria-hidden />
            </a>
            <p className="pf-redes-titulo"><T id="portfolio.contact.socials" /></p>
            <ul className="pf-redes">
              {REDES.map((r) => (
                <li key={r.label}>
                  <a href={r.href} target="_blank" rel="noreferrer">
                    <span className="pf-red-icono"><r.Icono size={16} aria-hidden /></span>
                    <span className="pf-red-txt"><strong>{r.label}</strong><small>{r.sub}</small></span>
                    <ArrowUpRight className="pf-red-flecha" size={15} strokeWidth={2.2} aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <BrunelaFooter />
    </>
  );
}

const CSS = `
.pf { --pf-curva: cubic-bezier(.22, 1, .36, 1); position: relative; background: linear-gradient(180deg, #FFF8F5 0%, #fff 26%, #FFF9F6 62%, #fff 100%); color: var(--ink); padding: 120px 0 40px; overflow-x: clip; }
.pf > section { position: relative; width: min(1180px, calc(100% - 32px)); margin: 0 auto; }

/* ── Tipografia comun ── */
.pf-kicker { display: inline-flex; align-items: center; gap: 8px; margin: 0 0 14px; font-family: var(--font-display); font-size: 12.5px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: var(--pink-deep); }
.pf-kicker svg { color: var(--pink); }
.pf-kicker--claro { color: #fff; }
.pf-kicker--claro svg { color: var(--pink-soft); }
.pf-raya { display: inline-block; width: 28px; height: 1.5px; background: currentColor; opacity: .55; }
.pf-h1 { margin: 0; font-family: var(--font-serif); font-weight: 500; font-size: clamp(3.6rem, 9vw, 7.2rem); line-height: .92; letter-spacing: -.025em; color: #1E1418; }
.pf-h1 > span { display: block; }
.pf-h1 em { position: relative; display: block; width: fit-content; margin-top: 18px; font-style: italic; font-size: .34em; line-height: 1.2; color: var(--pink-deep); letter-spacing: 0; }
.pf-trazo { position: absolute; left: 0; right: 0; bottom: -12px; width: 100%; height: 14px; overflow: visible; }
.pf-trazo path { fill: none; stroke: var(--pink); stroke-width: 2.4; stroke-linecap: round; stroke-dasharray: 340; stroke-dashoffset: 340; animation: pf-trazar 1.6s .9s var(--pf-curva) forwards; }
.pf-h2 { margin: 0; max-width: 20ch; font-family: var(--font-serif); font-weight: 500; font-size: clamp(2rem, 3.8vw, 3.2rem); line-height: 1.08; letter-spacing: -.01em; color: #1E1418; }
.pf-h2 em { font-style: italic; color: var(--pink); }
.pf-h2--claro { color: #fff; }
.pf-h2--claro em { color: var(--pink-soft); }
.pf-h3 { margin: 0 0 14px; font-family: var(--font-serif); font-weight: 500; font-size: clamp(1.8rem, 3vw, 2.5rem); line-height: 1.1; color: #1E1418; }
.pf-p { margin: 18px 0 0; max-width: 56ch; font-size: 16.5px; line-height: 1.75; color: #4A3F3C; }
.pf-p--centro { margin-left: auto; margin-right: auto; text-align: center; }
.pf-lede { margin: 30px 0 0; max-width: 46ch; font-size: 17.5px; line-height: 1.75; color: #4A3F3C; }

/* ── Botones ── */
.pf-btn { display: inline-flex; align-items: center; gap: 8px; height: 52px; padding: 0 26px; border-radius: 99px; text-decoration: none; font-family: var(--font-display); font-size: 14.5px; font-weight: 800; color: var(--ink); background: #fff; border: 1.5px solid var(--pink-line); transition: transform .35s var(--pf-curva), background .2s, box-shadow .35s; }
.pf-btn:hover { transform: translateY(-2px); background: var(--pink-wash); }
.pf-btn svg { transition: transform .35s var(--pf-curva); }
.pf-btn:hover svg:last-child { transform: translate(2px, -2px); }
.pf-btn--lleno { background: var(--pink); border-color: var(--pink); color: #fff; box-shadow: 0 16px 30px -14px rgba(230,79,85,.85); }
.pf-btn--lleno:hover { background: var(--pink-mid); box-shadow: 0 22px 36px -14px rgba(230,79,85,.9); }
.pf-btn--blanco { background: #fff; border-color: #fff; color: var(--pink-deep); margin-top: 30px; }
.pf-btn--blanco:hover { background: #FFF4F2; }
.pf-btn:focus-visible, .pf a:focus-visible { outline: 2px solid var(--pink-deep); outline-offset: 3px; }
.pf-botones { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 34px; }

/* ── Portada ── */
.pf-hero { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, .9fr); gap: clamp(28px, 5vw, 80px); align-items: center; padding-bottom: 70px; }
.pf-hero-txt { position: relative; z-index: 1; }
.pf-blob { position: absolute; z-index: 0; border-radius: 50%; filter: blur(70px); pointer-events: none; }
.pf-blob--a { width: 460px; height: 460px; right: -120px; top: -80px; background: radial-gradient(circle, rgba(255,190,190,.55), transparent 70%); animation: pf-flotar 14s ease-in-out infinite; }
.pf-blob--b { width: 380px; height: 380px; left: -160px; bottom: 0; background: radial-gradient(circle, rgba(255,214,196,.6), transparent 70%); animation: pf-flotar 18s ease-in-out infinite reverse; }
.pf-creds { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; margin-top: 36px; padding-top: 24px; border-top: 1px solid var(--pink-line); max-width: 480px; }
.pf-creds-label { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-display); font-size: 11.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--pink-muted); }
.pf-creds-label svg { color: var(--pink); }
.pf-creds ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.pf-creds li { padding: 5px 12px; border-radius: 99px; border: 1px solid var(--pink-line); background: rgba(255,255,255,.7); font-family: var(--font-display); font-size: 12px; font-weight: 800; letter-spacing: .06em; color: var(--pink-deep); }

.pf-hero-arte { position: relative; z-index: 1; width: 100%; max-width: 500px; justify-self: end; }
.pf-hero-marco { position: absolute; inset: 0; transform: translate(18px, 18px); border-radius: 240px 240px 34px 34px; border: 1.5px solid var(--pink-line); }
.pf-hero-foto { position: relative; aspect-ratio: 4 / 5; border-radius: 240px 240px 34px 34px; overflow: hidden; box-shadow: 0 50px 90px -44px rgba(176,58,62,.55); animation: pf-aparece 1.4s .1s var(--pf-curva) both; }
.pf-hero-foto::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 55%, rgba(30,20,24,.25)); }
.pf-sello { position: absolute; top: 6%; left: -56px; width: 128px; height: 128px; animation: pf-girar 26s linear infinite; }
.pf-sello-fondo { fill: rgba(255,255,255,.92); stroke: var(--pink-line); stroke-width: 1.5; }
.pf-sello text { font-family: var(--font-display); font-size: 15px; font-weight: 800; letter-spacing: 3px; fill: var(--pink-deep); }
.pf-sello-centro { position: absolute; top: calc(6% + 64px - 22px); left: calc(-56px + 64px - 22px); width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; background: var(--pink); color: #fff; }
.pf-guion { position: absolute; right: -6px; top: -26px; font-family: var(--font-serif); font-style: italic; font-size: 1.5rem; color: var(--pink-deep); transform: rotate(-6deg); }
.pf-flota { position: absolute; display: flex; align-items: center; gap: 12px; padding: 12px 18px 12px 12px; border-radius: 20px; background: rgba(255,255,255,.94); backdrop-filter: blur(12px); border: 1px solid var(--pink-line); box-shadow: 0 22px 40px -24px rgba(176,58,62,.55); }
.pf-flota > span:last-child { display: flex; flex-direction: column; line-height: 1.15; }
.pf-flota strong { font-family: var(--font-serif); font-size: 1.5rem; font-weight: 600; color: #1E1418; }
.pf-flota small { font-size: 12.5px; font-weight: 600; color: var(--pink-muted); }
.pf-flota-icono { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 14px; background: var(--pink-wash); color: var(--pink-deep); }
.pf-flota--a { left: -40px; bottom: 16%; animation: pf-mecer 7s ease-in-out infinite; }
.pf-flota--b { right: -26px; bottom: -18px; animation: pf-mecer 8s 1s ease-in-out infinite reverse; }
.pf-bajar { position: absolute; left: 0; bottom: 0; display: inline-flex; align-items: center; gap: 10px; font-family: var(--font-display); font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--pink-muted); text-decoration: none; }
.pf-bajar span { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; border: 1.5px solid var(--pink-line); color: var(--pink-deep); animation: pf-rebote 2.4s ease-in-out infinite; }
.pf-bajar:hover { color: var(--pink-deep); }

/* Entradas de la portada: al cargar, no al hacer scroll (ya esta en pantalla). */
.pf-entra { animation: pf-sube 1s var(--d, 0ms) var(--pf-curva) both; }

/* ── Cinta ── */
.pf-cinta { margin: 70px 0 0; padding: 18px 0; background: linear-gradient(90deg, #E64F55, #C9434A); transform: rotate(-1.6deg) scale(1.04); box-shadow: 0 20px 40px -26px rgba(176,58,62,.8); overflow: hidden; }
.pf-cinta-pista { display: flex; width: max-content; animation: pf-cinta 38s linear infinite; }
.pf-cinta-tramo { display: flex; flex-shrink: 0; }
.pf-cinta span { display: inline-flex; align-items: center; gap: 28px; padding-right: 28px; font-family: var(--font-serif); font-style: italic; font-size: clamp(1.4rem, 2.4vw, 2rem); white-space: nowrap; color: #fff; }
.pf-cinta svg { color: var(--pink-soft); }

/* ── Cifras ── */
.pf-cifras { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-top: 90px !important; }
.pf-cifra { position: relative; display: flex; flex-direction: column; gap: 4px; padding: 24px 24px 22px; border-radius: 26px; background: #fff; border: 1px solid var(--pink-line); overflow: hidden; transition: transform .4s var(--pf-curva), box-shadow .4s; }
.pf-cifra::after { content: ""; position: absolute; right: -40px; top: -40px; width: 120px; height: 120px; border-radius: 50%; background: radial-gradient(circle, var(--pink-wash), transparent 70%); transition: transform .6s var(--pf-curva); }
.pf-cifra:hover { transform: translateY(-4px); box-shadow: 0 26px 46px -30px rgba(176,58,62,.5); }
.pf-cifra:hover::after { transform: scale(1.6); }
.pf-cifra-icono { position: relative; z-index: 1; display: grid; place-items: center; width: 42px; height: 42px; margin-bottom: 14px; border-radius: 14px; background: var(--pink-wash); color: var(--pink-deep); }
.pf-cifra strong { position: relative; z-index: 1; font-family: var(--font-serif); font-weight: 500; font-size: 2.9rem; line-height: 1; color: var(--pink); font-variant-numeric: tabular-nums; }
.pf-cifra-titulo { position: relative; z-index: 1; margin-top: 10px; font-weight: 800; font-size: 14.5px; line-height: 1.35; }
.pf-cifra small { position: relative; z-index: 1; font-size: 13px; color: var(--muted); }

/* ── Conoceme ── */
.pf-conoceme { display: grid; grid-template-columns: minmax(0, .85fr) minmax(0, 1.15fr); gap: clamp(32px, 6vw, 90px); align-items: center; margin-top: 140px !important; }
.pf-conoceme-arte { position: relative; max-width: 440px; }
.pf-conoceme-marco { position: absolute; inset: -18px 18px 18px -18px; border-radius: 36px; background: repeating-linear-gradient(135deg, var(--pink-wash) 0 2px, transparent 2px 12px); }
.pf-conoceme-foto { position: relative; aspect-ratio: 3 / 4; border-radius: 34px; overflow: hidden; box-shadow: 0 40px 70px -40px rgba(176,58,62,.5); }
.pf-viaje { position: absolute; right: -22px; bottom: 34px; display: inline-flex; align-items: center; gap: 10px; padding: 12px 18px; border-radius: 99px; background: #1E1418; color: #fff; font-family: var(--font-display); font-size: 13px; font-weight: 800; box-shadow: 0 20px 36px -20px rgba(30,20,24,.7); }
.pf-viaje svg { color: var(--pink-soft); }
.pf-datos { list-style: none; margin: 24px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 10px 22px; }
.pf-datos li { display: inline-flex; align-items: center; gap: 8px; font-size: 14.5px; font-weight: 700; color: #3A302E; }
.pf-datos svg { color: var(--pink); }
.pf-cita { position: relative; margin: 30px 0 0; padding: 26px 28px 22px 30px; border-radius: 0 26px 26px 0; border-left: 3px solid var(--pink); background: linear-gradient(100deg, var(--pink-wash), rgba(253,236,236,0)); }
.pf-cita-icono { position: absolute; right: 18px; top: 14px; color: var(--pink-line); }
.pf-cita p { margin: 0; max-width: 40ch; font-family: var(--font-serif); font-style: italic; font-size: clamp(1.2rem, 1.8vw, 1.45rem); line-height: 1.45; color: #2A1E21; }
.pf-cita footer { margin-top: 12px; font-family: var(--font-display); font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: var(--pink-deep); }
.pf-chips { list-style: none; padding: 0; margin: 26px 0 0; display: flex; flex-wrap: wrap; gap: 8px; }
.pf-chips li { display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px 7px 7px; border-radius: 99px; background: #fff; border: 1px solid var(--pink-line); font-size: 13.5px; font-weight: 700; color: var(--pink-deep); transition: background .2s, transform .3s var(--pf-curva); }
.pf-chips li:hover { background: var(--pink-wash); transform: translateY(-2px); }
.pf-chips span { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--pink); color: #fff; }

/* ── Historia: linea vertical con hitos ── */
.pf-cabeza { text-align: center; display: flex; flex-direction: column; align-items: center; }
.pf-cabeza .pf-h2 { text-align: center; }
.pf-historia { margin-top: 150px !important; }
.pf-capitulos { position: relative; list-style: none; margin: 70px 0 0; padding: 0; display: flex; flex-direction: column; gap: 90px; }
.pf-linea { position: absolute; left: 50%; top: 10px; bottom: 10px; width: 2px; margin-left: -1px; background: var(--pink-line); border-radius: 2px; }
.pf-linea-relleno { position: absolute; inset: 0; border-radius: 2px; background: linear-gradient(180deg, var(--pink-soft), var(--pink)); transform: scaleY(0); transform-origin: top; }
.pf-capitulo { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) 84px minmax(0, 1fr); align-items: center; }
.pf-hito { grid-column: 2; grid-row: 1; justify-self: center; z-index: 1; display: grid; place-items: center; width: 54px; height: 54px; border-radius: 50%; background: #fff; border: 2px solid var(--pink); color: var(--pink-deep); box-shadow: 0 0 0 8px #FFF9F6, 0 14px 30px -14px rgba(176,58,62,.6); }
.pf-capitulo-foto { grid-column: 1; grid-row: 1; position: relative; aspect-ratio: 900 / 950; border-radius: 34px; overflow: hidden; box-shadow: 0 40px 70px -44px rgba(176,58,62,.55); }
.pf-capitulo-txt { grid-column: 3; grid-row: 1; }
.pf-capitulo.es-par .pf-capitulo-foto { grid-column: 3; }
.pf-capitulo.es-par .pf-capitulo-txt { grid-column: 1; }
.pf-capitulo-num { position: absolute; left: 22px; bottom: 10px; font-family: var(--font-serif); font-style: italic; font-size: 5rem; line-height: 1; color: #fff; text-shadow: 0 6px 24px rgba(0,0,0,.25); }
.pf-capitulo-foto::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 50%, rgba(30,20,24,.35)); pointer-events: none; }
.pf-capitulo-cabeza { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 0 0 14px; }
.pf-capitulo-etq { font-family: var(--font-serif); font-style: italic; font-size: 1.1rem; color: var(--pink-deep); }
.pf-fechas { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 99px; background: var(--pink-wash); font-family: var(--font-display); font-size: 12px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--pink-deep); }
.pf-capitulo-p { position: relative; margin: 0 0 14px; padding-left: 20px; font-size: 16.5px; line-height: 1.75; color: #4A3F3C; }
.pf-capitulo-p::before { content: ""; position: absolute; left: 0; top: .72em; width: 7px; height: 7px; border-radius: 50%; border: 1.5px solid var(--pink); }
.pf-capitulo-p strong { color: #1E1418; font-weight: 700; }

/* ── Formacion ── */
.pf-formacion { margin-top: 150px !important; }
.pf-disciplinas { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 54px; }
.pf-disciplina { position: relative; padding: 28px; border-radius: 28px; background: #fff; border: 1px solid var(--pink-line); overflow: hidden; transition: transform .45s var(--pf-curva), box-shadow .45s, border-color .3s; }
.pf-disciplina::before { content: ""; position: absolute; inset: 0; background: radial-gradient(420px 200px at 100% 0%, var(--pink-wash), transparent 70%); opacity: 0; transition: opacity .45s; }
.pf-disciplina:hover { transform: translateY(-6px); border-color: var(--pink-soft); box-shadow: 0 30px 50px -30px rgba(176,58,62,.5); }
.pf-disciplina:hover::before { opacity: 1; }
.pf-disciplina > * { position: relative; }
.pf-disciplina-arriba { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
.pf-disciplina-icono { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 18px; background: var(--pink-wash); color: var(--pink-deep); transition: background .35s, color .35s, transform .45s var(--pf-curva); }
.pf-disciplina:hover .pf-disciplina-icono { background: var(--pink); color: #fff; transform: rotate(-8deg) scale(1.06); }
.pf-disciplina-num { font-family: var(--font-serif); font-style: italic; font-size: 2.6rem; line-height: 1; color: transparent; -webkit-text-stroke: 1px var(--pink-line); }
.pf-etiqueta { display: inline-block; padding: 4px 11px; border-radius: 99px; background: var(--pink-wash); font-size: 11.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--pink-deep); }
.pf-disciplina h3 { margin: 14px 0 10px; font-family: var(--font-serif); font-weight: 500; font-size: 1.55rem; line-height: 1.2; color: #1E1418; }
.pf-disciplina h3 small { font-size: .7em; color: var(--pink-deep); }
.pf-disciplina p { margin: 0; font-size: 15px; line-height: 1.7; color: #5A4E4B; }

/* ── Galeria: bento ── */
.pf-galeria-sec { margin-top: 150px !important; }
.pf-galeria-cabeza { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 36px; }
.pf-galeria-ig { display: inline-flex; align-items: center; gap: 8px; padding: 12px 18px; border-radius: 99px; border: 1.5px solid var(--pink-line); background: #fff; text-decoration: none; font-family: var(--font-display); font-size: 13.5px; font-weight: 800; color: var(--pink-deep); transition: background .2s, transform .3s var(--pf-curva); }
.pf-galeria-ig:hover { background: var(--pink-wash); transform: translateY(-2px); }
.pf-galeria { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: clamp(150px, 17vw, 220px); gap: 14px; }
.pf-galeria-foto { position: relative; margin: 0; border-radius: 26px; overflow: hidden; background: var(--pink-wash); }
.pf-g1 { grid-column: span 2; grid-row: span 2; }
.pf-g2 { grid-column: span 2; }
.pf-g5, .pf-g6 { grid-column: span 2; }
.pf-galeria-foto figcaption { position: absolute; inset: auto 0 0 0; display: flex; align-items: center; gap: 10px; padding: 40px 18px 16px; background: linear-gradient(180deg, transparent, rgba(30,20,24,.72)); color: #fff; font-size: 13.5px; font-weight: 600; opacity: 0; transform: translateY(10px); transition: opacity .4s, transform .5s var(--pf-curva); }
.pf-galeria-foto figcaption span { font-family: var(--font-serif); font-style: italic; font-size: 1.2rem; color: var(--pink-soft); }
.pf-galeria-foto:hover figcaption { opacity: 1; transform: none; }
.pf-zoom img { transition: transform 1.1s var(--pf-curva); }
.pf-zoom:hover img { transform: scale(1.06); }

/* ── Cierre ── */
.pf-cierre { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); gap: 18px; margin-top: 150px !important; margin-bottom: 90px !important; }
.pf-estudio { position: relative; overflow: hidden; padding: clamp(30px, 4vw, 56px); border-radius: 38px; color: #fff; background: radial-gradient(520px 320px at 90% 0%, rgba(255,218,218,.38), transparent 70%), linear-gradient(140deg, #E64F55, #B03A3E); box-shadow: 0 40px 80px -44px rgba(176,58,62,.9); }
.pf-estudio > *:not(.pf-estudio-anillo) { position: relative; z-index: 1; }
.pf-estudio-anillo { position: absolute; border-radius: 50%; border: 1px solid rgba(255,255,255,.22); pointer-events: none; }
.pf-estudio-anillo--a { width: 380px; height: 380px; right: -140px; bottom: -160px; animation: pf-latir 9s ease-in-out infinite; }
.pf-estudio-anillo--b { width: 240px; height: 240px; right: -70px; bottom: -90px; animation: pf-latir 9s 1.5s ease-in-out infinite; }
.pf-estudio-p { margin: 18px 0 0; max-width: 44ch; font-size: 16.5px; line-height: 1.7; color: #FFE9E9; }
.pf-estudio-lista { list-style: none; margin: 26px 0 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.pf-estudio-lista li { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 16px; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.18); font-size: 14px; font-weight: 700; }
.pf-estudio-lista span { flex-shrink: 0; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 10px; background: #fff; color: var(--pink-deep); }
.pf-contacto { padding: clamp(30px, 4vw, 56px); border-radius: 38px; background: #fff; border: 1px solid var(--pink-line); }
.pf-whatsapp { display: flex; align-items: center; gap: 14px; margin-top: 26px; padding: 14px 20px 14px 14px; border-radius: 22px; text-decoration: none; background: var(--pink-wash); color: var(--pink-deep); transition: transform .35s var(--pf-curva), box-shadow .35s; }
.pf-whatsapp:hover { transform: translateY(-2px); box-shadow: 0 20px 36px -24px rgba(176,58,62,.6); }
.pf-whatsapp-icono { flex-shrink: 0; display: grid; place-items: center; width: 48px; height: 48px; border-radius: 16px; background: var(--pink); color: #fff; }
.pf-whatsapp-txt { flex: 1; display: flex; flex-direction: column; font-family: var(--font-display); font-size: 19px; font-weight: 800; }
.pf-whatsapp small { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; opacity: .8; }
.pf-whatsapp-flecha { transition: transform .35s var(--pf-curva); }
.pf-whatsapp:hover .pf-whatsapp-flecha { transform: translate(3px, -3px); }
.pf-redes-titulo { margin: 26px 0 10px; font-family: var(--font-display); font-size: 11.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--pink-muted); }
.pf-redes { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.pf-redes a { display: flex; align-items: center; gap: 12px; padding: 10px 14px 10px 10px; border-radius: 18px; border: 1px solid var(--pink-line); text-decoration: none; color: var(--ink); transition: background .2s, border-color .2s, transform .3s var(--pf-curva); }
.pf-redes a:hover { background: var(--pink-wash); border-color: var(--pink-soft); transform: translateY(-2px); }
.pf-red-icono { flex-shrink: 0; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 12px; background: var(--pink-wash); color: var(--pink-deep); transition: background .2s, color .2s; }
.pf-redes a:hover .pf-red-icono { background: var(--pink); color: #fff; }
.pf-red-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.pf-redes strong { font-size: 14.5px; }
.pf-redes small { font-size: 12.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pf-red-flecha { flex-shrink: 0; color: var(--pink); }

/* ── Entradas al hacer scroll (components/landing-movimiento.tsx). Solo se
   esconde bajo html.lp-js: sin JavaScript todo queda visible. ── */
.lp-js .pf [data-lp-revelar] { opacity: 0; transform: translateY(30px); transition: opacity .9s var(--pf-curva), transform .9s var(--pf-curva); }
.lp-js .pf .pf-hito[data-lp-revelar] { transform: scale(.4); }
.lp-js .pf .pf-capitulo-foto[data-lp-revelar] { transform: translateY(30px) scale(.96); }
.lp-js .pf [data-lp-revelar][data-lp-visto] { opacity: 1; transform: none; }

@keyframes pf-sube { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
@keyframes pf-aparece { from { opacity: 0; transform: scale(1.05); clip-path: inset(12% 0 0 0 round 240px 240px 34px 34px); } to { opacity: 1; transform: none; clip-path: inset(0 0 0 0 round 240px 240px 34px 34px); } }
@keyframes pf-trazar { to { stroke-dashoffset: 0; } }
@keyframes pf-flotar { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-30px, 24px) scale(1.08); } }
@keyframes pf-mecer { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes pf-girar { to { transform: rotate(360deg); } }
@keyframes pf-rebote { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(5px); } }
@keyframes pf-cinta { to { transform: translateX(-50%); } }
@keyframes pf-latir { 0%, 100% { transform: scale(1); opacity: .9; } 50% { transform: scale(1.08); opacity: .5; } }

@media (max-width: 1100px) {
  .pf-sello { left: -24px; }
  .pf-sello-centro { left: calc(-24px + 64px - 22px); }
  .pf-flota--a { left: -16px; }
  .pf-flota--b { right: -8px; }
}
@media (max-width: 900px) {
  .pf { padding-top: 104px; }
  .pf-hero, .pf-conoceme, .pf-cierre { grid-template-columns: minmax(0, 1fr); }
  .pf-hero { padding-bottom: 0; }
  .pf-hero-arte { order: -1; max-width: 420px; justify-self: center; margin-bottom: 18px; }
  .pf-bajar { display: none; }
  .pf-cifras { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 64px !important; }
  .pf-disciplinas { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pf-conoceme, .pf-historia, .pf-formacion, .pf-galeria-sec, .pf-cierre { margin-top: 100px !important; }
  .pf-conoceme-arte { width: calc(100% - 18px); margin-left: 18px; }
  /* Linea a la izquierda: hito en la primera columna, foto y texto apilados. */
  .pf-linea { left: 27px; }
  .pf-capitulos { gap: 64px; }
  .pf-capitulo, .pf-capitulo.es-par { grid-template-columns: 54px minmax(0, 1fr); column-gap: 18px; row-gap: 22px; align-items: start; }
  .pf-hito { grid-column: 1; grid-row: 1; }
  .pf-capitulo .pf-capitulo-foto, .pf-capitulo.es-par .pf-capitulo-foto { grid-column: 2; grid-row: 1; max-width: 460px; }
  .pf-capitulo .pf-capitulo-txt, .pf-capitulo.es-par .pf-capitulo-txt { grid-column: 2; grid-row: 2; }
}
@media (max-width: 600px) {
  .pf-h1 { font-size: clamp(3.4rem, 17vw, 4.6rem); }
  .pf-h1 em { font-size: .4em; }
  .pf-lede { font-size: 16.5px; }
  .pf-hero-arte { max-width: none; width: calc(100% - 22px); margin-left: 4px; justify-self: start; }
  .pf-sello { width: 96px; height: 96px; left: -6px; top: 4%; }
  .pf-sello-centro { width: 34px; height: 34px; top: calc(4% + 48px - 17px); left: calc(-6px + 48px - 17px); }
  .pf-sello-centro svg { width: 16px; height: 16px; }
  .pf-guion { right: 6px; top: -30px; font-size: 1.25rem; }
  .pf-flota { padding: 9px 14px 9px 9px; gap: 10px; border-radius: 16px; }
  .pf-flota strong { font-size: 1.2rem; }
  .pf-flota small { font-size: 11.5px; }
  .pf-flota-icono { width: 34px; height: 34px; border-radius: 12px; }
  .pf-flota--a { left: -4px; bottom: 18%; }
  .pf-flota--b { right: -18px; bottom: -16px; }
  .pf-hero-marco { transform: translate(12px, 12px); }
  .pf-cinta { margin-top: 56px; padding: 14px 0; }
  .pf-cifras { gap: 10px; }
  .pf-cifra { padding: 18px 16px; border-radius: 22px; }
  .pf-cifra strong { font-size: 2.2rem; }
  .pf-cifra-icono { width: 36px; height: 36px; margin-bottom: 10px; }
  .pf-cifra-titulo { font-size: 13.5px; }
  .pf-viaje { right: -10px; bottom: 22px; font-size: 12px; padding: 10px 14px; }
  .pf-cita { padding: 22px 20px 18px 22px; }
  .pf-disciplinas, .pf-redes, .pf-estudio-lista { grid-template-columns: minmax(0, 1fr); }
  .pf-capitulo, .pf-capitulo.es-par { grid-template-columns: 40px minmax(0, 1fr); column-gap: 14px; }
  .pf-hito { width: 40px; height: 40px; box-shadow: 0 0 0 6px #FFF9F6; }
  .pf-hito svg { width: 17px; height: 17px; }
  .pf-linea { left: 20px; }
  .pf-capitulo-num { font-size: 3.6rem; left: 16px; }
  .pf-capitulo-p { font-size: 15.5px; }
  .pf-galeria { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: 132px; gap: 8px; }
  .pf-galeria-foto { border-radius: 18px; }
  .pf-g1 { grid-column: span 2; grid-row: span 2; }
  .pf-g2, .pf-g5 { grid-column: span 1; }
  .pf-g6 { grid-column: span 2; }
  .pf-galeria-foto figcaption { display: none; }
  .pf-estudio, .pf-contacto { border-radius: 30px; }
  .pf-whatsapp-txt { font-size: 17px; }
}

/* Sin movimiento: nada flota, nada gira, nada queda oculto. */
@media (prefers-reduced-motion: reduce) {
  .pf *, .pf *::before, .pf *::after { animation: none !important; transition: none !important; }
  .lp-js .pf [data-lp-revelar] { opacity: 1; transform: none; }
  .pf-trazo path { stroke-dashoffset: 0; }
  .pf-zoom:hover img { transform: none; }
  .pf-galeria-foto figcaption { opacity: 1; transform: none; }
}
`;
