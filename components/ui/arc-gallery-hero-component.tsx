"use client";

import React from "react";

type ArcGalleryHeroProps = {
  images: string[];
  className?: string;
};

const positions = [
  { x: "-480px", y: "108px", tx: "-320px", ty: "70px", mx: "-124px", my: "32px", s: "124px", ts: "92px", ms: "64px" },
  { x: "-370px", y: "-8px", tx: "-240px", ty: "-4px", mx: "-62px", my: "-4px", s: "126px", ts: "94px", ms: "68px" },
  { x: "-245px", y: "-90px", tx: "-160px", ty: "-60px", mx: "0px", my: "-20px", s: "120px", ts: "92px", ms: "72px" },
  { x: "-110px", y: "-132px", tx: "-70px", ty: "-92px", mx: "62px", my: "-4px", s: "114px", ts: "88px", ms: "68px" },
  { x: "30px", y: "-146px", tx: "20px", ty: "-104px", mx: "124px", my: "32px", s: "112px", ts: "88px", ms: "64px" },
  { x: "170px", y: "-122px", tx: "110px", ty: "-88px", mx: "0px", my: "0px", s: "118px", ts: "90px", ms: "0px" },
  { x: "300px", y: "-54px", tx: "200px", ty: "-42px", mx: "0px", my: "0px", s: "126px", ts: "94px", ms: "0px" },
  { x: "404px", y: "54px", tx: "280px", ty: "38px", mx: "0px", my: "0px", s: "118px", ts: "90px", ms: "0px" },
  { x: "460px", y: "176px", tx: "320px", ty: "110px", mx: "0px", my: "0px", s: "108px", ts: "86px", ms: "0px" },
  { x: "255px", y: "162px", tx: "180px", ty: "100px", mx: "0px", my: "0px", s: "112px", ts: "88px", ms: "0px" },
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
};

export const ArcGalleryHero: React.FC<ArcGalleryHeroProps> = ({ images, className = "" }) => {
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
                  "--delay": `${index * 65}ms`,
                } as PhotoStyle
              }
            >
              <img src={src} alt="" draggable={false} />
            </div>
          );
        })}
      </div>

      <div className="brand-hero-copy">
        <p className="brand-hero-kicker">Estudio Online</p>
        <img className="brand-hero-mark" src="/brand/isologo-icon.png" alt="" draggable={false} />
        <h1>Brunela Dance Trainer</h1>
        <p className="brand-hero-subtitle">
          T&eacute;cnica, fuerza y movilidad para bailarines que quieren entrenar con intenci&oacute;n.
        </p>
        <div className="hero-actions">
          <a className="hero-action primary" href="/#planes">
            Comienza tu prueba de 7 dias gratis
          </a>
          <a className="hero-action secondary" href="/#clases">
            Explora estudio online
          </a>
        </div>
      </div>

      <style>{`
        .brand-hero {
          position: relative;
          z-index: 1;
          display: grid;
          justify-items: center;
          align-content: center;
          min-height: min(860px, 100svh);
          overflow: hidden;
          padding: 86px clamp(1rem, 4vw, 3rem) 4.5rem;
          background: transparent;
        }

        .brand-hero-photos {
          position: relative;
          width: min(1060px, 100%);
          height: 340px;
          margin: 0 auto -1.6rem;
          pointer-events: none;
        }

        .brand-hero-photo {
          position: absolute;
          left: 50%;
          top: 50%;
          width: var(--size);
          aspect-ratio: 1;
          border: 2px solid #FFDADA;
          border-radius: 999px;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 18px 34px rgba(217, 52, 56, 0.16);
          transform: translate(-50%, -50%) translate(var(--x), var(--y));
          animation: hero-photo-in 700ms cubic-bezier(0.22, 1, 0.36, 1) var(--delay) forwards;
        }

        .brand-hero-photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .brand-hero-copy {
          width: min(640px, 100%);
          display: grid;
          justify-items: center;
          gap: 0.85rem;
          text-align: center;
          color: #D93438;
          animation: hero-copy-in 750ms ease-out 320ms forwards;
        }

        .brand-hero-kicker {
          margin: 0;
          color: #E64F55;
          font-size: 0.8rem;
          font-weight: 900;
          letter-spacing: 0.28em;
          text-transform: uppercase;
        }

        .brand-hero-mark {
          width: 88px;
          height: 88px;
          object-fit: contain;
        }

        .brand-hero-copy h1 {
          max-width: 9ch;
          margin: 0;
          color: #D93438;
          font-family: var(--font-display), sans-serif;
          font-size: clamp(3.2rem, 7vw, 5.4rem);
          font-weight: 900;
          line-height: 0.94;
          text-wrap: balance;
        }

        .brand-hero-subtitle {
          max-width: 36ch;
          margin: 0;
          color: #D93438;
          font-size: clamp(0.95rem, 1.5vw, 1.08rem);
          line-height: 1.6;
        }

        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.75rem;
          width: 100%;
          margin-top: 0.35rem;
        }

        .hero-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 46px;
          max-width: 300px;
          border-radius: 999px;
          padding: 0.78rem 1.2rem;
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          line-height: 1.2;
          text-align: center;
          text-transform: uppercase;
          text-decoration: none;
        }

        .hero-action.primary {
          background: #E64F55;
          color: #fff;
          box-shadow: 0 10px 24px rgba(230, 79, 85, 0.26);
        }

        .hero-action.secondary {
          border: 1.5px solid #FFDADA;
          background: #fff;
          color: #D93438;
        }

        @keyframes hero-photo-in {
          from {
            transform: translate(-50%, -42%) translate(var(--x), var(--y));
          }
          to {
            transform: translate(-50%, -50%) translate(var(--x), var(--y));
          }
        }

        @keyframes hero-copy-in {
          from {
            transform: translateY(14px);
          }
          to {
            transform: translateY(0);
          }
        }

        @media (max-width: 900px) {
          .brand-hero {
            min-height: auto;
            padding-top: 82px;
          }

          .brand-hero-photos {
            height: 230px;
            margin-bottom: -0.6rem;
          }

          .brand-hero-photo {
            width: var(--tablet-size);
            transform: translate(-50%, -50%) translate(var(--tx), var(--ty));
          }

          @keyframes hero-photo-in {
            from {
              transform: translate(-50%, -42%) translate(var(--tx), var(--ty));
            }
            to {
              transform: translate(-50%, -50%) translate(var(--tx), var(--ty));
            }
          }
        }

        @media (max-width: 640px) {
          .brand-hero {
            padding: 78px 1rem 3.25rem;
          }

          .brand-hero-photos {
            width: 100%;
            height: 142px;
            margin: 0 0 0.6rem;
          }

          .brand-hero-photo {
            width: var(--mobile-size);
            transform: translate(-50%, -50%) translate(var(--mx), var(--my));
          }

          .brand-hero-photo:nth-child(n + 6) {
            display: none;
          }

          .brand-hero-copy {
            gap: 0.72rem;
          }

          .brand-hero-kicker {
            font-size: 0.66rem;
            letter-spacing: 0.2em;
          }

          .brand-hero-mark {
            width: 64px;
            height: 64px;
          }

          .brand-hero-copy h1 {
            font-size: clamp(2.45rem, 11vw, 3.25rem);
            line-height: 0.98;
          }

          .brand-hero-subtitle {
            max-width: 30ch;
            font-size: 0.92rem;
            line-height: 1.5;
          }

          .hero-action {
            width: min(100%, 320px);
            max-width: 320px;
            min-height: 44px;
            padding: 0.74rem 0.9rem;
            font-size: 0.64rem;
            letter-spacing: 0.055em;
          }

          @keyframes hero-photo-in {
            from {
              transform: translate(-50%, -42%) translate(var(--mx), var(--my));
            }
            to {
              transform: translate(-50%, -50%) translate(var(--mx), var(--my));
            }
          }
        }
      `}</style>
    </section>
  );
};
