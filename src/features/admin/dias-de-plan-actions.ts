"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import {
  AVISO_FALTA_MIGRACION_DESCANSO,
  NOTA_DESCANSO_MAX,
  NOTA_DESCANSO_POR_DEFECTO,
  esFaltaDeColumnaDescanso,
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
