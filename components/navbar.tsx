'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { X, Menu } from 'lucide-react';

const links = [
  { href: '/#clases', label: 'Clases'   },
  { href: '/#sobre',  label: 'Sobre mi' },
  { href: '/#planes', label: 'Planes'   },
] as const;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  return (
    <>
      <header
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          height: '66px',
          display: 'flex', alignItems: 'center',
          padding: '0 clamp(1.25rem, 4vw, 2.5rem)',
          transition: 'background 350ms, box-shadow 350ms, border-color 350ms',
          /* Always slightly tinted — feels premium, not empty */
          background: menuOpen
            ? 'rgba(253,242,248,0.98)'
            : scrolled
            ? 'rgba(253,242,248,0.95)'
            : 'rgba(253,242,248,0.72)',
          backdropFilter: 'blur(22px)',
          borderBottom: scrolled
            ? '1px solid rgba(236,72,153,0.14)'
            : '1px solid rgba(236,72,153,0.08)',
          boxShadow: scrolled
            ? '0 2px 24px rgba(190,24,93,0.07)'
            : 'none',
        }}
      >
        {/* ── Logo ── */}
        <Link href="/" onClick={close} aria-label="Brunela Dance Trainer" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}>
          <div style={{ width: 38, height: 52, position: 'relative', flexShrink: 0 }}>
            <Image
              src="/brand/isologo-color.png"
              alt="Brunela Dance Trainer"
              fill
              priority
              style={{ objectFit: 'contain', objectPosition: 'center' }}
            />
          </div>
        </Link>

        {/* ── Center links — desktop, absolutely centered ── */}
        <nav className="landing-nav-links" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              style={{ padding: '0.45rem 0.9rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#78716c', textDecoration: 'none', transition: 'color 140ms, background 140ms' }}
              onMouseOver={(e) => { const t = e.currentTarget; t.style.color = '#be185d'; t.style.background = 'rgba(252,231,243,0.85)'; }}
              onMouseOut={(e)  => { const t = e.currentTarget; t.style.color = '#78716c'; t.style.background = 'transparent'; }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* ── Desktop CTAs ── */}
        <div className="landing-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
          <Link href="/sign-in"
            style={{ display: 'inline-flex', alignItems: 'center', padding: '0.48rem 1.1rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#be185d', textDecoration: 'none', border: '1.5px solid rgba(190,24,93,0.3)', transition: 'all 180ms' }}
            onMouseOver={(e) => { const t = e.currentTarget; t.style.background = 'rgba(252,231,243,0.9)'; t.style.borderColor = '#be185d'; }}
            onMouseOut={(e)  => { const t = e.currentTarget; t.style.background = 'transparent'; t.style.borderColor = 'rgba(190,24,93,0.3)'; }}
          >
            Ingresar
          </Link>
          <Link href="/#planes"
            style={{ display: 'inline-flex', alignItems: 'center', padding: '0.48rem 1.15rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', background: '#ec4899', color: '#fff', textDecoration: 'none', boxShadow: '0 4px 16px rgba(236,72,153,0.3)', transition: 'background 180ms, transform 180ms' }}
            onMouseOver={(e) => { const t = e.currentTarget; t.style.background = '#db2777'; t.style.transform = 'translateY(-1px)'; }}
            onMouseOut={(e)  => { const t = e.currentTarget; t.style.background = '#ec4899'; t.style.transform = 'translateY(0)'; }}
          >
            Ver planes
          </Link>
        </div>

        {/* ── Mobile right: Ingresar + hamburger ── */}
        <div className="landing-mobile-nav" style={{ display: 'none', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
          <Link href="/sign-in"
            style={{ display: 'inline-flex', alignItems: 'center', padding: '0.44rem 1rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', background: '#ec4899', color: '#fff', textDecoration: 'none', boxShadow: '0 3px 12px rgba(236,72,153,0.28)' }}
          >
            Ingresar
          </Link>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Cerrar menu' : 'Abrir menu'}
            style={{ background: 'rgba(252,231,243,0.6)', border: '1px solid rgba(236,72,153,0.2)', borderRadius: 8, cursor: 'pointer', color: '#be185d', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, padding: 0 }}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      <div style={{
        position: 'fixed', top: 66, left: 0, right: 0, zIndex: 9998,
        background: 'rgba(253,242,248,0.98)',
        backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(236,72,153,0.12)',
        padding: '0.75rem 1.5rem 2rem',
        display: 'flex', flexDirection: 'column',
        transform: menuOpen ? 'translateY(0)' : 'translateY(-110%)',
        transition: 'transform 300ms cubic-bezier(0.22,1,0.36,1)',
        boxShadow: '0 12px 40px rgba(190,24,93,0.1)',
      }}>
        {links.map((l) => (
          <Link key={l.href} href={l.href} onClick={close}
            style={{ display: 'block', padding: '1rem 0.25rem', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1c1917', textDecoration: 'none', borderBottom: '1px solid rgba(236,72,153,0.08)' }}
          >
            {l.label}
          </Link>
        ))}
        <Link href="/#planes" onClick={close}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1.25rem', padding: '0.9rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', background: '#ec4899', color: '#fff', textDecoration: 'none', boxShadow: '0 6px 20px rgba(236,72,153,0.28)' }}
        >
          Ver planes
        </Link>
      </div>

      {menuOpen && <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 9997, background: 'rgba(0,0,0,0.15)' }} />}

      <style>{`
        @media (max-width: 639px) {
          .landing-nav-links { display: none !important; }
          .landing-mobile-nav { display: flex !important; }
        }
      `}</style>
    </>
  );
}
