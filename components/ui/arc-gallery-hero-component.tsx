"use client";

import React from "react";
import { usePublicI18n } from "@/components/language-provider";

type ArcGalleryHeroProps = {
  images: string[];
  className?: string;
};

const positions = [
  { x: "-540px", y: "141px", tx: "-300px", ty: "82px", mx: "-144px", my: "34px",  s: "128px", ts: "92px", ms: "62px", z: 1, r: "-20deg" },
  { x: "-432px", y: "89px",  tx: "-240px", ty: "48px", mx: "-128px", my: "19px",  s: "128px", ts: "92px", ms: "62px", z: 2, r: "-16deg" },
  { x: "-324px", y: "48px",  tx: "-180px", ty: "20px", mx: "-96px",  my: "6px",   s: "128px", ts: "92px", ms: "62px", z: 3, r: "-12deg" },
  { x: "-216px", y: "19px",  tx: "-120px", ty: "0px",  mx: "-64px",  my: "-5px",  s: "128px", ts: "92px", ms: "62px", z: 4, r: "-8deg"  },
  { x: "-108px", y: "2px",   tx: "-60px",  ty: "-14px", mx: "-32px", my: "-13px", s: "128px", ts: "92px", ms: "62px", z: 5, r: "-4deg"  },
  { x: "0px",    y: "-4px",  tx: "0px",    ty: "-20px", mx: "0px",   my: "-17px", s: "128px", ts: "92px", ms: "62px", z: 6, r: "0deg"   },
  { x: "108px",  y: "2px",   tx: "60px",   ty: "-14px", mx: "32px",  my: "-13px", s: "128px", ts: "92px", ms: "62px", z: 5, r: "4deg"   },
  { x: "216px",  y: "19px",  tx: "120px",  ty: "0px",   mx: "64px",  my: "-5px",  s: "128px", ts: "92px", ms: "62px", z: 4, r: "8deg"   },
  { x: "324px",  y: "48px",  tx: "180px",  ty: "20px",  mx: "96px",  my: "6px",   s: "128px", ts: "92px", ms: "62px", z: 3, r: "12deg"  },
  { x: "432px",  y: "89px",  tx: "240px",  ty: "48px",  mx: "128px", my: "19px",  s: "128px", ts: "92px", ms: "62px", z: 2, r: "16deg"  },
  { x: "540px",  y: "141px", tx: "300px",  ty: "82px",  mx: "158px", my: "34px",  s: "128px", ts: "92px", ms: "62px", z: 1, r: "20deg"  },
] as const;

type PhotoStyle = React.CSSProperties & {
  "--x": string;
  "--y": string;
  "--tx": string;
  "--ty": string;
  "--mx": string;
  "--my": string;
  "--size": string;
  "--tablet-size": string;
  "--mobile-size": string;
  "--delay": string;
  "--rotate": string;
  "--z": number;
};

export const ArcGalleryHero: React.FC<ArcGalleryHeroProps> = ({
  images,
  className = "",
}) => {
  const { t } = usePublicI18n();
  const photos = images.slice(0, positions.length);

  return (
    <section className={`brand-hero ${className}`}>
      <div className="brand-hero-photos" aria-hidden>
        {photos.map((src, index) => {
          const pos = positions[index];

          return (
            <div
              className="brand-hero-photo"
              key={`${src}-${index}`}
              style={
                {
                  "--x": pos.x,
                  "--y": pos.y,
                  "--tx": pos.tx,
                  "--ty": pos.ty,
                  "--mx": pos.mx,
                  "--my": pos.my,
                  "--size": pos.s,
                  "--tablet-size": pos.ts,
                  "--mobile-size": pos.ms,
                  "--delay": `${(photos.length - index - 1) * 62}ms`,
                  "--rotate": pos.r,
                  "--z": pos.z,
                } as PhotoStyle
              }
            >
              <img src={src} alt="" draggable={false} />
            </div>
          );
        })}
      </div>

      <div className="brand-hero-copy">
        <p className="brand-hero-kicker">{t("hero.kicker")}</p>

        <div className="brand-hero-logo" aria-label="Brunela Dance Trainer">
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
        </div>

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
          width: 100%;
          max-width: 100vw;
          min-height: 690px;
          height: 100vh;
          display: grid;
          justify-items: center;
          align-content: center;
          overflow: hidden;
          padding: 86px clamp(1rem, 4vw, 3rem) 4rem;
          background: transparent;
        }

        .brand-hero-photos {
          position: absolute;
          top: 64px;
          left: 50%;
          z-index: 1;
          width: min(1360px, 100vw);
          height: 310px;
          transform: translateX(-50%);
          pointer-events: none;
        }

        .brand-hero-photo {
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: var(--z);
          width: var(--size);
          aspect-ratio: 1;
          border-radius: 999px;
          overflow: hidden;
          background: linear-gradient(135deg, #E64F55 0%, #FFDADA 52%, #fff 100%);
          padding: 4px;
          opacity: 0;
          box-shadow: 0 16px 32px rgba(217, 52, 56, 0.16), 0 0 0 1px rgba(230, 79, 85, 0.14);
          transform: translate(-50%, -50%) translate(calc(var(--x) + 48px), calc(var(--y) - 14px)) rotate(calc(var(--rotate) + 5deg)) scale(0.88);
          animation: hero-photo-in 760ms cubic-bezier(0.16, 1, 0.3, 1) var(--delay) forwards;
          will-change: transform, opacity;
        }

        .brand-hero-photo::after {
          content: "";
          position: absolute;
          inset: 4px;
          border-radius: inherit;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.52);
          pointer-events: none;
        }

        .brand-hero-photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: inherit;
          transition: transform 260ms ease;
        }

        .brand-hero-photo:nth-child(5) img,
        .brand-hero-photo:nth-child(7) img,
        .brand-hero-photo:nth-child(10) img {
          filter: grayscale(1) contrast(1.08);
        }

        .brand-hero-copy {
          position: relative;
          z-index: 2;
          display: grid;
          justify-items: center;
          width: min(520px, 100%);
          margin-top: 10.4rem;
          gap: 0.72rem;
          color: #D93438;
          text-align: center;
          animation: hero-copy-in 720ms ease-out 460ms both;
        }

        .brand-hero-kicker {
          margin: 0;
          color: #E64F55;
          font-size: 0.76rem;
          font-weight: 900;
          letter-spacing: 0.38em;
          text-transform: uppercase;
        }

        .brand-hero-logo {
          display: grid;
          grid-template-columns: clamp(48px, 5.5vw, 66px) minmax(220px, 350px);
          align-items: center;
          justify-content: center;
          gap: clamp(0.75rem, 1.4vw, 1.1rem);
          width: min(520px, 100%);
        }

        .brand-hero-isotype {
          width: 100%;
          height: auto;
          object-fit: contain;
          filter: drop-shadow(0 14px 20px rgba(217, 52, 56, 0.12));
        }

        .brand-hero-wordmark {
          width: min(350px, 68vw);
          height: auto;
          object-fit: contain;
          object-position: left center;
          filter: drop-shadow(0 14px 22px rgba(217, 52, 56, 0.1));
        }

        .brand-hero-subtitle {
          max-width: 38ch;
          margin: 0;
          color: #D93438;
          font-size: clamp(1rem, 1.55vw, 1.14rem);
          line-height: 1.62;
        }

        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.75rem;
          width: 100%;
          margin-top: 0.6rem;
        }

        .hero-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
          min-width: min(300px, 100%);
          border-radius: 999px;
          padding: 0.82rem 1.25rem;
          font-size: 0.68rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          line-height: 1.2;
          text-align: center;
          text-transform: uppercase;
          text-decoration: none;
          transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
        }

        .hero-action:hover {
          transform: translateY(-2px);
        }

        .hero-action.primary {
          background: #E64F55;
          color: #fff;
          box-shadow: 0 14px 28px rgba(230, 79, 85, 0.28);
        }

        .hero-action.secondary {
          min-width: 210px;
          border: 1.5px solid #FFDADA;
          background: rgba(255, 255, 255, 0.86);
          color: #D93438;
        }

        .hero-action.secondary:hover {
          border-color: rgba(230, 79, 85, 0.44);
          box-shadow: 0 14px 28px rgba(217, 52, 56, 0.08);
        }

        @keyframes hero-photo-in {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) translate(calc(var(--x) + 48px), calc(var(--y) - 14px)) rotate(calc(var(--rotate) + 5deg)) scale(0.88);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) translate(var(--x), var(--y)) rotate(var(--rotate)) scale(1);
          }
        }

        @keyframes hero-copy-in {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (min-width: 901px) and (max-height: 820px) {
          .brand-hero {
            min-height: 640px;
            padding-top: 74px;
            padding-bottom: 2.4rem;
          }

          .brand-hero-photos {
            top: 50px;
            height: 270px;
            transform: translateX(-50%) scale(0.86);
            transform-origin: top center;
          }

          .brand-hero-copy {
            width: min(500px, 100%);
            margin-top: 8.4rem;
            gap: 0.58rem;
          }

          .brand-hero-kicker {
            font-size: 0.68rem;
          }

          .brand-hero-logo {
            grid-template-columns: 50px minmax(210px, 315px);
            width: min(470px, 100%);
          }

          .brand-hero-wordmark {
            width: min(315px, 62vw);
          }

          .brand-hero-subtitle {
            font-size: 1rem;
            line-height: 1.48;
          }

          .hero-actions {
            margin-top: 0.35rem;
          }

          .hero-action {
            min-height: 44px;
            padding-block: 0.72rem;
          }
        }

        @media (min-width: 901px) and (max-width: 1180px) {
          .brand-hero-photos {
            transform: translateX(-50%) scale(0.82);
            transform-origin: top center;
          }

          .brand-hero-copy {
            margin-top: 8.8rem;
          }
        }

        @media (max-width: 900px) {
          .brand-hero {
            height: auto;
            min-height: auto;
            padding-top: 82px;
            padding-bottom: 3.25rem;
          }

          .brand-hero-photos {
            position: relative;
            top: auto;
            left: auto;
            width: 100%;
            height: 228px;
            transform: none;
            margin: 0 auto 0.4rem;
          }

          .brand-hero-photo {
            width: var(--tablet-size);
            transform: translate(-50%, -50%) translate(var(--tx), var(--ty)) rotate(var(--rotate));
          }

          .brand-hero-photo:nth-child(1),
          .brand-hero-photo:nth-child(11) {
            display: none;
          }

          .brand-hero-copy {
            margin-top: 0;
          }

          @keyframes hero-photo-in {
            from {
              opacity: 0;
              transform: translate(-50%, -50%) translate(calc(var(--tx) + 34px), calc(var(--ty) - 10px)) rotate(calc(var(--rotate) + 4deg)) scale(0.9);
            }
            to {
              opacity: 1;
              transform: translate(-50%, -50%) translate(var(--tx), var(--ty)) rotate(var(--rotate)) scale(1);
            }
          }
        }

        @media (max-width: 640px) {
          .brand-hero {
            padding: 62px 0.85rem 2.4rem;
          }

          .brand-hero-photos {
            height: 148px;
            width: min(380px, calc(100vw - 0.5rem));
            margin-bottom: 0.9rem;
          }

          .brand-hero-photo {
            width: var(--mobile-size);
            padding: 3px;
            transform: translate(-50%, -50%) translate(var(--mx), var(--my)) rotate(var(--rotate));
          }

          .brand-hero-photo:nth-child(n + 12) {
            display: none;
          }

          .brand-hero-photo:nth-child(1) {
            --mx: -158px;
            --my: 34px;
            --mobile-size: 38px;
            --rotate: -17deg;
          }

          .brand-hero-photo:nth-child(2) {
            --mx: -128px;
            --my: 19px;
            --mobile-size: 42px;
            --rotate: -13deg;
          }

          .brand-hero-photo:nth-child(3) {
            --mx: -96px;
            --my: 6px;
            --mobile-size: 46px;
            --rotate: -10deg;
          }

          .brand-hero-photo:nth-child(4) {
            --mx: -64px;
            --my: -5px;
            --mobile-size: 50px;
            --rotate: -6deg;
          }

          .brand-hero-photo:nth-child(5) {
            --mx: -32px;
            --my: -13px;
            --mobile-size: 54px;
            --rotate: -3deg;
          }

          .brand-hero-photo:nth-child(6) {
            --mx: 0px;
            --my: -17px;
            --mobile-size: 58px;
            --rotate: 0deg;
          }

          .brand-hero-photo:nth-child(7) {
            --mx: 32px;
            --my: -13px;
            --mobile-size: 54px;
            --rotate: 3deg;
          }

          .brand-hero-photo:nth-child(8) {
            --mx: 64px;
            --my: -5px;
            --mobile-size: 50px;
            --rotate: 6deg;
          }

          .brand-hero-photo:nth-child(9) {
            --mx: 96px;
            --my: 6px;
            --mobile-size: 46px;
            --rotate: 10deg;
          }

          .brand-hero-photo:nth-child(10) {
            --mx: 128px;
            --my: 19px;
            --mobile-size: 42px;
            --rotate: 13deg;
          }

          .brand-hero-photo:nth-child(11) {
            --mx: 158px;
            --my: 34px;
            --mobile-size: 38px;
            --rotate: 17deg;
          }

          .brand-hero-copy {
            gap: 0.58rem;
          }

          .brand-hero-kicker {
            font-size: 0.64rem;
            letter-spacing: 0.22em;
          }

          .brand-hero-logo {
            grid-template-columns: 38px minmax(190px, 250px);
            gap: 0.55rem;
            width: min(315px, 100%);
          }

          .brand-hero-wordmark {
            width: min(250px, 72vw);
          }

          .brand-hero-subtitle {
            max-width: 31ch;
            font-size: 0.94rem;
            line-height: 1.52;
          }

          .hero-action {
            width: min(100%, 320px);
            max-width: 320px;
            min-height: 44px;
            padding: 0.74rem 0.9rem;
            font-size: 0.62rem;
            letter-spacing: 0.055em;
          }

          @keyframes hero-photo-in {
            from {
              opacity: 0;
              transform: translate(-50%, -50%) translate(calc(var(--mx) + 28px), calc(var(--my) - 8px)) rotate(calc(var(--rotate) + 4deg)) scale(0.9);
            }
            to {
              opacity: 1;
              transform: translate(-50%, -50%) translate(var(--mx), var(--my)) rotate(var(--rotate)) scale(1);
            }
          }
        }

        @media (max-width: 390px) {
          .brand-hero-photos {
            height: 136px;
            width: min(344px, calc(100vw - 0.5rem));
          }

          .brand-hero-photo:nth-child(2),
          .brand-hero-photo:nth-child(10) {
            display: none;
          }

          .brand-hero-photo:nth-child(1) {
            --mx: -148px;
            --my: 30px;
            --mobile-size: 34px;
          }

          .brand-hero-photo:nth-child(2) {
            --mx: -120px;
            --my: 17px;
            --mobile-size: 38px;
          }

          .brand-hero-photo:nth-child(3) {
            --mx: -91px;
            --my: 6px;
            --mobile-size: 42px;
          }

          .brand-hero-photo:nth-child(4) {
            --mx: -61px;
            --my: -4px;
            --mobile-size: 46px;
          }

          .brand-hero-photo:nth-child(5) {
            --mx: -31px;
            --my: -11px;
            --mobile-size: 50px;
          }

          .brand-hero-photo:nth-child(6) {
            --mx: 0px;
            --my: -14px;
            --mobile-size: 54px;
          }

          .brand-hero-photo:nth-child(7) {
            --mx: 31px;
            --my: -11px;
            --mobile-size: 50px;
          }

          .brand-hero-photo:nth-child(8) {
            --mx: 61px;
            --my: -4px;
            --mobile-size: 46px;
          }

          .brand-hero-photo:nth-child(9) {
            --mx: 91px;
            --my: 6px;
            --mobile-size: 42px;
          }

          .brand-hero-photo:nth-child(10) {
            --mx: 120px;
            --my: 17px;
            --mobile-size: 38px;
          }

          .brand-hero-photo:nth-child(11) {
            --mx: 148px;
            --my: 30px;
            --mobile-size: 34px;
          }

          .brand-hero-logo {
            grid-template-columns: 32px minmax(170px, 220px);
          }

          .brand-hero-wordmark {
            width: min(220px, 74vw);
          }
        }
      `}</style>
    </section>
  );
};
