'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOutAction } from '@/src/features/auth/actions';
import type { Route } from 'next';

type MembershipTier = 'none' | 'corps_de_ballet' | 'solista' | 'principal';

const PLAN_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  corps_de_ballet: { bg: '#fdf2f8', color: '#be185d', label: 'CORPS' },
  solista:         { bg: '#fce7f3', color: '#9d174d', label: 'SOLISTA' },
  principal:       { bg: '#1c1917', color: '#fdf2f8', label: 'PRINCIPAL' },
  none:            { bg: '#f5f5f4', color: '#78716c', label: 'SIN PLAN' },
};

function Ico({ d, d2 }: { d: string; d2?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {d2 && <path d={d2} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

type NavItem = { href: string; exact?: boolean; label: string; d: string; d2?: string };

const NAV: NavItem[] = [
  { href: '/dashboard', exact: true, label: 'Inicio',
    d: 'M2 2h5v5H2V2zm7 0h5v5H9V2zM2 9h5v5H2V9zm7 0h5v5H9V9z' },
  { href: '/dashboard/library', label: 'Clases',
    d: 'M4.5 3.5L13 8l-8.5 4.5V3.5z' },
  { href: '/dashboard/chat', label: 'Mi Chat',
    d: 'M2.5 3.5h11c.28 0 .5.22.5.5v6c0 .28-.22.5-.5.5H7L4 13V10.5H2.5c-.28 0-.5-.22-.5-.5V4c0-.28.22-.5.5-.5z' },
  { href: '/dashboard/community', label: 'Comunidad',
    d: 'M6.5 8a3 3 0 100-6 3 3 0 000 6zm-5 6a5.5 5.5 0 0111 0' },
  { href: '/dashboard/documents', label: 'Documentos',
    d: 'M5 1.5h5.5L14 5V14H5V1.5z', d2: 'M10 1.5V5h4' },
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

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <aside style={{
      width: 220,
      flexShrink: 0,
      background: '#fff',
      borderRight: '1.5px solid #f5f0ef',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      overflow: 'hidden',
    }}>
      {/* Brand */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1.5px solid #f5f0ef' }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #f9a8b4, #be185d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-display), serif' }}>B</span>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1c1917', letterSpacing: '-0.01em', lineHeight: 1.2 }}>Brunela</p>
            <p style={{ fontSize: 10, color: '#a8a29e', fontWeight: 600, letterSpacing: '0.05em', marginTop: 1 }}>Studio</p>
          </div>
        </Link>
      </div>

      {/* User */}
      <div style={{ padding: '12px 16px', borderBottom: '1.5px solid #f5f0ef' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: 'linear-gradient(135deg, #fdf2f8, #fce7f3)',
            border: '1.5px solid #fbcfe8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#be185d',
          }}>{initial}</div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              fontSize: 11, fontWeight: 700, color: '#1c1917',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              letterSpacing: '0.02em',
            }}>{userName}</p>
            <span style={{
              marginTop: 3, fontSize: 7.5, letterSpacing: '0.12em', fontWeight: 700,
              background: badge.bg, color: badge.color,
              padding: '2px 7px', borderRadius: 99, display: 'inline-block',
            }}>{badge.label}</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {NAV.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link key={item.href} href={item.href as Route} style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '7px 9px', borderRadius: 8, textDecoration: 'none',
              background: active ? '#fdf2f8' : 'transparent',
              color: active ? '#be185d' : '#78716c',
              fontWeight: active ? 700 : 500,
              fontSize: 13,
              borderLeft: active ? '2px solid #be185d' : '2px solid transparent',
              transition: 'background 0.12s, color 0.12s',
            }}>
              <Ico d={item.d} d2={item.d2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '10px 10px 14px', borderTop: '1.5px solid #f5f0ef', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Link href="/dashboard/plan" style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '7px 9px', borderRadius: 8, textDecoration: 'none',
          background: isActive('/dashboard/plan') ? '#fdf2f8' : 'transparent',
          color: isActive('/dashboard/plan') ? '#be185d' : '#a8a29e',
          fontSize: 13, fontWeight: isActive('/dashboard/plan') ? 700 : 500,
          borderLeft: isActive('/dashboard/plan') ? '2px solid #be185d' : '2px solid transparent',
        }}>
          <Ico d="M3 4h10v2H3V4zm0 4h8v2H3V8zm0 4h5v2H3v-2z" />
          Mi Plan
        </Link>

        {isAdmin && (
          <Link href="/admin" style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '7px 9px', borderRadius: 8, textDecoration: 'none',
            background: pathname.startsWith('/admin') ? '#1c1917' : 'transparent',
            color: pathname.startsWith('/admin') ? '#fdf2f8' : '#a8a29e',
            fontSize: 13, fontWeight: 700,
            borderLeft: '2px solid transparent',
          }}>
            <Ico d="M8 10a2 2 0 100-4 2 2 0 000 4zM8 2v1.5M8 12.5V14M2 8H3.5M12.5 8H14" />
            Admin Panel
          </Link>
        )}

        <form action={signOutAction}>
          <button type="submit" style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '7px 9px', borderRadius: 8, width: '100%',
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#a8a29e', fontSize: 13, fontWeight: 500, textAlign: 'left',
          }}>
            <Ico d="M11 2h3v12h-3M6.5 11L10 8l-3.5-3M10 8H2" />
            Cerrar sesion
          </button>
        </form>
      </div>
    </aside>
  );
}
