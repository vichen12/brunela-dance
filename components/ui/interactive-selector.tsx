'use client';

import { Lock, PlayCircle } from 'lucide-react';

const previews = [
  {
    title: 'Clase de ballet',
    detail: 'Nivel inicial/intermedio',
    img: '/fotos-landing/Ballet.jpg',
    pos: 'center top',
  },
  {
    title: 'Trabajo de rotacion externa',
    detail: 'Control, alineacion y activacion',
    img: '/fotos-landing/Progressing Ballet Technique.jpg',
    pos: 'center',
  },
  {
    title: 'Flexibilidad: conseguir el split',
    detail: 'Progresion consciente y segura',
    img: '/fotos-landing/Stretching.jpg',
    pos: 'center top',
  },
];

export function InteractiveSelector() {
  return (
    <div className="preview-grid-root">
      {previews.map((item) => (
        <a key={item.title} href="/#planes" className="preview-card" aria-label={`${item.title}. Acceso restringido`}>
          <img src={item.img} alt="" className="preview-card-img" style={{ objectPosition: item.pos }} draggable={false} />
          <div className="preview-card-overlay" />

          <div className="preview-play">
            <PlayCircle size={34} strokeWidth={1.6} />
          </div>

          <div className="preview-lock">
            <Lock size={14} />
            Acceso con suscripcion
          </div>

          <div className="preview-copy">
            <p className="preview-title">{item.title}</p>
            <p className="preview-detail">{item.detail}</p>
            <span className="preview-cta">Ver preview bloqueada</span>
          </div>
        </a>
      ))}

      <style>{`
        .preview-grid-root {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
        }

        .preview-card {
          position: relative;
          display: block;
          min-height: 360px;
          border-radius: 999px;
          overflow: hidden;
          text-decoration: none;
          color: #fff;
          border: 3px solid #FFDADA;
          box-shadow: 0 24px 60px rgba(217, 52, 56, 0.14);
          isolation: isolate;
        }

        .preview-card-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: saturate(0.95);
          transition: transform 0.6s ease, filter 0.6s ease;
          z-index: -2;
        }

        .preview-card:hover .preview-card-img {
          transform: scale(1.06);
          filter: saturate(1.05);
        }

        .preview-card-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(217,52,56,0.78), rgba(230,79,85,0.2) 50%, rgba(255,218,218,0.08));
          z-index: -1;
        }

        .preview-play {
          position: absolute;
          top: 42%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 72px;
          height: 72px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.88);
          color: #D93438;
          box-shadow: 0 16px 42px rgba(217,52,56,0.24);
        }

        .preview-lock {
          position: absolute;
          top: 1.2rem;
          left: 50%;
          transform: translateX(-50%);
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.42rem 0.85rem;
          border-radius: 999px;
          background: rgba(255,255,255,0.9);
          color: #D93438;
          font-size: 0.58rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .preview-copy {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          padding: 2.2rem 1.6rem 2.4rem;
          text-align: center;
        }

        .preview-title {
          font-family: var(--font-display), sans-serif;
          font-size: clamp(1.25rem, 2vw, 1.65rem);
          font-weight: 900;
          line-height: 1.05;
          margin: 0 0 0.5rem;
        }

        .preview-detail {
          margin: 0 auto 0.9rem;
          max-width: 24ch;
          font-size: 0.86rem;
          line-height: 1.55;
          color: rgba(255,255,255,0.84);
        }

        .preview-cta {
          display: inline-flex;
          font-size: 0.62rem;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #FFDADA;
        }

        @media (max-width: 900px) {
          .preview-grid-root { grid-template-columns: 1fr; max-width: 420px; margin: 0 auto; }
          .preview-card { min-height: 330px; }
        }
      `}</style>
    </div>
  );
}
