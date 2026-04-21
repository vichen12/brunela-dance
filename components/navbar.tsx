'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';

const links = [
  { href: '/#clases', label: 'Clases'   },
  { href: '/#sobre',  label: 'Sobre mi' },
  { href: '/#planes', label: 'Planes'   },
] as const;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <header
      className="site-navbar"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        padding: '0 2.5rem',
        height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'background 400ms, box-shadow 400ms',
        background: scrolled
          ? 'linear-gradient(135deg, rgba(252,231,243,0.97) 0%, rgba(255,255,255,0.97) 100%)'
          : 'linear-gradient(135deg, rgba(252,231,243,0.6) 0%, rgba(255,255,255,0.3) 100%)',
        backdropFilter: 'blur(20px)',
        boxShadow: scrolled
          ? '0 1px 0 rgba(236,72,153,0.12), 0 4px 24px rgba(236,72,153,0.06)'
          : 'none',
      }}
    >
      {/* Logo: image + wordmark */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', textDecoration: 'none' }}>
        {/* Logo image — no clip, blend-mode handles white bg */}
        <div style={{ width: 36, height: 36, flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Image
            src="/fotos-landing/logo.jpeg"
            alt=""
            width={36}
            height={36}
            priority
            style={{ objectFit: 'contain', mixBlendMode: 'multiply', borderRadius: '4px' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{
            fontFamily: 'var(--font-display, serif)',
            fontStyle: 'italic',
            fontSize: '1.5rem',
            color: '#1c1917',
            letterSpacing: '0.02em',
            lineHeight: 1,
          }}>
            Brunela
          </span>
          <span style={{
            fontSize: '0.5rem',
            fontWeight: 800,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: '#ec4899',
            marginTop: '1px',
          }}>
            Dance
          </span>
        </div>
      </Link>

      {/* Nav links */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '0.1rem' }}>
        {links.map((l) => (
          <Link
            key={l.href} href={l.href}
            style={{
              padding: '0.5rem 0.9rem', borderRadius: '999px',
              fontSize: '0.72rem', fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: '#78716c', textDecoration: 'none',
              transition: 'color 150ms, background 150ms',
            }}
            onMouseOver={(e) => { const t = e.currentTarget; t.style.color = '#ec4899'; t.style.background = 'rgba(252,231,243,0.8)'; }}
            onMouseOut={(e)  => { const t = e.currentTarget; t.style.color = '#78716c'; t.style.background = 'transparent'; }}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      {/* CTAs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Link
          href="/sign-in"
          style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '0.5rem 1.1rem', borderRadius: '999px',
            fontSize: '0.7rem', fontWeight: 800,
            letterSpacing: '0.16em', textTransform: 'uppercase',
            background: 'transparent', color: '#ec4899', textDecoration: 'none',
            border: '1.5px solid rgba(236,72,153,0.35)',
            transition: 'all 180ms',
          }}
          onMouseOver={(e) => { const t = e.currentTarget; t.style.background = 'rgba(252,231,243,0.8)'; t.style.borderColor = '#ec4899'; }}
          onMouseOut={(e)  => { const t = e.currentTarget; t.style.background = 'transparent'; t.style.borderColor = 'rgba(236,72,153,0.35)'; }}
        >
          Ingresar
        </Link>
        <Link
          href="/sign-in"
          style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '0.5rem 1.1rem', borderRadius: '999px',
            fontSize: '0.7rem', fontWeight: 800,
            letterSpacing: '0.16em', textTransform: 'uppercase',
            background: '#ec4899', color: '#fff', textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(236,72,153,0.3)',
            transition: 'background 180ms, transform 180ms',
          }}
          onMouseOver={(e) => { const t = e.currentTarget; t.style.background = '#db2777'; t.style.transform = 'translateY(-1px)'; }}
          onMouseOut={(e)  => { const t = e.currentTarget; t.style.background = '#ec4899'; t.style.transform = 'translateY(0)'; }}
        >
          Registrarse
        </Link>
      </div>
    </header>
  );
}
