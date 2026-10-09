"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Eye, Menu } from "lucide-react";

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
    <header className="ah">
      <div className="ah-izq">
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
        <Link href="/admin" className="ah-raiz">Panel</Link>
        <ChevronRight size={14} strokeWidth={2.2} className="ah-sep" aria-hidden="true" />
        <span className="ah-titulo">{title}</span>
      </div>
      <div className="ah-der">
        <Link href="/dashboard" className="ah-vista">
          <Eye size={15} strokeWidth={2} aria-hidden="true" />
          <span>Ver como alumna</span>
        </Link>
        <span className="ah-avatar" aria-hidden="true">{inicial}</span>
      </div>
    </header>
  );
}
