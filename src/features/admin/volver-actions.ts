"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import {
  leerCandidatasVolver, leerNovedades, mandarVolverAlEstudio, registroVolverDisponible, AVISO_FALTA_MIGRACION_VOLVER,
} from "@/src/features/correos/volver-al-estudio";
import { textoSalteadas, textoSeMando } from "@/src/features/correos/reglas";

/**
 * "Invitarlas a volver por mail" (/admin/users?plan=sin-acceso) y "Mandarle un
 * mail para que vuelva" (/admin/users/[id]). Las dos llaman a esta accion.
 *
 * requireAdmin() va PRIMERO: una server action es un endpoint POST publico y
 * esta manda correos con la firma del estudio usando service_role (trampa 4).
 *
 * El navegador solo dice A QUIENES eligio Brunela. Si se puede o no mandarle a
 * cada una (sin acceso, sin baja, nada en los ultimos 14 dias) se vuelve a
 * leer aca, contra la base, en el momento de mandar.
 */

const UUID = z.string().uuid();
const MAXIMO_POR_ENVIO = 500;

/** A donde volver: solo pantallas de alumnas del panel, nunca una URL de afuera. */
function destino(crudo: FormDataEntryValue | null): string {
  const v = typeof crudo === "string" ? crudo : "";
  return /^\/admin\/users(\/[0-9a-f-]{36})?(\?[\w=&%.-]*)?$/i.test(v) ? v : "/admin/users?plan=sin-acceso";
}

function con(url: string, clave: "success" | "error", mensaje: string, ancla = "") {
  return `${url}${url.includes("?") ? "&" : "?"}${clave}=${encodeURIComponent(mensaje)}${ancla}`;
}

export async function mandarVolverAlEstudioAction(fd: FormData) {
  await requireAdmin();
  const volverA = destino(fd.get("volverA"));
  const ancla = volverA.startsWith("/admin/users/") ? "#volver" : "";

  const ids = [...new Set(fd.getAll("alumna").map(String))].filter((id) => UUID.safeParse(id).success);
  if (ids.length === 0) redirect(con(volverA, "error", "Elegí al menos una alumna.", ancla) as never);
  if (ids.length > MAXIMO_POR_ENVIO) redirect(con(volverA, "error", `Son muchas de una vez: elegí hasta ${MAXIMO_POR_ENVIO}.`, ancla) as never);

  const db = createSupabaseAdminClient();
  if (!(await registroVolverDisponible(db))) redirect(con(volverA, "error", AVISO_FALTA_MIGRACION_VOLVER, ancla) as never);

  let mensaje: string;
  let tono: "success" | "error" = "success";
  try {
    const [{ candidatas, registro }, novedades] = await Promise.all([leerCandidatasVolver(db, { soloIds: ids }), leerNovedades(db)]);
    if (!registro) {
      mensaje = "Falta correr la migración 20261009_3_correos_enviados.sql: sin el registro no se puede saber a quién ya le llegó.";
      tono = "error";
    } else {
      // Las elegidas que ya no estan "sin acceso" (pagaron o se les regalo un
      // plan mientras Brunela miraba la lista) no vuelven en candidatas.
      const encontradas = new Set(candidatas.map((c) => c.id));
      const yaTienen = ids.filter((id) => !encontradas.has(id));
      const r = await mandarVolverAlEstudio(db, candidatas, novedades);
      if (r.omitido) {
        mensaje = `No se mandó ningún mail: ${r.omitido}.`;
        tono = "error";
      } else {
        const salteadas = [
          ...r.salteadas,
          ...(yaTienen.length ? [{ id: "", nombre: yaTienen.length === 1 ? "1 alumna" : `${yaTienen.length} alumnas`, motivo: "ya tiene acceso al estudio" }] : []),
        ];
        mensaje = textoSeMando(r.enviadas.length) + textoSalteadas(salteadas) +
          (r.fallos ? ` ${r.fallos === 1 ? "1 no salió" : `${r.fallos} no salieron`} por un error del envío: probá de nuevo en un rato.` : "");
        if (r.enviadas.length === 0) tono = "error";
      }
    }
  } catch (e) {
    console.error("[volver] no se pudo mandar:", e instanceof Error ? e.message : String(e));
    mensaje = "No se pudo mandar: " + (e instanceof Error ? e.message : String(e));
    tono = "error";
  }

  revalidatePath("/admin/users");
  redirect(con(volverA, tono, mensaje, ancla) as never);
}
