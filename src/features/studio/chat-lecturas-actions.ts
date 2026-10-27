"use server";

import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

/**
 * "Marcar como leídas" de la campanita, para los CHATS (2026-10-27).
 *
 * Antes la campanita solo guardaba en el navegador que avisos ya se vieron:
 * el numerito de "Mi chat" / "Mensajes" / "Comunidad" no se enteraba y seguia
 * marcando mensajes sin leer. Ahora adelanta chat_lecturas de esas salas hasta
 * AHORA (hora del servidor), igual que tener la sala abierta.
 *
 * Con el cliente DE ELLA: la policy de chat_lecturas solo deja escribir filas
 * propias (user_id = auth.uid()), asi que nadie puede marcar por otra persona.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Con nombre y no en la firma: scripts/verificar-guardas.mjs busca el cuerpo
// de cada action por su primera llave.
type Respuesta = { ok: boolean };

export async function marcarChatsLeidosAction(roomIds: string[]): Promise<Respuesta> {
  const { user } = await requireUser();
  const ids = [...new Set(Array.isArray(roomIds) ? roomIds : [])].filter((id) => typeof id === "string" && UUID.test(id)).slice(0, 100);
  if (!ids.length) return { ok: true };
  const supabase = await createSupabaseServerClient();
  const ahora = new Date().toISOString();
  const { error } = await supabase
    .from("chat_lecturas")
    .upsert(ids.map((room_id) => ({ user_id: user.id, room_id, leido_hasta: ahora })), { onConflict: "user_id,room_id" });
  if (error) console.error("[chat] marcar como leidos:", error.message);
  return { ok: !error };
}
