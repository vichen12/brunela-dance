import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { ArcGalleryHero } from '@/components/ui/arc-gallery-hero-component';
import { BrunelaFooter } from '@/components/ui/hover-footer';
import { InteractiveSelector } from '@/components/ui/interactive-selector';

/* ── Subtle grain texture overlay ── */
function GrainTexture() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        opacity: 0.032,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat",
        backgroundSize: "200px 200px",
      }}
    />
  );
}

/* ── Subtle dot grid ── */
function DotGrid() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        backgroundImage: "radial-gradient(circle, rgba(190,24,93,0.06) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
        opacity: 1,
      }}
    />
  );
}

/* ── Pink glow spread across the whole page ── */
function PinkGlow() {
  return (
    <>
      {/* Top glow — hero area */}
      <div
        aria-hidden
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: '70vh',
          zIndex: 0, pointerEvents: 'none',
          backgroundImage: `
            radial-gradient(ellipse 80% 70% at 50% 0%, #f9a8d4 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 5% 40%, #fbcfe8 0%, transparent 55%)
          `,
          opacity: 0.75,
        }}
      />
      {/* Middle glow — classes / about */}
      <div
        aria-hidden
        style={{
          position: 'fixed', top: '30vh', left: 0, right: 0, height: '70vh',
          zIndex: 0, pointerEvents: 'none',
          backgroundImage: `
            radial-gradient(ellipse 50% 50% at 95% 30%, #fce7f3 0%, transparent 55%),
            radial-gradient(ellipse 35% 45% at 10% 70%, #fbcfe8 0%, transparent 50%)
          `,
          opacity: 0.65,
        }}
      />
      {/* Bottom glow — pricing / footer transition */}
      <div
        aria-hidden
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, height: '60vh',
          zIndex: 0, pointerEvents: 'none',
          backgroundImage: `
            radial-gradient(ellipse 60% 60% at 50% 100%, #fdf2f8 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 90% 80%, #fce7f3 0%, transparent 50%)
          `,
          opacity: 0.7,
        }}
      />
    </>
  );
}

const heroImages = [
  '/fotos-landing/Ballet.jpg',
  '/fotos-landing/about-1.jpg',
  '/fotos-landing/Stretching.jpg',
  '/fotos-landing/Pilates Reformer.jpg',
  '/fotos-landing/Progressing Ballet Technique.jpg',
  '/fotos-landing/pbt.jpg',
  '/fotos-landing/about-2.jpg',
  '/fotos-landing/pct.jpg',
  '/fotos-landing/stretching1.jpg',
  '/fotos-landing/pilates.jpg',
  '/fotos-landing/Pilates Mat.png',
  '/fotos-landing/about-hero.jpg.jpg',
];

const plans = [
  {
    name: 'Corps de Ballet', price: '19', featured: false,
    desc: 'Acceso a toda la biblioteca on demand.',
    features: ['Biblioteca completa', 'Filtros por nivel y foco', 'Progreso guardado'],
  },
  {
    name: 'Solista', price: '39', featured: true,
    desc: 'Progreso guiado con programas estructurados.',
    features: ['Todo Corps de Ballet', 'Programas de 14 dias', 'Mayor profundidad tecnica'],
  },
  {
    name: 'Principal', price: '69', featured: false,
    desc: 'La experiencia completa con clases en vivo.',
    features: ['Todo Solista', 'Clases en vivo con reserva', 'Acompanamiento personalizado'],
  },
] as const;

export default function HomePage() {
  return (
    <>
      <GrainTexture />
      <DotGrid />
      <PinkGlow />

      {/* ── HERO ── */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <ArcGalleryHero images={heroImages} />
      </div>

      {/* ── CLASES ── */}
      <section id="clases" className="landing-section" style={{ position: 'relative', zIndex: 1, padding: 'clamp(4rem,8vw,7rem) clamp(1.5rem,5vw,4.5rem)', scrollMarginTop: '5rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          <div className="landing-section-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '3.5rem' }}>
            <div>
              <p style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.32em', textTransform: 'uppercase', color: '#ec4899', marginBottom: '0.6rem' }}>
                Studio
              </p>
              <h2 style={{ fontFamily: 'var(--font-display,serif)', fontStyle: 'italic', fontSize: 'clamp(2.4rem,5vw,4rem)', lineHeight: 0.95, color: '#1c1917' }}>
                Lo que encontras<br />adentro
              </h2>
            </div>
            <p style={{ fontSize: '1rem', color: '#78716c', lineHeight: 1.8, maxWidth: '36ch' }}>
              Clases on demand, programas con estructura real y sesiones en vivo para todos los niveles.
            </p>
          </div>

          <InteractiveSelector />
        </div>
      </section>

      {/* ── SOBRE MI ── */}
      <section id="sobre" className="landing-section" style={{ position: 'relative', zIndex: 1, scrollMarginTop: '5rem', overflow: 'hidden', padding: 0 }}>
        {/* Soft monocolor background */}
        <div style={{ position: 'absolute', inset: 0, background: '#fdf2f8', zIndex: 0 }} />

        {/* Ballet line art background decoration */}
        <svg
          viewBox="0 0 400 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
          style={{
            position: 'absolute', right: '3%', top: '50%',
            transform: 'translateY(-50%)',
            height: '80%', width: 'auto',
            opacity: 0.06, pointerEvents: 'none', zIndex: 0,
          }}
        >
          {/* Arabesque figure */}
          <circle cx="190" cy="148" r="22" stroke="#be185d" strokeWidth="2.5" />
          <circle cx="190" cy="126" r="11" stroke="#be185d" strokeWidth="2" />
          <ellipse cx="190" cy="198" rx="16" ry="34" stroke="#be185d" strokeWidth="2.5" />
          <path d="M 177 183 Q 138 158 100 128" stroke="#be185d" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 100 128 Q 88 116 82 103" stroke="#be185d" strokeWidth="2" strokeLinecap="round" />
          <path d="M 203 183 Q 248 168 292 150" stroke="#be185d" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 182 232 Q 177 290 174 360 Q 172 385 170 408" stroke="#be185d" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 198 232 Q 235 258 276 250 Q 312 243 342 218" stroke="#be185d" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 164 226 Q 144 246 130 254 Q 162 249 190 242 Q 218 249 250 254 Q 236 246 216 226" stroke="#be185d" strokeWidth="2" strokeLinecap="round" />
          <path d="M 170 408 Q 168 426 170 433" stroke="#be185d" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 342 218 Q 353 212 357 208" stroke="#be185d" strokeWidth="2" strokeLinecap="round" />
          {/* Barre */}
          <line x1="30" y1="480" x2="170" y2="480" stroke="#be185d" strokeWidth="2" strokeLinecap="round" />
          <line x1="30" y1="474" x2="30" y2="560" stroke="#be185d" strokeWidth="2" strokeLinecap="round" />
          <line x1="170" y1="474" x2="170" y2="560" stroke="#be185d" strokeWidth="2" strokeLinecap="round" />
          {/* Stars */}
          <circle cx="60" cy="70" r="3" fill="#be185d" opacity="0.6" />
          <circle cx="340" cy="500" r="2.5" fill="#be185d" opacity="0.5" />
          <circle cx="25" cy="350" r="2" fill="#be185d" opacity="0.4" />
          <circle cx="370" cy="110" r="2" fill="#be185d" opacity="0.35" />
          <circle cx="320" cy="320" r="1.5" fill="#be185d" opacity="0.3" />
        </svg>

        <div style={{ position: 'relative', zIndex: 1, padding: 'clamp(4rem,8vw,7rem) clamp(1.5rem,5vw,4.5rem)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>

            {/* Section label */}
            <div style={{ marginBottom: '3.5rem' }}>
              <p style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.32em', textTransform: 'uppercase', color: '#ec4899', marginBottom: '0.6rem' }}>
                Sobre mi
              </p>
              <h2 style={{ fontFamily: 'var(--font-display,serif)', fontStyle: 'italic', fontSize: 'clamp(2.4rem,5vw,4rem)', lineHeight: 0.95, color: '#1c1917' }}>
                Bailarina, docente<br />y coreografa.
              </h2>
            </div>

            {/* Content: photo left + portrait right */}
            <div className="landing-about-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '4rem', alignItems: 'start' }}>

              {/* Left: single portrait */}
              <div className="landing-about-photo" style={{
                position: 'relative', borderRadius: '1.5rem', overflow: 'hidden',
                aspectRatio: '3/4',
                boxShadow: '0 32px 80px rgba(236,72,153,0.15), 0 0 0 1px rgba(236,72,153,0.08)',
              }}>
                <Image src="/fotos-landing/about-hero.jpg.jpg" alt="Brunela" fill sizes="45vw"
                  style={{ objectFit: 'cover', objectPosition: 'top center' }} />
                {/* subtle pink tint at top */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(236,72,153,0.08) 0%, transparent 40%)' }} />
              </div>

              {/* Right: text */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem', paddingTop: '1rem' }}>
                <p style={{ fontSize: '1rem', color: '#78716c', lineHeight: 1.9 }}>
                  Mas de 15 anos transformando cuerpos y carreras a traves del movimiento. Certificada en PBT, PCT, Pilates y RAF. Trabajo desde Argentina y Barcelona.
                </p>
                <p style={{ fontSize: '1rem', color: '#78716c', lineHeight: 1.9 }}>
                  Mi propuesta no reemplaza tu tecnica — la sostiene con trabajo de centro, alineacion y movilidad especifica para bailarines.
                </p>

                {/* Certifications */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {['PBT Certified', 'PCT Certified', 'Pilates', 'RAF', '+15 anos'].map((t) => (
                    <span key={t} style={{
                      fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.14em',
                      textTransform: 'uppercase', padding: '0.4rem 1rem', borderRadius: '999px',
                      background: 'rgba(255,255,255,0.8)', color: '#ec4899',
                      border: '1px solid rgba(236,72,153,0.2)',
                    }}>
                      {t}
                    </span>
                  ))}
                </div>

                {/* Stats */}
                <div className="landing-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', padding: '1.5rem 0', borderTop: '1px solid rgba(236,72,153,0.12)', borderBottom: '1px solid rgba(236,72,153,0.12)' }}>
                  {[
                    { num: '+15', label: 'anos de experiencia' },
                    { num: '4', label: 'certificaciones' },
                    { num: '2', label: 'ciudades' },
                  ].map((s) => (
                    <div key={s.label} style={{ textAlign: 'center' }}>
                      <p style={{ fontFamily: 'var(--font-display,serif)', fontStyle: 'italic', fontSize: '2.2rem', color: '#ec4899', lineHeight: 1, marginBottom: '0.2rem' }}>{s.num}</p>
                      <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(28,25,23,0.4)', lineHeight: 1.4 }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* CTAs */}
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <Link href="/#planes" style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '0.85rem 1.8rem', borderRadius: '999px',
                    background: '#ec4899', color: '#fff', textDecoration: 'none',
                    fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase',
                    boxShadow: '0 10px 28px rgba(236,72,153,0.28)',
                  }}>
                    Ver membresias
                  </Link>
                  <a
                    href="https://instagram.com/brunela.dance"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center',
                      padding: '0.85rem 1.8rem', borderRadius: '999px',
                      background: 'transparent', color: '#1c1917', textDecoration: 'none',
                      fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase',
                      border: '1.5px solid rgba(28,25,23,0.15)',
                    }}
                  >
                    Ver portfolio
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PLANES ── */}
      <section id="planes" className="landing-section" style={{ position: 'relative', zIndex: 1, padding: 'clamp(4rem,8vw,7rem) clamp(1.5rem,5vw,4.5rem)', scrollMarginTop: '5rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '0' }}>
            <p style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.32em', textTransform: 'uppercase', color: '#ec4899', marginBottom: '0.6rem' }}>
              Membresias
            </p>
            <h2 style={{ fontFamily: 'var(--font-display,serif)', fontStyle: 'italic', fontSize: 'clamp(2.4rem,5vw,4rem)', lineHeight: 0.95, color: '#1c1917', marginBottom: '0.9rem' }}>
              Tres niveles.<br />Un studio completo.
            </h2>
            <p style={{ fontSize: '0.95rem', color: '#78716c', lineHeight: 1.8 }}>Sin contrato. Cambia de plan cuando quieras.</p>
          </div>

          <div className="landing-plans-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1.25rem', marginTop: '3rem' }}>
            {plans.map((p) => (
              <div key={p.name} style={{
                borderRadius: '1.5rem', padding: '2.25rem 2rem',
                border: p.featured ? '1.5px solid #ec4899' : '1.5px solid #fce7f3',
                background: p.featured ? 'linear-gradient(160deg,#fff 0%,#fdf2f8 100%)' : 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(8px)', position: 'relative',
                boxShadow: p.featured ? '0 20px 50px rgba(236,72,153,0.15)' : 'none',
              }}>
                {p.featured && (
                  <span style={{ position: 'absolute', top: '-0.8rem', left: '50%', transform: 'translateX(-50%)', background: '#ec4899', color: '#fff', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', padding: '0.3rem 1rem', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                    Mas elegida
                  </span>
                )}
                <p style={{ fontFamily: 'var(--font-display,serif)', fontStyle: 'italic', fontSize: '1.5rem', color: '#1c1917', marginBottom: '0.35rem' }}>{p.name}</p>
                <p style={{ fontSize: '0.85rem', color: '#78716c', lineHeight: 1.7, marginBottom: '1.5rem' }}>{p.desc}</p>
                <p style={{ fontFamily: 'var(--font-display,serif)', fontStyle: 'italic', fontSize: '3.5rem', color: '#ec4899', lineHeight: 1, marginBottom: '0.2rem' }}>${p.price}</p>
                <p style={{ fontSize: '0.68rem', color: '#78716c', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '1.75rem' }}>USD / mes</p>
                <ul style={{ listStyle: 'none', display: 'grid', gap: '0.6rem', marginBottom: '1.75rem', padding: 0 }}>
                  {p.features.map((f) => (
                    <li key={f} style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', fontSize: '0.88rem', color: '#78716c', lineHeight: 1.6 }}>
                      <CheckCircle2 size={14} style={{ color: '#ec4899', flexShrink: 0, marginTop: '0.12rem' }} />{f}
                    </li>
                  ))}
                </ul>
                <Link href="/sign-in" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%',
                  padding: '0.85rem', borderRadius: '999px',
                  fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase',
                  textDecoration: 'none',
                  background: p.featured ? '#ec4899' : 'transparent',
                  color: p.featured ? '#fff' : '#1c1917',
                  border: p.featured ? 'none' : '1.5px solid rgba(28,25,23,0.18)',
                  boxShadow: p.featured ? '0 8px 24px rgba(236,72,153,0.3)' : 'none',
                }}>
                  Empezar
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <BrunelaFooter />
      </div>
    </>
  );
}
