import { requireAdmin } from "@/src/features/auth/guards";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminHeader } from "@/components/admin-header";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireAdmin();
  const nombre =
    profile?.full_name?.trim().split(/s+/)[0] || user.email?.split("@")[0] || "admin";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#faf9f8" }}>
      <AdminSidebar nombre={nombre} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <AdminHeader inicial={(nombre[0] ?? "A").toUpperCase()} />
        <div className="zona-app" style={{ flex: 1, padding: "32px 36px", overflowX: "hidden" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
