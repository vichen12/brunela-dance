'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/dashboard',           label: 'Inicio',    exact: true  },
  { href: '/dashboard/library',   label: 'Clases',    exact: false },
  { href: '/dashboard/chat',      label: 'Chat',      exact: false },
  { href: '/dashboard/community', label: 'Comunidad', exact: false },
  { href: '/dashboard/plan',      label: 'Plan',      exact: false },
];

export function MobileDashboardNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  function active(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <nav
      className="mobile-dash-nav"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid #fce7f3',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxShadow: '0 -4px 24px rgba(190,24,93,0.07)',
      }}
    >
      <div style={{ display: 'flex', height: 58 }}>
        {NAV.map((item) => {
          const on = active(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href as never}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 2,
                textDecoration: 'none',
                color: on ? 'var(--pink)' : '#a8a29e',
                borderTop: on ? '2px solid var(--pink)' : '2px solid transparent',
                fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                transition: 'color 150ms',
              }}
            >
              {item.label}
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            href={"/admin" as never}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2,
              textDecoration: 'none',
              color: pathname.startsWith('/admin') ? '#1c1917' : '#a8a29e',
              borderTop: pathname.startsWith('/admin') ? '2px solid #1c1917' : '2px solid transparent',
              fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
            }}
          >
            Admin
          </Link>
        )}
      </div>
    </nav>
  );
}
