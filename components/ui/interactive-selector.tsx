'use client';

const classes = [
  {
    num: '01',
    name: 'Ballet',
    tag: 'Tecnica clasica',
    description: 'Trabajo de tecnica clasica para fortalecer tu base y elevar tu precision en escena.',
    img: '/fotos-landing/Ballet.jpg',
    pos: 'center top',
  },
  {
    num: '02',
    name: 'Pilates Reformer',
    tag: 'Fuerza funcional',
    description: 'Maquina reformer para construir fuerza real, estabilidad de columna y conciencia corporal.',
    img: '/fotos-landing/Pilates Reformer.jpg',
    pos: 'center',
  },
  {
    num: '03',
    name: 'Pilates Mat',
    tag: 'Control de centro',
    description: 'Control profundo desde el suelo. Accesible en cualquier lugar, siempre efectivo.',
    img: '/fotos-landing/Pilates Mat.png',
    pos: 'center',
  },
  {
    num: '04',
    name: 'Stretching',
    tag: 'Movilidad activa',
    description: 'Flexibilidad activa y liberacion del tejido para bailar sin limites ni bloqueos.',
    img: '/fotos-landing/Stretching.jpg',
    pos: 'center top',
  },
  {
    num: '05',
    name: 'Prog. Ballet Technique',
    tag: 'PBT Certificado',
    description: 'Metodo PBT para reprogramar patrones neuromusculares y mejorar tu tecnica desde la raiz.',
    img: '/fotos-landing/Progressing Ballet Technique.jpg',
    pos: 'center',
  },
  {
    num: '06',
    name: 'Prog. Contemporary',
    tag: 'PCT Certificado',
    description: 'Metodologia PCT para integrar el contemporaneo con un trabajo de cuerpo consciente.',
    img: '/fotos-landing/Progressing Contemporary Technique.jpg',
    pos: 'center top',
  },
];

export function InteractiveSelector() {
  return (
    <div className="class-grid-root">
      {classes.map((c) => (
        <a key={c.num} href="/sign-in" className="class-card-item" style={{ textDecoration: 'none' }}>
          <img src={c.img} alt={c.name} className="class-card-img" style={{ objectPosition: c.pos }} draggable={false} />

          {/* permanent dark gradient at bottom */}
          <div className="class-card-base-overlay" />
          {/* hover overlay — brighter pink tint */}
          <div className="class-card-hover-overlay" />

          {/* always-visible bottom info */}
          <div className="class-card-bottom">
            <span className="class-card-num">{c.num}</span>
            <p className="class-card-name">{c.name}</p>
            <p className="class-card-tag">{c.tag}</p>
          </div>

          {/* slides up on hover */}
          <div className="class-card-reveal">
            <p className="class-card-desc">{c.description}</p>
            <span className="class-card-cta">
              Explorar
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ marginLeft: '0.4rem' }}>
                <path d="M2 6.5h9M8 3l3.5 3.5L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        </a>
      ))}

      <style>{`
        .class-grid-root {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.875rem;
        }

        .class-card-item {
          position: relative;
          aspect-ratio: 3 / 4;
          border-radius: 1.25rem;
          overflow: hidden;
          cursor: pointer;
          display: block;
        }

        .class-card-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .class-card-item:hover .class-card-img {
          transform: scale(1.07);
        }

        .class-card-base-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to top,
            rgba(0,0,0,0.72) 0%,
            rgba(0,0,0,0.15) 45%,
            transparent 70%
          );
          transition: opacity 0.4s;
        }

        .class-card-hover-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(236,72,153,0.22) 0%,
            transparent 60%
          );
          opacity: 0;
          transition: opacity 0.4s;
        }

        .class-card-item:hover .class-card-hover-overlay {
          opacity: 1;
        }

        .class-card-bottom {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 1.5rem 1.4rem 1.2rem;
          transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .class-card-item:hover .class-card-bottom {
          transform: translateY(-4.5rem);
        }

        .class-card-num {
          display: block;
          font-family: var(--font-display, serif);
          font-style: italic;
          font-size: 0.75rem;
          color: rgba(249,168,212,0.7);
          margin-bottom: 0.25rem;
          letter-spacing: 0.06em;
        }

        .class-card-name {
          font-family: var(--font-display, serif);
          font-style: italic;
          font-size: clamp(1.25rem, 2.2vw, 1.6rem);
          color: #fff;
          line-height: 1.05;
          margin: 0 0 0.3rem;
        }

        .class-card-tag {
          font-size: 0.58rem;
          font-weight: 800;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(249,168,212,0.75);
          margin: 0;
        }

        .class-card-reveal {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 0 1.4rem 1.4rem;
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 0.35s 0.1s, transform 0.4s 0.1s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .class-card-item:hover .class-card-reveal {
          opacity: 1;
          transform: translateY(0);
        }

        .class-card-desc {
          font-size: 0.82rem;
          color: rgba(255,255,255,0.72);
          line-height: 1.65;
          margin: 0 0 0.75rem;
        }

        .class-card-cta {
          display: inline-flex;
          align-items: center;
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #f9a8d4;
        }

        @media (max-width: 900px) {
          .class-grid-root {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 560px) {
          .class-grid-root {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
