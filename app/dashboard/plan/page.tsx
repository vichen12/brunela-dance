import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { PlanClient } from "@/components/plan-client";

export const dynamic = "force-dynamic";

type MembershipTier = "none" | "corps_de_ballet" | "solista" | "principal";

export default async function PlanPage() {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from("profiles").select("membership_tier").eq("id", user.id).single<{ membership_tier: MembershipTier }>(),
    supabase.from("subscriptions").select("status, current_period_ends_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle<{ status: string; current_period_ends_at: string | null }>(),
  ]);

  return (
    <PlanClient
      currentTier={profile?.membership_tier ?? "none"}
      subscriptionStatus={subscription?.status ?? null}
      renewsAt={subscription?.current_period_ends_at ?? null}
    />
  );
}
