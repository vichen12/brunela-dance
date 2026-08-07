"use client";

import React from "react";
import { usePublicI18n } from "@/components/language-provider";

/**
 * Hero de la landing.
 *
 * QUE CAMBIO (2026-08-06)
 *   Antes el hero era un arco de 11 miniaturas circulares sobre fondo
 *   transparente. Ahora la imagen ES el diseno: una foto a sangre del estudio
 *   con la bailarina en la barra, y la copia apoyada en el tercio izquierdo,
 *   que en esa foto es pared vacia.
 *
 *   El arco se saco a proposito: la foto ya trae sujeto propio y el arco le
 *   caia encima. Las fotos de disciplinas NO se perdieron -- `InfinitePhotoCarousel`
 *   va inmediatamente debajo en `app/page.tsx` y sigue mostrandolas.
 *
 * 🔴 POR QUE HAY UN SCRIM Y NO ES DECORATIVO
 *   La pared de la foto es rosa. Se midieron los pixeles reales de la zona de
 *   copia: el peor caso es #C89992. Sobre ese fondo, el coral de marca
 *   (--pink #E64F55) da 1.50:1 -- texto invisible. Ni siquiera --pink-deep
 *   llega (2.39:1). El unico token que sobrevivia a pelo era --ink (7.02:1).
 *
 *   El scrim lava esa zona hasta un blanco calido casi opaco. Sobre el, el
 *   wordmark coral vuelve a leerse y la copia en --ink queda muy por encima de
 *   AA. Sin el scrim, el logo de la marca desaparece contra su propio fondo.
 *
 *   Los porcentajes NO son gusto: se ajustaron simulando la mezcla del scrim
 *   sobre los pixeles reales de la foto, por CAJA DE CADA ELEMENTO, en cinco
 *   resoluciones (1280x800 a 1920x1080). Con estos valores el peor caso es:
 *
 *     kicker (--pink-deep, 4.5:1)   5.33:1  ✅
 *     wordmark (--pink, 3:1)        3.18:1  ✅
 *     parrafo (--ink, 4.5:1)       15.65:1  ✅
 *
 *   Dos cosas que costo descubrir midiendo:
 *
 *   1. Una version anterior cerraba en 72% y daba 2.91:1 en el wordmark a
 *      1280x800 -- por debajo del 3:1 de WCAG para texto grande. A menos ancho
 *      la columna de copia se corre hacia la zona menos lavada, asi que medir
 *      solo a 1440 no alcanza.
 *   2. Medir el peor pixel de TODA la columna obligaba a un scrim al 97%, que
 *      borraba el rosa del estudio y dejaba la mitad izquierda blanca. Cada
 *      elemento ocupa su propia caja: midiendo por caja alcanza con 90% y la
 *      bailarina queda con 24% de velo en vez de 42%.
 *
 *   Mover estos numeros sin volver a medir rompe la legibilidad en silencio.
 *
 * ⚠️ EL COLOR DEL SCRIM ES #FEFAF7 PORQUE ES EL `background` DEL BODY.
 *    Asi el fundido inferior entrega el hero a la seccion siguiente sin corte.
 *    Si alguien cambia el fondo del body, hay que cambiarlo tambien aca.
 */

type ArcGalleryHeroProps = {
  className?: string;
};

export const ArcGalleryHero: React.FC<ArcGalleryHeroProps> = ({
  className = "",
}) => {
  const { t } = usePublicI18n();

  return (
    <section className={`brand-hero ${className}`}>
      <div className="brand-hero-scene" aria-hidden>
        {/*
          alt vacio a proposito: la foto es ambiente. Lo que hay que anunciar es
          el nombre del estudio, y eso lo dice el wordmark del <h1>. Describirla
          ademas obligaria a un lector de pantalla a oir dos veces lo mismo.
        */}
        <img
          className="brand-hero-bg"
          src="/hero-estudio.avif"
          alt=""
          // Es la imagen mas grande de la primera pantalla: sin esto compite
          // con el resto de la landing y el LCP se va varios cientos de ms.
          fetchPriority="high"
          decoding="async"
        />
        <div className="brand-hero-scrim" />
      </div>

      <div className="brand-hero-copy">
        <p className="brand-hero-kicker">{t("hero.kicker")}</p>

        {/*
          El wordmark es el UNICO h1 de la landing (verificado: no habia
          ninguno). Va como imagen y no como texto porque es el logo enviado de
          la marca: re-tipografiarlo en CSS lo cambiaria. El nombre accesible
          sale del alt.
        */}
        <h1 className="brand-hero-logo">
          <img
            className="brand-hero-isotype"
            src="/brand/isologo-icon.png"
            alt=""
            draggable={false}
          />
          <img
            className="brand-hero-wordmark"
            src="/brand/brunela-dance-trainer-wordmark.png"
            alt="Brunela Dance Trainer"
            draggable={false}
          />
        </h1>

        <p className="brand-hero-subtitle">{t("hero.subtitle")}</p>

        <div className="hero-actions">
          <a className="hero-action primary" href="/#planes">
            {t("hero.primary")}
          </a>
          <a className="hero-action secondary" href="/#clases">
            {t("hero.secondary")}
          </a>
        </div>
      </div>

      <style>{`
        .brand-hero {
          position: relative;
          z-index: 1;
          display: grid;
          align-content: center;
          justify-items: start;
          width: 100%;
          max-width: 100vw;
          min-height: 640px;
          height: 100svh;
          max-height: 960px;
          overflow: hidden;
          padding: 104px clamp(1.25rem, 6.5vw, 6rem) 4.5rem;
          background: #FEFAF7;
        }

        .brand-hero-scene {
          position: absolute;
          inset: 0;
          z-index: 0;
          overflow: hidden;
        }

        .brand-hero-bg {
          width: 100%;
          height: 100%;
          object-fit: cover;
          /* La bailarina esta a ~70% del ancho. Anclar ahi la mantiene entera
             cuando el viewport se angosta y recorta por los lados. */
          object-position: 68% 42%;
          animation: hero-bg-settle 1800ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .brand-hero-scrim {
          position: absolute;
          inset: 0;
          /* Capa 1: entrega el hero a la seccion siguiente.
             Capa 2: lava la columna de copia para que el coral se lea. */
          background:
            linear-gradient(
              180deg,
              rgba(254, 250, 247, 0) 79%,
              rgba(254, 250, 247, 0.62) 92%,
              #FEFAF7 100%
            ),
            linear-gradient(
              96deg,
              rgba(254, 250, 247, 0.90) 0%,
              rgba(254, 250, 247, 0.86) 30%,
              rgba(254, 250, 247, 0.64) 46%,
              rgba(254, 250, 247, 0.24) 62%,
              rgba(254, 250, 247, 0) 74%
            );
        }

        .brand-hero-copy {
          position: relative;
          z-index: 2;
          display: grid;
          justify-items: start;
          gap: clamp(0.9rem, 1.6vh, 1.45rem);
          width: min(560px, 100%);
          text-align: left;
        }

        .brand-hero-copy > * {
          animation: hero-copy-in 760ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .brand-hero-copy > *:nth-child(1) { animation-delay: 80ms; }
        .brand-hero-copy > *:nth-child(2) { animation-delay: 170ms; }
        .brand-hero-copy > *:nth-child(3) { animation-delay: 290ms; }
        .brand-hero-copy > *:nth-child(4) { animation-delay: 400ms; }

        .brand-hero-kicker {
          margin: 0;
          /* --pink-deep y no --pink: es texto chico, y chico exige 4.5:1.
             Sobre el scrim, --pink-deep pasa; --pink no llegaria. */
          color: var(--pink-deep);
          font-size: 0.76rem;
          font-weight: 900;
          letter-spacing: 0.34em;
          text-transform: uppercase;
        }

        .brand-hero-logo {
          display: grid;
          grid-template-columns: clamp(46px, 5vw, 62px) minmax(200px, 1fr);
          align-items: center;
          gap: clamp(0.7rem, 1.3vw, 1.05rem);
          width: min(500px, 100%);
          margin: 0;
        }

        .brand-hero-isotype {
          width: 100%;
          height: auto;
          object-fit: contain;
        }

        .brand-hero-wordmark {
          width: 100%;
          height: auto;
          object-fit: contain;
          object-position: left center;
        }

        .brand-hero-subtitle {
          max-width: 44ch;
          margin: 0;
          /* --ink y no coral: es prosa que alguien LEE. Sobre el scrim da mas
             de 12:1, y el coral se reserva para el wordmark. */
          color: var(--ink);
          font-size: clamp(1.02rem, 1.5vw, 1.16rem);
          line-height: 1.6;
          text-wrap: pretty;
        }

        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.7rem;
          margin-top: 0.35rem;
        }

        /*
          Misma familia que el resto de los botones (tokens en globals.css). El
          hero se permite un poco mas de aire porque es el CTA principal de la
          pagina, pero el tracking, la curva y el salto del hover son los del
          sistema -- que es lo que hace que se vean del mismo producto.
        */
        .hero-action {
          --btn-min-h: 50px;
          --btn-pad-y: 0.85rem;
          --btn-pad-x: 1.7rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: var(--btn-min-h);
          border-radius: var(--btn-radius);
          padding: var(--btn-pad-y) var(--btn-pad-x);
          font-size: var(--btn-size);
          font-weight: var(--btn-weight);
          letter-spacing: var(--btn-track);
          line-height: 1.2;
          text-align: center;
          text-transform: uppercase;
          text-decoration: none;
          transition: background var(--btn-dur) ease,
                      border-color var(--btn-dur) ease,
                      color var(--btn-dur) ease,
                      box-shadow var(--btn-dur) ease,
                      transform var(--btn-dur) var(--btn-ease);
        }

        .hero-action:hover { transform: translateY(var(--btn-lift)); }

        .hero-action:focus-visible {
          outline: 2px solid var(--pink-deep);
          outline-offset: 3px;
        }

        .hero-action.primary {
          background: var(--pink);
          color: #fff;
          box-shadow: 0 14px 30px rgba(230, 79, 85, 0.3);
        }

        .hero-action.primary:hover {
          background: var(--pink-mid);
          box-shadow: 0 18px 36px rgba(230, 79, 85, 0.36);
        }

        .hero-action.secondary {
          border: 1.5px solid var(--pink-line);
          background: rgba(255, 255, 255, 0.88);
          color: var(--pink-deep);
        }

        .hero-action.secondary:hover {
          border-color: rgba(230, 79, 85, 0.44);
          box-shadow: 0 14px 28px rgba(217, 52, 56, 0.1);
        }

        @keyframes hero-copy-in {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: none; }
        }

        @keyframes hero-bg-settle {
          from { transform: scale(1.06); }
          to   { transform: scale(1); }
        }

        /* Pantallas anchas: la copia no se despega del borde infinitamente. */
        @media (min-width: 1500px) {
          .brand-hero {
            padding-left: max(6rem, calc((100vw - 1400px) / 2));
          }
        }

        /* Portatiles bajos: la foto sigue entera, la copia se compacta. */
        @media (min-width: 901px) and (max-height: 780px) {
          .brand-hero {
            min-height: 600px;
            padding-top: 88px;
            padding-bottom: 3rem;
          }
          .brand-hero-copy { gap: 0.78rem; }
          .brand-hero-logo { width: min(440px, 100%); }
          .brand-hero-subtitle { font-size: 1rem; line-height: 1.5; }
          .hero-action { min-height: 46px; }
        }

        /*
          ≤900px: la composicion se da vuelta. El degradado pasa a VERTICAL --
          arriba transparente para que se vea la bailarina, abajo casi opaco
          para apoyar la copia. Un scrim horizontal aca no serviria: en retrato
          la columna de copia ocupa todo el ancho y quedaria sobre la foto.
        */
        @media (max-width: 900px) {
          .brand-hero {
            height: auto;
            min-height: 100svh;
            max-height: none;
            align-content: end;
            justify-items: center;
            padding: 108px clamp(1.25rem, 6vw, 2.5rem) 3.25rem;
          }

          /*
            78% y no 70%: en retrato la ventana visible es angosta, y con 70% la
            bailarina quedaba corrida a la derecha, con la pared vacia ocupando
            la izquierda y el brazo cortado por el borde. Con 78% queda centrada.
            El valor de escritorio (68%) NO sirve aca: alli la ventana es ancha y
            el reparto es otro.
          */
          .brand-hero-bg { object-position: 78% 16%; }

          .brand-hero-scrim {
            background: linear-gradient(
              180deg,
              rgba(254, 250, 247, 0.06) 0%,
              rgba(254, 250, 247, 0.22) 26%,
              rgba(254, 250, 247, 0.80) 45%,
              rgba(254, 250, 247, 0.97) 58%,
              #FEFAF7 78%
            );
          }

          .brand-hero-copy {
            width: 100%;
            justify-items: center;
            text-align: center;
          }

          .brand-hero-logo {
            justify-content: center;
            width: min(420px, 92%);
          }

          .brand-hero-subtitle { max-width: 40ch; }

          .hero-actions {
            justify-content: center;
            width: 100%;
          }

          .hero-action { min-width: min(320px, 100%); }
        }

        @media (max-width: 480px) {
          .brand-hero { padding-top: 96px; }
          .brand-hero-kicker { font-size: 0.68rem; letter-spacing: 0.26em; }
          .brand-hero-logo {
            grid-template-columns: 42px minmax(0, 1fr);
            width: min(330px, 94%);
          }
          .brand-hero-subtitle { font-size: 1rem; }
        }

        /*
          Sin movimiento: se apagan las animaciones, no se reemplazan por otra
          cosa. Como el estado base de la copia ya es visible (la animacion
          arranca en opacity 0 pero no hay regla que la deje oculta), quitarla
          deja todo en su sitio. Es a proposito: una animacion que "revela"
          contenido lo deja invisible si nunca corre.
        */
        @media (prefers-reduced-motion: reduce) {
          .brand-hero-copy > *,
          .brand-hero-bg {
            animation: none;
          }
          .hero-action { transition: none; }
          .hero-action:hover { transform: none; }
        }
      `}</style>
    </section>
  );
};

export default ArcGalleryHero;
