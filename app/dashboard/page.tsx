import Link from "next/link";
import { signOutAction } from "@/src/features/auth/actions";
import { requireUser } from "@/src/features/auth/guards";
import { getDictionary } from "@/src/i18n/messages";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const copy = getDictionary("es");

type DashboardProfile = {
  full_name: string | null;
  membership_tier: "none" | "corps_de_ballet" | "solista" | "principal";
  onboarding_completed: boolean;
};

type SubscriptionSnapshot = {
  status: string;
  current_period_ends_at: string | null;
};

type ResumeSnapshot = {
  max_position_seconds: number;
  completion_percent: number;
  updated_at: string;
  videos: {
    title_i18n: Record<string, string>;
    duration_seconds: number;
    slug: string;
  } | null;
};

export default async function DashboardPage() {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [{ data: profile }, { data: subscription }, { data: resume }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, membership_tier, onboarding_completed")
      .eq("id", user.id)
      .single<DashboardProfile>(),
    supabase
      .from("subscriptions")
      .select("status, current_period_ends_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<SubscriptionSnapshot>(),
    supabase
      .from("user_progress")
      .select("max_position_seconds, completion_percent, updated_at, videos(title_i18n, duration_seconds, slug)")
      .eq("user_id", user.id)
      .gt("max_position_seconds", 0)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<ResumeSnapshot>()
  ]);

  const profileName = profile?.full_name ?? user.email ?? copy.dashboard.defaultName;
  const resumeTitle = resume?.videos?.title_i18n?.es ?? resume?.videos?.title_i18n?.en ?? copy.dashboard.resumeFallback;

  return (
    <main className="py-12">
      <section className="page-shell space-y-6">
        <header className="panel rounded-[36px] p-8 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow mb-3">{copy.dashboard.kicker}</p>
              <h1 className="display text-4xl md:text-5xl">{copy.dashboard.greeting(profileName)}</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-ink/70">{copy.dashboard.description}</p>
            </div>

            <form action={signOutAction}>
              <button className="button-secondary" type="submit">
                {copy.dashboard.signOut}
              </button>
            </form>
          </div>
        </header>

        <div className="grid-cards">
          <article className="panel rounded-[28px] p-6">
            <p className="eyebrow">{copy.dashboard.membershipLabel}</p>
            <p className="mt-4 text-2xl font-semibold capitalize">{profile?.membership_tier ?? "none"}</p>
            <p className="mt-2 text-sm text-ink/65">{copy.dashboard.membershipHint}</p>
          </article>

          <article className="panel rounded-[28px] p-6">
            <p className="eyebrow">{copy.dashboard.subscriptionLabel}</p>
            <p className="mt-4 text-2xl font-semibold">{subscription?.status ?? copy.dashboard.noSubscription}</p>
            <p className="mt-2 text-sm text-ink/65">
              {subscription?.current_period_ends_at
                ? copy.dashboard.renewsAt(subscription.current_period_ends_at)
                : copy.dashboard.subscriptionHint}
            </p>
          </article>

          <article className="panel rounded-[28px] p-6">
            <p className="eyebrow">{copy.dashboard.onboardingLabel}</p>
            <p className="mt-4 text-2xl font-semibold">
              {profile?.onboarding_completed ? copy.common.ready : copy.common.pending}
            </p>
            <p className="mt-2 text-sm text-ink/65">{copy.dashboard.onboardingHint}</p>
          </article>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="panel rounded-[32px] p-8">
            <p className="eyebrow mb-3">{copy.dashboard.resumeEyebrow}</p>
            <h2 className="display text-3xl">{copy.dashboard.resumeTitle}</h2>

            {resume ? (
              <div className="mt-6 rounded-[28px] border border-black/6 bg-white/72 p-6">
                <p className="text-xl font-semibold">{resumeTitle}</p>
                <p className="mt-2 text-sm text-ink/65">
                  {copy.dashboard.resumeMeta(
                    Math.floor(resume.max_position_seconds),
                    Math.floor(Number(resume.completion_percent))
                  )}
                </p>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-black/8">
                  <div
                    className="h-full rounded-full bg-ember"
                    style={{ width: `${Math.max(8, Number(resume.completion_percent))}%` }}
                  />
                </div>
                <button className="button-primary mt-6">{copy.dashboard.resumeButton}</button>
              </div>
            ) : (
              <div className="mt-6 rounded-[28px] border border-dashed border-black/10 bg-white/55 p-6 text-sm text-ink/65">
                {copy.dashboard.resumeEmpty}
              </div>
            )}
          </article>

          <article className="panel rounded-[32px] p-8">
            <p className="eyebrow mb-3">{copy.dashboard.quickAccessEyebrow}</p>
            <h2 className="display text-3xl">{copy.dashboard.quickAccessTitle}</h2>
            <div className="mt-6 space-y-4">
              <Link className="block rounded-[26px] border border-black/6 bg-white/78 p-5" href="/admin">
                <p className="font-semibold">{copy.dashboard.quickAccessAdmin}</p>
                <p className="mt-1 text-sm leading-6 text-ink/65">{copy.dashboard.quickAccessAdminBody}</p>
              </Link>

              <div className="rounded-[26px] border border-black/6 bg-white/78 p-5">
                <p className="font-semibold">{copy.dashboard.quickAccessLibrary}</p>
                <p className="mt-1 text-sm leading-6 text-ink/65">{copy.dashboard.quickAccessLibraryBody}</p>
              </div>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
