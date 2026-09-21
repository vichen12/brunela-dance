"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { invalidarAjustes } from "@/src/lib/settings";
import { deleteBunnyVideo, hasBunnyStreamEnv } from "@/src/lib/video/bunny";
import {
  CATEGORIA_SLUGS,
  MATERIAL_SLUGS,
  NIVEL_SLUGS,
  PLAN_SLUGS,
  TIPO_SLUGS,
  nivelARango
} from "@/src/features/studio/catalogo-clases";

const videoSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  slug: z.string().min(3),
  titleEs: z.string().min(1),
  titleEn: z.string().optional(),
  descriptionEs: z.string().min(1),
  descriptionEn: z.string().optional(),
  /**
   * 🔴 ESTO ES CONTROL DE ACCESO, no una etiqueta: es lo que lee la policy
   *    videos_select_allowed_by_tier. `.min(1)` no es cosmetico -- la lista
   *    vacia seria una clase que no ve nadie, y la base la rechaza igual con un
   *    check constraint. Se valida en los dos lados a proposito.
   */
  planesPermitidos: z.array(z.enum(PLAN_SLUGS)).min(1),
  /**
   * "archived" sigue aceptandose aunque el formulario ya no lo ofrezca: el
   * desplegable de una clase archivada de antes muestra su propio estado, y
   * sacarlo de aca haria fallar el guardado de esa clase sin haberla tocado.
   */
  status: z.enum(["draft", "published", "archived"]),
  /** Llega en MINUTOS desde el formulario; se convierte antes de guardar. */
  durationMinutes: z.coerce.number().int().positive().max(600),
  contentType: z.enum(TIPO_SLUGS),
  categorySlug: z.enum(CATEGORIA_SLUGS),
  nivel: z.enum(NIVEL_SLUGS),
  /**
   * Listas cerradas y no texto libre. Antes esto era un CSV: "Colchoneta" y
   * "colchoneta" eran dos materiales distintos para la base, y una clase con un
   * slug mal escrito desaparecia de todos los filtros sin dar ningun error.
   */
  equipment: z.array(z.enum(MATERIAL_SLUGS)).default([]),
  thumbnailUrl: z.string().optional(),
  // streamPlaybackId y streamAssetId NO estan aca a proposito: ver el payload.
  // NOTE: audio_tracks is deliberately absent. It is written by the mux worker
  // (worker/index.mjs) once a language is verified inside the encoded video.
  // The old manual "Mux Audio Track ID" fields wrote it from this form, which
  // wiped the worker's record on every save -- the inputs were always empty
  // because Bunny has no per-track ids to paste in the first place.
  isFeatured: z.boolean().default(false)
});

/** Una clase ocupando un dia de un plan de trabajo. */
const claseEnPlanSchema = z.object({
  videoId: z.string().uuid(),
  programId: z.string().uuid(),
  dayNumber: z.coerce.number().int().positive().max(365),
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
  planesPermitidos: "planes que la pueden ver",
  status: "estado",
  durationMinutes: "duración",
  contentType: "tipo de contenido",
  categorySlug: "categoría",
  nivel: "nivel",
  equipment: "materiales",
  thumbnailUrl: "portada",
  isFeatured: "destacado",
  title: "título",
  dayNumber: "día",
  videoId: "clase",
  programId: "plan de trabajo",
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
    // getAll y no get: son listas de a una entrada por elegido. Con get()
    // llegaria solo el PRIMER material y el primer plan, y la clase quedaria
    // mas cerrada de lo que se eligio sin avisar.
    planesPermitidos: formData.getAll("planesPermitidos"),
    status: formData.get("status"),
    durationMinutes: formData.get("durationMinutes"),
    contentType: formData.get("contentType"),
    categorySlug: formData.get("categorySlug"),
    nivel: formData.get("nivel"),
    equipment: formData.getAll("equipment"),
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
    // membership_tier_required NO se escribe aca: lo deriva el trigger
    // videos_sincronizar_planes como el plan mas bajo de la lista. Mandarlo
    // ademas seria dar dos ordenes distintas sobre lo mismo, y la que gana no
    // es la que se lee en este archivo.
    planes_permitidos: parsed.data.planesPermitidos,
    status: parsed.data.status,
    duration_seconds: parsed.data.durationMinutes * 60,
    content_type: parsed.data.contentType,
    // La categoria es una sola, pero la columna es un array desde el primer dia
    // y la biblioteca filtra con `overlaps`. Se guarda como array de uno.
    category_slugs: [parsed.data.categorySlug],
    recommended_min_level: nivelARango(parsed.data.nivel).min,
    recommended_max_level: nivelARango(parsed.data.nivel).max,
    equipment: parsed.data.equipment,
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

/**
 * Enganchar una clase a un dia de un plan de trabajo, DESDE LA CLASE.
 *
 * POR QUE NO SE REUSA `upsertProgramDayAction`
 *   Esa recibe el SLUG de la clase (porque en /admin/programs se elige la clase
 *   de una lista) y termina en /admin/programs. Llamada desde el panel de la
 *   clase haria dos cosas mal: pedir un dato que ahi no se elige, y sacar a
 *   Brunela a otra pantalla cerrandole el panel que tenia abierto.
 *
 *   Son cinco lineas de diferencia y evitan un parametro "¿a donde vuelvo?"
 *   dentro de una accion que escribe con service_role.
 *
 * `upsert` sobre (program_id, day_number), que es el unique de la tabla: si ese
 * dia ya tenia otra clase, esta la reemplaza. La interfaz lo avisa.
 *
 * ⚠️ Una clase puede estar en VARIOS planes y en varios dias. Esto no es un
 *    "mover": cada llamada agrega una ubicacion mas.
 */
export async function agregarClaseAPlanAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseAdminClient();

  const parsed = claseEnPlanSchema.safeParse({
    videoId: formData.get("videoId"),
    programId: formData.get("programId"),
    dayNumber: formData.get("dayNumber"),
  });

  if (!parsed.success) {
    redirectWithMessage("/admin/videos", "error", `Revisá: ${detalleZod(parsed.error)}`);
  }

  const { error } = await supabase.from("program_days").upsert(
    {
      program_id: parsed.data.programId,
      day_number: parsed.data.dayNumber,
      video_id: parsed.data.videoId,
    },
    { onConflict: "program_id,day_number" }
  );

  if (error) {
    redirectWithMessage("/admin/videos", "error", error.message);
  }

  refreshAdminRoutes();
  revalidatePath("/dashboard/programs");
  guardadoOk("/admin/videos");
}

/** Sacar la clase de un dia de un plan. No borra ni la clase ni el plan. */
export async function quitarClaseDePlanAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseAdminClient();
  const id = String(formData.get("programDayId") ?? "");

  const { error } = await supabase.from("program_days").delete().eq("id", id);

  if (error) {
    redirectWithMessage("/admin/videos", "error", error.message);
  }

  refreshAdminRoutes();
  revalidatePath("/dashboard/programs");
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
