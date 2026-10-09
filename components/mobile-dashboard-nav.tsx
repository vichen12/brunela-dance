'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { CalendarHeart, FileText, House, ListOrdered, Menu, MessageCircleHeart, Package, Play, Settings2, Sparkles, Users, X } from 'lucide-react';

/**
 * Los MISMOS ocho destinos que el sidebar de escritorio. Antes habia cinco y
 * Planes de trabajo, En vivo y Documentos no se podian abrir desde el telefono.
 *
 * POR QUE NO ESTAN LOS OCHO EN LA BARRA DE ABAJO
 *   Ocho mas Admin son nueve columnas. En una pantalla de 375px queda cada una
 *   en ~41px, y "Comunidad" a 9px mide ~45px: se corta o se parte en dos
 *   lineas. Los cuatro mas usados quedan a un toque y el resto vive en la hoja
 *   de "Menu", que ademas da lugar a etiquetas legibles y a objetivos tactiles
 *   comodos.
 */
const NAV = [
  { href: '/dashboard',           label: 'Inicio',     exact: true,  Icon: House },
  { href: '/dashboard/library',   label: 'Clases',     exact: false, Icon: Play },
  { href: '/dashboard/programs',  label: 'Planes de trabajo', exact: false, Icon: ListOrdered },
  { href: '/dashboard/live',      label: 'Clases en vivo', exact: false, Icon: CalendarHeart },
  { href: '/dashboard/chat',      label: 'Mi chat',    exact: false, Icon: MessageCircleHeart },
  { href: '/dashboard/community', label: 'Comunidad',  exact: false, Icon: Users },
  { href: '/dashboard/documents', label: 'Documentos', exact: false, Icon: FileText },
  { href: '/dashboard/plan',      label: 'Mi plan',    exact: false, Icon: Sparkles },
  { href: '/dashboard/packs', label: 'Packs', exact: false, Icon: Package },
];

/** Los que quedan a un toque en la barra. El resto, en la hoja. */
const PRIMARIOS = ['/dashboard', '/dashboard/library', '/dashboard/chat', '/dashboard/community'];

export function MobileDashboardNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);

  // Cerrar al navegar: sin esto la hoja queda abierta sobre la pantalla nueva.
  useEffect(() => { setAbierto(false); }, [pathname]);

  // Escape cierra la hoja de "Mas".
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierto]);

  function active(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  const enBarra = NAV.filter((i) => PRIMARIOS.includes(i.href));
  const enHoja = NAV;
  // Si estas en una pantalla que no esta en la barra, "Menu" se marca activo:
  // asi la navegacion nunca aparece sin ningun item seleccionado.
  const menuActivo = !enBarra.some((i) => active(i.href, i.exact)) && !pathname.startsWith('/admin');

  // Estilos en globals.css (.mn-*).
  return (
    <>
      {abierto && (
        <>
          <button aria-label="Cerrar menú" onClick={() => setAbierto(false)} className="mn-velo" />
          <div role="dialog" aria-label="Menú" className="mn-hoja">
            <span className="mn-asa" aria-hidden="true" />
            <p className="mn-hoja-titulo">¿A dónde vamos?</p>
            <div className="mn-grilla">
              {enHoja.map((item) => {
                const on = active(item.href, item.exact);
                return (
                  <Link key={item.href} href={item.href as never} className={'mn-op' + (on ? ' es-activo' : '')}>
                    <span className="mn-op-ico"><item.Icon size={18} strokeWidth={2} aria-hidden="true" /></span>
                    {item.label}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link href={'/admin' as never} className="mn-op mn-op--admin">
                  <span className="mn-op-ico"><Settings2 size={18} strokeWidth={2} aria-hidden="true" /></span>
                  Panel de admin
                </Link>
              )}
            </div>
          </div>
        </>
      )}

      <nav className="mobile-dash-nav mn-barra" aria-label="Navegación">
        <div className="mn-fila">
          {enBarra.map((item) => {
            const on = active(item.href, item.exact);
            return (
              <Link key={item.href} href={item.href as never} className={'mn-item' + (on ? ' es-activo' : '')} aria-current={on ? 'page' : undefined}>
                <span className="mn-item-ico"><item.Icon size={19} strokeWidth={on ? 2.4 : 2} aria-hidden="true" /></span>
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            aria-label={abierto ? 'Cerrar menú' : 'Abrir menú completo'}
            className={'mn-item' + (abierto || menuActivo ? ' es-activo' : '')}
          >
            <span className="mn-item-ico">{abierto ? <X size={19} strokeWidth={2.2} aria-hidden="true" /> : <Menu size={19} strokeWidth={2} aria-hidden="true" />}</span>
            {abierto ? 'Cerrar' : 'Más'}
          </button>
        </div>
      </nav>
    </>
  );
}
