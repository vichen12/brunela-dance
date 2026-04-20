import Link from "next/link";
import { StudioNav } from "@/components/studio-nav";
import { requireUser } from "@/src/features/auth/guards";
import {
  formatDurationLabel,
  membershipTierLabel,
  resolveI18nText,
  safePercent,
  type MembershipTier,
  type VideoStatus
} from "@/src/features/studio/helpers";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

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
  is_featured: boolean;
  status: VideoStatus;
};

type ProgressRecord = {
  video_id: string;
  completion_percent: number;
  max_position_seconds: number;
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

export default async function DashboardLibraryPage({ searchParams }: { searchParams?: SearchParams }) {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;
  const activeCategory = typeof params.category === "string" ? params.category : "all";

  const [{ data: videosData }, { data: progressData }, { data: profile }] = await Promise.all([
    supabase
      .from("videos")
      .select(
        "id, slug, title_i18n, description_i18n, membership_tier_required, duration_seconds, category_slugs, equipment, thumbnail_url, is_featured, status"
      )
      .order("is_featured", { ascending: false })
      .order("published_at", { ascending: false }),
    supabase
      .from("user_progress")
      .select("video_id, completion_percent, max_position_seconds")
      .eq("user_id", user.id),
    supabase.from("profiles").select("membership_tier").eq("id", user.id).maybeSingle<{ membership_tier: MembershipTier }>()
  ]);

  const videos = (videosData ?? []) as VideoRecord[];
  const progressMap = new Map(
    ((progressData ?? []) as ProgressRecord[]).map((progress) => [progress.video_id, progress])
  );
  const categories = Array.from(
    new Set(videos.flatMap((video) => video.category_slugs).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right, "es"));

  const filteredVideos =
    activeCategory === "all"
      ? videos
      : videos.filter((video) => video.category_slugs.includes(activeCategory));

  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">
        <StudioNav current="library" />

        <header className="hero-stage">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="studio-chip">On demand</span>
              <h1 className="display mt-8 text-5xl leading-none md:text-7xl">Biblioteca del estudio.</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[color:var(--ink-soft)] md:text-lg">
                Todo el contenido disponible para tu plan vive aca, con continuidad real, progreso visible y acceso
                ordenado por categorias.
              </p>
            </div>

            <div className="soft-stat min-w-[16rem] p-5">
              <p className="eyebrow">Tu acceso</p>
              <p className="display mt-4 text-4xl leading-none">
                {membershipTierLabel(profile?.membership_tier ?? "none")}
              </p>
              <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                {videos.length} clases habilitadas para esta membresia.
              </p>
            </div>
          </div>
        </header>

        <Flash message={success} tone="success" />
        <Flash message={error} tone="error" />

        <section className="panel rounded-[2.4rem] p-7 md:p-9">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Filtros</p>
              <h2 className="display mt-4 text-4xl">Entrena con claridad</h2>
            </div>
            <span className="studio-chip">{filteredVideos.length} visibles</span>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className={
                activeCategory === "all"
                  ? "button-primary !px-4 !py-3 !text-xs"
                  : "button-secondary !px-4 !py-3 !text-xs"
              }
              href="/dashboard/library"
            >
              Todas
            </Link>
            {categories.map((category) => (
              <Link
                key={category}
                className={
                  activeCategory === category
                    ? "button-primary !px-4 !py-3 !text-xs"
                    : "button-secondary !px-4 !py-3 !text-xs"
                }
                href={`/dashboard/library?category=${encodeURIComponent(category)}`}
              >
                {category}
              </Link>
            ))}
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {filteredVideos.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-[rgba(118,92,113,0.14)] bg-[rgba(255,255,255,0.52)] p-6 text-sm leading-7 text-[color:var(--ink-soft)]">
                No hay clases publicadas todavia para este filtro.
              </div>
            ) : null}

            {filteredVideos.map((video) => {
              const progress = progressMap.get(video.id);
              const progressPercent = safePercent(progress?.completion_percent);
              const title = resolveI18nText(video.title_i18n);
              const description = resolveI18nText(video.description_i18n);

              return (
                <Link
                  key={video.id}
                  className="feature-tile flex h-full flex-col gap-5 rounded-[2rem] border border-[rgba(var(--border-rgb),0.42)] bg-[rgba(255,255,255,0.88)] p-5"
                  href={`/dashboard/library/${video.slug}`}
                >
                  <div
                    className="min-h-[12rem] rounded-[1.7rem] border border-[rgba(var(--border-rgb),0.3)] bg-cover bg-center"
                    style={{
                      backgroundColor: "rgba(238, 225, 228, 0.85)",
                      backgroundImage: video.thumbnail_url ? `url(${video.thumbnail_url})` : undefined
                    }}
                  />

                  <div className="flex flex-wrap gap-2">
                    <span className="studio-chip">{membershipTierLabel(video.membership_tier_required)}</span>
                    <span className="studio-chip">{formatDurationLabel(video.duration_seconds)}</span>
                    {video.is_featured ? <span className="studio-chip">Featured</span> : null}
                  </div>

                  <div>
                    <h3 className="display text-3xl">{title}</h3>
                    <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">
                      {description || "Descripcion pendiente en admin."}
                    </p>
                  </div>

                  <div className="mt-auto space-y-3">
                    <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--ink-soft)]">
                      {video.category_slugs.slice(0, 3).map((category) => (
                        <span key={category}>{category}</span>
                      ))}
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--ink-soft)]">
                        <span>Progreso</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[rgba(89,101,123,0.08)]">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#eb8d95,#d96977)]"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
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
