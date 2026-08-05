import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { getBunnyStreamEnv } from "@/src/lib/env";
import { bunnyHlsUrl, bunnyThumbnailUrl, deleteBunnyVideo } from "@/src/lib/video/bunny";
import { audioLabel, audioObjectPath, isAudioLocale, ORIGINAL_LOCALE } from "@/src/lib/audio/config";

/** Los nombres del schema no significan nada fuera del codigo. */
const CAMPO_LEGIBLE: Record<string, string> = {
  bunnyVideoId: "video subido",
  audioLocales: "idiomas de audio",
  slug: "dirección",
  titleEs: "título en español",
  titleEn: "título en inglés",
  descriptionEs: "descripción en español",
  descriptionEn: "descripción en inglés",
  membershipTierRequired: "plan requerido",
  status: "estado",
  durationSeconds: "duración",
  categories: "categorías",
  equipment: "material",
  isFeatured: "destacado",
};

const schema = z.object({
  bunnyVideoId: z.string().min(1),
  /** Languages whose mp3 the browser already uploaded to Supabase Storage. */
  audioLocales: z.array(z.string()).default([]),
  slug: z.string().min(2),
  titleEs: z.string().min(1),
  titleEn: z.string().optional(),
  descriptionEs: z.string().min(1),
  descriptionEn: z.string().optional(),
  membershipTierRequired: z.enum(["corps_de_ballet", "solista", "principal"]),
  status: z.enum(["draft", "published", "archived"]),
  durationSeconds: z.coerce.number().int().positive(),
  categories: z.string().optional(),
  equipment: z.string().optional(),
  isFeatured: z.boolean().default(false)
});

function parseCsv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildI18n(es: string, en?: string) {
  return en && en.trim() ? { es, en: en.trim() } : { es };
}

/**
 * Step 3 of the browser-direct upload: the bytes are already in Bunny, so all
 * that is left is the catalog row. Only metadata crosses the wire here, which
 * is why this is nowhere near any body size limit.
 */
export async function POST(request: Request) {
  const { user } = await requireAdmin();

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        // Antes decia solo "Datos de video invalidos." y mandaba `details`
        // aparte, que la interfaz descartaba. El mensaje ya viene listo para
        // mostrar: quien lo recibe no tiene que saber leer un error de zod.
        error: `Revisá: ${Object.entries(parsed.error.flatten().fieldErrors)
          .slice(0, 4)
          .map(([campo, errores]) => `${CAMPO_LEGIBLE[campo] ?? campo} (${errores?.[0] ?? "inválido"})`)
          .join(", ")}`,
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const supabase = createSupabaseAdminClient();

  // A duplicate slug would 500 on insert after the file is already uploaded.
  // Check first so we can clean up the orphaned Bunny asset instead.
  const { data: existing } = await supabase
    .from("videos")
    .select("id")
    .eq("slug", data.slug.trim())
    .maybeSingle<{ id: string }>();

  if (existing) {
    await deleteBunnyVideo(data.bunnyVideoId);
    return NextResponse.json(
      { error: `Ya existe una clase con el slug "${data.slug.trim()}".` },
      { status: 409 }
    );
  }

  const { BUNNY_STREAM_LIBRARY_ID } = getBunnyStreamEnv();

  const payload = {
    slug: data.slug.trim(),
    title_i18n: buildI18n(data.titleEs.trim(), data.titleEn),
    description_i18n: buildI18n(data.descriptionEs.trim(), data.descriptionEn),
    membership_tier_required: data.membershipTierRequired,
    status: data.status,
    duration_seconds: data.durationSeconds,
    category_slugs: parseCsv(data.categories),
    equipment: parseCsv(data.equipment),
    // Unsigned canonical URLs, stored as a record of which Bunny asset this row
    // points at. Never rendered: playback and posters are signed per request.
    thumbnail_url: bunnyThumbnailUrl(data.bunnyVideoId),
    stream_provider: "bunny",
    stream_playback_id: bunnyHlsUrl(data.bunnyVideoId),
    bunny_library_id: BUNNY_STREAM_LIBRARY_ID,
    bunny_video_id: data.bunnyVideoId,
    audio_tracks: [],
    is_featured: data.isFeatured,
    published_at: data.status === "published" ? new Date().toISOString() : null,
    created_by: user.id,
    updated_by: user.id
  };

  const result = await supabase.from("videos").insert(payload).select("id").single<{ id: string }>();

  if (result.error || !result.data) {
    // The row failed but the asset is in Bunny. Remove it so the library does
    // not accumulate videos with no catalog entry.
    await deleteBunnyVideo(data.bunnyVideoId);
    return NextResponse.json({ error: result.error?.message ?? "No se pudo guardar." }, { status: 500 });
  }

  // Extra languages need the mux worker. Queue the job; the class is already
  // playable in its original language while it waits.
  const locales = data.audioLocales.filter(isAudioLocale);
  let queued = false;

  if (locales.length > 0) {
    const { error: jobError } = await supabase.from("video_mux_jobs").insert({
      video_id: result.data.id,
      source_bunny_video_id: data.bunnyVideoId,
      audio_inputs: locales.map((locale) => ({
        locale,
        label: audioLabel(locale),
        path: audioObjectPath(data.bunnyVideoId, locale)
      })),
      // The contract the worker must verify before swapping. Original language
      // included: losing it would be just as broken as losing a dub.
      expected_locales: [ORIGINAL_LOCALE, ...locales],
      status: "pending"
    });

    // A failed enqueue must not undo a good upload -- the class is fine, it
    // just has no extra languages yet. Surfaced so the admin can retry.
    queued = !jobError;
    if (jobError) {
      revalidatePath("/admin/videos");
      return NextResponse.json(
        { ok: true, queued: false, warning: `La clase se guardo, pero no se pudo encolar el muxeo: ${jobError.message}` },
        { status: 200 }
      );
    }
  }

  revalidatePath("/admin/videos");
  revalidatePath("/dashboard/library");

  return NextResponse.json({ ok: true, queued });
}
