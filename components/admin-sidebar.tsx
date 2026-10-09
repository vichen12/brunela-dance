"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { signOutAction } from "@/src/features/auth/actions";
import type { Route } from "next";
import {
  ChartColumn,
  LayoutGrid, Play, Grid2x2, AlignLeft, FileText, Users, CalendarDays,
  MessageCircleHeart, Shield, Megaphone, Settings, LogOut, Tag, Package, Home, Plus,
  Lock, UserPlus,
} from "lucide-react";

/**
 * Menú del panel de administración.
 *
 * POR QUE SE REESCRIBIO
 *   Era visualmente otro producto que el menú de miembro: 220px contra 268,
 *   marca chica sobre un separador, items cuadrados de 13px, encabezados de
 *   seccion en gris, sin accion principal y sin bloque de identidad. Pasar del
 *   estudio al panel se sentia como salir del producto.
 *
 *   Ahora comparte el mismo lenguaje: wordmark grande en coral, items en
 *   pildora con el activo en --pink-wash, una accion principal arriba y el
 *   bloque de identidad abajo.
 *
 *   Los iconos pasan a lucide-react, que ya estaba instalado. Los trazos que
 *   habia estaban dibujados a mano uno por uno: no eran consistentes entre si
 *   ni con el resto del producto.
 */

type NavItem = { href: string; exact?: boolean; label: string; Icon: typeof LayoutGrid };

const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Estudio",
    items: [
      { href: "/admin", exact: true, label: "Resumen", Icon: LayoutGrid },
      { href: "/admin/analiticas", label: "Analíticas", Icon: ChartColumn },
    ],
  },
  {
    label: "Contenido",
    items: [
      { href: "/admin/videos",     label: "Clases",     Icon: Play },
      { href: "/admin/categories", label: "Categorías", Icon: Grid2x2 },
      { href: "/admin/programs",   label: "Planes de trabajo",  Icon: AlignLeft },
      { href: "/admin/documents",  label: "Documentos", Icon: FileText },
      { href: "/admin/packs",      label: "Packs",      Icon: Package },
      // La portada va en Contenido y no en Ajustes a proposito: lo que se edita
      // ahi -- FAQ, trailer, certificados -- es contenido que ve la visitante,
      // no una regla de como se comporta el sistema.
      { href: "/admin/portada",    label: "Portada",    Icon: Home },
    ],
  },
  {
    label: "Comunidad",
    items: [
      { href: "/admin/users",         label: "Alumnas",          Icon: Users },
      // Crear una alumna vivia solo en un bloque plegado de /admin/users, y la
      // duena no lo encontraba. Abre ese bloque ya desplegado.
      { href: "/admin/users?nueva=1#nueva", label: "Nueva alumna", Icon: UserPlus },
      { href: "/admin/sesiones-privadas", label: "Sesiones privadas", Icon: Lock },
      { href: "/admin/live",          label: "Sesiones en vivo", Icon: CalendarDays },
      // Mensajes y Comunidad vivian mezclados en /dashboard/chat y
      // /dashboard/community (la admin veia ahi la bandeja y las herramientas).
      // /dashboard es ahora solo la vista de alumna; gestionar vive aca.
      { href: "/admin/mensajes",      label: "Mensajes",         Icon: MessageCircleHeart },
      { href: "/admin/comunidad",     label: "Comunidad",        Icon: Users },
      { href: "/admin/chat",          label: "Moderación",       Icon: Shield },
      { href: "/admin/announcements", label: "Anuncios",         Icon: Megaphone },
    ],
  },
  {
    label: "Ajustes",
    items: [
      { href: "/admin/precios",  label: "Precios",       Icon: Tag },
      { href: "/admin/settings", label: "Configuración", Icon: Settings },
    ],
  },
];

/**
 * `nombre` es el de quien entro: hay tres cuentas admin y antes las tres
 * leian "BRUNELA" al pie del menu.
 */
export function AdminSidebar({ nombre, foto }: { nombre: string; foto?: string | null }) {
  const pathname = usePathname();

  // En pantallas chicas el menu es un cajon: se cierra al navegar.
  useEffect(() => {
    const t = document.getElementById("menu-admin") as HTMLInputElement | null;
    if (t) t.checked = false;
  }, [pathname]);

  // Y con Escape, como cualquier cajon.
  useEffect(() => {
    const cerrar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = document.getElementById("menu-admin") as HTMLInputElement | null;
      if (t?.checked) t.checked = false;
    };
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, []);

  const isActive = (href: string, exact?: boolean) => {
    // Un item con query (Nueva alumna) no se marca: comparte ruta con Alumnas.
    if (href.includes("?")) return false;
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <aside className="sb" aria-label="Menú de administración">
      <Link href={"/admin" as Route} className="sb-marca">
        <span className="sb-marca-ico">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/isologo-icon.png" alt="" />
        </span>
        <span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/brunela-dance-trainer-wordmark.png" alt="Brunela Dance Trainer" className="sb-marca-wm" />
          <span className="sb-marca-sub" style={{ display: "block" }}>Panel del estudio</span>
        </span>
      </Link>

      {/* Accion principal: el equivalente a "Explorar clases" del lado alumna */}
      <Link href={"/admin/videos?nueva=1#nueva" as Route} className="sb-cta">
        <span className="sb-cta-ico"><Plus size={15} strokeWidth={2.8} aria-hidden="true" /></span>
        Subir una clase
      </Link>

      <nav className="sb-nav">
        {NAV.map((grupo) => (
          <div key={grupo.label} className="sb-grupo">
            <p className="sb-grupo-titulo">{grupo.label}</p>
            {grupo.items.map(({ href, exact, label, Icon }) => {
              const active = isActive(href, exact);
              return (
                <Link key={href} href={href as Route} className={"sb-item" + (active ? " es-activo" : "")} aria-current={active ? "page" : undefined}>
                  <span className="sb-item-ico"><Icon size={18} strokeWidth={active ? 2.3 : 1.9} aria-hidden="true" /></span>
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sb-pie">
        {/* "Ver como alumna" vive en la cabecera: aca restaba alto a un menu de 14 items. */}
        <div className="sb-perfil">
          <Link href={"/admin/perfil" as Route} className="sb-avatar" title="Mi perfil" aria-label="Mi perfil">
            {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt="" className="sb-avatar-img" />
          ) : (nombre.trim()[0] ?? "A").toUpperCase()}
          </Link>
          <div className="sb-perfil-txt">
            <p className="sb-perfil-nombre" style={{ textTransform: "capitalize" }}>{nombre}</p>
            <span className="sb-perfil-plan">Administración</span>
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
