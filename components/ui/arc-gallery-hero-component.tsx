'use client';

import React, { useEffect, useState } from 'react';

type ArcGalleryHeroProps = {
  images: string[];
  className?: string;
};

/* ── Mobile fan layout — 6 photos, hand-crafted positions ── */
const FAN = [
  { x: -138, y: 38,  rot: -22 },
  { x: -84,  y: 14,  rot: -13 },
  { x: -30,  y:  2,  rot:  -4 },
  { x:  30,  y:  2,  rot:   4 },
  { x:  84,  y: 14,  rot:  13 },
  { x: 138,  y: 38,  rot:  22 },
];

function MobileHero({ images }: { images: string[] }) {
  const photos = images.slice(0, 6);
  return (
    <section className="relative overflow-hidden bg-transparent flex flex-col">
      {/* Fan area */}
      <div style={{ position: 'relative', height: 220, width: '100%', zIndex: 1 }}>
        <div style={{ position: 'absolute', left: '50%', top: 115 }}>
          {photos.map((src, i) => (
            <div
              key={i}
              className="absolute opacity-0 animate-arc-in"
              style={{
                width: 68,
                height: 68,
                left: FAN[i].x,
                top: FAN[i].y,
                transform: `translate(-50%, -50%) rotate(${FAN[i].rot}deg)`,
                animationDelay: `${i * 70}ms`,
                animationFillMode: 'forwards',
                zIndex: photos.length - i,
              }}
            >
              <div
                className="rounded-2xl shadow-xl overflow-hidden w-full h-full"
                style={{ border: '2px solid rgba(249,168,212,0.5)' }}
              >
                <img
                  src={src}
                  alt={`Brunela ${i + 1}`}
                  className="block w-full h-full object-cover"
                  draggable={false}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Text */}
      <div
        className="relative flex items-center justify-center px-6 opacity-0 animate-text-in"
        style={{ zIndex: 2, paddingBottom: '3.5rem', animationDelay: '550ms', animationFillMode: 'forwards' }}
      >
        <div className="text-center">
          <p style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.32em', textTransform: 'uppercase', color: '#ec4899', marginBottom: '0.55rem' }}>
            Studio online
          </p>
          <h1 style={{ fontFamily: 'var(--font-display, serif)', fontStyle: 'italic', fontSize: 'clamp(3.4rem, 16vw, 4.8rem)', lineHeight: 0.92, color: '#1c1917', marginBottom: '0.9rem' }}>
            Brunela
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#78716c', lineHeight: 1.75, maxWidth: '30ch', margin: '0 auto 1.6rem' }}>
            Pilates y conditioning para bailarinas que quieren moverse mejor, con mas fuerza y continuidad.
          </p>
          <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'center' }}>
            <a href="/#planes" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '0.72rem 1.45rem', background: '#ec4899', color: '#fff', fontSize: '0.67rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', textDecoration: 'none', boxShadow: '0 8px 22px rgba(236,72,153,0.28)' }}>
              Ver planes
            </a>
            <a href="/sign-in" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '0.72rem 1.45rem', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', color: '#1c1917', fontSize: '0.67rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', textDecoration: 'none', border: '1.5px solid rgba(28,25,23,0.15)' }}>
              Ingresar
            </a>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes arc-in { from { opacity:0; transform:translate(-50%,-35%) rotate(var(--r,0deg)); } to { opacity:1; transform:translate(-50%,-50%) rotate(var(--r,0deg)); } }
        @keyframes text-in { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .animate-arc-in { animation: arc-in 0.85s cubic-bezier(0.22,1,0.36,1) both; }
        .animate-text-in { animation: text-in 0.75s ease-out both; }
      `}</style>
    </section>
  );
}

/* ── Desktop/tablet arc layout ── */
function ArcHero({ images, radius, cardSize, startAngle, endAngle, arcHeightRatio, pivotOffsetRatio, textPull, titleSize, bodySize }: {
  images: string[]; radius: number; cardSize: number; startAngle: number; endAngle: number;
  arcHeightRatio: number; pivotOffsetRatio: number; textPull: string; titleSize: string; bodySize: string;
}) {
  const count     = Math.max(images.length, 2);
  const step      = (endAngle - startAngle) / (count - 1);
  const arcHeight = radius * arcHeightRatio;
  const pivot     = radius * pivotOffsetRatio;

  return (
    <section className="relative overflow-hidden bg-transparent flex flex-col">
      <div style={{ position: 'relative', width: '100%', height: arcHeight, zIndex: 1, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: '50%', bottom: `-${pivot}px`, transform: 'translateX(-50%)' }}>
          {images.map((src, i) => {
            const angle    = startAngle + step * i;
            const angleRad = (angle * Math.PI) / 180;
            const x = Math.round(Math.cos(angleRad) * radius * 1000) / 1000;
            const y = Math.round(Math.sin(angleRad) * radius * 1000) / 1000;
            return (
              <div key={i} className="absolute opacity-0 animate-arc-in" style={{ width: `${cardSize}px`, height: `${cardSize}px`, left: `calc(50% + ${x}px)`, bottom: `${y}px`, transform: 'translate(-50%, 50%)', animationDelay: `${i * 70}ms`, animationFillMode: 'forwards', zIndex: count - i }}>
                <div className="rounded-2xl shadow-xl overflow-hidden w-full h-full" style={{ transform: `rotate(${angle / 4}deg)`, border: '2px solid rgba(249,168,212,0.45)' }}>
                  <img src={src} alt={`Brunela ${i + 1}`} className="block w-full h-full object-cover" draggable={false} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative flex items-center justify-center px-6 opacity-0 animate-text-in" style={{ zIndex: 2, marginTop: textPull, paddingBottom: '5rem', animationDelay: '700ms', animationFillMode: 'forwards' }}>
        <div className="text-center" style={{ maxWidth: '38ch' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.32em', textTransform: 'uppercase', color: '#ec4899', marginBottom: '0.6rem' }}>Studio online</p>
          <h1 style={{ fontFamily: 'var(--font-display, serif)', fontStyle: 'italic', fontSize: titleSize, lineHeight: 0.92, color: '#1c1917', marginBottom: '1rem' }}>Brunela</h1>
          <p style={{ fontSize: bodySize, color: '#78716c', lineHeight: 1.75, maxWidth: '32ch', margin: '0 auto 1.75rem' }}>
            Pilates y conditioning para bailarinas que quieren moverse mejor, con mas fuerza y continuidad.
          </p>
          <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/#planes" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '0.85rem 1.8rem', background: '#ec4899', color: '#fff', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', textDecoration: 'none', boxShadow: '0 8px 24px rgba(236,72,153,0.28)' }}>Ver planes</a>
            <a href="/sign-in" style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '0.85rem 1.8rem', background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(8px)', color: '#1c1917', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', textDecoration: 'none', border: '1.5px solid rgba(28,25,23,0.15)' }}>Ingresar</a>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes arc-in { from { opacity:0; transform:translate(-50%,65%); } to { opacity:1; transform:translate(-50%,50%); } }
        @keyframes text-in { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        .animate-arc-in { animation: arc-in 0.85s cubic-bezier(0.22,1,0.36,1) both; }
        .animate-text-in { animation: text-in 0.75s ease-out both; }
      `}</style>
    </section>
  );
}

/* ── Main export — picks layout based on screen size ── */
export const ArcGalleryHero: React.FC<ArcGalleryHeroProps> = ({ images, className = '' }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isMd, setIsMd]         = useState(false);

  useEffect(() => {
    const update = () => {
      setIsMobile(window.innerWidth < 640);
      setIsMd(window.innerWidth >= 640 && window.innerWidth < 1024);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (isMobile) return <MobileHero images={images} />;

  return (
    <ArcHero
      images={images}
      radius={isMd ? 370 : 500}
      cardSize={isMd ? 104 : 128}
      startAngle={20}
      endAngle={160}
      arcHeightRatio={1.35}
      pivotOffsetRatio={0.18}
      textPull={isMd ? '-10rem' : '-14rem'}
      titleSize={isMd ? 'clamp(4rem, 8vw, 6rem)' : 'clamp(4rem, 10vw, 7rem)'}
      bodySize={isMd ? '1rem' : 'clamp(0.9rem,1.5vw,1.05rem)'}
    />
  );
};
