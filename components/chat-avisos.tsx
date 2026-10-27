"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/client";

/**
 * Mensajes sin leer EN VIVO: el numerito de "Mi chat", "Comunidad" y
 * "Mensajes", y el de cada conversacion o canal.
 *
 * El servidor calcula lo que habia al cargar (src/features/studio/chat-sin-leer.ts)
 * y esto lo mantiene al dia sin recargar:
 *   - llega un mensaje de otra persona a una sala que no esta abierta -> +1
 *   - se abre la sala (components/chat-room.tsx) -> 0
 *
 * Es un almacen chico de modulo, no un contexto: el menu y las paginas no
 * comparten un padre de cliente. Mientras no arranca (primer render, servidor)
 * cada contador muestra el numero que le paso el servidor.
 */

type Tipo = "dm" | "canal";
type Estado = { listo: boolean; porSala: Record<string, number>; tipos: Record<string, Tipo>; abierta: string | null };

let estado: Estado = { listo: false, porSala: {}, tipos: {}, abierta: null };
const oyentes = new Set<() => void>();
function cambiar(nuevo: Estado) {
  estado = nuevo;
  oyentes.forEach((o) => o());
  actualizarTitulo();
}
function suscribir(o: () => void) {
  oyentes.add(o);
  return () => { oyentes.delete(o); };
}

function totalDe(tipo: Tipo) {
  let n = 0;
  for (const [sala, c] of Object.entries(estado.porSala)) if ((estado.tipos[sala] ?? "dm") === tipo) n += c;
  return n;
}

/** "(3) Brunela Dance Trainer": que se vea desde la pestaña del navegador. */
function actualizarTitulo() {
  if (typeof document === "undefined") return;
  const n = totalDe("dm") + totalDe("canal");
  const base = document.title.replace(/^\(\d+\)\s*/, "");
  document.title = n > 0 ? `(${n}) ${base}` : base;
}

/** La sala que se esta mirando: sus mensajes nuevos no suman. */
export function salaAbierta(roomId: string | null) {
  estado = { ...estado, abierta: roomId };
}

/** Varias salas leidas de una (la campanita, "Marcar como leídas"). */
export function marcarSalasLeidas(roomIds: string[]) {
  const porSala = { ...estado.porSala };
  let cambio = false;
  for (const id of roomIds) if (porSala[id]) { porSala[id] = 0; cambio = true; }
  if (cambio) cambiar({ ...estado, porSala });
}

/** Se leyo: el contador de esa sala vuelve a cero. */
export function marcarSalaLeida(roomId: string) {
  if (!estado.porSala[roomId]) return;
  cambiar({ ...estado, porSala: { ...estado.porSala, [roomId]: 0 } });
}

/**
 * Arranca el almacen con lo que calculo el servidor y escucha mensajes nuevos.
 * Va UNA vez, en el layout del estudio y en el del panel.
 *
 * Un solo canal de realtime por persona, sin filtro por sala: RLS decide que
 * mensajes le llegan, igual que en la sala.
 */
export function ChatAvisosVivo({ userId, porSala, tipos }: { userId: string; porSala: Record<string, number>; tipos: Record<string, Tipo> }) {
  useEffect(() => {
    cambiar({ listo: true, porSala: { ...porSala }, tipos: { ...tipos }, abierta: estado.abierta });
    // Solo al montar: despues manda lo que llega en vivo. Si el servidor
    // recalcula (navegacion con refresh), se vuelve a sembrar.
  }, [porSala, tipos]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let cancelado = false;
    (async () => {
      // Sin el JWT, postgres_changes no entrega nada (ver chat-room.tsx).
      const { data } = await supabase.auth.getSession();
      if (cancelado) return;
      if (data.session?.access_token) await supabase.realtime.setAuth(data.session.access_token);
      if (cancelado) return;
      canal = supabase
        .channel(`chat-avisos-${userId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, async (payload) => {
          const m = payload.new as { room_id: string; user_id: string };
          if (!m.room_id || m.user_id === userId) return;
          const mirando = estado.abierta === m.room_id && document.visibilityState === "visible";
          if (mirando) return;
          let tipo = estado.tipos[m.room_id];
          if (!tipo) {
            /**
             * 🔴 UNA SALA QUE NO ESTABA EN LA LISTA (2026-10-27).
             *
             * Antes se daba por hecho que era un chat directo nuevo y sumaba.
             * Pero a una ADMIN, RLS le deja ver TODOS los mensajes: los de
             * conversaciones ajenas (otra admin con una alumna) tambien
             * llegaban aca y sumaban a su "Mi chat"/"Mensajes". Eran avisos
             * fantasma que no se borraban entrando a sus chats ni con "Marcar
             * como leídas": solo recargando. Ahora se pregunta: suma solo si es
             * un chat directo DONDE ELLA PARTICIPA o un canal activo.
             */
            const { data: sala } = await supabase
              .from("chat_rooms")
              .select("type, is_archived, participant_ids")
              .eq("id", m.room_id)
              .maybeSingle<{ type: string; is_archived: boolean; participant_ids: string[] | null }>();
            if (!sala) return;
            if (sala.type === "dm") {
              if (!(sala.participant_ids ?? []).includes(userId)) return;
              tipo = "dm";
            } else if ((sala.type === "community" || sala.type === "tier") && !sala.is_archived) {
              tipo = "canal";
            } else {
              return;
            }
          }
          cambiar({
            ...estado,
            tipos: { ...estado.tipos, [m.room_id]: tipo },
            porSala: { ...estado.porSala, [m.room_id]: (estado.porSala[m.room_id] ?? 0) + 1 },
          });
        })
        .subscribe();
    })();
    return () => {
      cancelado = true;
      if (canal) supabase.removeChannel(canal);
    };
  }, [userId]);

  return null;
}

function Globo({ n, className }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span className={"chat-globo" + (className ? " " + className : "")} aria-label={n === 1 ? "1 mensaje sin leer" : `${n} mensajes sin leer`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** El numerito del menu: todos los chats directos, o todos los canales. */
export function ContadorChat({ tipo, inicial = 0, className }: { tipo: Tipo; inicial?: number; className?: string }) {
  const e = useSyncExternalStore(suscribir, () => estado, () => null);
  const n = e?.listo ? totalDe(tipo) : inicial;
  return <Globo n={n} className={className} />;
}

/** El numerito de UNA conversacion o canal, en su lista. */
export function ContadorSala({ roomId, inicial = 0, className }: { roomId: string; inicial?: number; className?: string }) {
  const e = useSyncExternalStore(suscribir, () => estado, () => null);
  const n = e?.listo ? e.porSala[roomId] ?? 0 : inicial;
  return <Globo n={n} className={className} />;
}
