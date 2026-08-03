"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ROUTES: Record<string, string> = {
  "/admin":               "Dashboard",
  "/admin/videos":        "Videos",
  "/admin/categories":    "Categorías",
  "/admin/programs":      "Programas",
  "/admin/documents":     "Documentos",
  "/admin/users":         "Alumnas",
  "/admin/live":          "Sesiones en vivo",
  "/admin/chat":          "Chat",
  "/admin/announcements": "Anuncios",
  "/admin/settings":      "Configuración",
};

export function AdminHeader() {
  const pathname = usePathname();
  const title = ROUTES[pathname] ?? "Admin";

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 20,
      background: "rgba(250,249,248,0.97)", backdropFilter: "blur(12px)",
      borderBottom: "1px solid #ece9e6",
      height: 52, padding: "0 36px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ fontSize: 11, color: "#c4b5af", fontWeight: 600, letterSpacing: "0.04em" }}>Admin</span>
        <span style={{ fontSize: 11, color: "#d6d3d1" }}>›</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1c1917" }}>{title}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/dashboard" style={{
          fontSize: 11, fontWeight: 600, color: "#78716c",
          textDecoration: "none", padding: "5px 14px",
          borderRadius: 99, background: "#fff",
          border: "1px solid #e7e5e4",
          transition: "background 0.12s",
        }}>
          Vista alumna ↗
        </Link>
        <div style={{
          width: 30, height: 30, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--rose), var(--pink-mid))",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 800, fontFamily: "var(--font-display), serif" }}>B</span>
        </div>
      </div>
    </header>
  );
}
