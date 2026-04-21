'use client';

import React, { useEffect, useState } from 'react';

type ArcGalleryHeroProps = {
  images: string[];
  startAngle?: number;
  endAngle?: number;
  radiusLg?: number;
  radiusMd?: number;
  radiusSm?: number;
  cardSizeLg?: number;
  cardSizeMd?: number;
  cardSizeSm?: number;
  className?: string;
};

export const ArcGalleryHero: React.FC<ArcGalleryHeroProps> = ({
  images,
  startAngle = 20,
  endAngle = 160,
  radiusLg = 480,
  radiusMd = 360,
  radiusSm = 260,
  cardSizeLg = 120,
  cardSizeMd = 100,
  cardSizeSm = 80,
  className = '',
}) => {
  const [dimensions, setDimensions] = useState({ radius: radiusLg, cardSize: cardSizeLg });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 640)       setDimensions({ radius: radiusSm, cardSize: cardSizeSm });
      else if (w < 1024) setDimensions({ radius: radiusMd, cardSize: cardSizeMd });
      else               setDimensions({ radius: radiusLg, cardSize: cardSizeLg });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [radiusLg, radiusMd, radiusSm, cardSizeLg, cardSizeMd, cardSizeSm]);

  const count = Math.max(images.length, 2);
  const step  = (endAngle - startAngle) / (count - 1);

  return (
    <section className={`relative overflow-hidden bg-transparent flex flex-col ${className}`}>

      {/* Arc gallery — top, photos slightly below navbar */}
      <div
        className="arc-photo-container"
        style={{
          position: 'relative',
          width: '100%',
          height: dimensions.radius * 1.4,
          zIndex: 1,
          overflow: 'hidden',
        }}
      >
        {/* push the pivot point down so arc top clears the navbar */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            /* offsetting bottom pushes photos downward */
            bottom: `-${dimensions.radius * 0.18}px`,
            transform: 'translateX(-50%)',
          }}
        >
          {images.map((src, i) => {
            const angle    = startAngle + step * i;
            const angleRad = (angle * Math.PI) / 180;
            const x = Math.cos(angleRad) * dimensions.radius;
            const y = Math.sin(angleRad) * dimensions.radius;

            return (
              <div
                key={i}
                className="absolute opacity-0 animate-fade-in-up"
                style={{
                  width: dimensions.cardSize,
                  height: dimensions.cardSize,
                  left: `calc(50% + ${x}px)`,
                  bottom: `${y}px`,
                  transform: 'translate(-50%, 50%)',
                  animationDelay: `${i * 80}ms`,
                  animationFillMode: 'forwards',
                  zIndex: count - i,
                }}
              >
                <div
                  className="rounded-2xl shadow-xl overflow-hidden w-full h-full transition-transform hover:scale-105"
                  style={{
                    transform: `rotate(${angle / 4}deg)`,
                    border: '2px solid rgba(249,168,212,0.4)',
                  }}
                >
                  <img
                    src={src}
                    alt={`Brunela ${i + 1}`}
                    className="block w-full h-full object-cover"
                    draggable={false}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Text — sits tight under the photo arc */}
      <div
        className="arc-text-section relative flex items-center justify-center px-6 opacity-0 animate-fade-in"
        style={{
          zIndex: 2,
          marginTop: '-14rem',
          paddingBottom: '5rem',
          animationDelay: '900ms',
          animationFillMode: 'forwards',
        }}
      >
        <div className="text-center max-w-xl">
          <p style={{
            fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.32em',
            textTransform: 'uppercase', color: '#ec4899', marginBottom: '0.75rem',
          }}>
            Studio online
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display, serif)',
            fontStyle: 'italic',
            fontSize: 'clamp(4rem, 10vw, 7rem)',
            lineHeight: 0.92,
            color: '#1c1917',
            marginBottom: '1.1rem',
          }}>
            Brunela
          </h1>
          <p style={{
            fontSize: 'clamp(0.9rem, 1.5vw, 1.05rem)',
            color: '#78716c',
            lineHeight: 1.8,
            maxWidth: '38ch',
            margin: '0 auto 2rem',
          }}>
            Pilates y conditioning para bailarines que quieren moverse mejor, con mas fuerza y continuidad.
          </p>
          <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="/#planes"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '999px', padding: '0.85rem 1.8rem',
                background: '#ec4899', color: '#fff',
                fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.16em',
                textTransform: 'uppercase', textDecoration: 'none',
                boxShadow: '0 10px 28px rgba(236,72,153,0.3)',
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = '#db2777'; }}
              onMouseOut={(e)  => { (e.currentTarget as HTMLElement).style.background = '#ec4899'; }}
            >
              Ver planes
            </a>
            <a
              href="/sign-in"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '999px', padding: '0.85rem 1.8rem',
                background: 'transparent', color: '#1c1917',
                fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.16em',
                textTransform: 'uppercase', textDecoration: 'none',
                border: '1.5px solid rgba(28,25,23,0.2)',
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = '#ec4899';
                (e.currentTarget as HTMLElement).style.color = '#ec4899';
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(28,25,23,0.2)';
                (e.currentTarget as HTMLElement).style.color = '#1c1917';
              }}
            >
              Ingresar
            </a>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translate(-50%, 65%); }
          to   { opacity: 1; transform: translate(-50%, 50%); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation-name: fade-in-up;
          animation-duration: 0.9s;
          animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
        }
        .animate-fade-in {
          animation-name: fade-in;
          animation-duration: 0.8s;
          animation-timing-function: ease-out;
        }
      `}</style>
    </section>
  );
};
