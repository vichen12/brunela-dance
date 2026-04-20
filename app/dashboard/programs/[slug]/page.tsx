import Link from "next/link";
import { notFound } from "next/navigation";
import { StudioNav } from "@/components/studio-nav";
import {
  formatDurationLabel,
  membershipTierLabel,
  resolveI18nText,
  type MembershipTier
} from "@/src/features/studio/helpers";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

type Params = Promise<{ slug: string }>;

type ProgramRecord = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  membership_tier_required: MembershipTier;
  duration_days: number;
  cover_image_url: string | null;
};

type ProgramDayRecord = {
  day_number: number;
  video_id: string;
  videos:
    | {
        slug: string;
        title_i18n: Record<string, string>;
        duration_seconds: number;
      }
    | {
        slug: string;
        title_i18n: Record<string, string>;
        duration_seconds: number;
      }[]
    | null;
};

type ProgressRecord = {
  video_id: string;
  program_day_number: number | null;
  is_completed: boolean;
  completion_percent: number;
};

export default async function DashboardProgramDetailPage({ params }: { params: Params }) {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { slug } = await params;

  const { data: program, error: programError } = await supabase
    .from("programs")
    .select("id, slug, title_i18n, description_i18n, membership_tier_required, duration_days, cover_image_url")
    .eq("slug", slug)
    .maybeSingle<ProgramRecord>();

  if (programError || !program) {
    notFound();
  }

  const [{ data: daysData }, { data: progressData }] = await Promise.all([
    supabase
      .from("program_days")
      .select("day_number, video_id, videos(slug, title_i18n, duration_seconds)")
      .eq("program_id", program.id)
      .order("day_number", { ascending: true }),
    supabase
      .from("user_progress")
      .select("video_id, program_day_number, is_completed, completion_percent")
      .eq("user_id", user.id)
      .eq("program_id", program.id)
  ]);

  const days = (daysData ?? []) as ProgramDayRecord[];
  const progressRows = (progressData ?? []) as ProgressRecord[];
  const progressMap = new Map<number, ProgressRecord>();

  for (const item of progressRows) {
    if (item.program_day_number) {
      progressMap.set(item.program_day_number, item);
    }
  }

  const nextDay = days.find((day) => !progressMap.get(day.day_number)?.is_completed) ?? days[0] ?? null;

  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">
        <StudioNav current="programs" />

        <Link className="button-secondary" href="/dashboard/programs">
          Volver a programas
        </Link>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="hero-stage">
            <div
              className="min-h-[18rem] rounded-[2rem] border border-[rgba(var(--border-rgb),0.32)] bg-cover bg-center"
              style={{
                backgroundColor: "rgba(238, 225, 228, 0.85)",
                backgroundImage: program.cover_image_url ? `url(${program.cover_image_url})` : undefined
              }}
            />

            <div className="mt-8 flex flex-wrap gap-2">
              <span className="studio-chip">{membershipTierLabel(program.membership_tier_required)}</span>
              <span className="studio-chip">{program.duration_days} dias</span>
              <span className="studio-chip">{days.length} clases</span>
            </div>

            <h1 className="display mt-6 text-5xl leading-none md:text-7xl">{resolveI18nText(program.title_i18n)}</h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-[color:var(--ink-soft)] md:text-lg">
              {resolveI18nText(program.description_i18n) || "Descripcion pendiente en admin."}
            </p>
          </article>

          <aside className="space-y-6">
            <article className="panel rounded-[2.4rem] p-7 md:p-9">
              <p className="eyebrow">Continuar</p>
              <h2 className="display mt-4 text-4xl">Siguiente paso</h2>
              <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                El programa ya enlaza cada dia con una clase concreta y guarda progreso por contexto de programa.
              </p>

              {nextDay ? (
                <Link
                  className="button-primary mt-6"
                  href={`/dashboard/library/${Array.isArray(nextDay.videos) ? nextDay.videos[0]?.slug : nextDay.videos?.slug}?programId=${program.id}&day=${nextDay.day_number}`}
                >
                  Ir al dia {nextDay.day_number}
                </Link>
              ) : (
                <p className="mt-6 rounded-[1.5rem] border border-[rgba(118,92,113,0.12)] bg-[rgba(255,255,255,0.72)] px-4 py-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                  Todavia no hay dias configurados para este programa.
                </p>
              )}
            </article>
          </aside>
        </section>

        <section className="panel rounded-[2.4rem] p-7 md:p-9">
          <p className="eyebrow">Calendario interno</p>
          <h2 className="display mt-4 text-4xl">Dia por dia</h2>

          <div className="mt-8 grid gap-4">
            {days.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-[rgba(118,92,113,0.14)] bg-[rgba(255,255,255,0.52)] p-6 text-sm leading-7 text-[color:var(--ink-soft)]">
                Este programa todavia no tiene dias armados en admin.
              </div>
            ) : null}

            {days.map((day) => {
              const video = Array.isArray(day.videos) ? day.videos[0] : day.videos;
              if (!video) return null;

              const progress = progressMap.get(day.day_number);
              const isCompleted = progress?.is_completed ?? false;
              const progressPercent = Math.max(0, Math.min(100, Number(progress?.completion_percent ?? 0)));

              return (
                <Link
                  key={`${day.day_number}-${day.video_id}`}
                  className="feature-tile block"
                  href={`/dashboard/library/${video.slug}?programId=${program.id}&day=${day.day_number}`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="eyebrow">Dia {day.day_number}</p>
                      <h3 className="display mt-4 text-3xl">{resolveI18nText(video.title_i18n)}</h3>
                      <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">
                        {formatDurationLabel(video.duration_seconds)} · {isCompleted ? "Completado" : "En curso"}
                      </p>
                    </div>

                    <span className="studio-chip">{progressPercent}%</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
