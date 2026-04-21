import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { StudioSidebar } from "@/components/studio-sidebar";

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

  return (
    <>
      <style>{`.site-navbar { display: none !important; }`}</style>
      <div style={{ display: "flex", minHeight: "100vh", background: "linear-gradient(160deg, #FDF8F6 0%, #FAF3F0 60%, #FDF6F4 100%)" }}>
        <StudioSidebar
          userName={userName}
          membershipTier={profile?.membership_tier ?? "none"}
          isAdmin={profile?.is_admin ?? false}
        />
        <div style={{ flex: 1, minWidth: 0, overflowX: "hidden" }}>
          {children}
        </div>
      </div>
    </>
  );
}
