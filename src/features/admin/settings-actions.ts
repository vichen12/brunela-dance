"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { invalidarAjustes } from "@/src/lib/settings";

/**
 * Los DOS ajustes que Brunela edita, cada uno con su propia accion.
 *
 * POR QUE NO HAY UNA ACCION GENERICA
 *   La que habia recibia una clave y un JSON de texto libre: servia para
 *   escribir cualquier cosa en cualquier clave, incluidos los doce price ids de
 *   Stripe y las reglas de acceso. Una accion por ajuste significa que, aunque
 *   alguien fabrique el POST a mano, no puede tocar mas que estos dos campos.
 *
 *   Es la misma idea que la migracion 18: no alcanza con que la interfaz no lo
 *   ofrezca; el endpoint tampoco tiene que poder.
 *
 * POR QUE ESCRIBE CON jsonb_set Y NO PISA EL VALOR ENTERO
 *   Cada ajuste puede tener claves que la interfaz no muestra. Reemplazar el
 *   objeto completo las borraria en silencio.
 */

function volver(kind: "success" | "error", msg: string): never {
  redirect(`/admin/settings?${kind}=${encodeURIComponent(msg)}` as never);
}

async function leerValor(clave: string): Promise<Record<string, unknown>> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("setting_key", clave)
    .maybeSingle<{ value: Record<string, unknown> }>();
  return data?.value ?? {};
}

async function escribirValor(clave: string, valor: Record<string, unknown>) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("site_settings")
    .update({ value: valor, updated_at: new Date().toISOString() })
    .eq("setting_key", clave);
  if (error) volver("error", error.message);

  // Los ajustes se leen cacheados (unstable_cache, 5 min). Sin esto, Brunela
  // cambia algo y no lo ve reflejado hasta que vence el cache.
  invalidarAjustes();
}

export async function guardarAjusteDeReservasAction(formData: FormData) {
  await requireAdmin();

  const actual = await leerValor("live_sessions.booking");
  await escribirValor("live_sessions.booking", {
    ...actual,
    allow_waitlist: formData.get("allowWaitlist") === "on",
    reveal_link_only_to_booked_users: formData.get("revealOnlyToBooked") === "on",
  });

  volver("success", "Listo, se guardaron las reservas.");
}

const PLANES = ["none", "corps_de_ballet", "solista", "principal"] as const;

export async function guardarAjusteDeChatAction(formData: FormData) {
  await requireAdmin();

  const actual = await leerValor("chat.dm_access");
  const nuevo: Record<string, unknown> = { ...actual };
  for (const plan of PLANES) {
    nuevo[plan] = formData.get(`dm_${plan}`) === "on";
  }

  await escribirValor("chat.dm_access", nuevo);
  volver("success", "Listo, se guardó quién puede escribirte.");
}
