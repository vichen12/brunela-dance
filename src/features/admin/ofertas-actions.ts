"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { madridAIso } from "@/src/features/studio/sesiones-privadas-reglas";
import { esFaltaDeColumnaOferta } from "@/src/features/studio/ofertas";

/**
 * La oferta por tiempo limitado de un pack (20261026_3_ofertas_de_packs.sql).
 * requireAdmin() PRIMERO: corre con service_role (trampa 4).
 */

const FALTA_MIGRACION = "Para cargar ofertas falta correr la migración 20261026_3_ofertas_de_packs.sql en Supabase.";

function volver(kind: "success" | "error", msg: string): never {
  redirect(`/admin/packs?${kind}=${encodeURIComponent(msg)}` as never);
}

function refrescar() {
  revalidatePath("/admin/packs");
  revalidatePath("/");
  revalidatePath("/dashboard/packs");
  revalidatePath("/dashboard/plan");
}

export async function guardarOfertaDePackAction(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("packId") ?? "");
  // "9,90" o "9.90" -> 990
  const precioTexto = String(fd.get("ofertaPrecio") ?? "").trim().replace(/\s|€/g, "").replace(",", ".");
  const euros = Number(precioTexto);
  // datetime-local trae "2026-11-02T23:59", sin zona: es hora de Madrid, no
  // la del servidor (Vercel corre en UTC).
  const [fecha, hora] = String(fd.get("ofertaHasta") ?? "").split("T");
  const hasta = madridAIso(fecha ?? "", (hora ?? "").slice(0, 5));

  if (!/^[0-9a-f-]{36}$/i.test(id)) volver("error", "Pack inválido.");
  if (!Number.isFinite(euros) || euros <= 0) volver("error", "Poné el precio de oferta, por ejemplo 9,90.");
  if (!hasta) volver("error", "Elegí hasta qué día y hora dura la oferta.");
  if (Date.parse(hasta) <= Date.now()) volver("error", "La fecha de fin de la oferta tiene que ser en el futuro.");

  const db = createSupabaseAdminClient();
  const { data: pack } = await db.from("packs").select("price_cents, name_i18n").eq("id", id).maybeSingle<{ price_cents: number; name_i18n: Record<string, string> }>();
  if (!pack) volver("error", "Ese pack ya no existe.");
  const cents = Math.round(euros * 100);
  if (cents >= pack.price_cents) volver("error", `La oferta tiene que ser más barata que el precio normal (${(pack.price_cents / 100).toLocaleString("es-ES")} €).`);

  const { error } = await db.from("packs").update({ oferta_precio_cents: cents, oferta_hasta: hasta }).eq("id", id);
  if (error) volver("error", esFaltaDeColumnaOferta(error) ? FALTA_MIGRACION : error.message);
  refrescar();
  volver("success", `Listo: «${pack.name_i18n?.es ?? "el pack"}» queda en oferta hasta la fecha que elegiste.`);
}

export async function quitarOfertaDePackAction(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("packId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) volver("error", "Pack inválido.");
  const { error } = await createSupabaseAdminClient().from("packs").update({ oferta_precio_cents: null, oferta_hasta: null }).eq("id", id);
  if (error) volver("error", esFaltaDeColumnaOferta(error) ? FALTA_MIGRACION : error.message);
  refrescar();
  volver("success", "Listo, se quitó la oferta: el pack vuelve a su precio.");
}
