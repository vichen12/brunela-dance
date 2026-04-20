import Link from "next/link";
import { StudioNav } from "@/components/studio-nav";
import {
  membershipTierLabel,
  resolveI18nText,
  safePercent,
  type MembershipTier,
  type ProgramStatus
} from "@/src/features/studio/helpers";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

type ProgramRecord = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  membership_tier_required: MembershipTier;
  duration_days: number;
  cover_image_url: string | null;
  is_featured: boolean;
  status: ProgramStatus;
};

type ProgramDayRecord = {
  program_id: string;
};

type ProgressRecord = {
  program_id: string | null;
  completion_percent: number;
  is_completed: boolean;
};

export default async function DashboardProgramsPage() {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [{ data: programsData }, { data: daysData }, { data: progressData }] = await Promise.all([
    supabase
      .from("programs")
      .select("id, slug, title_i18n, description_i18n, membership_tier_required, duration_days, cover_image_url, is_featured, status")
      .order("is_featured", { ascending: false })
      .order("published_at", { ascending: false }),
    supabase.from("program_days").select("program_id"),
    supabase
      .from("user_progress")
      .select("program_id, completion_percent, is_completed")
      .eq("user_id", user.id)
      .not("program_id", "is", null)
  ]);

  const programs = (programsData ?? []) as ProgramRecord[];
  const days = (daysData ?? []) as ProgramDayRecord[];
  const progressRows = (progressData ?? []) as ProgressRecord[];

  const daysByProgram = new Map<string, number>();
  for (const day of days) {
    daysByProgram.set(day.program_id, (daysByProgram.get(day.program_id) ?? 0) + 1);
  }

  const progressByProgram = new Map<
    string,
    {
      completedDays: number;
      maxPercent: number;
    }
  >();

  for (const progress of progressRows) {
    if (!progress.program_id) continue;

    const current = progressByProgram.get(progress.program_id) ?? {
      completedDays: 0,
      maxPercent: 0
    };

    current.maxPercent = Math.max(current.maxPercent, safePercent(progress.completion_percent));
    if (progress.is_completed) {
      current.completedDays += 1;
    }

    progressByProgram.set(progress.program_id, current);
  }

  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">
        <StudioNav current="programs" />

        <header className="hero-stage">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="studio-chip">Programas</span>
              <h1 className="display mt-8 text-5xl leading-none md:text-7xl">Recorridos con estructura.</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[color:var(--ink-soft)] md:text-lg">
                Aca viven las secuencias de dias, con progreso visible por programa y acceso atado a membresia.
              </p>
            </div>

            <div className="soft-stat min-w-[16rem] p-5">
              <p className="eyebrow">Activos</p>
              <p className="display mt-4 text-4xl leading-none">{programs.length}</p>
              <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                Programas listos para continuar desde tu dashboard.
              </p>
            </div>
          </div>
        </header>

        <section className="panel rounded-[2.4rem] p-7 md:p-9">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Secuencias</p>
              <h2 className="display mt-4 text-4xl">Entrena sin perder el hilo</h2>
            </div>
            <span className="studio-chip">Studio roadmap</span>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {programs.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-[rgba(118,92,113,0.14)] bg-[rgba(255,255,255,0.52)] p-6 text-sm leading-7 text-[color:var(--ink-soft)]">
                Todavia no hay programas publicados para tu plan.
              </div>
            ) : null}

            {programs.map((program) => {
              const progress = progressByProgram.get(program.id);
              const totalDays = daysByProgram.get(program.id) ?? 0;
              const completedDays = progress?.completedDays ?? 0;
              const progressPercent =
                totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : progress?.maxPercent ?? 0;

              return (
                <Link
                  key={program.id}
                  className="feature-tile flex h-full flex-col gap-5 rounded-[2rem] border border-[rgba(var(--border-rgb),0.42)] bg-[rgba(255,255,255,0.88)] p-5"
                  href={`/dashboard/programs/${program.slug}`}
                >
                  <div
                    className="min-h-[12rem] rounded-[1.7rem] border border-[rgba(var(--border-rgb),0.3)] bg-cover bg-center"
                    style={{
                      backgroundColor: "rgba(238, 225, 228, 0.85)",
                      backgroundImage: program.cover_image_url ? `url(${program.cover_image_url})` : undefined
                    }}
                  />

                  <div className="flex flex-wrap gap-2">
                    <span className="studio-chip">{membershipTierLabel(program.membership_tier_required)}</span>
                    <span className="studio-chip">{program.duration_days} dias</span>
                    {program.is_featured ? <span className="studio-chip">Featured</span> : null}
                  </div>

                  <div>
                    <h3 className="display text-3xl">{resolveI18nText(program.title_i18n)}</h3>
                    <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">
                      {resolveI18nText(program.description_i18n) || "Descripcion pendiente en admin."}
                    </p>
                  </div>

                  <div className="mt-auto">
                    <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--ink-soft)]">
                      <span>
                        {completedDays}/{Math.max(totalDays, 0)} dias completos
                      </span>
                      <span>{safePercent(progressPercent)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[rgba(89,101,123,0.08)]">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#eb8d95,#d96977)]"
                        style={{ width: `${safePercent(progressPercent)}%` }}
                      />
                    </div>
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
