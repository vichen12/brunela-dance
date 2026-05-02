"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/src/features/auth/actions";
import type { Route } from "next";

function Ico({ d, d2 }: { d: string; d2?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {d2 && <path d={d2} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

const NAV = [
  {
    label: "GENERAL",
    items: [
      { href: "/admin", exact: true, label: "Dashboard",
        d: "M2 2h5v5H2V2zm7 0h5v5H9V2zM2 9h5v5H2V9zm7 0h5v5H9V9z" },
    ],
  },
  {
    label: "CONTENIDO",
    items: [
      { href: "/admin/videos",     label: "Videos",     d: "M4.5 3.5L13 8l-8.5 4.5V3.5z" },
      { href: "/admin/categories", label: "Categorias", d: "M2 2h4v4H2V2zm8 0h4v4h-4V2zM2 10h4v4H2v-4zm8 0h4v4h-4v-4z" },
      { href: "/admin/programs",   label: "Programas",  d: "M3 5h10M3 8h10M3 11h6" },
      { href: "/admin/documents",  label: "Documentos", d: "M5 1.5h5.5L14 5V14H5V1.5z", d2: "M10 1.5V5h4" },
    ],
  },
  {
    label: "STUDIO",
    items: [
      { href: "/admin/users", label: "Alumnas",
        d: "M6.5 8a3 3 0 100-6 3 3 0 000 6zm-5 6a5.5 5.5 0 0111 0M12 3.5a2.5 2.5 0 010 5M15 14a4 4 0 00-3-3.8" },
      { href: "/admin/live",  label: "Sesiones en vivo",
        d: "M2 5h12v8H2V5zm3-3v3m6-3v3M5.5 10.5l2-2 2 2 2-2" },
      { href: "/admin/chat",  label: "Chat",
        d: "M2.5 3.5h11c.28 0 .5.22.5.5v6c0 .28-.22.5-.5.5H7L4 13V10.5H2.5c-.28 0-.5-.22-.5-.5V4c0-.28.22-.5.5-.5z" },
      { href: "/admin/announcements", label: "Anuncios",
        d: "M13 2H3a1 1 0 00-1 1v8a1 1 0 001 1h2v2.5l3-2.5h5a1 1 0 001-1V3a1 1 0 00-1-1zM5 6h6M5 8.5h4" },
    ],
  },
  {
    label: "SISTEMA",
    items: [
      { href: "/admin/settings", label: "Settings",
        d: "M8 10a2 2 0 100-4 2 2 0 000 4zM8 2v1.5M8 12.5V14M2 8H3.5M12.5 8H14M3.88 3.88l1.06 1.06M11.06 11.06l1.06 1.06M3.88 12.12l1.06-1.06M11.06 4.94l1.06-1.06" },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: "#fff",
      borderRight: "1.5px solid #f5f0ef",
      display: "flex", flexDirection: "column",
      height: "100vh", position: "sticky", top: 0,
      overflow: "hidden",
    }}>
      {/* Brand */}
      <div style={{ padding: "20px 16px 16px", borderBottom: "1.5px solid #f5f0ef" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg, #f9a8b4, #be185d)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#fff", fontSize: 15, fontWeight: 800, fontFamily: "var(--font-display), serif" }}>B</span>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#1c1917", letterSpacing: "-0.01em", lineHeight: 1.2 }}>Brunela</p>
            <p style={{ fontSize: 10, color: "#a8a29e", fontWeight: 600, letterSpacing: "0.05em", marginTop: 1 }}>Backstage</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "14px 10px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
        {NAV.map((section) => (
          <div key={section.label}>
            <p style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.13em",
              color: "#c4b5af", padding: "0 8px", marginBottom: 3,
              textTransform: "uppercase",
            }}>{section.label}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {section.items.map((item) => {
                const active = isActive(item.href, (item as { exact?: boolean }).exact);
                return (
                  <Link key={item.href} href={item.href as Route} style={{
                    display: "flex", alignItems: "center", gap: 9,
                    padding: "7px 9px", borderRadius: 8, textDecoration: "none",
                    background: active ? "#fdf2f8" : "transparent",
                    color: active ? "#be185d" : "#78716c",
                    fontWeight: active ? 700 : 500,
                    fontSize: 13,
                    borderLeft: active ? "2px solid #be185d" : "2px solid transparent",
                    transition: "background 0.12s, color 0.12s",
                  }}>
                    <Ico d={item.d} d2={(item as { d2?: string }).d2} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: "10px 10px 14px", borderTop: "1.5px solid #f5f0ef", display: "flex", flexDirection: "column", gap: 1 }}>
        <Link href="/dashboard" style={{
          display: "flex", alignItems: "center", gap: 9,
          padding: "7px 9px", borderRadius: 8, textDecoration: "none",
          color: "#a8a29e", fontSize: 13, fontWeight: 500,
        }}>
          <Ico d="M1.5 8c0-3.59 2.91-6.5 6.5-6.5S14.5 4.41 14.5 8s-2.91 6.5-6.5 6.5S1.5 11.59 1.5 8zm4-2l4 2-4 2V6z" />
          Vista alumna
        </Link>
        <form action={signOutAction}>
          <button type="submit" style={{
            display: "flex", alignItems: "center", gap: 9,
            padding: "7px 9px", borderRadius: 8, width: "100%",
            background: "none", border: "none", cursor: "pointer",
            color: "#a8a29e", fontSize: 13, fontWeight: 500, textAlign: "left",
          }}>
            <Ico d="M11 2h3v12h-3M6.5 11L10 8l-3.5-3M10 8H2" />
            Cerrar sesion
          </button>
        </form>
      </div>
    </aside>
  );
}
