import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { getBunnyStreamEnv } from "@/src/lib/env";
import { bunnyHlsUrl, bunnyThumbnailUrl, deleteBunnyVideo } from "@/src/lib/video/bunny";
import { audioLabel, audioObjectPath, isAudioLocale, ORIGINAL_LOCALE } from "@/src/lib/audio/config";
import {
  CATEGORIA_SLUGS,
  MATERIAL_SLUGS,
  NIVEL_SLUGS,
  TIPO_SLUGS,
  nivelARango
} from "@/src/features/studio/catalogo-clases";

const CONTENT_TYPES = TIPO_SLUGS;

/** Los nombres del schema no significan nada fuera del codigo. */
const CAMPO_LEGIBLE: Record<string, string> = {
  bunnyVideoId: "video subido",
  audioLocales: "idiomas de audio",
  slug: "dirección",
  titleEs: "título en español",
  titleEn: "título en inglés",
  descriptionEs: "descripción en español",
  descriptionEn: "descripción en inglés",
  planesPermitidos: "planes que la pueden ver",
  status: "estado",
  durationSeconds: "duración",
  contentType: "tipo de contenido",
  categorySlug: "categoría",
  nivel: "nivel",
  equipment: "materiales",
  programId: "plan de trabajo",
  programDayNumber: "día del plan",
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
  /**
   * 🔴 ESTO ES CONTROL DE ACCESO, no una etiqueta: es lo que lee la policy
   *    videos_select_allowed_by_tier. El `.min(1)` no es cosmetico -- una lista
   *    vacia seria una clase que no ve nadie, y la base la rechaza igual con un
   *    check constraint. Se valida en los dos lados a proposito.
   */
  planesPermitidos: z.array(z.enum(["corps_de_ballet", "solista", "principal"])).min(1),
  status: z.enum(["draft", "published"]),
  durationSeconds: z.coerce.number().int().positive(),
  contentType: z.enum(CONTENT_TYPES),
  categorySlug: z.enum(CATEGORIA_SLUGS),
  nivel: z.enum(NIVEL_SLUGS),
  /**
   * Listas cerradas y no texto libre: antes esto era un CSV, y "Colchoneta" y
   * "colchoneta" eran dos materiales distintos para la base. Un slug que no
   * este en la lista se rechaza en vez de guardarse, porque guardarlo lo deja
   * invisible en todos los filtros sin dar ningun error.
   */
  equipment: z.array(z.enum(MATERIAL_SLUGS)).default([]),
  /** Enganchar la clase a un plan de trabajo es opcional: casi siempre es null. */
  programId: z.string().uuid().nullable().optional(),
  programDayNumber: z.coerce.number().int().positive().nullable().optional(),
  isFeatured: z.boolean().default(false)
});

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
    // membership_tier_required NO se escribe aca: lo deriva el trigger
    // videos_sincronizar_planes como el plan mas bajo de la lista. Mandarlo
    // ademas seria dar dos ordenes distintas sobre lo mismo, y la que gana no
    // es la que se lee en este archivo.
    planes_permitidos: data.planesPermitidos,
    status: data.status,
    duration_seconds: data.durationSeconds,
    content_type: data.contentType,
    // La categoria es una sola, pero la columna es un array desde el primer
    // dia y la biblioteca filtra con `overlaps`. Se guarda como array de uno.
    category_slugs: [data.categorySlug],
    ...(() => {
      const { min, max } = nivelARango(data.nivel);
      return { recommended_min_level: min, recommended_max_level: max };
    })(),
    equipment: data.equipment,
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

  /**
   * Enganchar la clase a un dia de un plan de trabajo.
   *
   * POR QUE NO TIRA ABAJO LA SUBIDA SI FALLA
   *   El video ya esta en Bunny y la fila ya esta en el catalogo. Borrar todo
   *   eso porque el dia 3 de un plan estaba ocupado seria hacerle repetir una
   *   subida de varios gigabytes por algo que se arregla en /admin/programs en
   *   diez segundos. Se avisa y se sigue.
   *
   * `upsert` sobre (program_id, day_number), que es el unique de la tabla: si
   * ese dia ya tenia una clase, esta la reemplaza. Es lo que dice el formulario
   * abajo del campo, asi que no sorprende a nadie.
   */
  let avisoPlan: string | null = null;

  if (data.programId && data.programDayNumber) {
    const { error: planError } = await supabase.from("program_days").upsert(
      {
        program_id: data.programId,
        day_number: data.programDayNumber,
        video_id: result.data.id
      },
      { onConflict: "program_id,day_number" }
    );

    if (planError) {
      avisoPlan = `La clase se guardó, pero no se pudo agregar al plan: ${planError.message}. Se puede agregar a mano desde Planes de trabajo.`;
    }
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
      revalidatePath("/admin/programs");
      return NextResponse.json(
        {
          ok: true,
          queued: false,
          warning: [
            `La clase se guardo, pero no se pudo encolar el muxeo: ${jobError.message}`,
            avisoPlan
          ]
            .filter(Boolean)
            .join(" ")
        },
        { status: 200 }
      );
    }
  }

  revalidatePath("/admin/videos");
  revalidatePath("/dashboard/library");
  revalidatePath("/admin/programs");
  revalidatePath("/dashboard/programs");

  return NextResponse.json({ ok: true, queued, ...(avisoPlan ? { warning: avisoPlan } : null) });
}
