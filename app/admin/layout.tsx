import { requireAdmin } from "@/src/features/auth/guards";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminHeader } from "@/components/admin-header";
import { fuenteSistema } from "@/src/lib/fuente-sistema";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireAdmin();
  const nombre =
    profile?.full_name?.trim().split(/\s+/)[0] || user.email?.split("@")[0] || "admin";

  // overflow-x: clip y no hidden: hidden rompe position: sticky de adentro.
  //
  // EL MENU EN PANTALLAS CHICAS: el panel no tenia version movil y el menu
  // de 268 px dejaba el contenido en una columna de dos palabras. Debajo de
  // 900 px el menu se esconde y entra deslizando. El interruptor es un
  // checkbox (#menu-admin) que la cabecera abre y el velo cierra: CSS puro,
  // sin volver de cliente este layout. Estilos en globals.css (.adm-*).
  return (
    <div className={`adm-raiz sistema ${fuenteSistema.variable}`} style={{ display: "flex", minHeight: "100vh", overflowX: "clip" }}>
      <input type="checkbox" id="menu-admin" className="adm-toggle" tabIndex={-1} aria-hidden="true" />
      <label htmlFor="menu-admin" className="adm-velo" aria-hidden="true" />
      <div className="adm-lateral">
        <AdminSidebar nombre={nombre} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <AdminHeader inicial={(nombre[0] ?? "A").toUpperCase()} />
        <div className="zona-app adm-contenido" style={{ flex: 1, padding: "32px 36px", overflowX: "hidden" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
