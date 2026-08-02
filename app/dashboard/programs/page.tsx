import Link from "next/link";
import {
  membershipTierLabel,
  resolveI18nText,
  safePercent,
  type MembershipTier,
  type ProgramStatus
} from "@/src/features/studio/helpers";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getProgresoDelUsuario } from "@/src/features/studio/progress";

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

type VideoDeDia = { recommended_min_level: string | null; category_slugs: string[] | null };

type ProgramDayRecord = {
  program_id: string;
  // PostgREST tipa el embed como arreglo aunque la relacion sea a-uno.
  videos: VideoDeDia | VideoDeDia[] | null;
};

/** Normaliza el embed, venga como objeto o como arreglo de uno. */
function claseDelDia(videos: ProgramDayRecord["videos"]): VideoDeDia | null {
  if (!videos) return null;
  return Array.isArray(videos) ? videos[0] ?? null : videos;
}

const ORDEN_NIVEL = ["principiante", "intermedio", "avanzado", "profesional", "maestro"];

const NIVEL_LABEL: Record<string, string> = {
  principiante: "Principiante",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
  profesional: "Profesional",
  maestro: "Maestro",
};

const FOCO_LABEL: Record<string, string> = {
  ballet: "Tecnica",
  reformer: "Fuerza",
  mat: "Control",
  stretching: "Movilidad",
  pbt: "PBT",
  pct: "PCT",
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
    // Traemos el nivel y la categoria de cada clase del programa: el nivel y el
    // foco que se muestran no son campos de `programs`, se derivan de su
    // contenido real.
    supabase.from("program_days").select("program_id, videos(recommended_min_level, category_slugs)"),
    // Del progreso memoizado, filtrando en memoria las filas de programa.
    getProgresoDelUsuario(user.id).then((filas) => ({
      data: filas.filter((f) => f.program_id !== null),
    }))
  ]);

  const programs = (programsData ?? []) as ProgramRecord[];
  const days = (daysData ?? []) as unknown as ProgramDayRecord[];
  const progressRows = (progressData ?? []) as ProgressRecord[];

  const daysByProgram = new Map<string, number>();
  // Nivel exigido = el mas alto entre los minimos de sus clases. Es el nivel que
  // hace falta para seguir el programa entero, no el de la clase mas facil.
  const nivelPorPrograma = new Map<string, string>();
  const categoriasPorPrograma = new Map<string, Map<string, number>>();

  for (const day of days) {
    daysByProgram.set(day.program_id, (daysByProgram.get(day.program_id) ?? 0) + 1);

    const clase = claseDelDia(day.videos);
    const nivel = clase?.recommended_min_level;
    if (nivel) {
      const actual = nivelPorPrograma.get(day.program_id);
      if (!actual || ORDEN_NIVEL.indexOf(nivel) > ORDEN_NIVEL.indexOf(actual)) {
        nivelPorPrograma.set(day.program_id, nivel);
      }
    }

    const conteo = categoriasPorPrograma.get(day.program_id) ?? new Map<string, number>();
    for (const cat of clase?.category_slugs ?? []) {
      conteo.set(cat, (conteo.get(cat) ?? 0) + 1);
    }
    categoriasPorPrograma.set(day.program_id, conteo);
  }

  /** Foco = la categoria que mas aparece entre las clases del programa. */
  const focoDe = (programId: string) => {
    const conteo = categoriasPorPrograma.get(programId);
    if (!conteo || conteo.size === 0) return null;
    const [top] = [...conteo.entries()].sort((a, b) => b[1] - a[1]);
    return FOCO_LABEL[top[0]] ?? top[0];
  };

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

        <header className="hero-stage">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="studio-chip">Programas</span>
              <h1 className="display mt-8 text-5xl leading-none md:text-7xl">
                Recorridos con{" "}
                <span style={{ color: "var(--pink)", fontStyle: "italic" }}>estructura.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[color:var(--ink-soft)] md:text-lg">
                Planes de varios días para entrenar con un orden pensado, en vez de elegir una clase suelta
                cada vez. Cada programa recuerda por dónde vas.
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
            <span className="studio-chip">Día a día</span>
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
                    className="relative min-h-[12rem] overflow-hidden rounded-[1.7rem] border border-[rgba(var(--border-rgb),0.3)] bg-cover bg-center"
                    style={{
                      backgroundColor: "rgba(238, 225, 228, 0.85)",
                      backgroundImage: program.cover_image_url ? `url(${program.cover_image_url})` : undefined
                    }}
                  >
                    {program.is_featured && (
                      <span style={{
                        position: "absolute", top: 14, left: 14,
                        display: "inline-flex", alignItems: "center", gap: 6,
                        background: "#fff", color: "var(--pink)",
                        fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                        padding: "6px 12px", borderRadius: 99, textTransform: "uppercase",
                      }}>
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 1.6l1.9 4 4.4.6-3.2 3.1.8 4.4L8 11.6l-3.9 2.1.8-4.4L1.7 6.2l4.4-.6L8 1.6z" />
                        </svg>
                        Destacado
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {nivelPorPrograma.get(program.id) && (
                      <span className="studio-chip">{NIVEL_LABEL[nivelPorPrograma.get(program.id)!]}</span>
                    )}
                    <span className="studio-chip">{program.duration_days} días</span>
                    {focoDe(program.id) && <span className="studio-chip">{focoDe(program.id)}</span>}
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
                        {completedDays}/{Math.max(totalDays, 0)} días completos
                      </span>
                      <span>{safePercent(progressPercent)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--pink-wash)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${safePercent(progressPercent)}%`, background: "var(--pink)" }}
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
