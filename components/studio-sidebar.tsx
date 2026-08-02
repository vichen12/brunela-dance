'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOutAction } from '@/src/features/auth/actions';
import type { Route } from 'next';

type MembershipTier = 'none' | 'corps_de_ballet' | 'solista' | 'principal';

const PLAN_LABEL: Record<MembershipTier, string> = {
  corps_de_ballet: 'Corps de Ballet',
  solista: 'Solista',
  principal: 'Principal',
  none: 'Sin plan',
};

function Ico({ d, d2, size = 20 }: { d: string; d2?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d={d} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      {d2 && <path d={d2} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

type NavItem = { href: string; exact?: boolean; label: string; d: string; d2?: string };

/**
 * Todas las pantallas de alumna viven aca.
 *
 * Programas y En vivo llegaban solo desde las tarjetas del Inicio, asi que una
 * alumna que entraba directo a Clases podia no enterarse nunca de que existian
 * -- y Principal se compra en buena medida por las clases en vivo.
 */
const NAV: NavItem[] = [
  { href: '/dashboard', exact: true, label: 'Inicio',
    d: 'M2.5 7L8 2.5 13.5 7v6a.5.5 0 01-.5.5h-3.5v-4h-3v4H3a.5.5 0 01-.5-.5V7z' },
  { href: '/dashboard/library', label: 'Clases',
    d: 'M4.5 3.5L13 8l-8.5 4.5V3.5z' },
  { href: '/dashboard/programs', label: 'Programas',
    d: 'M3 4.5h10M3 8h10M3 11.5h6' },
  { href: '/dashboard/live', label: 'En vivo',
    d: 'M3 4.5h10v9H3v-9z', d2: 'M3 7.2h10M5.6 2.6v3M10.4 2.6v3' },
  { href: '/dashboard/chat', label: 'Mi chat',
    d: 'M2.5 3.5h11c.28 0 .5.22.5.5v6c0 .28-.22.5-.5.5H7L4 13V10.5H2.5c-.28 0-.5-.22-.5-.5V4c0-.28.22-.5.5-.5z' },
  { href: '/dashboard/community', label: 'Comunidad',
    d: 'M6.2 7.6a2.6 2.6 0 100-5.2 2.6 2.6 0 000 5.2zM1.6 13.4a4.6 4.6 0 019.2 0',
    d2: 'M10.6 3.1a2.2 2.2 0 010 4.3M11.6 9.2a3.8 3.8 0 012.8 3.6' },
  { href: '/dashboard/documents', label: 'Documentos',
    d: 'M5 1.5h5.5L14 5V14H5V1.5z', d2: 'M10 1.5V5h4' },
  { href: '/dashboard/plan', label: 'Mi plan',
    d: 'M2 4.5h12v7H2v-7z', d2: 'M2 7h12' },
];

export function StudioSidebar({
  userName,
  membershipTier,
  isAdmin,
  seguirViendo,
}: {
  userName: string;
  membershipTier: MembershipTier;
  isAdmin: boolean;
  /** Ultima clase empezada y sin terminar, o null si no hay ninguna. */
  seguirViendo?: { slug: string; title: string } | null;
}) {
  const pathname = usePathname();
  const initial = (userName.trim()[0] ?? 'A').toUpperCase();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  // Nunca lleva a una pantalla vacia: sin progreso guardado, invita a explorar
  // la biblioteca en vez de abrir un reproductor que no existe.
  const cta = seguirViendo
    ? { href: `/dashboard/library/${seguirViendo.slug}`, label: 'Seguir viendo',
        d: 'M4.5 3.5L13 8l-8.5 4.5V3.5z' }
    : { href: '/dashboard/library', label: 'Explorar clases',
        d: 'M2 2h5v5H2V2zm7 0h5v5H9V2zM2 9h5v5H2V9zm7 0h5v5H9V9z' };

  const fila: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '13px 18px', borderRadius: 16, textDecoration: 'none',
    width: '100%', textAlign: 'left', fontFamily: 'inherit',
    fontSize: 15,
  };

  return (
    <aside style={{
      width: 268,
      flexShrink: 0,
      background: '#FDFBFA',
      borderRight: '1px solid #F1E9E7',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
    }}>
      {/* Marca */}
      <div style={{ padding: '34px 22px 26px' }}>
        <Link href="/dashboard" style={{ textDecoration: 'none', display: 'block' }}>
          <p style={{
            fontFamily: 'var(--font-display), sans-serif',
            fontSize: 30, fontWeight: 800, letterSpacing: '0.1em',
            color: 'var(--pink)', lineHeight: 1,
          }}>
            BRUNELA
          </p>
          <p style={{
            fontSize: 10, fontWeight: 500, letterSpacing: '0.34em',
            color: 'var(--ink)', marginTop: 9, opacity: 0.75,
          }}>
            DANCE TRAINER
          </p>
        </Link>
      </div>

      {/* Accion principal */}
      <div style={{ padding: '0 20px 22px' }}>
        <Link
          href={cta.href as Route}
          title={seguirViendo ? seguirViendo.title : undefined}
          style={{
            ...fila,
            justifyContent: 'center', gap: 12,
            padding: '15px 18px', borderRadius: 999,
            background: 'var(--pink)', color: '#fff',
            fontWeight: 700, fontSize: 14, letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          <Ico d={cta.d} size={17} />
          {cta.label}
        </Link>
      </div>

      {/* Navegacion */}
      <nav style={{ flex: 1, padding: '0 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link key={item.href} href={item.href as Route} style={{
              ...fila,
              background: active ? 'var(--pink-wash)' : 'transparent',
              color: active ? 'var(--pink)' : 'var(--ink)',
              fontWeight: active ? 700 : 500,
              transition: 'background 0.14s, color 0.14s',
            }}>
              <Ico d={item.d} d2={item.d2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Usuario: informativo, sin desplegable */}
      <div style={{ padding: '18px 20px 22px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ borderTop: '1px solid #F1E9E7', marginBottom: 12 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 4px 12px' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: 'var(--pink-wash)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, fontWeight: 700, color: 'var(--pink)',
          }}>{initial}</div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.01em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{userName}</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              {PLAN_LABEL[membershipTier] ?? PLAN_LABEL.none}
            </p>
          </div>
        </div>

        {isAdmin && (
          <Link href="/admin" style={{
            ...fila,
            padding: '12px 18px', borderRadius: 999, fontSize: 14, fontWeight: 600,
            background: pathname.startsWith('/admin') ? 'var(--ink)' : '#F6F1EF',
            color: pathname.startsWith('/admin') ? '#fff' : 'var(--ink)',
          }}>
            <Ico d="M8 10a2 2 0 100-4 2 2 0 000 4zM8 2v1.5M8 12.5V14M2 8H3.5M12.5 8H14" size={17} />
            Panel de admin
          </Link>
        )}

        <form action={signOutAction}>
          <button type="submit" style={{
            ...fila,
            padding: '12px 18px', borderRadius: 999, fontSize: 14, fontWeight: 600,
            background: 'var(--pink-wash)', color: 'var(--pink)',
            border: 'none', cursor: 'pointer',
          }}>
            <Ico d="M11 2h3v12h-3M6.5 11L10 8l-3.5-3M10 8H2" size={17} />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
