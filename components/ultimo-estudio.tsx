"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bookmark, BookOpen, CalendarDays, Check, Play, X } from "lucide-react";
import { usePublicI18n } from "@/components/language-provider";
import type { PublicMessageKey } from "@/src/i18n/public";

/**
 * "Ultimo del estudio online".
 *
 * DE DONDE SALE ESTO
 *   Reemplaza a la seccion `#clases` (`components/ui/interactive-selector.tsx`),
 *   que hacia lo mismo con otro aspecto. Los textos de las nueve fichas --
 *   titulos, duraciones, descripciones y vinetas -- se trajeron TAL CUAL de
 *   alli: no hay nada reescrito ni inventado.
 *
 * ⚠️ ESTA SECCION SE QUEDA CON EL id="clases".
 *    El navbar enlaza a /#clases y el resaltado de seccion activa depende de
 *    ese id. Al borrar la seccion vieja habia que trasladarlo o el enlace del
 *    menu dejaba de llevar a ningun lado -- sin dar ningun error.
 *
 * ⚠️ LOS TEXTOS DE LAS FICHAS ESTAN SOLO EN ESPANOL.
 *    Es exactamente como estaban en la seccion vieja, que no usaba el
 *    diccionario. La interfaz (pestanas, "Ver detalle", boton de cerrar) si va
 *    en los cuatro idiomas. Traducir las nueve fichas es un paso aparte.
 *
 * ⚠️ LO QUE SE MUESTRA NO SALE DE LA BASE: es una vitrina. La base de contenido
 *    esta vacia, asi que leerla dejaria la seccion en blanco.
 */

const FICHAS = [
  {
    id: "ballet",
    grupo: "clases",
    etiqueta: "Clase",
    titulo: "Ballet técnico",
    meta: "32 min · Técnica",
    foto: "/fotos-landing/Ballet.jpg",
    encuadre: "center top",
    descripcion:
      "Una clase para trabajar postura, control, coordinación y calidad de movimiento desde la base del ballet.",
    puntos: [
      "Barra, centro y trabajo técnico progresivo.",
      "Enfoque en alineación, musicalidad y presencia.",
      "Ideal para sostener una práctica constante desde casa.",
    ],
  },
  {
    id: "pbt",
    grupo: "clases",
    etiqueta: "Clase",
    titulo: "Progressing Ballet Technique",
    meta: "28 min · PBT",
    foto: "/fotos-landing/Progressing Ballet Technique.jpg",
    encuadre: "center",
    descripcion:
      "Entrenamiento de memoria muscular para mejorar la técnica, activar correctamente el cuerpo y bailar con más seguridad.",
    puntos: [
      "Trabajo de fuerza profunda y control postural.",
      "Ejercicios específicos para transferencia técnica al ballet.",
      "Acompaña el progreso sin sobrecargar articulaciones.",
    ],
  },
  {
    id: "stretching",
    grupo: "clases",
    etiqueta: "Clase",
    titulo: "Flexibilidad consciente",
    meta: "24 min · Stretching",
    foto: "/fotos-landing/Stretching.jpg",
    encuadre: "center top",
    descripcion:
      "Una práctica de movilidad y elongación para ganar rango sin forzar, cuidando la activación y la respiración.",
    puntos: [
      "Rutinas para piernas, espalda y apertura de cadera.",
      "Progresión clara para mejorar sin apurar el cuerpo.",
      "Complemento ideal para ballet, PBT y entrenamiento diario.",
    ],
  },
  {
    id: "feet-rotation",
    grupo: "cursos",
    etiqueta: "Curso",
    titulo: "Pies, rotación y estabilidad",
    meta: "14 días · Objetivo específico",
    foto: "/fotos-landing/pbt.jpg",
    encuadre: "center",
    descripcion:
      "Un recorrido guiado para trabajar bases técnicas que sostienen el rendimiento del bailarín.",
    puntos: [
      "Secuencia organizada día por día.",
      "Foco en pies, rotación externa y control de eje.",
      "Pensado para entrenar con más claridad y continuidad.",
    ],
  },
  {
    id: "mobility",
    grupo: "cursos",
    etiqueta: "Curso",
    titulo: "Movilidad para splits",
    meta: "14 días · Flexibilidad",
    foto: "/fotos-landing/stretching1.jpg",
    encuadre: "center",
    descripcion:
      "Recorrido estructurado para avanzar en flexibilidad con técnica, fuerza activa y cuidado corporal.",
    puntos: [
      "Trabajo progresivo de cadera, isquios y líneas.",
      "Ejercicios de activación para no depender solo de estirar.",
      "Guía paso a paso para medir avances reales.",
    ],
  },
  {
    id: "contemporary",
    grupo: "cursos",
    etiqueta: "Curso",
    titulo: "Contemporary Technique",
    meta: "Series · PCT",
    foto: "/fotos-landing/Progressing Contemporary Technique.jpg",
    encuadre: "center",
    descripcion:
      "Un recorrido para explorar articulación, transferencia de peso, conexión con el suelo y libertad de movimiento.",
    puntos: [
      "Ejercicios funcionales para danza contemporánea.",
      "Mayor conciencia de columna, peso y expansión.",
      "Complementa el entrenamiento técnico del bailarín.",
    ],
  },
  {
    id: "corps",
    grupo: "planes",
    etiqueta: "Objetivo",
    titulo: "Técnica base",
    meta: "Biblioteca completa",
    foto: "/fotos-landing/Pilates Mat.png",
    encuadre: "center",
    descripcion:
      "Un punto de partida para ordenar tu entrenamiento, sostener constancia y mejorar con una base técnica clara.",
    puntos: [
      "Clases disponibles para entrenar cuando quieras.",
      "Trabajo de ballet, flexibilidad y técnica aplicada.",
      "Contenido pensado para progresar sin perder calidad.",
    ],
  },
  {
    id: "solista",
    grupo: "planes",
    etiqueta: "Objetivo",
    titulo: "Progreso guiado",
    meta: "Recorridos estructurados",
    foto: "/fotos-landing/pilates.jpg",
    encuadre: "center",
    descripcion:
      "Recorridos de trabajo con objetivos específicos para entrenar con más profundidad, orden y precisión.",
    puntos: [
      "Foco en pies, rotación, flexibilidad y control.",
      "Secuencias paso a paso para mantener continuidad.",
      "Mayor claridad sobre qué trabajar y cómo avanzar.",
    ],
  },
  {
    id: "principal",
    grupo: "planes",
    etiqueta: "Objetivo",
    titulo: "Acompañamiento",
    meta: "Clases en vivo y seguimiento",
    foto: "/fotos-landing/about-2.jpg",
    encuadre: "center top",
    descripcion:
      "Una experiencia más cercana para revisar tu proceso, resolver dudas y ajustar el entrenamiento a tus necesidades.",
    puntos: [
      "Espacio para seguimiento y correcciones más concretas.",
      "Clases en vivo con reserva previa.",
      "Acompañamiento para sostener tu progreso con dirección.",
    ],
  },
] as const;

type Ficha = (typeof FICHAS)[number];

const GRUPOS = [
  { id: "clases", tab: "ultimo.tab.clases", icono: "clases", nueva: true },
  { id: "cursos", tab: "ultimo.tab.cursos", icono: "cursos", nueva: false },
  { id: "planes", tab: "ultimo.tab.planes", icono: "planes", nueva: false },
] as const;

function IconoTab({ nombre }: { nombre: (typeof GRUPOS)[number]["icono"] }) {
  const p = { size: 17, strokeWidth: 1.9, "aria-hidden": true } as const;
  if (nombre === "clases") return <Play {...p} />;
  if (nombre === "cursos") return <BookOpen {...p} />;
  return <CalendarDays {...p} />;
}

export function UltimoEstudio() {
  const { t } = usePublicI18n();
  const [activo, setActivo] = useState(0);
  const [visible, setVisible] = useState(0);
  const [detalle, setDetalle] = useState<Ficha | null>(null);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const pistaRef = useRef<HTMLDivElement | null>(null);
  const dialogoRef = useRef<HTMLDialogElement | null>(null);

  const grupo = GRUPOS[activo];
  const fichas = FICHAS.filter((f) => f.grupo === grupo.id);

  /**
   * Flechas entre pestanas. Sin esto hay que tabular una por una hasta la
   * ultima, y se incumple el patron que los lectores de pantalla anuncian.
   */
  function alPulsarTecla(e: React.KeyboardEvent, indice: number) {
    const ultimo = GRUPOS.length - 1;
    let destino: number | null = null;
    if (e.key === "ArrowRight") destino = indice === ultimo ? 0 : indice + 1;
    else if (e.key === "ArrowLeft") destino = indice === 0 ? ultimo : indice - 1;
    else if (e.key === "Home") destino = 0;
    else if (e.key === "End") destino = ultimo;
    if (destino === null) return;
    e.preventDefault();
    setActivo(destino);
    tabsRef.current[destino]?.focus();
  }

  /**
   * El detalle va en un <dialog> NATIVO, no en un div flotante.
   *
   * `showModal()` regala tres cosas que a mano se olvidan siempre: el foco
   * queda atrapado dentro, Escape cierra, y el resto de la pagina queda inerte
   * para los lectores de pantalla. Un modal casero sin eso deja tabular por
   * detras del fondo.
   */
  useEffect(() => {
    const d = dialogoRef.current;
    if (!d) return;
    if (detalle && !d.open) d.showModal();
    if (!detalle && d.open) d.close();
  }, [detalle]);

  const alDesplazar = useCallback(() => {
    const pista = pistaRef.current;
    if (!pista || pista.clientWidth === 0) return;
    setVisible(Math.round(pista.scrollLeft / pista.clientWidth));
  }, []);

  useEffect(() => {
    pistaRef.current?.scrollTo({ left: 0 });
    setVisible(0);
  }, [activo]);

  return (
    <section id="clases" className="ultimo-section" aria-labelledby="ultimo-titulo">
      <div className="ultimo-panel">
        {/* Silueta decorativa. Es una imagen SIN canal alfa (un rectangulo
            rosa), asi que hace falta mascara radial + multiply para integrarla:
            ver la nota del CSS. */}
        <div className="ultimo-silueta" aria-hidden>
          <Image
            src="/silueta-ballet.avif"
            alt=""
            width={1485}
            height={1059}
            sizes="(max-width: 900px) 0px, 46vw"
          />
        </div>

        <div className="ultimo-head">
          <p className="ultimo-kicker">
            <span className="ultimo-kicker-punto" aria-hidden />
            {t("method.kicker")}
          </p>

          <h2 className="ultimo-title" id="ultimo-titulo">
            {t("ultimo.title")}{" "}
            <span className="ultimo-title-accent">{t("ultimo.titleAccent")}</span>
          </h2>

          <p className="ultimo-lead">{t("ultimo.lead")}</p>

          <div className="ultimo-tabs" role="tablist" aria-label={t("ultimo.tabsAria")}>
            {GRUPOS.map((g, i) => (
              <button
                key={g.id}
                type="button"
                role="tab"
                id={`ultimo-tab-${g.id}`}
                aria-selected={i === activo}
                aria-controls={`ultimo-panel-${g.id}`}
                tabIndex={i === activo ? 0 : -1}
                ref={(el) => {
                  tabsRef.current[i] = el;
                }}
                className={`ultimo-tab${i === activo ? " is-activa" : ""}`}
                onClick={() => setActivo(i)}
                onKeyDown={(e) => alPulsarTecla(e, i)}
              >
                <IconoTab nombre={g.icono} />
                {t(g.tab as PublicMessageKey)}
              </button>
            ))}
          </div>
        </div>

        <div
          className="ultimo-pista"
          role="tabpanel"
          id={`ultimo-panel-${grupo.id}`}
          aria-labelledby={`ultimo-tab-${grupo.id}`}
          ref={pistaRef}
          onScroll={alDesplazar}
          key={grupo.id}
        >
          {fichas.map((f) => (
            /*
              LA TARJETA ENTERA ES EL BOTON.
              Antes el control era solo el "Ver detalle" de abajo. Ahora lo es
              toda la ficha, que es lo que la gente intenta pulsar igualmente.

              ⚠️ Por eso el "Ver detalle" de dentro dejo de ser un <button>: un
                 boton dentro de otro boton es HTML invalido y el navegador lo
                 reordena por su cuenta. Ahora es un <span> decorativo y hay un
                 unico control por tarjeta, alcanzable con teclado.
            */
            <button
              type="button"
              className="ultimo-card"
              key={f.id}
              onClick={() => setDetalle(f)}
              aria-label={`${f.titulo} — ${t("ultimo.action")}`}
            >
              <Image
                className="ultimo-card-img"
                src={f.foto}
                alt=""
                fill
                sizes="(max-width: 900px) 86vw, (max-width: 1200px) 45vw, 400px"
                style={{ objectPosition: f.encuadre }}
              />
              <span className="ultimo-card-velo" aria-hidden />

              {grupo.nueva ? <span className="ultimo-nueva">{t("ultimo.nueva")}</span> : null}

              {/* Decorativo, NO un boton: guardar favoritos exige sesion y aca
                  no hay ninguna. Un control que no hace nada es peor que no
                  estar, asi que queda fuera del arbol de accesibilidad. */}
              <span className="ultimo-marcador" aria-hidden>
                <Bookmark size={16} strokeWidth={1.8} />
              </span>

              <div className="ultimo-card-info">
                <span className="ultimo-cat">{f.etiqueta}</span>
                <h3 className="ultimo-card-title">{f.titulo}</h3>
                <span className="ultimo-card-regla" aria-hidden />
                <p className="ultimo-card-meta">{f.meta}</p>

                {/* Decorativo: el control es la tarjeta entera (ver arriba). */}
                <span className="ultimo-card-link" aria-hidden>
                  {t("ultimo.action")}
                  <span className="ultimo-card-flecha">
                    <ArrowRight size={15} strokeWidth={2.2} />
                  </span>
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="ultimo-puntos">
          {fichas.map((f, i) => (
            <button
              key={f.id}
              type="button"
              className={`ultimo-punto${i === visible ? " is-activo" : ""}`}
              aria-label={`${i + 1} / ${fichas.length}`}
              aria-current={i === visible ? "true" : undefined}
              onClick={() =>
                pistaRef.current?.scrollTo({
                  left: pistaRef.current.clientWidth * i,
                  behavior: "smooth",
                })
              }
            />
          ))}
        </div>
      </div>

      <dialog
        className="ultimo-dialogo"
        ref={dialogoRef}
        aria-labelledby="ultimo-detalle-titulo"
        // `close` tambien salta con Escape, asi que el estado se entera igual.
        onClose={() => setDetalle(null)}
        // Pulsar el fondo cierra. Se compara el objetivo con el propio dialogo
        // porque el ::backdrop reparte sus clics al elemento.
        onClick={(e) => {
          if (e.target === dialogoRef.current) setDetalle(null);
        }}
      >
        {detalle ? (
          <div className="ultimo-detalle">
            <div className="ultimo-detalle-foto">
              <Image
                src={detalle.foto}
                alt=""
                fill
                sizes="(max-width: 760px) 92vw, 340px"
                style={{ objectFit: "cover", objectPosition: detalle.encuadre }}
              />
            </div>

            <div className="ultimo-detalle-cuerpo">
              <span className="ultimo-detalle-cat">{detalle.etiqueta}</span>
              <h3 className="ultimo-detalle-titulo" id="ultimo-detalle-titulo">
                {detalle.titulo}
              </h3>
              <p className="ultimo-detalle-meta">{detalle.meta}</p>
              <p className="ultimo-detalle-desc">{detalle.descripcion}</p>

              <ul className="ultimo-detalle-lista">
                {detalle.puntos.map((p) => (
                  <li key={p}>
                    <Check size={15} strokeWidth={2.4} aria-hidden />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>

              <Link className="ultimo-detalle-cta" href="/#planes" onClick={() => setDetalle(null)}>
                {t("nav.viewPlans")}
                <ArrowRight size={15} strokeWidth={2.2} aria-hidden />
              </Link>
            </div>

            <button
              type="button"
              className="ultimo-detalle-cerrar"
              onClick={() => setDetalle(null)}
              aria-label={t("nav.closeMenu")}
            >
              <X size={18} strokeWidth={2.2} aria-hidden />
            </button>
          </div>
        ) : null}
      </dialog>

      <style>{`
        .ultimo-section {
          position: relative;
          z-index: 1;
          padding: clamp(2.5rem, 5vw, 4.5rem) clamp(1rem, 4vw, 3.5rem);
        }

        .ultimo-panel {
          position: relative;
          overflow: hidden;
          width: min(1280px, 100%);
          margin: 0 auto;
          border: 1px solid rgba(255, 218, 218, 0.8);
          border-radius: clamp(24px, 3vw, 44px);
          background:
            radial-gradient(120% 90% at 82% 8%, rgba(255, 214, 216, 0.72) 0%, transparent 62%),
            linear-gradient(150deg, #FFF7F5 0%, #FDECEC 100%);
          padding: clamp(1.5rem, 3.4vw, 3.2rem);
          box-shadow: 0 30px 90px rgba(217, 52, 56, 0.08);
        }

        /*
          🔴 MASCARA RADIAL, NO LINEAL.
             La imagen es un RECTANGULO rosa sin canal alfa. Un degradado lineal
             solo difumina en un eje: dejaba opaca la esquina inferior derecha y
             ahi se veia el borde recto de la foto. La radial se abre desde la
             esquina superior derecha y cae en todas las direcciones, asi que
             ningun borde llega a verse. El multiply hace el resto: el rosa
             claro de su fondo desaparece contra el panel, mas claro todavia.
        */
        .ultimo-silueta {
          position: absolute;
          top: -8%;
          right: -3%;
          z-index: 0;
          width: clamp(320px, 46%, 660px);
          mix-blend-mode: multiply;
          pointer-events: none;
          -webkit-mask-image: radial-gradient(125% 125% at 100% 0%, #000 26%, rgba(0,0,0,0.35) 58%, transparent 76%);
          mask-image: radial-gradient(125% 125% at 100% 0%, #000 26%, rgba(0,0,0,0.35) 58%, transparent 76%);
        }

        .ultimo-silueta img { width: 100%; height: auto; }

        @media (max-width: 900px) { .ultimo-silueta { display: none; } }

        .ultimo-head {
          position: relative;
          z-index: 1;
          display: grid;
          justify-items: start;
          gap: 0.85rem;
          max-width: 46rem;
          margin-bottom: clamp(1.4rem, 3vw, 2.4rem);
        }

        .ultimo-kicker {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          margin: 0;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.72);
          padding: 0.4rem 0.95rem 0.4rem 0.7rem;
          color: var(--pink-deep);
          font-family: var(--font-display), sans-serif;
          font-size: 0.66rem;
          font-weight: 900;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        .ultimo-kicker-punto {
          width: 7px; height: 7px;
          border-radius: 999px;
          background: var(--pink);
        }

        .ultimo-title {
          margin: 0;
          color: #1E1418;
          font-family: var(--font-display), sans-serif;
          font-size: clamp(2rem, 4vw, 3.5rem);
          font-weight: 800;
          letter-spacing: -0.035em;
          line-height: 1.06;
          text-wrap: balance;
        }

        .ultimo-title-accent { color: var(--pink); }

        .ultimo-lead {
          max-width: 34rem;
          margin: 0;
          color: var(--pink-muted);
          font-size: clamp(0.96rem, 1.2vw, 1.05rem);
          line-height: 1.6;
          text-wrap: pretty;
        }

        .ultimo-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
          margin-top: 0.45rem;
          border: 1px solid rgba(255, 218, 218, 0.9);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.82);
          padding: 0.32rem;
        }

        .ultimo-tab {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          border: 0;
          border-radius: 999px;
          background: transparent;
          /* --pink-deep: son ~11.5px en negrita, texto NORMAL para WCAG. */
          color: var(--pink-deep);
          padding: 0.6rem 1.25rem;
          font-family: var(--font-display), sans-serif;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          cursor: pointer;
          transition: background var(--btn-dur) ease, color var(--btn-dur) ease;
        }

        .ultimo-tab:hover { background: var(--pink-wash); }

        .ultimo-tab.is-activa {
          /* --pink-mid y no --pink: blanco sobre --pink da 3.74:1 y esto es
             texto normal (4.5:1). --pink-mid llega a 4.67:1. */
          background: var(--pink-mid);
          color: #fff;
          box-shadow: 0 8px 20px rgba(217, 52, 56, 0.28);
        }

        .ultimo-tab:focus-visible {
          outline: 2px solid var(--pink-deep);
          outline-offset: 2px;
        }

        .ultimo-pista {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: clamp(0.8rem, 1.6vw, 1.3rem);
        }

        .ultimo-card {
          position: relative;
          display: flex;
          align-items: flex-end;
          overflow: hidden;
          /* Es un <button>: hay que devolverle lo que el navegador le quita. */
          width: 100%;
          border: 0;
          padding: 0;
          text-align: left;
          font: inherit;
          cursor: pointer;
          /* ⚠️ Alto fijo, NO aspect-ratio: con aspect-ratio el alto sale del
             ancho, y al angostarse la columna las fichas se volvian torres. */
          min-height: clamp(330px, 30vw, 420px);
          border-radius: clamp(16px, 1.6vw, 24px);
          background: #241A1D;
          box-shadow: 0 18px 46px rgba(84, 30, 38, 0.18);
          transition: transform var(--btn-dur) var(--btn-ease), box-shadow var(--btn-dur) ease;
          animation: ultimo-entra 460ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .ultimo-card:nth-child(2) { animation-delay: 70ms; }
        .ultimo-card:nth-child(3) { animation-delay: 140ms; }

        .ultimo-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 28px 64px rgba(84, 30, 38, 0.26);
        }

        .ultimo-card-img { object-fit: cover; }

        /* 🔴 El velo no es estetico: debajo va texto blanco sobre una FOTO, que
           puede ser clara en cualquier zona. Al 0.92 el blanco pasa de 12:1. */
        .ultimo-card-velo {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(20, 12, 14, 0.10) 0%,
            rgba(20, 12, 14, 0.28) 38%,
            rgba(20, 12, 14, 0.78) 68%,
            rgba(20, 12, 14, 0.92) 100%
          );
        }

        .ultimo-nueva {
          position: absolute;
          top: 0.85rem; left: 0.85rem;
          z-index: 2;
          border-radius: 999px;
          /* --pink-mid: blanco sobre --pink da 3.78:1 y esto son ~10px en
             negrita, texto normal. */
          background: var(--pink-mid);
          color: #fff;
          padding: 0.32rem 0.7rem;
          font-family: var(--font-display), sans-serif;
          font-size: 0.6rem;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .ultimo-marcador {
          position: absolute;
          top: 0.75rem; right: 0.85rem;
          z-index: 2;
          display: grid;
          place-items: center;
          width: 34px; height: 34px;
          border: 1px solid rgba(255, 255, 255, 0.5);
          border-radius: 999px;
          color: #fff;
        }

        .ultimo-card-info {
          position: relative;
          z-index: 2;
          display: grid;
          justify-items: start;
          gap: 0.42rem;
          width: 100%;
          padding: clamp(0.95rem, 1.8vw, 1.35rem);
        }

        .ultimo-cat {
          border: 1px solid rgba(255, 255, 255, 0.42);
          border-radius: 999px;
          /* Fondo solido: encima hay una foto y el contraste de un fondo
             translucido no se puede garantizar. */
          background: rgba(20, 12, 14, 0.72);
          color: #fff;
          padding: 0.28rem 0.65rem;
          font-family: var(--font-display), sans-serif;
          font-size: 0.58rem;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .ultimo-card-title {
          margin: 0.1rem 0 0;
          color: #fff;
          font-family: var(--font-display), sans-serif;
          font-size: clamp(1.1rem, 1.6vw, 1.4rem);
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.16;
          text-wrap: pretty;
        }

        .ultimo-card-regla {
          width: 38px; height: 2px;
          margin: 0.28rem 0 0.1rem;
          border-radius: 2px;
          background: var(--pink);
        }

        .ultimo-card-meta {
          margin: 0;
          color: rgba(255, 255, 255, 0.88);
          font-size: 0.84rem;
          line-height: 1.4;
        }

        .ultimo-card-link {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          margin-top: 0.45rem;
          color: #fff;
          font-family: var(--font-display), sans-serif;
          font-size: 0.74rem;
          font-weight: 800;
          letter-spacing: 0.02em;
        }

        /* El foco se dibuja en la tarjeta entera, que es el control real. */
        .ultimo-card:focus-visible {
          outline: 3px solid var(--pink);
          outline-offset: 3px;
        }

        .ultimo-card:hover .ultimo-card-flecha,
        .ultimo-card:focus-visible .ultimo-card-flecha {
          background: var(--pink-mid);
          transform: translateX(3px);
        }

        .ultimo-card-flecha {
          display: grid;
          place-items: center;
          width: 30px; height: 30px;
          border-radius: 999px;
          background: var(--pink);
          color: #fff;
          transition: background var(--btn-dur) ease, transform var(--btn-dur) var(--btn-ease);
        }

        .ultimo-puntos { display: none; }

        /* ── Detalle ─────────────────────────────────────────────────────── */

        /*
          🔴 margin: auto ES OBLIGATORIO, NO DECORATIVO.

             Un <dialog> abierto con showModal() lo centra el navegador con
             margin: auto en su hoja de estilos. Pero este proyecto carga
             @tailwind base, y el Preflight de Tailwind pone margin: 0 en
             TODOS los elementos -- dialog incluido. Resultado: el modal se
             pegaba arriba a la izquierda de la pantalla.

             Al declararlo aca se recupera el centrado. Sin esta linea vuelve a
             irse a la esquina, y no da ningun error.
        */
        .ultimo-dialogo {
          margin: auto;
          width: min(820px, calc(100vw - 2rem));
          max-height: min(88svh, 700px);
          overflow: hidden;
          border: 1px solid rgba(255, 218, 218, 0.9);
          border-radius: clamp(18px, 2.2vw, 26px);
          background: #fff;
          padding: 0;
          box-shadow: 0 50px 120px rgba(50, 18, 24, 0.34);
          animation: ultimo-dialogo-entra 300ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Neutro y no rojizo: la pagina ya tiene sus propios brillos coral, y un
           velo rosa encima los sumaba y dejaba todo el fondo embarrado. */
        .ultimo-dialogo::backdrop {
          background: rgba(24, 16, 18, 0.62);
          backdrop-filter: blur(4px);
          animation: ultimo-velo-entra 300ms ease both;
        }

        @keyframes ultimo-dialogo-entra {
          from { opacity: 0; transform: translateY(10px) scale(0.985); }
          to   { opacity: 1; transform: none; }
        }

        @keyframes ultimo-velo-entra {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .ultimo-detalle {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 0.86fr) minmax(0, 1fr);
          max-height: inherit;
        }

        .ultimo-detalle-foto {
          position: relative;
          min-height: 100%;
          background: var(--pink-wash);
        }

        /* Degradado sutil en el borde donde la foto toca el texto: sin el, el
           corte entre foto y fondo blanco es una linea dura. */
        .ultimo-detalle-foto::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 72%, rgba(255, 255, 255, 0.28) 100%);
        }

        .ultimo-detalle-cuerpo {
          display: grid;
          justify-items: start;
          align-content: start;
          gap: 0.45rem;
          overflow-y: auto;
          padding: clamp(1.5rem, 3vw, 2.4rem);
        }

        .ultimo-detalle-cat {
          border-radius: 999px;
          background: var(--pink-wash);
          color: var(--pink-deep);
          padding: 0.3rem 0.7rem;
          font-family: var(--font-display), sans-serif;
          font-size: 0.6rem;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .ultimo-detalle-titulo {
          margin: 0.15rem 0 0;
          color: #1E1418;
          font-family: var(--font-display), sans-serif;
          font-size: clamp(1.3rem, 2.2vw, 1.7rem);
          font-weight: 800;
          letter-spacing: -0.025em;
          line-height: 1.14;
        }

        .ultimo-detalle-meta {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0;
          color: var(--pink-deep);
          font-family: var(--font-display), sans-serif;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.06em;
        }

        .ultimo-detalle-desc {
          margin: 0.55rem 0 0;
          padding-bottom: 0.9rem;
          /* Filete que separa la presentacion de la lista de puntos. */
          border-bottom: 1px solid var(--pink-line);
          color: var(--pink-muted);
          font-size: 0.95rem;
          line-height: 1.62;
          text-wrap: pretty;
        }

        .ultimo-detalle-lista {
          display: grid;
          gap: 0.55rem;
          margin: 0.7rem 0 0;
          padding: 0;
          list-style: none;
        }

        .ultimo-detalle-lista li {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.55rem;
          color: #4A2A30;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .ultimo-detalle-lista svg {
          margin-top: 0.22rem;
          color: var(--pink);
        }

        .ultimo-detalle-cta {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          min-height: var(--btn-min-h);
          margin-top: 1rem;
          border-radius: var(--btn-radius);
          background: var(--pink);
          color: #fff;
          padding: var(--btn-pad-y) var(--btn-pad-x);
          font-family: var(--font-display), sans-serif;
          font-size: var(--btn-size);
          font-weight: var(--btn-weight);
          letter-spacing: var(--btn-track);
          text-transform: uppercase;
          text-decoration: none;
          transition: background var(--btn-dur) ease, transform var(--btn-dur) var(--btn-ease);
        }

        .ultimo-detalle-cta:hover {
          background: var(--pink-mid);
          transform: translateY(var(--btn-lift));
        }

        .ultimo-detalle-cta:focus-visible,
        .ultimo-detalle-cerrar:focus-visible {
          outline: 2px solid var(--pink-deep);
          outline-offset: 3px;
        }

        .ultimo-detalle-cerrar {
          position: absolute;
          top: 0.7rem; right: 0.7rem;
          display: grid;
          place-items: center;
          width: 36px; height: 36px;
          border: 1px solid var(--pink-line);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.92);
          color: var(--pink-deep);
          padding: 0;
          cursor: pointer;
        }

        .ultimo-detalle-cerrar:hover { background: var(--pink-wash); }

        @keyframes ultimo-entra {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: none; }
        }

        @media (max-width: 760px) {
          .ultimo-detalle { grid-template-columns: minmax(0, 1fr); }
          .ultimo-detalle-foto { min-height: 200px; }
        }

        @media (max-width: 900px) {
          /* Carrusel con anclaje: aqui los puntos SI significan algo. */
          .ultimo-pista {
            grid-template-columns: none;
            grid-auto-flow: column;
            grid-auto-columns: 100%;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            scrollbar-width: none;
          }

          .ultimo-pista::-webkit-scrollbar { display: none; }

          .ultimo-card { scroll-snap-align: start; }

          .ultimo-puntos {
            display: flex;
            justify-content: center;
            gap: 0.5rem;
            margin-top: 1.2rem;
          }

          .ultimo-punto {
            width: 9px; height: 9px;
            border: 0;
            border-radius: 999px;
            background: var(--pink-line);
            padding: 0;
            cursor: pointer;
            transition: background var(--btn-dur) ease, width var(--btn-dur) ease;
          }

          .ultimo-punto.is-activo { width: 26px; background: var(--pink); }

          .ultimo-punto:focus-visible {
            outline: 2px solid var(--pink-deep);
            outline-offset: 3px;
          }
        }

        @media (max-width: 620px) {
          .ultimo-tabs { width: 100%; }
          .ultimo-tab { flex: 1; justify-content: center; padding-inline: 0.5rem; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ultimo-card { animation: none; transition: none; }
          .ultimo-card:hover { transform: none; }
          .ultimo-tab,
          .ultimo-card-flecha,
          .ultimo-punto,
          .ultimo-detalle-cta { transition: none; }
          .ultimo-card-link:hover .ultimo-card-flecha { transform: none; }
          .ultimo-detalle-cta:hover { transform: none; }
        }
      `}</style>
    </section>
  );
}
