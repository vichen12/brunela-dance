import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { BrunelaFooter } from "@/components/ui/hover-footer";

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
 * Solo en español: la web vieja tampoco tenia el texto traducido entero.
 */

export const metadata: Metadata = {
  title: "Portfolio · Brunela Dance Trainer",
  description:
    "Bailarina, coreógrafa y profesora de Argentina radicada en Barcelona. Trayectoria, formación y trabajo artístico de Brunela.",
};

const WHATSAPP = "https://wa.me/34612491637";

const CIFRAS = [
  { num: "2002", titulo: "Primeros pasos", sub: "Mendoza, Argentina" },
  { num: "15+", titulo: "Años de docencia", sub: "Desde 2011" },
  { num: "9", titulo: "Años en la Fiesta de la Vendimia", sub: "Evento nacional" },
  { num: "RAD", titulo: "Certificación", sub: "Royal Academy of Dance" },
];

type Parrafo = (string | { b: string })[];

const CAPITULOS: { numero: string; fechas: string; titulo: string; foto: string; parrafos: Parrafo[] }[] = [
  {
    numero: "01",
    fechas: "2002 – 2010",
    titulo: "La bailarina nace",
    foto: "/fotos-landing/c-tul.jpg",
    parrafos: [
      ["Nació en ", { b: "1994" }, " en Mendoza, Argentina. Comenzó el ballet a los ", { b: "8 años" }, ", sumando danza contemporánea, teatro, flamenco, hip-hop y acondicionamiento físico."],
      ["Subió a los principales escenarios interpretando ", { b: "El Lago de los Cisnes, Don Quijote, El Cascanueces, Giselle y Coppélia" }, "."],
      ["Se formó junto a figuras como ", { b: "Eleonora Cassano, Paloma Herrera y Julio Bocca" }, "."],
    ],
  },
  {
    numero: "02",
    fechas: "2011 – 2019",
    titulo: "La maestra emerge",
    foto: "/fotos-landing/c-cambre.jpg",
    parrafos: [
      ["En ", { b: "2011" }, " inició su carrera docente, graduándose como instructora de danza clásica."],
      ["En ", { b: "2015" }, " se incorporó a la ", { b: "Fiesta de la Vendimia" }, " — 1.000 artistas, miles de espectadores internacionales — durante ", { b: "9 años consecutivos" }, "."],
      ["En ", { b: "2018" }, " obtuvo el Título Técnico en Danza Clásica y Contemporánea."],
    ],
  },
  {
    numero: "03",
    fechas: "2020 – Hoy",
    titulo: "Barcelona y el mundo",
    foto: "/fotos-landing/c-split.jpg",
    parrafos: [
      ["En ", { b: "2020" }, " obtuvo certificaciones en ", { b: "PBT, PCT, Pilates Reformer, Pilates Mat y Stretching" }, ", y menciones CPD de la ", { b: "Royal Academy of Dance" }, " de Londres."],
      ["En ", { b: "2021" }, " se convirtió en coreógrafa y remontadora: ", { b: "El Lago de los Cisnes, Bayadera, Serenata de Balanchine" }, "."],
      ["Hoy, desde ", { b: "Barcelona" }, ", forma bailarines en clases presenciales y online, con ", { b: "más de 30K" }, " seguidores en Instagram."],
    ],
  },
];

const DISCIPLINAS = [
  { etiqueta: "Técnica", titulo: "Progressing Ballet Technique", sigla: "PBT", texto: "Programa innovador de acondicionamiento que entrena la memoria muscular para mejorar la técnica en todas las formas de danza." },
  { etiqueta: "Contemporáneo", titulo: "Progressing Contemporary Technique", sigla: "PCT", texto: "Desarrolla la libertad de movimiento a través de ejercicios funcionales, con foco en la articulación de la columna y la musicalidad." },
  { etiqueta: "Clásico", titulo: "Ballet", texto: "Ballet clásico para todos los niveles, con foco en técnica, postura y expresión artística." },
  { etiqueta: "Flexibilidad", titulo: "Stretching", texto: "Trabajo enfocado en mejorar la flexibilidad, el rango de movimiento y la salud muscular general." },
  { etiqueta: "Fuerza", titulo: "Pilates Reformer", texto: "Técnica en máquina con resortes ajustables que trabaja todo el cuerpo, mejorando fuerza, postura y coordinación." },
  { etiqueta: "Core", titulo: "Pilates Mat", texto: "Técnica de suelo que desarrolla fuerza del core, flexibilidad y resistencia muscular usando el peso del cuerpo." },
];

const GALERIA = [
  { src: "/fotos-landing/m-piso.jpg", alt: "Brunela en el suelo con el brazo en alto" },
  { src: "/fotos-landing/m-cou.jpg", alt: "Retrato de Brunela de perfil" },
  { src: "/fotos-landing/m-cintas.jpg", alt: "Atando las cintas de las zapatillas de punta" },
  { src: "/fotos-landing/m-mermaid.jpg", alt: "Brunela en estiramiento lateral con pelota" },
  { src: "/fotos-landing/m-pelota.jpg", alt: "Trabajo en la barra con pelota" },
  { src: "/fotos-landing/m-barra2.jpg", alt: "Brunela sonriendo junto a la barra" },
];

const REDES = [
  { href: "https://www.instagram.com/brunela.dance", label: "Instagram", sub: "@brunela.dance · 30K+" },
  { href: "https://www.tiktok.com/@brunela.dance", label: "TikTok", sub: "@brunela.dance" },
  { href: "https://www.youtube.com/@bruneladance", label: "YouTube", sub: "@bruneladance" },
  { href: "https://www.facebook.com/brunela.dance", label: "Facebook", sub: "brunela.dance" },
];

function Texto({ partes }: { partes: Parrafo }) {
  return <p>{partes.map((p, i) => (typeof p === "string" ? p : <strong key={i}>{p.b}</strong>))}</p>;
}

export default function PortfolioPage() {
  return (
    <>
      <style>{CSS}</style>
      <Navbar />
      <main className="pf">
        {/* ── Portada ─────────────────────────────────────────────── */}
        <section className="pf-hero">
          <div className="pf-hero-txt">
            <p className="pf-kicker"><span className="pf-punto" aria-hidden /> Barcelona · Argentina</p>
            <h1 className="pf-h1">
              Brunela<em>bailarina, coreógrafa y profesora.</em>
            </h1>
            <p className="pf-lede">
              Arte, técnica y pasión desde Argentina. Radicada en Barcelona, certificada en PBT, PCT,
              Pilates y RAD — llevo más de 15 años transformando cuerpos y carreras a través del movimiento.
            </p>
            <div className="pf-botones">
              <Link className="pf-btn pf-btn--lleno" href="/#planes">
                Entrenar conmigo <ArrowUpRight size={16} strokeWidth={2.2} aria-hidden />
              </Link>
              <a className="pf-btn" href={WHATSAPP} target="_blank" rel="noreferrer">
                <MessageCircle size={16} strokeWidth={2.2} aria-hidden /> Escribime
              </a>
            </div>
          </div>
          <div className="pf-hero-foto">
            <Image src="/fotos-landing/puerta.avif" alt="Brunela en la barra con la pierna extendida" fill priority sizes="(max-width: 900px) 92vw, 520px" style={{ objectFit: "cover", objectPosition: "center 30%" }} />
          </div>
        </section>

        {/* ── Cifras ──────────────────────────────────────────────── */}
        <section className="pf-cifras" aria-label="En números">
          {CIFRAS.map((c) => (
            <div key={c.titulo} className="pf-cifra">
              <strong>{c.num}</strong>
              <span>{c.titulo}</span>
              <small>{c.sub}</small>
            </div>
          ))}
        </section>

        {/* ── Conóceme ────────────────────────────────────────────── */}
        <section className="pf-conoceme">
          <div className="pf-conoceme-foto">
            <Image src="/fotos-landing/sobre-mi.jpg" alt="Retrato de Brunela" fill sizes="(max-width: 900px) 88vw, 420px" style={{ objectFit: "cover", objectPosition: "top center" }} />
          </div>
          <div>
            <p className="pf-kicker">Conóceme</p>
            <h2 className="pf-h2">Una artista que enseña con el <em>cuerpo y el alma.</em></h2>
            <p className="pf-p">
              Soy Brunela, profesora de ballet, coreógrafa y bailarina. Soy de Argentina y actualmente resido
              en Barcelona. Tras años de estudio y práctica dedicados, me he especializado en el entrenamiento de
              bailarines para ayudarlos a alcanzar su mejor rendimiento.
            </p>
            <ul className="pf-chips" aria-label="Especialidades">
              {DISCIPLINAS.map((d, i) => (
                <li key={d.titulo}><span>{String(i + 1).padStart(2, "0")}</span>{d.titulo}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Trayectoria ─────────────────────────────────────────── */}
        <section className="pf-historia">
          <header className="pf-cabeza">
            <p className="pf-kicker">Mi historia</p>
            <h2 className="pf-h2">Una historia escrita en <em>movimiento.</em></h2>
          </header>
          <ol className="pf-capitulos">
            {CAPITULOS.map((c, i) => (
              <li key={c.numero} className={"pf-capitulo" + (i % 2 ? " es-par" : "")}>
                <div className="pf-capitulo-foto">
                  <Image src={c.foto} alt="" fill sizes="(max-width: 900px) 88vw, 440px" style={{ objectFit: "cover" }} />
                  <span className="pf-capitulo-num" aria-hidden>{c.numero}</span>
                </div>
                <div className="pf-capitulo-txt">
                  <p className="pf-fechas">{c.fechas}</p>
                  <h3 className="pf-h3">{c.titulo}</h3>
                  {c.parrafos.map((p, j) => <Texto key={j} partes={p} />)}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Formación ───────────────────────────────────────────── */}
        <section className="pf-formacion">
          <header className="pf-cabeza">
            <p className="pf-kicker">Formación y método</p>
            <h2 className="pf-h2">Cada disciplina, <em>una historia.</em></h2>
            <p className="pf-p pf-p--centro">Cada una está pensada para elevar tu técnica, fortalecer tu cuerpo y conectarte con el movimiento.</p>
          </header>
          <div className="pf-disciplinas">
            {DISCIPLINAS.map((d) => (
              <article key={d.titulo} className="pf-disciplina">
                <span className="pf-etiqueta">{d.etiqueta}</span>
                <h3>{d.titulo}{d.sigla && <small> ({d.sigla})</small>}</h3>
                <p>{d.texto}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Galería ─────────────────────────────────────────────── */}
        <section className="pf-galeria" aria-label="Galería">
          {GALERIA.map((g) => (
            <div key={g.src} className="pf-galeria-foto">
              <Image src={g.src} alt={g.alt} fill sizes="(max-width: 700px) 46vw, 30vw" style={{ objectFit: "cover" }} />
            </div>
          ))}
        </section>

        {/* ── Estudio online + contacto ───────────────────────────── */}
        <section className="pf-cierre">
          <div className="pf-estudio">
            <p className="pf-kicker pf-kicker--claro">Estudio online</p>
            <h2 className="pf-h2 pf-h2--claro">Entrená conmigo, <em>cuando y donde quieras.</em></h2>
            <p>Clases completas, planes de trabajo, sesiones en vivo y una comunidad de bailarinas. Para todos los niveles.</p>
            <Link className="pf-btn pf-btn--blanco" href="/#planes">
              Ver los planes <ArrowUpRight size={16} strokeWidth={2.2} aria-hidden />
            </Link>
          </div>
          <div className="pf-contacto">
            <p className="pf-kicker">Contacto</p>
            <h2 className="pf-h2">¿Lista para empezar <em>a bailar?</em></h2>
            <p className="pf-p">Hablemos y encontremos la clase perfecta para vos.</p>
            <a className="pf-whatsapp" href={WHATSAPP} target="_blank" rel="noreferrer">
              <MessageCircle size={20} strokeWidth={2} aria-hidden />
              <span><small>WhatsApp</small>+34 612 491 637</span>
            </a>
            <ul className="pf-redes">
              {REDES.map((r) => (
                <li key={r.label}>
                  <a href={r.href} target="_blank" rel="noreferrer">
                    <strong>{r.label}</strong><small>{r.sub}</small>
                    <ArrowUpRight size={15} strokeWidth={2.2} aria-hidden />
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
.pf { background: linear-gradient(180deg, #FFF8F5 0%, #fff 30%, #FFF9F6 100%); color: var(--ink); padding: 120px 0 40px; overflow-x: clip; }
.pf > section { width: min(1180px, calc(100% - 32px)); margin: 0 auto; }
.pf-kicker { display: inline-flex; align-items: center; gap: 8px; margin: 0 0 14px; font-family: var(--font-display); font-size: 12.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--pink-deep); }
.pf-kicker--claro { color: var(--pink-soft); }
.pf-punto { width: 8px; height: 8px; border-radius: 50%; background: var(--pink); }
.pf-h1 { margin: 0; font-family: var(--font-serif); font-weight: 500; font-size: clamp(3.2rem, 8vw, 6.4rem); line-height: .95; letter-spacing: -.02em; color: #1E1418; }
.pf-h1 em { display: block; margin-top: 14px; font-style: italic; font-size: .36em; line-height: 1.2; color: var(--pink); letter-spacing: 0; }
.pf-h2 { margin: 0; max-width: 20ch; font-family: var(--font-serif); font-weight: 500; font-size: clamp(2rem, 3.6vw, 3.1rem); line-height: 1.1; color: #1E1418; }
.pf-h2 em { font-style: italic; color: var(--pink); }
.pf-h2--claro { color: #fff; }
.pf-h2--claro em { color: var(--pink-soft); }
.pf-h3 { margin: 0 0 12px; font-family: var(--font-serif); font-weight: 500; font-size: clamp(1.6rem, 2.6vw, 2.2rem); color: #1E1418; }
.pf-p { margin: 18px 0 0; max-width: 56ch; font-size: 16.5px; line-height: 1.75; color: #4A3F3C; }
.pf-p--centro { margin-left: auto; margin-right: auto; text-align: center; }
.pf-lede { margin: 24px 0 0; max-width: 46ch; font-size: 17.5px; line-height: 1.75; color: #4A3F3C; }

.pf-btn { display: inline-flex; align-items: center; gap: 8px; height: 50px; padding: 0 24px; border-radius: 99px; text-decoration: none; font-family: var(--font-display); font-size: 14.5px; font-weight: 800; color: var(--ink); background: #fff; border: 1.5px solid var(--pink-line); transition: transform .3s, background .2s, box-shadow .3s; }
.pf-btn:hover { transform: translateY(-2px); background: var(--pink-wash); }
.pf-btn--lleno { background: var(--pink); border-color: var(--pink); color: #fff; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); }
.pf-btn--lleno:hover { background: var(--pink-mid); }
.pf-btn--blanco { background: #fff; border-color: #fff; color: var(--pink-deep); margin-top: 26px; }
.pf-botones { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }

.pf-hero { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, .9fr); gap: clamp(28px, 5vw, 72px); align-items: center; }
.pf-hero-foto { position: relative; aspect-ratio: 4 / 5; border-radius: 220px 220px 32px 32px; overflow: hidden; box-shadow: 0 40px 80px -40px rgba(176,58,62,.45); }

.pf-cifras { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 72px !important; }
.pf-cifra { display: flex; flex-direction: column; gap: 4px; padding: 22px 22px 20px; border-radius: 24px; background: #fff; border: 1px solid var(--pink-line); }
.pf-cifra strong { font-family: var(--font-serif); font-weight: 500; font-size: 2.6rem; line-height: 1; color: var(--pink); }
.pf-cifra span { margin-top: 8px; font-weight: 800; font-size: 14.5px; }
.pf-cifra small { font-size: 13px; color: var(--muted); }

.pf-conoceme { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: clamp(28px, 5vw, 72px); align-items: center; margin-top: 120px !important; }
.pf-conoceme-foto { position: relative; aspect-ratio: 3 / 4; border-radius: 32px; overflow: hidden; }
.pf-chips { list-style: none; padding: 0; margin: 28px 0 0; display: flex; flex-wrap: wrap; gap: 8px; }
.pf-chips li { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px 8px 8px; border-radius: 99px; background: var(--pink-wash); font-size: 14px; font-weight: 700; color: var(--pink-deep); }
.pf-chips span { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: #fff; font-size: 11px; font-weight: 900; }

.pf-cabeza { text-align: center; display: flex; flex-direction: column; align-items: center; }
.pf-cabeza .pf-h2 { text-align: center; }
.pf-historia { margin-top: 140px !important; }
.pf-capitulos { list-style: none; margin: 56px 0 0; padding: 0; display: flex; flex-direction: column; gap: 64px; }
.pf-capitulo { display: grid; grid-template-columns: minmax(0, .85fr) minmax(0, 1.15fr); gap: clamp(28px, 5vw, 64px); align-items: center; }
.pf-capitulo.es-par .pf-capitulo-foto { order: 2; }
.pf-capitulo-foto { position: relative; aspect-ratio: 900 / 950; border-radius: 32px; overflow: hidden; }
.pf-capitulo-num { position: absolute; left: 18px; bottom: 12px; font-family: var(--font-serif); font-style: italic; font-size: 4.2rem; line-height: 1; color: #fff; text-shadow: 0 6px 24px rgba(0,0,0,.25); }
.pf-fechas { margin: 0 0 8px; font-family: var(--font-display); font-size: 13px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--pink); }
.pf-capitulo-txt p:not(.pf-fechas) { margin: 0 0 14px; font-size: 16.5px; line-height: 1.75; color: #4A3F3C; }
.pf-capitulo-txt strong { color: #1E1418; font-weight: 700; }

.pf-formacion { margin-top: 140px !important; }
.pf-disciplinas { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 48px; }
.pf-disciplina { padding: 26px; border-radius: 26px; background: #fff; border: 1px solid var(--pink-line); transition: transform .3s, box-shadow .3s; }
.pf-disciplina:hover { transform: translateY(-4px); box-shadow: 0 24px 44px -28px rgba(176,58,62,.45); }
.pf-etiqueta { display: inline-block; padding: 4px 11px; border-radius: 99px; background: var(--pink-wash); font-size: 11.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--pink-deep); }
.pf-disciplina h3 { margin: 16px 0 10px; font-family: var(--font-serif); font-weight: 500; font-size: 1.5rem; line-height: 1.2; color: #1E1418; }
.pf-disciplina h3 small { font-size: .7em; color: var(--pink); }
.pf-disciplina p { margin: 0; font-size: 15px; line-height: 1.7; color: #5A4E4B; }

.pf-galeria { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 120px !important; }
.pf-galeria-foto { position: relative; aspect-ratio: 1200 / 780; border-radius: 24px; overflow: hidden; }
.pf-galeria-foto img { transition: transform .8s; }
.pf-galeria-foto:hover img { transform: scale(1.04); }

.pf-cierre { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; margin-top: 120px !important; margin-bottom: 80px !important; }
.pf-estudio { padding: clamp(28px, 4vw, 52px); border-radius: 36px; color: #fff; background: radial-gradient(500px 300px at 90% 0%, rgba(255,218,218,.35), transparent 70%), linear-gradient(140deg, #E64F55, #B03A3E); }
.pf-estudio p:not(.pf-kicker) { margin: 18px 0 0; max-width: 44ch; font-size: 16.5px; line-height: 1.7; color: #FFE9E9; }
.pf-contacto { padding: clamp(28px, 4vw, 52px); border-radius: 36px; background: #fff; border: 1px solid var(--pink-line); }
.pf-whatsapp { display: flex; align-items: center; gap: 14px; margin-top: 26px; padding: 16px 20px; border-radius: 22px; text-decoration: none; background: var(--pink-wash); color: var(--pink-deep); }
.pf-whatsapp span { display: flex; flex-direction: column; font-family: var(--font-display); font-size: 19px; font-weight: 800; }
.pf-whatsapp small { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; opacity: .8; }
.pf-redes { list-style: none; padding: 0; margin: 14px 0 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.pf-redes a { display: grid; grid-template-columns: 1fr auto; align-items: center; padding: 12px 16px; border-radius: 18px; border: 1px solid var(--pink-line); text-decoration: none; color: var(--ink); transition: background .2s; }
.pf-redes a:hover { background: var(--pink-wash); }
.pf-redes strong { font-size: 14.5px; }
.pf-redes small { grid-column: 1; font-size: 12.5px; color: var(--muted); }
.pf-redes svg { grid-column: 2; grid-row: 1 / span 2; color: var(--pink); }

@media (max-width: 900px) {
  .pf { padding-top: 104px; }
  .pf-hero, .pf-conoceme, .pf-capitulo, .pf-cierre { grid-template-columns: minmax(0, 1fr); }
  .pf-hero-foto { order: -1; max-width: 460px; width: 100%; margin: 0 auto; }
  .pf-capitulo.es-par .pf-capitulo-foto { order: 0; }
  .pf-cifras { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 48px !important; }
  .pf-disciplinas { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pf-conoceme, .pf-historia, .pf-formacion, .pf-galeria, .pf-cierre { margin-top: 88px !important; }
  .pf-conoceme-foto { max-width: 420px; width: 100%; }
}
@media (max-width: 600px) {
  .pf-disciplinas, .pf-redes { grid-template-columns: minmax(0, 1fr); }
  .pf-galeria { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .pf-cifra strong { font-size: 2.1rem; }
  .pf-capitulo-num { font-size: 3.2rem; }
}
`;
