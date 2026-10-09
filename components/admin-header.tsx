"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

const ROUTES: Record<string, string> = {
  "/admin":               "Resumen",
  "/admin/videos":        "Clases",
  "/admin/categories":    "Categorías",
  "/admin/programs":      "Planes de trabajo",
  "/admin/documents":     "Documentos",
  "/admin/users":         "Alumnas",
  "/admin/live":          "Sesiones en vivo",
  "/admin/chat":          "Chat",
  "/admin/announcements": "Anuncios",
  "/admin/packs":         "Packs",
  "/admin/precios":       "Precios",
  "/admin/settings":      "Configuración",
  "/admin/portada":       "Portada",
  "/admin/analiticas":    "Analíticas",
};

export function AdminHeader({ inicial }: { inicial: string }) {
  const pathname = usePathname();
  // Una ficha (/admin/users/abc) toma el nombre de su seccion: antes caia
  // en "Backstage", que no es el nombre de nada.
  const title = ROUTES[pathname] ?? ROUTES[pathname.split("/").slice(0, 3).join("/")] ?? "Panel";

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 20,
      background: "rgba(250,249,248,0.97)", backdropFilter: "blur(12px)",
      borderBottom: "1px solid #ece9e6",
      height: 52, padding: "0 clamp(14px, 3vw, 36px)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
        {/* Abre el menu en pantallas chicas (checkbox #menu-admin del layout).
            Un <label> no recibe foco, por eso el role y el manejo de teclado. */}
        <label
          htmlFor="menu-admin"
          className="adm-hamb"
          role="button"
          tabIndex={0}
          aria-label="Abrir el menú"
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            const t = document.getElementById("menu-admin") as HTMLInputElement | null;
            if (t) t.checked = !t.checked;
          }}
        >
          <Menu size={20} strokeWidth={2} />
        </label>
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
          Vista alumna
        </Link>
        <div style={{
          width: 30, height: 30, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--rose), var(--pink-mid))",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 800, fontFamily: "var(--font-display), serif" }}>{inicial}</span>
        </div>
      </div>
    </header>
  );
}
