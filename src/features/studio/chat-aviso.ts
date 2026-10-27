import type { Notificacion } from "@/src/features/studio/notificaciones";

/**
 * El aviso de chat de la campanita, armado a partir de una sala con mensajes
 * sin leer. Sin nada de servidor a proposito: lo usa el servidor al cargar
 * (chat-sin-leer.ts) y el navegador cuando llega un mensaje en vivo
 * (components/chat-avisos.tsx). Antes solo existia del lado del servidor y la
 * campanita no se enteraba de un mensaje hasta recargar la pagina (2026-10-27).
 */

export type SalaSinLeer = {
  roomId: string;
  tipo: "dm" | "canal";
  nombre: string;
  noLeidos: number;
  /** En un DM: la otra persona. */
  otraId: string | null;
  ultimo: { id: string; autor: string; texto: string; cuando: string } | null;
};

/** El texto de un mensaje para la campanita: una linea, sin saltos. */
function recorte(t: string, n = 90) {
  const limpio = t.replace(/\s+/g, " ").trim();
  return limpio.length > n ? limpio.slice(0, n - 1) + "…" : limpio;
}

/**
 * Las salas con mensajes nuevos, como items de la campanita.
 *
 * El id lleva el ULTIMO mensaje: la campanita guarda en el navegador cuales ya
 * se vieron, asi que un mensaje nuevo en la misma sala vuelve a avisar.
 */
export function chatsComoNotificaciones(d: { salas: SalaSinLeer[] }, esAdmin: boolean): Notificacion[] {
  return d.salas.map((s) => {
    const varios = s.noLeidos > 1;
    if (s.tipo === "dm") {
      return {
        id: `chat-${s.roomId}-${s.ultimo?.id ?? ""}`,
        tipo: "mensaje" as const,
        titulo: esAdmin
          ? `${s.ultimo?.autor ?? "Una alumna"} te escribió${varios ? ` (${s.noLeidos} mensajes)` : ""}`
          : `Brunela te escribió${varios ? ` (${s.noLeidos} mensajes)` : ""}`,
        texto: recorte(s.ultimo?.texto ?? ""),
        cuando: s.ultimo?.cuando ?? null,
        href: esAdmin ? (s.otraId ? `/admin/mensajes?user=${s.otraId}` : "/admin/mensajes") : "/dashboard/chat",
      };
    }
    return {
      id: `chat-${s.roomId}-${s.ultimo?.id ?? ""}`,
      tipo: "mensaje" as const,
      titulo: varios ? `${s.noLeidos} mensajes nuevos en ${s.nombre}` : `Nuevo mensaje en ${s.nombre}`,
      texto: `${s.ultimo?.autor ?? ""}: ${recorte(s.ultimo?.texto ?? "", 80)}`,
      cuando: s.ultimo?.cuando ?? null,
      href: esAdmin ? `/admin/comunidad?room=${s.roomId}` : `/dashboard/community?room=${s.roomId}`,
    };
  });
}
