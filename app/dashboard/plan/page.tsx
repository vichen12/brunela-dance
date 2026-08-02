import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { getSubscriptionCatalog } from "@/src/lib/stripe/catalog";
import { PlanClient } from "@/components/plan-client";

export const dynamic = "force-dynamic";

type MembershipTier = "none" | "corps_de_ballet" | "solista" | "principal";

export default async function PlanPage() {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [profile, { data: subscription }, catalog] = await Promise.all([
    getCurrentProfile(user.id),
    supabase.from("subscriptions").select("status, current_period_ends_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle<{ status: string; current_period_ends_at: string | null }>(),
    getSubscriptionCatalog(),
  ]);

  return (
    <PlanClient
      currentTier={profile?.membership_tier ?? "none"}
      subscriptionStatus={subscription?.status ?? null}
      renewsAt={subscription?.current_period_ends_at ?? null}
      catalog={catalog}
    />
  );
}
