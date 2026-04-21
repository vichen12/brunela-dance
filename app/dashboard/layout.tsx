import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { StudioSidebar } from "@/components/studio-sidebar";
import { MobileDashboardNav } from "@/components/mobile-dashboard-nav";

type MembershipTier = "none" | "corps_de_ballet" | "solista" | "principal";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, membership_tier, is_admin")
    .eq("id", user.id)
    .single<{ full_name: string | null; membership_tier: MembershipTier; is_admin: boolean }>();

  const userName = profile?.is_admin
    ? "BRUNELA"
    : (profile?.full_name?.split(" ")[0]?.toUpperCase() ??
       (user.email?.split("@")[0] ?? "ALUMNA").toUpperCase());

  const isAdmin = profile?.is_admin ?? false;

  return (
    <>
      <style>{`
        .site-navbar { display: none !important; }
        .mobile-dash-nav { display: none; }
        @media (max-width: 767px) {
          .studio-sidebar-wrapper { display: none !important; }
          .mobile-dash-nav { display: block !important; }
          .dashboard-content { padding-bottom: 74px !important; }
          .chat-col-sidebar { display: none !important; }
        }
      `}</style>
      <div style={{ display: "flex", minHeight: "100vh", background: "linear-gradient(160deg, #FDF8F6 0%, #FAF3F0 60%, #FDF6F4 100%)" }}>
        <div className="studio-sidebar-wrapper">
          <StudioSidebar
            userName={userName}
            membershipTier={profile?.membership_tier ?? "none"}
            isAdmin={isAdmin}
          />
        </div>
        <div className="dashboard-content" style={{ flex: 1, minWidth: 0, overflowX: "hidden" }}>
          {children}
        </div>
      </div>
      <MobileDashboardNav isAdmin={isAdmin} />
    </>
  );
}
