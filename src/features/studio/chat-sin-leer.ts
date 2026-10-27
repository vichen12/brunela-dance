import { cache } from "react";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { chatsComoNotificaciones, type SalaSinLeer } from "@/src/features/studio/chat-aviso";

export { chatsComoNotificaciones, type SalaSinLeer };

/**
 * Que hay SIN LEER en los chats de quien mira: el chat directo y los canales.
 *
 * POR QUE EXISTE (2026-10-26)
 *   "A Brunela y a la gente no les llegan las notificaciones": para saber si
 *   alguien habia escrito habia que entrar a cada conversacion. De aca salen
 *   el numerito del menu, la campanita y el contador de cada conversacion.
 *
 * LA REGLA
 *   No leido = mensaje de OTRA persona posterior a `chat_lecturas.leido_hasta`
 *   de esa sala. La fila se adelanta sola al tener la sala abierta
 *   (components/chat-room.tsx).
 *   - Chat directo sin fila: cuenta todo lo de la otra persona.
 *   - Canal sin fila: solo la ultima semana. Quien entra por primera vez no
 *     tiene por que ver "143 mensajes nuevos" de conversaciones viejas.
 *
 * SIN LA MIGRACION 20261026_chat_lecturas.sql
 *   No se rompe: en un chat directo "no leido" pasa a ser lo que escribio la
 *   otra persona despues de tu ultima respuesta. Los canales, sin contador.
 *
 * Con el cliente DE ELLA: RLS decide que salas y que mensajes ve. A la admin
 * le devuelve todas las salas, asi que se recorta: sus DM y los canales activos.
 */


export type ChatsSinLeer = {
  /** false = falta la migracion: los canales no tienen contador. */
  conLecturas: boolean;
  salas: SalaSinLeer[];
  /** Todas las salas que ve, sin leer o no: para el contador en vivo. */
  tipos: Record<string, "dm" | "canal">;
  /** Nombre y otra persona de cada sala: para armar en vivo el aviso de la campanita. */
  info: Record<string, { nombre: string; otraId: string | null }>;
};

const SEMANA = 7 * 24 * 3600 * 1000;

type Sala = { id: string; type: string; name: string; is_archived: boolean; participant_ids: string[] | null };
type Msg = { id: string; room_id: string; user_id: string; content: string; author_name: string | null; created_at: string };

export const getChatsSinLeer = cache(async (userId: string, esAdmin: boolean): Promise<ChatsSinLeer> => {
  const supabase = await createSupabaseServerClient();

  const [{ data: salasData }, lecturas] = await Promise.all([
    supabase.from("chat_rooms").select("id, type, name, is_archived, participant_ids"),
    supabase.from("chat_lecturas").select("room_id, leido_hasta"),
  ]);
  const conLecturas = !lecturas.error;
  const leidoHasta = new Map(((lecturas.data ?? []) as { room_id: string; leido_hasta: string }[]).map((l) => [l.room_id, l.leido_hasta]));

  const salas = ((salasData ?? []) as Sala[]).filter((s) =>
    s.type === "dm"
      ? (s.participant_ids ?? []).includes(userId)
      : (s.type === "community" || s.type === "tier") && !s.is_archived
  );
  const tipos = Object.fromEntries(salas.map((s) => [s.id, s.type === "dm" ? "dm" : "canal"] as const));
  const info = Object.fromEntries(
    salas.map((s) => [s.id, { nombre: s.name, otraId: s.type === "dm" ? (s.participant_ids ?? []).find((p) => p !== userId) ?? null : null }])
  );
  if (!salas.length) return { conLecturas, salas: [], tipos, info };

  const desdeCanal = new Date(Date.now() - SEMANA).toISOString();
  const corte = (s: Sala) => leidoHasta.get(s.id) ?? (s.type === "dm" ? "2000-01-01T00:00:00Z" : desdeCanal);
  const masViejo = salas.map(corte).sort()[0];

  // Mensajes de todas (tambien los propios: en el modo sin migracion hacen
  // falta para saber donde contesto ella). Los mas nuevos primero.
  const { data: msgsData } = await supabase
    .from("chat_messages")
    .select("id, room_id, user_id, content, author_name, created_at")
    .in("room_id", salas.map((s) => s.id))
    .eq("is_deleted", false)
    .gt("created_at", conLecturas ? masViejo : "2000-01-01T00:00:00Z")
    .order("created_at", { ascending: false })
    .limit(1000);
  const porSala = new Map<string, Msg[]>();
  for (const m of (msgsData ?? []) as Msg[]) {
    const l = porSala.get(m.room_id) ?? [];
    l.push(m);
    porSala.set(m.room_id, l);
  }

  const resultado: SalaSinLeer[] = [];
  for (const s of salas) {
    const msgs = porSala.get(s.id) ?? [];
    let noLeidos: Msg[] = [];
    if (conLecturas) {
      const c = corte(s);
      noLeidos = msgs.filter((m) => m.user_id !== userId && m.created_at > c);
    } else if (s.type === "dm") {
      for (const m of msgs) {
        if (m.user_id === userId) break;
        noLeidos.push(m);
      }
    }
    if (!noLeidos.length) continue;
    const u = noLeidos[0];
    resultado.push({
      roomId: s.id,
      tipo: s.type === "dm" ? "dm" : "canal",
      nombre: s.name,
      noLeidos: noLeidos.length,
      otraId: s.type === "dm" ? (s.participant_ids ?? []).find((p) => p !== userId) ?? null : null,
      ultimo: { id: u.id, autor: u.author_name?.trim() || (esAdmin ? "Una alumna" : "Brunela"), texto: u.content, cuando: u.created_at },
    });
  }
  resultado.sort((a, b) => (b.ultimo?.cuando ?? "").localeCompare(a.ultimo?.cuando ?? ""));
  return { conLecturas, salas: resultado, tipos, info };
});
