"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { invalidarAjustes } from "@/src/lib/settings";
import { deleteBunnyVideo, hasBunnyStreamEnv } from "@/src/lib/video/bunny";

const videoSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  slug: z.string().min(3),
  titleEs: z.string().min(1),
  titleEn: z.string().optional(),
  descriptionEs: z.string().min(1),
  descriptionEn: z.string().optional(),
  membershipTierRequired: z.enum(["corps_de_ballet", "solista", "principal"]),
  status: z.enum(["draft", "published", "archived"]),
  /** Llega en MINUTOS desde el formulario; se convierte antes de guardar. */
  durationMinutes: z.coerce.number().int().positive().max(600),
  categories: z.string().optional(),
  equipment: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  // streamPlaybackId y streamAssetId NO estan aca a proposito: ver el payload.
  // NOTE: audio_tracks is deliberately absent. It is written by the mux worker
  // (worker/index.mjs) once a language is verified inside the encoded video.
  // The old manual "Mux Audio Track ID" fields wrote it from this form, which
  // wiped the worker's record on every save -- the inputs were always empty
  // because Bunny has no per-track ids to paste in the first place.
  isFeatured: z.boolean().default(false)
});

const programSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  slug: z.string().min(3),
  titleEs: z.string().min(1),
  titleEn: z.string().optional(),
  descriptionEs: z.string().min(1),
  descriptionEn: z.string().optional(),
  membershipTierRequired: z.enum(["solista", "principal"]),
  status: z.enum(["draft", "published", "archived"]),
  durationDays: z.coerce.number().int().positive(),
  coverImageUrl: z.string().optional(),
  isFeatured: z.boolean().default(false)
});

const programDaySchema = z.object({
  programId: z.string().uuid(),
  dayNumber: z.coerce.number().int().positive(),
  videoSlug: z.string().min(1)
});

const siteSettingSchema = z.object({
  settingKey: z.string().min(3),
  category: z.string().min(1),
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
  value: z.string().min(1)
});

const profileSchema = z.object({
  profileId: z.string().uuid(),
  membershipTier: z.enum(["none", "corps_de_ballet", "solista", "principal"]),
  technicalLevel: z.enum(["principiante", "intermedio", "avanzado", "profesional", "maestro"]),
  onboardingCompleted: z.boolean().default(false),
  isAdmin: z.boolean().default(false)
});

function parseCsv(input: string | undefined) {
  return (input ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildI18n(es: string, en?: string) {
  return {
    es,
    ...(en?.trim() ? { en: en.trim() } : {})
  };
}

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

/**
 * Convierte los errores de zod en algo accionable.
 *
 * Antes todas las validaciones fallaban con "Datos de video invalidos.", que no
 * le dice nada a nadie: Brunela ve un cartel rojo y no sabe que corregir, y
 * quien programa tampoco. Ahora dice el campo y el motivo.
 *
 * Los nombres van en castellano: `membershipTierRequired` no significa nada
 * fuera del codigo.
 */
const CAMPO_LEGIBLE: Record<string, string> = {
  slug: "dirección",
  titleEs: "título en español",
  titleEn: "título en inglés",
  descriptionEs: "descripción en español",
  descriptionEn: "descripción en inglés",
  membershipTierRequired: "plan requerido",
  status: "estado",
  durationMinutes: "duración",
  categories: "categorías",
  equipment: "material",
  thumbnailUrl: "portada",
  isFeatured: "destacado",
  title: "título",
  dayNumber: "día",
  videoSlug: "clase",
  startsAt: "fecha de inicio",
  capacity: "cupo",
};

function detalleZod(error: { issues: { path: (string | number)[]; message: string }[] }): string {
  const partes = error.issues.slice(0, 4).map((i) => {
    const clave = String(i.path[0] ?? "");
    const nombre = CAMPO_LEGIBLE[clave] ?? clave;
    return `${nombre} (${i.message})`;
  });
  const resto = error.issues.length > 4 ? ` y ${error.issues.length - 4} más` : "";
  return partes.join(", ") + resto;
}

function redirectWithMessage(path: string, kind: "success" | "error", message: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message)}` as never);
}

/**
 * Guardado exitoso: revalida y NO navega.
 *
 * POR QUE
 *   Antes toda accion terminaba en redirect(), o sea una navegacion completa
 *   por cada campo guardado -- el mismo problema que tenia el chat al enviar un
 *   mensaje. Con el panel lateral es peor todavia: al navegar se cerraria solo
 *   y Brunela perderia el lugar en la lista.
 *
 *   El aviso de que esta trabajando ya lo da BotonEnviar (useFormStatus), y el
 *   resultado se ve en la lista, que se revalida. No hace falta un cartel.
 *
 * EL ERROR SI SIGUE NAVEGANDO
 *   Un error tiene que decir QUE fallo, y ese texto necesita un lugar donde
 *   aparecer. Un guardado que falla en silencio es peor que uno que navega.
 */
function guardadoOk(path: string): void {
  revalidatePath(path);
}

function refreshAdminRoutes() {
  revalidatePath("/admin");
  revalidatePath("/admin/videos");
  revalidatePath("/admin/programs");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/users");
}

export async function upsertVideoAction(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createSupabaseAdminClient();

  const parsed = videoSchema.safeParse({
    id: formData.get("id"),
    slug: formData.get("slug"),
    titleEs: formData.get("titleEs"),
    titleEn: formData.get("titleEn"),
    descriptionEs: formData.get("descriptionEs"),
    descriptionEn: formData.get("descriptionEn"),
    membershipTierRequired: formData.get("membershipTierRequired"),
    status: formData.get("status"),
    durationMinutes: formData.get("durationMinutes"),
    categories: formData.get("categories"),
    equipment: formData.get("equipment"),
    thumbnailUrl: formData.get("thumbnailUrl"),
    isFeatured: checkboxValue(formData, "isFeatured")
  });

  if (!parsed.success) {
    redirectWithMessage("/admin/videos", "error", `Revisá: ${detalleZod(parsed.error)}`);
  }

  const payload = {
    slug: parsed.data.slug.trim(),
    title_i18n: buildI18n(parsed.data.titleEs.trim(), parsed.data.titleEn),
    description_i18n: buildI18n(parsed.data.descriptionEs.trim(), parsed.data.descriptionEn),
    membership_tier_required: parsed.data.membershipTierRequired,
    status: parsed.data.status,
    duration_seconds: parsed.data.durationMinutes * 60,
    category_slugs: parseCsv(parsed.data.categories),
    equipment: parseCsv(parsed.data.equipment),
    thumbnail_url: parsed.data.thumbnailUrl?.trim() || null,

    // 🔴 stream_playback_id y stream_asset_id NO se escriben desde aca.
    //
    //   Estaban en el payload como `parsed.data.streamPlaybackId?.trim() || null`
    //   pero sus campos ya no existen en el formulario: se sacaron de la
    //   interfaz el 2026-08-03. formData.get() devolvia null, y como
    //   z.string().optional() acepta undefined pero NO null, la validacion
    //   fallaba con "Datos de video invalidos" en cada guardado.
    //
    //   Ese fallo estaba TAPANDO algo peor: si se hubiera arreglado aceptando
    //   null, cada guardado habria escrito stream_playback_id = null. Esa
    //   columna esta VIVA -- Bunny guarda ahi la URL del HLS y el proxy de
    //   video la usa como respaldo para las clases viejas (ver CLAUDE.md). O
    //   sea que "arreglar la validacion" habria roto la reproduccion de las
    //   clases viejas, en silencio y de a una por cada edicion.
    //
    //   Omitirlas del update las deja intactas. En un insert quedan en null,
    //   que es lo correcto: las escribe la subida a Bunny, no este formulario.
    is_featured: parsed.data.isFeatured,
    published_at: parsed.data.status === "published" ? new Date().toISOString() : null,
    updated_by: user.id
  };

  const result = parsed.data.id
    ? await supabase.from("videos").update(payload).eq("id", parsed.data.id)
    : await supabase.from("videos").insert({ ...payload, created_by: user.id });

  if (result.error) {
    redirectWithMessage("/admin/videos", "error", result.error.message);
  }

  refreshAdminRoutes();
  guardadoOk("/admin/videos");
}

export async function deleteVideoAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseAdminClient();
  const id = String(formData.get("id") ?? "");

  // Fetch the Bunny id first so we can clean up the CDN asset after DB deletion.
  const { data: existing } = await supabase
    .from("videos")
    .select("bunny_video_id")
    .eq("id", id)
    .maybeSingle<{ bunny_video_id: string | null }>();

  const { error } = await supabase.from("videos").delete().eq("id", id);

  if (error) {
    redirectWithMessage("/admin/videos", "error", error.message);
  }

  if (existing?.bunny_video_id && hasBunnyStreamEnv()) {
    await deleteBunnyVideo(existing.bunny_video_id);
  }

  refreshAdminRoutes();
  guardadoOk("/admin/videos");
}

/** A job stuck this long is a dead worker, not a slow encode. */
const STUCK_JOB_HOURS = 4;

/**
 * Puts a mux job back in the queue.
 *
 * Without this the only way to retry is a hand-written UPDATE in the SQL editor
 * (worker/README.md documents it), which is not something to hand to a client.
 * Attempts reset to zero on purpose: an operator retrying after reading the
 * error deserves the full budget again.
 *
 * Only failed jobs, plus 'processing' ones abandoned for longer than the
 * worker's own encode timeout. Re-queueing a job a live worker still holds
 * would let a second worker mux the same class in parallel: both upload a new
 * Bunny video, only one wins the swap and the other leaks as an orphan asset.
 */
export async function requeueMuxJobAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseAdminClient();

  const jobId = String(formData.get("jobId") ?? "");
  if (!z.string().uuid().safeParse(jobId).success) {
    redirectWithMessage("/admin/videos", "error", "Job de muxeo invalido.");
  }

  const cutoff = new Date(Date.now() - STUCK_JOB_HOURS * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("video_mux_jobs")
    .update({ status: "pending", attempts: 0, last_error: null, claimed_at: null })
    .eq("id", jobId)
    .or(`status.eq.failed,and(status.eq.processing,claimed_at.lt.${cutoff})`)
    .select("id");

  if (error) {
    redirectWithMessage("/admin/videos", "error", error.message);
  }

  if (!data || data.length === 0) {
    redirectWithMessage(
      "/admin/videos",
      "error",
      "No se reencolo: el job ya no estaba fallido, o hay un worker procesandolo ahora."
    );
  }

  refreshAdminRoutes();
  redirectWithMessage(
    "/admin/videos",
    "success",
    "Muxeo reencolado. El worker lo toma en el proximo ciclo."
  );
}

export async function upsertProgramAction(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createSupabaseAdminClient();

  const parsed = programSchema.safeParse({
    id: formData.get("id"),
    slug: formData.get("slug"),
    titleEs: formData.get("titleEs"),
    titleEn: formData.get("titleEn"),
    descriptionEs: formData.get("descriptionEs"),
    descriptionEn: formData.get("descriptionEn"),
    membershipTierRequired: formData.get("membershipTierRequired"),
    status: formData.get("status"),
    durationDays: formData.get("durationDays"),
    coverImageUrl: formData.get("coverImageUrl"),
    isFeatured: checkboxValue(formData, "isFeatured")
  });

  if (!parsed.success) {
    redirectWithMessage("/admin/programs", "error", `Revisá: ${detalleZod(parsed.error)}`);
  }

  const payload = {
    slug: parsed.data.slug.trim(),
    title_i18n: buildI18n(parsed.data.titleEs.trim(), parsed.data.titleEn),
    description_i18n: buildI18n(parsed.data.descriptionEs.trim(), parsed.data.descriptionEn),
    membership_tier_required: parsed.data.membershipTierRequired,
    status: parsed.data.status,
    duration_days: parsed.data.durationDays,
    cover_image_url: parsed.data.coverImageUrl?.trim() || null,
    is_featured: parsed.data.isFeatured,
    published_at: parsed.data.status === "published" ? new Date().toISOString() : null,
    updated_by: user.id
  };

  const result = parsed.data.id
    ? await supabase.from("programs").update(payload).eq("id", parsed.data.id)
    : await supabase.from("programs").insert({ ...payload, created_by: user.id });

  if (result.error) {
    redirectWithMessage("/admin/programs", "error", result.error.message);
  }

  refreshAdminRoutes();
  guardadoOk("/admin/programs");
}

export async function deleteProgramAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseAdminClient();
  const id = String(formData.get("id") ?? "");

  const { error } = await supabase.from("programs").delete().eq("id", id);

  if (error) {
    redirectWithMessage("/admin/programs", "error", error.message);
  }

  refreshAdminRoutes();
  guardadoOk("/admin/programs");
}

export async function upsertProgramDayAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseAdminClient();
  const parsed = programDaySchema.safeParse({
    programId: formData.get("programId"),
    dayNumber: formData.get("dayNumber"),
    videoSlug: formData.get("videoSlug")
  });

  if (!parsed.success) {
    redirectWithMessage("/admin/programs", "error", `Revisá: ${detalleZod(parsed.error)}`);
  }

  const { data: video, error: videoError } = await supabase
    .from("videos")
    .select("id")
    .eq("slug", parsed.data.videoSlug.trim())
    .single<{ id: string }>();

  if (videoError || !video) {
    redirectWithMessage("/admin/programs", "error", "No existe un video con ese slug.");
  }

  const { error } = await supabase.from("program_days").upsert(
    {
      program_id: parsed.data.programId,
      day_number: parsed.data.dayNumber,
      video_id: video.id
    },
    {
      onConflict: "program_id,day_number"
    }
  );

  if (error) {
    redirectWithMessage("/admin/programs", "error", error.message);
  }

  refreshAdminRoutes();
  guardadoOk("/admin/programs");
}

export async function deleteProgramDayAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseAdminClient();
  const id = String(formData.get("id") ?? "");

  const { error } = await supabase.from("program_days").delete().eq("id", id);

  if (error) {
    redirectWithMessage("/admin/programs", "error", error.message);
  }

  refreshAdminRoutes();
  guardadoOk("/admin/programs");
}

/*
 * upsertSiteSettingAction SE ELIMINO el 2026-08-03.
 *
 * Escribia cualquier clave de site_settings con cualquier JSON, y era lo que
 * alimentaba el editor crudo de /admin/settings. Ese editor dejaba a Brunela a
 * un tipeo de romper `subscriptions.catalog` -- y con el, el cobro -- o
 * `subscriptions.access_defaults`, que decide quien tiene acceso.
 *
 * No alcanzaba con sacar el editor de la pantalla: una server action exportada
 * sigue siendo un endpoint POST publico aunque ninguna interfaz la use. Mientras
 * existiera, la proteccion era decorativa.
 *
 * La reemplazan dos acciones acotadas en src/features/admin/settings-actions.ts,
 * una por ajuste, que solo pueden tocar sus propios campos. Las claves
 * peligrosas se cambian por migracion, que queda versionada y revisable.
 */

export async function updateProfileAdminAction(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createSupabaseAdminClient();
  const parsed = profileSchema.safeParse({
    profileId: formData.get("profileId"),
    membershipTier: formData.get("membershipTier"),
    technicalLevel: formData.get("technicalLevel"),
    onboardingCompleted: checkboxValue(formData, "onboardingCompleted"),
    isAdmin: checkboxValue(formData, "isAdmin")
  });

  if (!parsed.success) {
    redirectWithMessage("/admin/users", "error", "Perfil invalido.");
  }

  if (parsed.data.profileId === user.id && !parsed.data.isAdmin) {
    redirectWithMessage("/admin/users", "error", "No podes quitarte el rol admin desde esta pantalla.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      membership_tier: parsed.data.membershipTier,
      technical_level: parsed.data.technicalLevel,
      onboarding_completed: parsed.data.onboardingCompleted,
      is_admin: parsed.data.isAdmin
    })
    .eq("id", parsed.data.profileId);

  if (error) {
    redirectWithMessage("/admin/users", "error", error.message);
  }

  refreshAdminRoutes();
  guardadoOk("/admin/users");
}
