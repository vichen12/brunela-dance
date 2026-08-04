"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/src/features/auth/actions";
import type { Route } from "next";
import {
  ChartColumn,
  LayoutGrid, Play, Grid2x2, AlignLeft, FileText, Users, CalendarDays,
  MessageSquare, Megaphone, Settings, Eye, LogOut,
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
      { href: "/admin/programs",   label: "Programas",  Icon: AlignLeft },
      { href: "/admin/documents",  label: "Documentos", Icon: FileText },
    ],
  },
  {
    label: "Comunidad",
    items: [
      { href: "/admin/users",         label: "Alumnas",          Icon: Users },
      { href: "/admin/live",          label: "Sesiones en vivo", Icon: CalendarDays },
      { href: "/admin/chat",          label: "Chat",             Icon: MessageSquare },
      { href: "/admin/announcements", label: "Anuncios",         Icon: Megaphone },
    ],
  },
  {
    label: "Ajustes",
    items: [{ href: "/admin/settings", label: "Configuración", Icon: Settings }],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  const fila: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 13,
    padding: "11px 14px",
    borderRadius: 12,
    textDecoration: "none",
    fontSize: 14,
    minHeight: 44,
  };

  return (
    <aside style={{
      width: 268,
      flexShrink: 0,
      background: "#FDFBFA",
      borderRight: "1px solid #F1E9E7",
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      position: "sticky",
      top: 0,
    }}>
      {/* Marca — mismo wordmark y escala que el menú de miembro */}
      <div style={{ padding: "34px 22px 22px" }}>
        <Link href={"/admin" as Route} style={{ textDecoration: "none", display: "block" }}>
          <p style={{
            fontFamily: "var(--font-display), sans-serif",
            fontSize: 30, fontWeight: 800, letterSpacing: "0.1em",
            color: "var(--pink)", lineHeight: 1,
          }}>
            BRUNELA
          </p>
          <p style={{
            fontSize: 10, fontWeight: 500, letterSpacing: "0.34em",
            color: "var(--ink)", marginTop: 9, opacity: 0.75,
          }}>
            DANCE TRAINER
          </p>
        </Link>
      </div>

      {/* Acción principal: el equivalente a "Explorar clases" del lado alumna */}
      <div style={{ padding: "0 20px 20px" }}>
        <Link
          href={"/admin/videos" as Route}
          style={{
            ...fila,
            justifyContent: "center", gap: 11,
            padding: "15px 18px", borderRadius: 999,
            background: "var(--pink)", color: "#fff",
            fontWeight: 700, fontSize: 13.5, letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <Play size={16} strokeWidth={2.2} />
          Subir una clase
        </Link>
      </div>

      {/* Navegación */}
      <nav style={{ flex: 1, padding: "0 20px", overflowY: "auto" }}>
        {NAV.map((grupo, gi) => (
          <div key={grupo.label} style={{ marginTop: gi === 0 ? 0 : 18 }}>
            <p style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: "0.18em",
              color: "var(--pink-muted)", textTransform: "uppercase",
              padding: "0 14px", marginBottom: 7,
            }}>
              {grupo.label}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {grupo.items.map(({ href, exact, label, Icon }) => {
                const active = isActive(href, exact);
                return (
                  <Link key={href} href={href as Route} style={{
                    ...fila,
                    background: active ? "var(--pink-wash)" : "transparent",
                    color: active ? "var(--pink)" : "var(--ink)",
                    fontWeight: active ? 700 : 500,
                    transition: "background 0.14s, color 0.14s",
                  }}>
                    <Icon size={17} strokeWidth={active ? 2.2 : 1.8} style={{ flexShrink: 0 }} />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Identidad y salida */}
      <div style={{ padding: "18px 20px 22px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ borderTop: "1px solid #F1E9E7", marginBottom: 12 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "0 4px 12px" }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
            background: "var(--pink-wash)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17, fontWeight: 700, color: "var(--pink)",
          }}>B</div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.01em" }}>
              BRUNELA
            </p>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Backstage</p>
          </div>
        </div>

        <Link href={"/dashboard" as Route} style={{
          ...fila, color: "var(--ink)", fontWeight: 500, background: "var(--pink-wash)",
        }}>
          <Eye size={17} strokeWidth={1.8} style={{ flexShrink: 0 }} />
          Vista alumna
        </Link>

        <form action={signOutAction}>
          <button type="submit" style={{
            ...fila,
            width: "100%", background: "none", border: "none", cursor: "pointer",
            color: "var(--pink)", fontWeight: 600, textAlign: "left",
            fontFamily: "inherit",
          }}>
            <LogOut size={17} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
