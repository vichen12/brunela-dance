import { deleteVideoAction, upsertVideoAction } from "@/src/features/admin/actions";
import { getAdminDictionary } from "@/src/features/admin/dictionary";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const copy = getAdminDictionary("es");

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type VideoRecord = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  status: "draft" | "published" | "archived";
  membership_tier_required: "corps_de_ballet" | "solista" | "principal";
  duration_seconds: number;
  category_slugs: string[];
  equipment: string[];
  thumbnail_url: string | null;
  stream_playback_id: string | null;
  stream_asset_id: string | null;
  is_featured: boolean;
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

export default async function AdminVideosPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;

  const { data } = await supabase
    .from("videos")
    .select(
      "id, slug, title_i18n, description_i18n, status, membership_tier_required, duration_seconds, category_slugs, equipment, thumbnail_url, stream_playback_id, stream_asset_id, is_featured"
    )
    .order("created_at", { ascending: false });

  const videos = (data ?? []) as VideoRecord[];

  return (
    <main className="space-y-6">
      <header className="panel rounded-[36px] p-8 md:p-10">
        <h1 className="display text-4xl">{copy.videos.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-ink/70">{copy.videos.description}</p>
      </header>

      <Flash message={success} tone="success" />
      <Flash message={error} tone="error" />

      <section className="panel rounded-[32px] p-8">
        <p className="eyebrow mb-4">{copy.videos.createTitle}</p>
        <VideoForm actionLabel={copy.videos.form.submitCreate} />
      </section>

      <section className="panel rounded-[32px] p-8">
        <p className="eyebrow mb-4">{copy.videos.listTitle}</p>
        <div className="space-y-6">
          {videos.length === 0 ? <p className="text-sm text-ink/65">{copy.labels.empty}</p> : null}
          {videos.map((video) => (
            <div key={video.id} className="rounded-[28px] border border-black/6 bg-white/76 p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">{video.title_i18n.es ?? video.slug}</p>
                  <p className="text-sm text-ink/60">{video.slug}</p>
                </div>

                <form action={deleteVideoAction}>
                  <input name="id" type="hidden" value={video.id} />
                  <button className="button-secondary" type="submit">
                    {copy.videos.form.delete}
                  </button>
                </form>
              </div>

              <VideoForm actionLabel={copy.videos.form.submitUpdate} video={video} />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function VideoForm({ actionLabel, video }: { actionLabel: string; video?: VideoRecord }) {
  return (
    <form action={upsertVideoAction} className="grid gap-4 md:grid-cols-2">
      <input name="id" type="hidden" value={video?.id ?? ""} />

      <label className="text-sm font-semibold text-ink">
        {copy.videos.form.slug}
        <input className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={video?.slug ?? ""} name="slug" required />
      </label>

      <label className="text-sm font-semibold text-ink">
        {copy.videos.form.duration}
        <input
          className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3"
          defaultValue={video?.duration_seconds ?? 900}
          min={1}
          name="durationSeconds"
          required
          type="number"
        />
      </label>

      <label className="text-sm font-semibold text-ink">
        {copy.videos.form.titleEs}
        <input className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={video?.title_i18n.es ?? ""} name="titleEs" required />
      </label>

      <label className="text-sm font-semibold text-ink">
        {copy.videos.form.titleEn}
        <input className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={video?.title_i18n.en ?? ""} name="titleEn" />
      </label>

      <label className="text-sm font-semibold text-ink md:col-span-2">
        {copy.videos.form.descriptionEs}
        <textarea className="mt-2 min-h-24 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={video?.description_i18n.es ?? ""} name="descriptionEs" required />
      </label>

      <label className="text-sm font-semibold text-ink md:col-span-2">
        {copy.videos.form.descriptionEn}
        <textarea className="mt-2 min-h-24 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={video?.description_i18n.en ?? ""} name="descriptionEn" />
      </label>

      <label className="text-sm font-semibold text-ink">
        {copy.videos.form.tier}
        <select className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={video?.membership_tier_required ?? "corps_de_ballet"} name="membershipTierRequired">
          <option value="corps_de_ballet">corps_de_ballet</option>
          <option value="solista">solista</option>
          <option value="principal">principal</option>
        </select>
      </label>

      <label className="text-sm font-semibold text-ink">
        {copy.videos.form.status}
        <select className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={video?.status ?? "draft"} name="status">
          <option value="draft">draft</option>
          <option value="published">published</option>
          <option value="archived">archived</option>
        </select>
      </label>

      <label className="text-sm font-semibold text-ink">
        {copy.videos.form.categories}
        <input className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={video?.category_slugs.join(", ") ?? ""} name="categories" />
      </label>

      <label className="text-sm font-semibold text-ink">
        {copy.videos.form.equipment}
        <input className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={video?.equipment.join(", ") ?? ""} name="equipment" />
      </label>

      <label className="text-sm font-semibold text-ink">
        {copy.videos.form.thumbnail}
        <input className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={video?.thumbnail_url ?? ""} name="thumbnailUrl" />
      </label>

      <label className="text-sm font-semibold text-ink">
        {copy.videos.form.playbackId}
        <input className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={video?.stream_playback_id ?? ""} name="streamPlaybackId" />
      </label>

      <label className="text-sm font-semibold text-ink">
        {copy.videos.form.assetId}
        <input className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3" defaultValue={video?.stream_asset_id ?? ""} name="streamAssetId" />
      </label>

      <label className="flex items-center gap-3 text-sm font-semibold text-ink">
        <input defaultChecked={video?.is_featured ?? false} name="isFeatured" type="checkbox" />
        {copy.videos.form.featured}
      </label>

      <div className="md:col-span-2">
        <button className="button-primary" type="submit">
          {actionLabel}
        </button>
      </div>
    </form>
  );
}
