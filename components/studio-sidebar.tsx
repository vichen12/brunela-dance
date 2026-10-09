'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import {
  CalendarHeart, FileText, Flower2, House, LayoutGrid, ListOrdered,
  LogOut, MessageCircleHeart, Play, Settings2, Sparkles, Users,
} from 'lucide-react';
import { signOutAction } from '@/src/features/auth/actions';

type MembershipTier = 'none' | 'corps_de_ballet' | 'solista' | 'principal';

const PLAN_LABEL: Record<MembershipTier, string> = {
  corps_de_ballet: 'Corps de Ballet',
  solista: 'Solista',
  principal: 'Principal',
  none: 'Sin plan',
};

type NavItem = { href: string; exact?: boolean; label: string; Icon: typeof House };

/**
 * Todas las pantallas de alumna viven aca.
 *
 * Los planes de trabajo y En vivo llegaban solo desde las tarjetas del Inicio, asi que una
 * alumna que entraba directo a Clases podia no enterarse nunca de que existian
 * -- y Principal se compra en buena medida por las clases en vivo.
 *
 * Estilos en globals.css (.sb-*), compartidos con el menu de admin. Los iconos
 * se eligen aca, del lado del cliente (trampa 6 del CLAUDE.md).
 */
const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: 'Tu práctica',
    items: [
      { href: '/dashboard', exact: true, label: 'Inicio', Icon: House },
      { href: '/dashboard/library', label: 'Clases', Icon: Play },
      { href: '/dashboard/programs', label: 'Planes de trabajo', Icon: ListOrdered },
      { href: '/dashboard/live', label: 'En vivo', Icon: CalendarHeart },
    ],
  },
  {
    label: 'Comunidad',
    items: [
      { href: '/dashboard/chat', label: 'Mi chat', Icon: MessageCircleHeart },
      { href: '/dashboard/community', label: 'Comunidad', Icon: Users },
      { href: '/dashboard/documents', label: 'Documentos', Icon: FileText },
    ],
  },
  {
    label: 'Cuenta',
    items: [
      { href: '/dashboard/plan', label: 'Mi plan', Icon: Sparkles },
    ],
  },
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
    ? { href: `/dashboard/library/${seguirViendo.slug}`, label: 'Seguir viendo', Icon: Play }
    : { href: '/dashboard/library', label: 'Explorar clases', Icon: LayoutGrid };

  return (
    <aside className="sb" aria-label="Menú del estudio">
      <Link href="/dashboard" className="sb-marca">
        <span className="sb-marca-ico">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/isologo-icon.png" alt="" />
        </span>
        <span>
          <span className="sb-marca-nombre" style={{ display: 'block' }}>Brunela</span>
          <span className="sb-marca-sub" style={{ display: 'block' }}>Dance Trainer</span>
        </span>
      </Link>

      <Link href={cta.href as Route} className="sb-cta" title={seguirViendo ? seguirViendo.title : undefined}>
        <span className="sb-cta-ico"><cta.Icon size={14} strokeWidth={2.6} aria-hidden="true" /></span>
        {cta.label}
      </Link>

      <nav className="sb-nav">
        {NAV.map((grupo) => (
          <div key={grupo.label} className="sb-grupo">
            <p className="sb-grupo-titulo">{grupo.label}</p>
            {grupo.items.map(({ href, exact, label, Icon }) => {
              const active = isActive(href, exact);
              return (
                <Link key={href} href={href as Route} className={'sb-item' + (active ? ' es-activo' : '')} aria-current={active ? 'page' : undefined}>
                  <span className="sb-item-ico"><Icon size={18} strokeWidth={active ? 2.3 : 1.9} aria-hidden="true" /></span>
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sb-pie">
        {isAdmin && (
          <Link href="/admin" className={'sb-extra' + (pathname.startsWith('/admin') ? ' es-activo' : '')}>
            <Settings2 size={16} strokeWidth={2} aria-hidden="true" />
            Panel de admin
          </Link>
        )}
        <div className="sb-perfil">
          <span className="sb-avatar" aria-hidden="true">{initial}</span>
          <div className="sb-perfil-txt">
            <p className="sb-perfil-nombre">{userName}</p>
            <span className="sb-perfil-plan">
              {membershipTier !== 'none' && <Flower2 size={10} strokeWidth={2.6} aria-hidden="true" style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />}
              {PLAN_LABEL[membershipTier] ?? PLAN_LABEL.none}
            </span>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="sb-salir" aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut size={17} strokeWidth={2} aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
