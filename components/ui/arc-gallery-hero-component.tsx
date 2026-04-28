"use client";

import React from "react";
import { BrandLockup } from "@/components/brand-lockup";
import { usePublicI18n } from "@/components/language-provider";

type ArcGalleryHeroProps = {
  images: string[];
  className?: string;
};

const positions = [
  { x: "-510px", y: "96px", tx: "-340px", ty: "76px", mx: "-190px", my: "42px", s: "158px", ts: "116px", ms: "98px", z: 1, r: "-20deg" },
  { x: "-405px", y: "14px", tx: "-270px", ty: "18px", mx: "-140px", my: "16px", s: "168px", ts: "126px", ms: "108px", z: 2, r: "-15deg" },
  { x: "-286px", y: "-48px", tx: "-190px", ty: "-30px", mx: "-88px", my: "-8px", s: "180px", ts: "136px", ms: "118px", z: 3, r: "-10deg" },
  { x: "-150px", y: "-86px", tx: "-96px", ty: "-62px", mx: "-30px", my: "-24px", s: "200px", ts: "150px", ms: "128px", z: 4, r: "-5deg" },
  { x: "0px", y: "-98px", tx: "0px", ty: "-74px", mx: "36px", my: "-30px", s: "224px", ts: "168px", ms: "142px", z: 5, r: "2deg" },
  { x: "154px", y: "-82px", tx: "102px", ty: "-58px", mx: "96px", my: "-18px", s: "200px", ts: "150px", ms: "128px", z: 4, r: "7deg" },
  { x: "294px", y: "-38px", tx: "198px", ty: "-22px", mx: "150px", my: "8px", s: "180px", ts: "136px", ms: "114px", z: 3, r: "13deg" },
  { x: "414px", y: "36px", tx: "278px", ty: "34px", mx: "194px", my: "38px", s: "168px", ts: "126px", ms: "100px", z: 2, r: "18deg" },
  { x: "515px", y: "126px", tx: "340px", ty: "94px", mx: "0px", my: "0px", s: "156px", ts: "116px", ms: "0px", z: 1, r: "23deg" }
] as const;

type PhotoStyle = React.CSSProperties & {
  "--x": string;
  "--y": string;
  "--tx": string;
  "--ty": string;
  "--size": string;
  "--tablet-size": string;
  "--delay": string;
  "--rotate": string;
  "--z": number;
};

export const ArcGalleryHero: React.FC<ArcGalleryHeroProps> = ({ images, className = "" }) => {
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
                  "--size": pos.s,
                  "--tablet-size": pos.ts,
                  "--delay": `${index * 65}ms`,
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
        <BrandLockup centered markOnly className="brand-hero-lockup" />
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
          display: grid;
          justify-items: center;
          align-content: center;
          min-height: min(820px, 100svh);
          overflow: hidden;
          padding: 76px clamp(1rem, 4vw, 3rem) 4.25rem;
          background: transparent;
        }

        .brand-hero-photos {
          position: relative;
          width: min(1250px, 100%);
          height: 330px;
          margin: 0 auto -1.1rem;
          pointer-events: none;
        }

        .brand-hero-photo {
          position: absolute;
          left: 50%;
          top: 50%;
          width: var(--size);
          aspect-ratio: 1;
          z-index: var(--z);
          border: 0;
          border-radius: 999px;
          overflow: hidden;
          background: linear-gradient(135deg, #E64F55 0%, #FFDADA 48%, #fff 100%);
          padding: 4px;
          box-shadow: 0 22px 44px rgba(217, 52, 56, 0.18), 0 0 0 1px rgba(230, 79, 85, 0.16);
          transform: translate(-50%, -50%) translate(var(--x), var(--y)) rotate(var(--rotate));
          animation: hero-photo-in 700ms cubic-bezier(0.22, 1, 0.36, 1) var(--delay) forwards;
        }

        .brand-hero-photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: inherit;
        }

        .brand-hero-copy {
          width: min(640px, 100%);
          display: grid;
          justify-items: center;
          gap: 1rem;
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

        .brand-hero-lockup {
          margin-top: 0.1rem;
        }

        .brand-hero-subtitle {
          max-width: 36ch;
          margin: 0;
          color: #D93438;
          font-size: clamp(0.95rem, 1.5vw, 1.06rem);
          line-height: 1.7;
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
            transform: translate(-50%, -42%) translate(var(--x), var(--y)) rotate(var(--rotate));
          }
          to {
            transform: translate(-50%, -50%) translate(var(--x), var(--y)) rotate(var(--rotate));
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
            margin-bottom: -0.35rem;
          }

          .brand-hero-photo {
            width: var(--tablet-size);
            transform: translate(-50%, -50%) translate(var(--tx), var(--ty)) rotate(var(--rotate));
          }

          @keyframes hero-photo-in {
            from {
              transform: translate(-50%, -42%) translate(var(--tx), var(--ty)) rotate(var(--rotate));
            }
            to {
              transform: translate(-50%, -50%) translate(var(--tx), var(--ty)) rotate(var(--rotate));
            }
          }
        }

        /* Tablet: hide the outermost photos whose tx offsets overflow at narrower widths */
        @media (max-width: 900px) and (min-width: 641px) {
          .brand-hero-photo:nth-child(1),
          .brand-hero-photo:nth-child(9) {
            display: none;
          }
        }

        @media (max-width: 768px) and (min-width: 641px) {
          .brand-hero-photo:nth-child(2),
          .brand-hero-photo:nth-child(8) {
            display: none;
          }
        }

        @media (max-width: 640px) {
          .brand-hero {
            padding: 76px 0.85rem 2.65rem;
          }

          .brand-hero-photos {
            width: 100%;
            height: 180px;
            margin: 0 auto 0.35rem;
          }

          .brand-hero-photo {
            width: var(--mobile-size);
            transform: translate(-50%, -50%) translate(var(--mx), var(--my)) rotate(var(--rotate));
          }

          /* 7 photos: symmetric arc, wider spread */
          .brand-hero-photo:nth-child(1) {
            --mx: -112px;
            --my: 30px;
            --mobile-size: 58px;
          }

          .brand-hero-photo:nth-child(2) {
            --mx: -76px;
            --my: 10px;
            --mobile-size: 68px;
          }

          .brand-hero-photo:nth-child(3) {
            --mx: -37px;
            --my: -6px;
            --mobile-size: 76px;
          }

          .brand-hero-photo:nth-child(4) {
            --mx: 0px;
            --my: -14px;
            --mobile-size: 82px;
          }

          .brand-hero-photo:nth-child(5) {
            --mx: 37px;
            --my: -6px;
            --mobile-size: 76px;
          }

          .brand-hero-photo:nth-child(6) {
            --mx: 76px;
            --my: 10px;
            --mobile-size: 68px;
          }

          .brand-hero-photo:nth-child(7) {
            --mx: 112px;
            --my: 30px;
            --mobile-size: 58px;
          }

          .brand-hero-photo:nth-child(n + 8) {
            display: none;
          }

          .brand-hero-copy {
            gap: 0.58rem;
          }

          .brand-hero-kicker {
            font-size: 0.66rem;
            letter-spacing: 0.2em;
          }

          .brand-hero-lockup {
            margin: -0.1rem 0 0.05rem;
            transform: scale(0.78);
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
              transform: translate(-50%, -42%) translate(var(--mx), var(--my)) rotate(var(--rotate));
            }
            to {
              transform: translate(-50%, -50%) translate(var(--mx), var(--my)) rotate(var(--rotate));
            }
          }
        }

        @media (max-width: 390px) {
          .brand-hero {
            padding-inline: 0.75rem;
          }

          .brand-hero-photos {
            height: 165px;
          }

          .brand-hero-lockup {
            transform: scale(0.68);
          }
        }
      `}</style>
    </section>
  );
};
