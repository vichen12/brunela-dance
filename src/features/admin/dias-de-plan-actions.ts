"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { aDireccion } from "@/src/lib/slug";
import {
  AVISO_FALTA_MIGRACION_DESCANSO,
  MAX_DIAS_PLAN,
  NOTA_DESCANSO_MAX,
  NOTA_DESCANSO_POR_DEFECTO,
  esFaltaDeColumnaDescanso,
  filasParaGuardar,
  leerCasilleros,
} from "@/src/features/studio/dias-de-plan";

/**
 * Cargar un dia de un plan de trabajo desde /admin/programs: una CLASE o un
 * DESCANSO.
 *
 * 🔴 requireAdmin() va PRIMERO (trampa 4): una server action es un endpoint
 *    POST publico y esta escribe con service_role.
 *
 * POR QUE NO VA EN actions.ts JUNTO A upsertProgramDayAction
 *   Esa sigue igual (la usaba este mismo formulario). Esta escribe SIEMPRE las
 *   tres columnas juntas -- video_id, es_descanso, nota -- porque el CHECK
 *   program_days_clase_o_descanso exige que un dia sea exactamente una cosa.
 *   Un upsert que mandara solo video_id sobre un dia que era descanso dejaria
 *   es_descanso = true y la base lo rechazaria (23514).
 *
 * El formulario manda `videoId` (el id, no el slug: el buscador elige por id)
 * o `descanso=1`.
 */

const esquema = z.object({
  programId: z.string().uuid(),
  dayNumber: z.coerce.number().int().positive().max(365),
  descanso: z.boolean(),
  videoId: z.string().uuid().optional(),
  nota: z.string().max(NOTA_DESCANSO_MAX, `La nota puede tener hasta ${NOTA_DESCANSO_MAX} caracteres.`).optional(),
});

function volver(tipo: "success" | "error", mensaje: string): never {
  redirect(`/admin/programs?${tipo}=${encodeURIComponent(mensaje)}` as never);
}

export async function guardarDiaDePlanAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const eleccion = String(formData.get("eleccion") ?? "");
  const descanso = eleccion === "descanso";
  const parsed = esquema.safeParse({
    programId: formData.get("programId"),
    dayNumber: formData.get("dayNumber"),
    descanso,
    videoId: descanso || !eleccion ? undefined : eleccion,
    nota: String(formData.get("nota") ?? "").trim() || undefined,
  });

  if (!parsed.success) {
    volver("error", `Revisá: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
  }
  const d = parsed.data;
  if (!d.descanso && !d.videoId) volver("error", "Elegí una clase o «Descanso» para ese día.");

  // La nota por defecto no se guarda: null deja que la pantalla ponga la
  // vigente, y si un dia cambia el texto, cambia en todos los descansos.
  const nota = d.descanso && d.nota && d.nota !== NOTA_DESCANSO_POR_DEFECTO ? d.nota : null;

  const fila = d.descanso
    ? { program_id: d.programId, day_number: d.dayNumber, video_id: null, es_descanso: true, nota }
    : { program_id: d.programId, day_number: d.dayNumber, video_id: d.videoId!, es_descanso: false, nota: null };

  const { error } = await supabase.from("program_days").upsert(fila, { onConflict: "program_id,day_number" });

  if (error) {
    if (esFaltaDeColumnaDescanso(error) || /null value in column "video_id"/.test(error.message)) {
      // Sin la migracion, solo una clase se puede guardar, como antes.
      if (d.descanso) volver("error", AVISO_FALTA_MIGRACION_DESCANSO);
      const viejo = await supabase
        .from("program_days")
        .upsert(
          { program_id: d.programId, day_number: d.dayNumber, video_id: d.videoId! },
          { onConflict: "program_id,day_number" }
        );
      if (viejo.error) volver("error", viejo.error.message);
    } else if (error.code === "23503") {
      volver("error", "Esa clase ya no existe. Recargá la página y elegila de nuevo.");
    } else {
      volver("error", error.message);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/programs");
  revalidatePath("/admin/videos");
  revalidatePath("/dashboard/programs", "layout");
}

// ─────────────────────────────────────────────────────────────────────────────
// Editor de plan a pantalla completa (/admin/programs/nuevo y /[id])
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoEditorPlan =
  | { tipo: "inicial" }
  | { tipo: "ok"; mensaje: string; aviso?: string; vez: number }
  | { tipo: "error"; mensaje: string; vez: number };

const planEsquema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  slug: z.string().trim().min(3, "La dirección necesita al menos 3 letras.").max(120),
  titleEs: z.string().trim().min(1, "Falta el título."),
  titleEn: z.string().optional(),
  descriptionEs: z.string().trim().min(1, "Falta la descripción."),
  descriptionEn: z.string().optional(),
  membershipTierRequired: z.enum(["solista", "principal"]),
  status: z.enum(["draft", "published", "archived"]),
  coverImageUrl: z.string().optional(),
  isFeatured: z.boolean(),
});

const i18n = (es: string, en?: string) => ({ es, ...(en?.trim() ? { en: en.trim() } : {}) });

const nombrarDias = (nums: number[]) => (nums.length === 1 ? `el día ${nums[0]}` : `los días ${nums.join(", ")}`);

/**
 * Guarda el plan ENTERO -- sus datos y todos sus dias -- de una vez.
 *
 * POR QUE "GUARDAR TODO" Y NO AUTOGUARDADO POR FILA
 *   Reordenar es intercambiar dias. Con un guardado por fila, mover el dia 3 al
 *   5 son dos escrituras, y si la segunda falla el plan queda con dos dias
 *   iguales o con uno perdido, ya visible para las alumnas. Con un solo
 *   guardado el estado final se arma en el navegador y se escribe junto:
 *   upsert de todos los dias por (program_id, day_number) -- cada numero
 *   aparece una sola vez, asi que no hay choques del unique -- y despues se
 *   borran los numeros que quedaron vacios.
 *
 * "TRANSACCIONAL DENTRO DE LO POSIBLE"
 *   PostgREST no da transacciones entre dos llamadas. El orden es el que menos
 *   rompe: primero el plan, despues los dias, al final los borrados. Si los
 *   dias fallan se prueban de a uno para decir CUALES no entraron, y esos
 *   numeros no se borran (conservan lo que tenian).
 */
export async function guardarPlanCompletoAction(_prev: EstadoEditorPlan, formData: FormData): Promise<EstadoEditorPlan> {
  const { user } = await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const vez = Date.now();

  const texto = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const parsed = planEsquema.safeParse({
    id: texto("id") ?? "",
    slug: texto("slug"),
    titleEs: texto("titleEs"),
    titleEn: texto("titleEn"),
    descriptionEs: texto("descriptionEs"),
    descriptionEn: texto("descriptionEn"),
    membershipTierRequired: texto("membershipTierRequired"),
    status: texto("status"),
    coverImageUrl: texto("coverImageUrl"),
    isFeatured: formData.get("isFeatured") === "on",
  });
  if (!parsed.success) {
    return { tipo: "error", mensaje: parsed.error.issues.map((i) => i.message).join(" "), vez };
  }
  const p = parsed.data;

  const casilleros = leerCasilleros(formData.get("dias"));
  if (!casilleros) return { tipo: "error", mensaje: "No se pudieron leer los días. Recargá la página y probá de nuevo.", vez };
  const filas = filasParaGuardar(casilleros);

  // Las clases elegidas tienen que existir (pudieron borrarse con el editor abierto).
  const ids = [...new Set(filas.flatMap((f) => (f.video_id ? [f.video_id] : [])))];
  if (ids.length > 0) {
    const { data: existen } = await supabase.from("videos").select("id").in("id", ids);
    const hay = new Set((existen ?? []).map((v: { id: string }) => v.id));
    const faltan = filas.filter((f) => f.video_id && !hay.has(f.video_id)).map((f) => f.day_number);
    if (faltan.length > 0) {
      return { tipo: "error", mensaje: `La clase de ${nombrarDias(faltan)} ya no existe. Elegí otra y guardá de nuevo.`, vez };
    }
  }

  // ── 1. El plan ─────────────────────────────────────────────────────────────
  let publishedAt: string | null = null;
  if (p.status === "published") {
    publishedAt = new Date().toISOString();
    if (p.id) {
      const { data: antes } = await supabase
        .from("programs").select("published_at").eq("id", p.id)
        .maybeSingle<{ published_at: string | null }>();
      if (antes?.published_at) publishedAt = antes.published_at;
    }
  }

  const datos = {
    title_i18n: i18n(p.titleEs, p.titleEn),
    description_i18n: i18n(p.descriptionEs, p.descriptionEn),
    membership_tier_required: p.membershipTierRequired,
    status: p.status,
    duration_days: casilleros.length,
    cover_image_url: p.coverImageUrl?.trim() || null,
    is_featured: p.isFeatured,
    published_at: publishedAt,
    updated_by: user.id,
  };

  let programId = p.id || "";
  if (programId) {
    // La direccion NO se cambia al editar: romperia los enlaces compartidos.
    const { error } = await supabase.from("programs").update(datos).eq("id", programId);
    if (error) return { tipo: "error", mensaje: `No se guardó el plan: ${error.message}`, vez };
  } else {
    const slug = aDireccion(p.slug);
    const { data, error } = await supabase
      .from("programs")
      .insert({ ...datos, slug, created_by: user.id })
      .select("id")
      .single<{ id: string }>();
    if (error || !data) {
      if (error?.code === "23505") {
        return { tipo: "error", mensaje: `Ya hay un plan con la dirección «${slug}». Cambiale un poco el título o la dirección.`, vez };
      }
      return { tipo: "error", mensaje: `No se creó el plan: ${error?.message ?? "error desconocido"}`, vez };
    }
    programId = data.id;
  }

  // ── 2. Los dias ────────────────────────────────────────────────────────────
  const conPlan = filas.map((f) => ({ program_id: programId, ...f }));
  const fallaron: number[] = [];
  let sinMigracion: number[] = [];

  if (conPlan.length > 0) {
    const { error } = await supabase.from("program_days").upsert(conPlan, { onConflict: "program_id,day_number" });
    if (error && esFaltaDeColumnaDescanso(error)) {
      // Sin la migracion 20261025: las clases se guardan como antes, los
      // descansos no se pueden guardar y se dice cuales.
      sinMigracion = conPlan.filter((f) => f.es_descanso).map((f) => f.day_number);
      const clases = conPlan
        .filter((f) => !f.es_descanso)
        .map(({ program_id, day_number, video_id }) => ({ program_id, day_number, video_id }));
      if (clases.length > 0) {
        const r = await supabase.from("program_days").upsert(clases, { onConflict: "program_id,day_number" });
        if (r.error) fallaron.push(...clases.map((c) => c.day_number));
      }
    } else if (error) {
      // De a uno, para poder decir cuales.
      for (const fila of conPlan) {
        const r = await supabase.from("program_days").upsert(fila, { onConflict: "program_id,day_number" });
        if (r.error) {
          console.error(`[plan ${programId}] dia ${fila.day_number}:`, r.error.message);
          fallaron.push(fila.day_number);
        }
      }
    }
  }

  // ── 3. Los numeros que quedaron vacios (o que sobran) se borran ───────────
  // Los que se intentaron escribir NO, aunque hayan fallado: conservan lo que
  // tenian, que es mejor que perderlo.
  const quedan = conPlan.map((f) => f.day_number);
  let borrado = supabase.from("program_days").delete().eq("program_id", programId);
  if (quedan.length > 0) borrado = borrado.not("day_number", "in", "(" + quedan.join(",") + ")");
  const { error: errorBorrado } = await borrado;

  revalidatePath("/admin");
  revalidatePath("/admin/programs");
  revalidatePath(`/admin/programs/${programId}`);
  revalidatePath("/admin/videos");
  revalidatePath("/dashboard/programs", "layout");

  const avisos: string[] = [];
  if (fallaron.length > 0) avisos.push(`No se pudo guardar ${nombrarDias(fallaron)}: revisalos y guardá de nuevo.`);
  if (sinMigracion.length > 0) avisos.push(`No se guardó como descanso ${nombrarDias(sinMigracion)}. ${AVISO_FALTA_MIGRACION_DESCANSO}`);
  if (errorBorrado) avisos.push(`No se pudieron vaciar los días que sacaste: ${errorBorrado.message}`);
  const aviso = avisos.join(" ") || undefined;

  if (!p.id) {
    // Recien creado: a su propia pantalla, con el resultado en la URL.
    redirect(
      (aviso
        ? `/admin/programs/${programId}?error=${encodeURIComponent("El plan se creó, pero: " + aviso)}`
        : `/admin/programs/${programId}?success=${encodeURIComponent("Plan creado con sus días.")}`) as never
    );
  }

  return aviso ? { tipo: "ok", mensaje: "Se guardó el plan, con avisos.", aviso, vez } : { tipo: "ok", mensaje: "Guardado", vez };
}

/** Borrar un plan entero (sus dias caen en cascada). Vuelve a la lista. */
export async function borrarPlanAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) volver("error", "No se encontró ese plan.");

  const { error } = await supabase.from("programs").delete().eq("id", id);
  if (error) {
    redirect(`/admin/programs/${id}?error=${encodeURIComponent(error.message)}` as never);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/programs");
  revalidatePath("/dashboard/programs", "layout");
  volver("success", "Plan borrado.");
}

/**
 * Poner una clase en un dia de un plan DESDE EL PANEL DE LA CLASE
 * (components/clase-en-planes.tsx). Reemplaza ahi a agregarClaseAPlanAction.
 *
 * Escribe las tres columnas: si ese dia era un DESCANSO, pasa a ser esta clase
 * (la pantalla lo avisa antes: «El día 4 es un descanso: se reemplaza»). La
 * accion vieja mandaba solo video_id, dejaba es_descanso = true y la base la
 * rechazaba con el error crudo del CHECK.
 */
export async function ponerClaseEnDiaDePlanAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const aVideos = (m: string): never => redirect(`/admin/videos?error=${encodeURIComponent(m)}` as never);

  const parsed = z
    .object({
      videoId: z.string().uuid(),
      programId: z.string().uuid(),
      dayNumber: z.coerce.number().int().positive().max(MAX_DIAS_PLAN),
    })
    .safeParse({
      videoId: formData.get("videoId"),
      programId: formData.get("programId"),
      dayNumber: formData.get("dayNumber"),
    });
  if (!parsed.success) aVideos("Revisá el plan y el día.");
  const d = parsed.data!;

  const fila = { program_id: d.programId, day_number: d.dayNumber, video_id: d.videoId };
  const { error } = await supabase
    .from("program_days")
    .upsert({ ...fila, es_descanso: false, nota: null }, { onConflict: "program_id,day_number" });

  if (error) {
    if (esFaltaDeColumnaDescanso(error)) {
      const r = await supabase.from("program_days").upsert(fila, { onConflict: "program_id,day_number" });
      if (r.error) aVideos(r.error.message);
    } else if (error.code === "23514") {
      aVideos(`El día ${d.dayNumber} de ese plan no se pudo cambiar. Abrí el plan en Planes de trabajo y cambialo ahí.`);
    } else {
      aVideos(error.message);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/videos");
  revalidatePath("/admin/programs");
  revalidatePath("/dashboard/programs", "layout");
}
