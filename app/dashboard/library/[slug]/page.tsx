import Link from "next/link";
import { notFound } from "next/navigation";
import { StudioNav } from "@/components/studio-nav";
import { upsertProgressAction } from "@/src/features/studio/actions";
import {
  formatDurationLabel,
  membershipTierLabel,
  resolveI18nText,
  safePercent,
  type MembershipTier
} from "@/src/features/studio/helpers";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type VideoRecord = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  membership_tier_required: MembershipTier;
  duration_seconds: number;
  category_slugs: string[];
  equipment: string[];
  thumbnail_url: string | null;
  stream_playback_id: string | null;
};

type ProgressRecord = {
  last_position_seconds: number;
  max_position_seconds: number;
  completion_percent: number;
};

type ProgramContext = {
  title_i18n: Record<string, string>;
  slug: string;
};

function Flash({ message, tone }: { message: string | null; tone: "success" | "error" }) {
  if (!message) return null;

  return (
    <div
      className={`rounded-[1.5rem] border px-4 py-4 text-sm font-semibold ${
        tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-[rgba(217,105,119,0.18)] bg-[rgba(255,238,242,0.88)] text-[color:var(--rose-deep)]"
      }`}
    >
      {message}
    </div>
  );
}

export default async function VideoDetailPage({
  params,
  searchParams
}: {
  params: Params;
  searchParams?: SearchParams;
}) {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const success = typeof resolvedSearchParams.success === "string" ? resolvedSearchParams.success : null;
  const error = typeof resolvedSearchParams.error === "string" ? resolvedSearchParams.error : null;
  const programId = typeof resolvedSearchParams.programId === "string" ? resolvedSearchParams.programId : "";
  const programDayNumber =
    typeof resolvedSearchParams.day === "string" && resolvedSearchParams.day.length > 0
      ? Number(resolvedSearchParams.day)
      : null;

  const { data: video, error: videoError } = await supabase
    .from("videos")
    .select(
      "id, slug, title_i18n, description_i18n, membership_tier_required, duration_seconds, category_slugs, equipment, thumbnail_url, stream_playback_id"
    )
    .eq("slug", slug)
    .maybeSingle<VideoRecord>();

  if (videoError || !video) {
    notFound();
  }

  const progressQuery = supabase
    .from("user_progress")
    .select("last_position_seconds, max_position_seconds, completion_percent")
    .eq("user_id", user.id)
    .eq("video_id", video.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  const scopedProgressQuery = programId ? progressQuery.eq("program_id", programId) : progressQuery.is("program_id", null);

  const [{ data: progress }, { data: programContext }, { data: relatedPrograms }] = await Promise.all([
    scopedProgressQuery.maybeSingle<ProgressRecord>(),
    programId
      ? supabase
          .from("programs")
          .select("slug, title_i18n")
          .eq("id", programId)
          .maybeSingle<ProgramContext>()
      : Promise.resolve({ data: null }),
    supabase
      .from("program_days")
      .select("day_number, programs!inner(slug, title_i18n)")
      .eq("video_id", video.id)
  ]);

  const progressPercent = safePercent(progress?.completion_percent);
  const title = resolveI18nText(video.title_i18n);
  const description = resolveI18nText(video.description_i18n);
  const quickMarks = [25, 50, 100];

  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">
        <StudioNav current="library" />

        <Link className="button-secondary" href={programContext ? `/dashboard/programs/${programContext.slug}` : "/dashboard/library"}>
          {programContext ? "Volver al programa" : "Volver a biblioteca"}
        </Link>

        <Flash message={success} tone="success" />
        <Flash message={error} tone="error" />

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="hero-stage">
            <div
              className="min-h-[18rem] rounded-[2rem] border border-[rgba(var(--border-rgb),0.32)] bg-cover bg-center"
              style={{
                backgroundColor: "rgba(238, 225, 228, 0.85)",
                backgroundImage: video.thumbnail_url ? `url(${video.thumbnail_url})` : undefined
              }}
            />

            <div className="mt-8 flex flex-wrap gap-2">
              <span className="studio-chip">{membershipTierLabel(video.membership_tier_required)}</span>
              <span className="studio-chip">{formatDurationLabel(video.duration_seconds)}</span>
              {video.stream_playback_id ? <span className="studio-chip">Stream ready</span> : null}
            </div>

            <h1 className="display mt-6 text-5xl leading-none md:text-7xl">{title}</h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-[color:var(--ink-soft)] md:text-lg">
              {description || "La descripcion todavia no fue cargada en admin."}
            </p>

            {programContext && programDayNumber ? (
              <div className="mt-8 rounded-[2rem] border border-[rgba(var(--brand-accent),0.16)] bg-[rgba(255,240,244,0.72)] p-5">
                <p className="eyebrow">Contexto de programa</p>
                <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">
                  Estas viendo este video como parte de <strong>{resolveI18nText(programContext.title_i18n)}</strong>,
                  dia {programDayNumber}.
                </p>
              </div>
            ) : null}
          </article>

          <aside className="space-y-6">
            <article className="panel rounded-[2.4rem] p-7 md:p-9">
              <p className="eyebrow">Continuidad</p>
              <h2 className="display mt-4 text-4xl">Guarda tu avance</h2>
              <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                Aunque todavia no haya player definitivo, el sistema ya puede registrar progreso y marcar dias
                completados.
              </p>

              <div className="mt-6 h-3 overflow-hidden rounded-full bg-[rgba(89,101,123,0.08)]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#eb8d95,#d96977)]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">
                Ultimo guardado: {progress?.max_position_seconds ?? 0}s y {progressPercent}% completado.
              </p>

              <div className="mt-6 grid gap-3">
                {quickMarks.map((percent) => {
                  const seconds = Math.floor((video.duration_seconds * percent) / 100);
                  const label =
                    percent === 100 ? "Marcar como completada" : `Guardar ${percent}% de la clase`;

                  return (
                    <form key={percent} action={upsertProgressAction}>
                      <input name="slug" type="hidden" value={video.slug} />
                      <input name="videoId" type="hidden" value={video.id} />
                      <input name="programId" type="hidden" value={programId} />
                      <input name="programDayNumber" type="hidden" value={programDayNumber ?? ""} />
                      <input name="lastPositionSeconds" type="hidden" value={seconds} />
                      <input name="completionPercent" type="hidden" value={percent} />
                      <button className={percent === 100 ? "button-primary w-full" : "button-secondary w-full"} type="submit">
                        {label}
                      </button>
                    </form>
                  );
                })}
              </div>
            </article>

            <article className="panel rounded-[2.4rem] p-7 md:p-9">
              <p className="eyebrow">Metadata</p>
              <div className="mt-5 space-y-3 text-sm leading-7 text-[color:var(--ink-soft)]">
                <p>
                  <strong className="text-[color:var(--ink)]">Categorias:</strong>{" "}
                  {video.category_slugs.length > 0 ? video.category_slugs.join(", ") : "Sin categorias"}
                </p>
                <p>
                  <strong className="text-[color:var(--ink)]">Materiales:</strong>{" "}
                  {video.equipment.length > 0 ? video.equipment.join(", ") : "No requiere equipamiento"}
                </p>
              </div>
            </article>
          </aside>
        </section>

        <section className="panel rounded-[2.4rem] p-7 md:p-9">
          <p className="eyebrow">Relacionado</p>
          <h2 className="display mt-4 text-4xl">Donde aparece esta clase</h2>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {(relatedPrograms ?? []).length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-[rgba(118,92,113,0.14)] bg-[rgba(255,255,255,0.52)] p-6 text-sm leading-7 text-[color:var(--ink-soft)]">
                Esta clase todavia no esta conectada a ningun programa.
              </div>
            ) : null}

            {(relatedPrograms ?? []).map((item) => {
              const program = Array.isArray(item.programs) ? item.programs[0] : item.programs;
              if (!program) return null;

              return (
                <Link
                  key={`${program.slug}-${item.day_number}`}
                  className="feature-tile block"
                  href={`/dashboard/programs/${program.slug}`}
                >
                  <p className="eyebrow">Dia {item.day_number}</p>
                  <h3 className="display mt-4 text-3xl">{resolveI18nText(program.title_i18n)}</h3>
                  <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                    Abri el programa para ver el recorrido completo y el estado del resto de los dias.
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
