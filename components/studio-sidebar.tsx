'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOutAction } from '@/src/features/auth/actions';

type MembershipTier = 'none' | 'corps_de_ballet' | 'solista' | 'principal';

const PLAN_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  corps_de_ballet: { bg: '#fdf2f8', color: '#be185d', label: 'CORPS DE BALLET' },
  solista:         { bg: '#fce7f3', color: '#9d174d', label: 'SOLISTA' },
  principal:       { bg: '#1c1917', color: '#fdf2f8', label: 'PRINCIPAL' },
  none:            { bg: '#f5f5f4', color: '#78716c', label: 'SIN PLAN' },
};

const NAV = [
  { href: '/dashboard',           label: 'Inicio' },
  { href: '/dashboard/library',   label: 'Clases' },
  { href: '/dashboard/chat',      label: 'Mi Chat' },
  { href: '/dashboard/community', label: 'Comunidad' },
  { href: '/dashboard/documents', label: 'Documentos' },
];

export function StudioSidebar({
  userName,
  membershipTier,
  isAdmin,
}: {
  userName: string;
  membershipTier: MembershipTier;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const badge = PLAN_BADGE[membershipTier] ?? PLAN_BADGE.none;
  const initial = (userName.trim()[0] ?? 'A').toUpperCase();

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  return (
    <aside
      style={{
        width: 232,
        minHeight: '100vh',
        height: '100vh',
        position: 'sticky',
        top: 0,
        overflowY: 'auto',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #fce7f3',
        background: 'linear-gradient(180deg, #ffffff 0%, #fffbfd 100%)',
        fontFamily: 'var(--font-body), "Plus Jakarta Sans", sans-serif',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid #fce7f3' }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <Image src="/brand/isologo-icon.png" alt="Brunela Dance Trainer" width={38} height={38} style={{ objectFit: 'contain', flexShrink: 0 }} />
          <div>
            <div style={{
              fontFamily: 'var(--font-display), Montserrat, sans-serif',
              fontSize: 13, fontWeight: 900, color: '#D93438', lineHeight: 1.1,
            }}>Brunela Dance Trainer</div>
            <div style={{ fontSize: 8.5, letterSpacing: '0.12em', color: '#E64F55', marginTop: 1, fontWeight: 700 }}>
              DANCE TRAINER · BCN
            </div>
          </div>
        </Link>
      </div>

      {/* User */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #fce7f3' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, #fdf2f8, #fce7f3)',
            border: '1.5px solid #fbcfe8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#be185d', flexShrink: 0,
          }}>{initial}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#1c1917',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{userName}</div>
            <div style={{
              marginTop: 3, fontSize: 7.5, letterSpacing: '0.12em', fontWeight: 700,
              background: badge.bg, color: badge.color,
              padding: '2px 8px', borderRadius: 99, display: 'inline-block',
              border: badge.color === '#fdf2f8' ? '1px solid rgba(255,255,255,0.2)' : 'none',
            }}>{badge.label}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 10px' }}>
        {NAV.map(({ href, label }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href as never} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', marginBottom: 2, borderRadius: 10,
              background: active ? 'linear-gradient(135deg, #fdf2f8, #fce7f3)' : 'transparent',
              textDecoration: 'none',
              border: active ? '1px solid #fbcfe8' : '1px solid transparent',
              transition: 'all 0.15s',
            }}>
              <span style={{
                fontSize: 12, fontWeight: active ? 700 : 500,
                color: active ? '#be185d' : '#78716c',
                letterSpacing: '0.01em',
              }}>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={{ borderTop: '1px solid #fce7f3', padding: '8px 10px 16px' }}>
        <Link href="/dashboard/plan" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 12px', marginBottom: 2, borderRadius: 10,
          background: isActive('/dashboard/plan') ? 'linear-gradient(135deg, #fdf2f8, #fce7f3)' : 'transparent',
          textDecoration: 'none',
          border: isActive('/dashboard/plan') ? '1px solid #fbcfe8' : '1px solid transparent',
        }}>
          <span style={{
            fontSize: 12, fontWeight: isActive('/dashboard/plan') ? 700 : 500,
            color: isActive('/dashboard/plan') ? '#be185d' : '#78716c',
          }}>Mi Plan</span>
        </Link>

        {isAdmin && (
          <Link href="/admin" style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', marginBottom: 2, borderRadius: 10,
            background: pathname.startsWith('/admin') ? '#1c1917' : 'transparent',
            textDecoration: 'none',
            border: pathname.startsWith('/admin') ? 'none' : '1px solid transparent',
          }}>
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: pathname.startsWith('/admin') ? '#fdf2f8' : '#78716c',
              letterSpacing: '0.01em',
            }}>Admin</span>
          </Link>
        )}

        <form action={signOutAction}>
          <button type="submit" style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', background: 'transparent',
            border: '1px solid transparent', cursor: 'pointer',
            borderRadius: 10, textAlign: 'left',
          }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#a8a29e', letterSpacing: '0.01em' }}>Salir</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
