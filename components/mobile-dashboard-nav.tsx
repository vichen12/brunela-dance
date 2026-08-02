'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

/**
 * Los MISMOS ocho destinos que el sidebar de escritorio. Antes habia cinco y
 * Programas, En vivo y Documentos no se podian abrir desde el telefono.
 *
 * POR QUE NO ESTAN LOS OCHO EN LA BARRA DE ABAJO
 *   Ocho mas Admin son nueve columnas. En una pantalla de 375px queda cada una
 *   en ~41px, y "Comunidad" a 9px mide ~45px: se corta o se parte en dos
 *   lineas. Los cuatro mas usados quedan a un toque y el resto vive en la hoja
 *   de "Menu", que ademas da lugar a etiquetas legibles y a objetivos tactiles
 *   comodos.
 */
const NAV = [
  { href: '/dashboard',           label: 'Inicio',     exact: true  },
  { href: '/dashboard/library',   label: 'Clases',     exact: false },
  { href: '/dashboard/programs',  label: 'Programas',  exact: false },
  { href: '/dashboard/live',      label: 'En vivo',    exact: false },
  { href: '/dashboard/chat',      label: 'Mi chat',    exact: false },
  { href: '/dashboard/community', label: 'Comunidad',  exact: false },
  { href: '/dashboard/documents', label: 'Documentos', exact: false },
  { href: '/dashboard/plan',      label: 'Mi plan',    exact: false },
];

/** Los que quedan a un toque en la barra. El resto, en la hoja. */
const PRIMARIOS = ['/dashboard', '/dashboard/library', '/dashboard/chat', '/dashboard/community'];

export function MobileDashboardNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);

  // Cerrar al navegar: sin esto la hoja queda abierta sobre la pantalla nueva.
  useEffect(() => { setAbierto(false); }, [pathname]);

  function active(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  const enBarra = NAV.filter((i) => PRIMARIOS.includes(i.href));
  const enHoja = NAV;
  // Si estas en una pantalla que no esta en la barra, "Menu" se marca activo:
  // asi la navegacion nunca aparece sin ningun item seleccionado.
  const menuActivo = !enBarra.some((i) => active(i.href, i.exact)) && !pathname.startsWith('/admin');

  const itemBase: React.CSSProperties = {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 2,
    textDecoration: 'none', fontSize: 9, fontWeight: 700,
    letterSpacing: '0.06em', transition: 'color 150ms',
    minHeight: 48,
  };

  return (
    <>
      {abierto && (
        <>
          <button
            aria-label="Cerrar menú"
            onClick={() => setAbierto(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 210,
              background: 'rgba(28,25,23,0.45)', backdropFilter: 'blur(3px)',
              border: 'none', cursor: 'pointer',
            }}
          />
          <div
            role="dialog"
            aria-label="Menú"
            style={{
              position: 'fixed', left: 0, right: 0, bottom: 58, zIndex: 220,
              background: '#fff',
              borderRadius: '22px 22px 0 0',
              padding: '20px 16px calc(18px + env(safe-area-inset-bottom, 0px))',
              boxShadow: '0 -12px 40px rgba(28,25,23,0.18)',
            }}
          >
            <p style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.18em',
              color: 'var(--pink)', textTransform: 'uppercase', marginBottom: 14,
              paddingLeft: 6,
            }}>
              Menú
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {enHoja.map((item) => {
                const on = active(item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href as never}
                    style={{
                      display: 'flex', alignItems: 'center', minHeight: 48,
                      padding: '0 14px', borderRadius: 14, textDecoration: 'none',
                      fontSize: 13, fontWeight: 700,
                      background: on ? 'var(--pink-wash)' : 'transparent',
                      color: on ? 'var(--pink-deep)' : 'var(--ink)',
                      border: on ? '1.5px solid var(--pink-line)' : '1.5px solid transparent',
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}

              {isAdmin && (
                <Link
                  href={'/admin' as never}
                  style={{
                    display: 'flex', alignItems: 'center', minHeight: 48,
                    padding: '0 14px', borderRadius: 14, textDecoration: 'none',
                    fontSize: 13, fontWeight: 700,
                    background: pathname.startsWith('/admin') ? '#1c1917' : 'transparent',
                    color: pathname.startsWith('/admin') ? '#fff' : 'var(--ink)',
                    border: '1.5px solid #1c1917',
                    gridColumn: '1 / -1',
                  }}
                >
                  Backstage
                </Link>
              )}
            </div>
          </div>
        </>
      )}

      <nav
        className="mobile-dash-nav"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 230,
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--pink-soft)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          boxShadow: '0 -4px 24px rgba(230,79,85,0.07)',
        }}
      >
        <div style={{ display: 'flex', height: 58 }}>
          {enBarra.map((item) => {
            const on = active(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href as never}
                style={{
                  ...itemBase,
                  color: on ? 'var(--pink)' : 'var(--muted)',
                  borderTop: on ? '2px solid var(--pink)' : '2px solid transparent',
                }}
              >
                {item.label}
              </Link>
            );
          })}

          <button
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            aria-label="Abrir menú completo"
            style={{
              ...itemBase,
              background: 'none', cursor: 'pointer',
              fontFamily: 'inherit',
              color: abierto || menuActivo ? 'var(--pink)' : 'var(--muted)',
              borderTop: abierto || menuActivo ? '2px solid var(--pink)' : '2px solid transparent',
              borderLeft: 'none', borderRight: 'none', borderBottom: 'none',
            }}
          >
            {abierto ? 'Cerrar' : 'Menú'}
          </button>
        </div>
      </nav>
    </>
  );
}
