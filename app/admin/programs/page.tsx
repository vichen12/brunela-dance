import {
  deleteProgramAction,
  deleteProgramDayAction,
  upsertProgramAction,
  upsertProgramDayAction
} from "@/src/features/admin/actions";
import { getAdminDictionary } from "@/src/features/admin/dictionary";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const copy = getAdminDictionary("es");

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type ProgramRecord = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  membership_tier_required: "solista" | "principal";
  status: "draft" | "published" | "archived";
  duration_days: number;
  cover_image_url: string | null;
  is_featured: boolean;
};

type ProgramDayRecord = {
  id: string;
  program_id: string;
  day_number: number;
  video_id: string;
};

type VideoLookup = {
  id: string;
  slug: string;
};

function Flash({ message, tone }: { message: string | null; tone: "success" | "error" }) {
  if (!message) return null;
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {message}
    </div>
  );
}

export default async function AdminProgramsPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;

  const [{ data: programsData }, { data: programDaysData }, { data: videosData }] = await Promise.all([
    supabase
      .from("programs")
      .select("id, slug, title_i18n, description_i18n, membership_tier_required, status, duration_days, cover_image_url, is_featured")
      .order("created_at", { ascending: false }),
    supabase.from("program_days").select("id, program_id, day_number, video_id").order("day_number", { ascending: true }),
    supabase.from("videos").select("id, slug").order("slug", { ascending: true })
  ]);

  const programs = (programsData ?? []) as ProgramRecord[];
  const programDays = (programDaysData ?? []) as ProgramDayRecord[];
  const videos = (videosData ?? []) as VideoLookup[];
  const videoById = new Map(videos.map((video) => [video.id, video]));

  return (
    <main className="space-y-6">
      <header className="panel rounded-[36px] p-8 md:p-10">
        <h1 className="display text-4xl">{copy.programs.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-ink/70">{copy.programs.description}</p>
      </header>

      <Flash message={success} tone="success" />
      <Flash message={error} tone="error" />

      <section className="panel rounded-[32px] p-8">
        <p className="eyebrow mb-4">{copy.programs.createTitle}</p>
        <ProgramForm actionLabel={copy.programs.form.submitCreate} />
      </section>

      <section className="panel rounded-[32px] p-8">
        <p className="eyebrow mb-4">{copy.programs.listTitle}</p>
        <div className="space-y-6">
          {programs.length === 0 ? <p className="text-sm text-ink/65">{copy.labels.empty}</p> : null}

          {programs.map((program) => {
            const days = programDays.filter((day) => day.program_id === program.id);

            return (
              <div key={program.id} className="rounded-[28px] border border-black/6 bg-white/76 p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{program.title_i18n.es ?? program.slug}</p>
                    <p className="text-sm text-ink/60">{program.slug}</p>
                  </div>

                  <form action={deleteProgramAction}>
                    <input name="id" type="hidden" value={program.id} />
                    <button className="button-secondary" type="submit">
                      {copy.programs.form.delete}
                    </button>
                  </form>
                </div>

                <ProgramForm actionLabel={copy.programs.form.submitUpdate} program={program} />

                <div className="mt-8 rounded-[24px] border border-black/6 bg-mist p-5">
                  <p className="eyebrow mb-3">{copy.programs.daysTitle}</p>
                  <div className="space-y-3">
                    {days.map((day) => {
                      const video = videoById.get(day.video_id);
                      return (
                        <div key={day.id} className="flex items-center justify-between gap-4 rounded-2xl border border-black/6 bg-white px-4 py-3">
                          <div className="text-sm">
                            <span className="font-semibold">Dia {day.day_number}</span>{" "}
                            <span className="text-ink/65">- {video?.slug ?? day.video_id}</span>
                          </div>
                          <form action={deleteProgramDayAction}>
                            <input name="id" type="hidden" value={day.id} />
                            <button className="button-secondary" type="submit">
                              {copy.programs.form.deleteDay}
                            </button>
                          </form>
                        </div>
                      );
                    })}
                  </div>

                  <form action={upsertProgramDayAction} className="mt-5 grid gap-4 md:grid-cols-[120px_1fr_auto]">
                    <input name="programId" type="hidden" value={program.id} />
                    <label className="text-sm font-semibold text-ink">
                      {copy.programs.form.dayNumber}
                      <input className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" min={1} name="dayNumber" required type="number" />
                    </label>
                    <label className="text-sm font-semibold text-ink">
                      {copy.programs.form.videoSlug}
                      <input className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" list={`video-slugs-${program.id}`} name="videoSlug" required />
                      <datalist id={`video-slugs-${program.id}`}>
                        {videos.map((video) => (
                          <option key={video.id} value={video.slug} />
                        ))}
                      </datalist>
                    </label>
                    <div className="self-end">
                      <button className="button-primary" type="submit">
                        {copy.programs.form.addDay}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function ProgramForm({ actionLabel, program }: { actionLabel: string; program?: ProgramRecord }) {
  return (
    <form action={upsertProgramAction} className="grid gap-4 md:grid-cols-2">
      <input name="id" type="hidden" value={program?.id ?? ""} />

      <label className="text-sm font-semibold text-ink">
        {copy.programs.form.slug}
        <input className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={program?.slug ?? ""} name="slug" required />
      </label>

      <label className="text-sm font-semibold text-ink">
        {copy.programs.form.durationDays}
        <input className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={program?.duration_days ?? 14} min={1} name="durationDays" required type="number" />
      </label>

      <label className="text-sm font-semibold text-ink">
        {copy.programs.form.titleEs}
        <input className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={program?.title_i18n.es ?? ""} name="titleEs" required />
      </label>

      <label className="text-sm font-semibold text-ink">
        {copy.programs.form.titleEn}
        <input className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={program?.title_i18n.en ?? ""} name="titleEn" />
      </label>

      <label className="text-sm font-semibold text-ink md:col-span-2">
        {copy.programs.form.descriptionEs}
        <textarea className="mt-2 min-h-24 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={program?.description_i18n.es ?? ""} name="descriptionEs" required />
      </label>

      <label className="text-sm font-semibold text-ink md:col-span-2">
        {copy.programs.form.descriptionEn}
        <textarea className="mt-2 min-h-24 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={program?.description_i18n.en ?? ""} name="descriptionEn" />
      </label>

      <label className="text-sm font-semibold text-ink">
        {copy.programs.form.tier}
        <select className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={program?.membership_tier_required ?? "solista"} name="membershipTierRequired">
          <option value="solista">solista</option>
          <option value="principal">principal</option>
        </select>
      </label>

      <label className="text-sm font-semibold text-ink">
        {copy.programs.form.status}
        <select className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={program?.status ?? "draft"} name="status">
          <option value="draft">draft</option>
          <option value="published">published</option>
          <option value="archived">archived</option>
        </select>
      </label>

      <label className="text-sm font-semibold text-ink">
        {copy.programs.form.coverImage}
        <input className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={program?.cover_image_url ?? ""} name="coverImageUrl" />
      </label>

      <label className="flex items-center gap-3 text-sm font-semibold text-ink">
        <input defaultChecked={program?.is_featured ?? false} name="isFeatured" type="checkbox" />
        {copy.programs.form.featured}
      </label>

      <div className="md:col-span-2">
        <button className="button-primary" type="submit">
          {actionLabel}
        </button>
      </div>
    </form>
  );
}
