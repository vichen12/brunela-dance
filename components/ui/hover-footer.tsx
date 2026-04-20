'use client';
import Image from 'next/image';
import Link from 'next/link';

const col1 = [
  { label: 'Clases',   href: '/#clases' },
  { label: 'Sobre mi', href: '/#sobre'  },
  { label: 'Planes',   href: '/#planes' },
] as const;

const col2 = [
  { label: 'Ingresar al studio', href: '/sign-in'   },
  { label: 'Mi dashboard',       href: '/dashboard' },
] as const;

const LINK_COLOR     = '#78716c';
const LINK_HOVER     = '#ec4899';
const MUTED          = 'rgba(28,25,23,0.35)';

function FLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      style={{ fontSize: '0.88rem', color: LINK_COLOR, textDecoration: 'none', transition: 'color 150ms' }}
      onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.color = LINK_HOVER; }}
      onMouseOut={(e)  => { (e.currentTarget as HTMLElement).style.color = LINK_COLOR; }}
    >
      {children}
    </a>
  );
}

export function BrunelaFooter() {
  return (
    <footer style={{
      background: 'linear-gradient(180deg, #fff9fb 0%, #fdf2f8 100%)',
      borderTop: '1px solid rgba(236,72,153,0.1)',
      color: LINK_COLOR,
      padding: '5rem 3rem 0',
    }}>
      <div style={{
        maxWidth: 1100,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1.4fr',
        gap: '3rem',
        paddingBottom: '3.5rem',
        borderBottom: '1px solid rgba(236,72,153,0.1)',
      }}>

        {/* Brand */}
        <div>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', textDecoration: 'none', marginBottom: '1.25rem' }}>
            <div style={{ width: 40, height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Image
                src="/fotos-landing/logo.jpeg"
                alt="Brunela"
                width={40}
                height={40}
                style={{ objectFit: 'contain', mixBlendMode: 'multiply' }}
              />
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-display,serif)', fontStyle: 'italic', fontSize: '1.7rem', lineHeight: 1, color: '#1c1917', margin: 0 }}>
                Brunela
              </p>
              <p style={{ fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#ec4899', marginTop: '2px', marginBottom: 0 }}>
                Dance Trainer
              </p>
            </div>
          </Link>
          <p style={{ fontSize: '0.88rem', lineHeight: 1.9, maxWidth: '30ch', color: '#78716c' }}>
            Pilates y conditioning para bailarines. Studio online desde Argentina y Barcelona.
          </p>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['PBT', 'PCT', 'Pilates', 'RAF'].map((tag) => (
              <span key={tag} style={{
                fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.18em',
                textTransform: 'uppercase', padding: '0.28rem 0.75rem',
                borderRadius: '999px', background: 'rgba(236,72,153,0.07)',
                color: '#ec4899', border: '1px solid rgba(236,72,153,0.18)',
              }}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Studio */}
        <div>
          <p style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.26em', textTransform: 'uppercase', color: MUTED, marginBottom: '1.4rem' }}>
            Studio
          </p>
          <ul style={{ display: 'grid', gap: '0.9rem', listStyle: 'none', padding: 0, margin: 0 }}>
            {col1.map((l) => (
              <li key={l.label}><FLink href={l.href}>{l.label}</FLink></li>
            ))}
          </ul>
        </div>

        {/* Acceso */}
        <div>
          <p style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.26em', textTransform: 'uppercase', color: MUTED, marginBottom: '1.4rem' }}>
            Acceso
          </p>
          <ul style={{ display: 'grid', gap: '0.9rem', listStyle: 'none', padding: 0, margin: 0 }}>
            {col2.map((l) => (
              <li key={l.label}><FLink href={l.href}>{l.label}</FLink></li>
            ))}
          </ul>
        </div>

        {/* Contacto */}
        <div>
          <p style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.26em', textTransform: 'uppercase', color: MUTED, marginBottom: '1.4rem' }}>
            Contacto
          </p>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <FLink href="mailto:hola@brunela.com">hola@brunela.com</FLink>
            <FLink href="https://instagram.com/brunela.dance" external>@brunela.dance</FLink>
            <p style={{ fontSize: '0.88rem', color: MUTED, margin: 0 }}>Argentina · Barcelona · Online</p>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        paddingTop: '1.5rem', paddingBottom: '2rem',
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem',
      }}>
        <span style={{ fontSize: '0.75rem', color: MUTED }}>
          © {new Date().getFullYear()} Brunela Dance Trainer
        </span>
        <a
          href="https://instagram.com/dallapesystems"
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: '0.72rem', color: MUTED, textDecoration: 'none', letterSpacing: '0.04em', transition: 'color 150ms' }}
          onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.color = '#ec4899'; }}
          onMouseOut={(e)  => { (e.currentTarget as HTMLElement).style.color = MUTED; }}
        >
          Hecho por DallapeSystems
        </a>
      </div>
    </footer>
  );
}
