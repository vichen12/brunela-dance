import Link from "next/link";
import { signOutAction } from "@/src/features/auth/actions";
import { requireUser } from "@/src/features/auth/guards";
import { getDictionary } from "@/src/i18n/messages";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const copy = getDictionary("es");
export const dynamic = "force-dynamic";

type DashboardProfile = {
  full_name: string | null;
  membership_tier: "none" | "corps_de_ballet" | "solista" | "principal";
  onboarding_completed: boolean;
  is_admin: boolean;
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

const tierLabels: Record<DashboardProfile["membership_tier"], string> = {
  none: "Sin plan activo",
  corps_de_ballet: "Corps de Ballet",
  solista: "Solista",
  principal: "Principal"
};

const dashboardMoments = [
  {
    label: "Continuidad",
    title: "Resume tu practica",
    body: "La alumna siempre vuelve al punto exacto donde dejo la clase."
  },
  {
    label: "Biblioteca",
    title: "Curaduria elegante",
    body: "Videos, programas y sesiones en vivo viven en una experiencia de estudio, no de plataforma fria."
  }
];

export default async function DashboardPage() {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [{ data: profile }, { data: subscription }, { data: resume }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, membership_tier, onboarding_completed, is_admin")
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

  const membershipTier = profile?.membership_tier ?? "none";
  const profileName = profile?.full_name ?? user.email ?? copy.dashboard.defaultName;
  const resumeTitle =
    resume?.videos?.title_i18n?.es ?? resume?.videos?.title_i18n?.en ?? copy.dashboard.resumeFallback;
  const resumeProgress = Math.max(8, Math.min(100, Number(resume?.completion_percent ?? 0)));

  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">
        <header className="hero-stage">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="studio-chip">{copy.dashboard.kicker}</span>
              <h1 className="display mt-8 text-5xl leading-none md:text-7xl">{copy.dashboard.greeting(profileName)}</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[color:var(--ink-soft)] md:text-lg">
                Un espacio privado para sostener la practica, volver a la ultima clase y crecer dentro de una
                experiencia de estudio online premium.
              </p>
            </div>

            <form action={signOutAction}>
              <button className="button-secondary" type="submit">
                {copy.dashboard.signOut}
              </button>
            </form>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <article className="soft-stat p-5">
              <p className="eyebrow">{copy.dashboard.membershipLabel}</p>
              <p className="display mt-4 text-4xl leading-none">{tierLabels[membershipTier]}</p>
              <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">{copy.dashboard.membershipHint}</p>
            </article>

            <article className="soft-stat p-5">
              <p className="eyebrow">{copy.dashboard.subscriptionLabel}</p>
              <p className="display mt-4 text-4xl leading-none capitalize">
                {subscription?.status ?? copy.dashboard.noSubscription}
              </p>
              <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                {subscription?.current_period_ends_at
                  ? copy.dashboard.renewsAt(subscription.current_period_ends_at)
                  : copy.dashboard.subscriptionHint}
              </p>
            </article>

            <article className="soft-stat p-5">
              <p className="eyebrow">{copy.dashboard.onboardingLabel}</p>
              <p className="display mt-4 text-4xl leading-none">
                {profile?.onboarding_completed ? copy.common.ready : copy.common.pending}
              </p>
              <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">{copy.dashboard.onboardingHint}</p>
            </article>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
          <article className="panel rounded-[2.4rem] p-7 md:p-9">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="eyebrow">{copy.dashboard.resumeEyebrow}</p>
                <h2 className="display mt-4 text-4xl md:text-5xl">{copy.dashboard.resumeTitle}</h2>
              </div>
              <span className="studio-chip">Member studio</span>
            </div>

            {resume ? (
              <div className="mt-8 rounded-[2rem] border border-[rgba(118,92,113,0.08)] bg-gradient-to-br from-[#fffdfd] via-[#fff4f6] to-[#ffe8ee] p-6 md:p-7">
                <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="eyebrow">Now playing</p>
                    <h3 className="display mt-3 text-3xl">{resumeTitle}</h3>
                    <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">
                      {copy.dashboard.resumeMeta(
                        Math.floor(resume.max_position_seconds),
                        Math.floor(Number(resume.completion_percent))
                      )}
                    </p>
                  </div>
                  <button className="button-primary" type="button">
                    {copy.dashboard.resumeButton}
                  </button>
                </div>

                <div className="mt-6 h-3 overflow-hidden rounded-full bg-[rgba(89,101,123,0.08)]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#eb8d95,#d96977)]"
                    style={{ width: `${resumeProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-8 rounded-[2rem] border border-dashed border-[rgba(118,92,113,0.14)] bg-[rgba(255,255,255,0.52)] p-6 text-sm leading-7 text-[color:var(--ink-soft)]">
                {copy.dashboard.resumeEmpty}
              </div>
            )}

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {dashboardMoments.map((item) => (
                <div key={item.title} className="feature-tile">
                  <p className="eyebrow">{item.label}</p>
                  <h3 className="display mt-5 text-3xl">{item.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">{item.body}</p>
                </div>
              ))}
            </div>
          </article>

          <aside className="space-y-6">
            <article className="panel rounded-[2.4rem] p-7 md:p-9">
              <p className="eyebrow">{copy.dashboard.quickAccessEyebrow}</p>
              <h2 className="display mt-4 text-4xl">{copy.dashboard.quickAccessTitle}</h2>
              <div className="mt-8 space-y-4">
                {profile?.is_admin ? (
                  <Link className="feature-tile block" href="/admin">
                    <p className="eyebrow">Admin</p>
                    <p className="display mt-4 text-3xl">{copy.dashboard.quickAccessAdmin}</p>
                    <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                      {copy.dashboard.quickAccessAdminBody}
                    </p>
                  </Link>
                ) : null}

                <div className="feature-tile">
                  <p className="eyebrow">Next</p>
                  <p className="display mt-4 text-3xl">{copy.dashboard.quickAccessLibrary}</p>
                  <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                    {copy.dashboard.quickAccessLibraryBody}
                  </p>
                </div>
              </div>
            </article>

            <article className="panel rounded-[2.4rem] p-7 md:p-9">
              <p className="eyebrow">Studio mood</p>
              <h2 className="display mt-4 text-4xl">Tu practica merece una interfaz que acompanie.</h2>
              <p className="mt-5 text-sm leading-7 text-[color:var(--ink-soft)]">
                El dashboard ahora ya se siente como un estudio privado. Desde aca la siguiente capa natural es la
                biblioteca filtrable, el player y el onboarding completo.
              </p>
            </article>
          </aside>
        </section>
      </section>
    </main>
  );
}
