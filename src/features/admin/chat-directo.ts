import type { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

/**
 * El chat privado entre la admin y una alumna: encontrarlo (o abrirlo) y
 * escribirle.
 *
 * Vivia adentro de ficha-actions.ts. Se saco a un modulo SIN "use server" a
 * proposito: en un archivo "use server" toda funcion exportada es un endpoint
 * POST publico (trampa 4), y estas reciben el cliente de service_role ya
 * armado. Las llaman las actions DESPUES de requireAdmin(): la ficha y las
 * sesiones privadas.
 */

type Db = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Busca la sala de DM entre la admin y la alumna; si no hay, la crea.
 *
 * Si hay varias (la pantalla de chat las duplicaba al cargarse en paralelo),
 * usa la MAS VIEJA, que es la que ya tiene la conversacion. Asi el mensaje
 * nuevo cae donde ella ya estaba leyendo.
 */
export async function salaDirecta(db: Db, adminId: string, alumnaId: string, nombre: string) {
  const { data: existentes } = await db
    .from("chat_rooms")
    .select("id")
    .eq("type", "dm")
    .contains("participant_ids", [adminId, alumnaId])
    .order("created_at", { ascending: true })
    .limit(1);
  if (existentes?.[0]) return existentes[0].id as string;

  const { data, error } = await db
    .from("chat_rooms")
    .insert({ type: "dm", name: `DM: Brunela — ${nombre}`, participant_ids: [adminId, alumnaId], tier_required: "none" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/**
 * Le escribe a la alumna por su chat privado, como la admin que esta logueada.
 * Devuelve null si salio bien, o el motivo si no: quien llama decide si eso
 * frena su accion o solo se avisa (en las sesiones privadas, la sesion ya
 * quedo agendada aunque el mensaje falle).
 */
export async function escribirleALaAlumna(db: Db, adminId: string, alumnaId: string, texto: string): Promise<string | null> {
  try {
    const [{ data: alumna }, { data: yo }] = await Promise.all([
      db.from("profiles").select("full_name, email").eq("id", alumnaId).maybeSingle(),
      db.from("profiles").select("full_name").eq("id", adminId).maybeSingle(),
    ]);
    if (!alumna) return "No se encontró a la alumna.";
    const salaId = await salaDirecta(db, adminId, alumnaId, alumna.full_name ?? alumna.email);
    const { error } = await db.from("chat_messages").insert({
      room_id: salaId,
      user_id: adminId,
      content: texto,
      author_name: yo?.full_name ?? "Brunela",
      author_is_admin: true,
    });
    return error ? error.message : null;
  } catch (e) {
    return (e as Error).message;
  }
}
