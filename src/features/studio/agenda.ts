import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { resolveI18nText } from "@/src/features/studio/helpers";
import { getAccesoGratis } from "@/src/features/studio/acceso-gratis";
import { getMisSesionesPrivadas } from "@/src/features/studio/sesiones-privadas";
import type { EventoCalendario } from "@/src/features/admin/calendario";
import {
  eventoDeInvitacion, eventoDePrivada, eventoDeReserva, eventoDisponible, marcasDeCuenta,
  type PackConVencimiento, type SesionVivoAgenda, type SuscripcionAgenda,
} from "@/src/features/studio/agenda-reglas";

/**
 * Lee "Mi agenda": SOLO lo de quien hace la request, entre dos instantes.
 *
 * 🔴 TODO CON EL CLIENTE DE ELLA (RLS decide). Ninguna consulta usa
 *    service_role: no hay nada de la agenda de una alumna que ella no pueda
 *    leer por sus propias policies (bookings_select_own, invitaciones propias,
 *    subscriptions_select_own_or_admin, pack_purchases_select_own, su fila de
 *    profiles, sesiones_privadas propias). tests/sistema/mi-agenda.test.ts
 *    comprueba que este archivo no importe el cliente admin.
 *
 * ⚠️ Los filtros `.eq("user_id", userId)` NO son la seguridad: son para la
 *    ADMIN, a quien RLS le devuelve las reservas, invitaciones y suscripciones
 *    de TODAS. Sin ellos, "Mi agenda" de Brunela mostraria las clases de sus
 *    alumnas. `userId` sale de requireUser() (la sesion), nunca de la URL.
 *
 * Tolerante: sin las migraciones de acceso gratis o de sesiones privadas, sus
 * helpers devuelven `disponible: false` y simplemente no aparecen. Ninguna
 * consulta que falle tira la pagina: se queda sin esos eventos.
 *
 * Devuelve solo cadenas y numeros (trampa 6).
 */
export type DatosAgenda = {
  eventos: EventoCalendario[];
};

type FilaVivo = {
  id: string;
  slug: string;
  title_i18n: Record<string, string> | null;
  status: string;
  starts_at: string;
  ends_at: string | null;
};

const COLUMNAS_VIVO = "id, slug, title_i18n, status, starts_at, ends_at";

function comoSesion(f: FilaVivo): SesionVivoAgenda {
  return { id: f.id, slug: f.slug, titulo: resolveI18nText(f.title_i18n ?? {}) || f.slug, starts_at: f.starts_at, ends_at: f.ends_at, status: f.status };
}

export async function cargarMiAgenda(
  userId: string,
  desdeIso: string,
  hastaIso: string,
  opciones: { disponibles?: boolean; ahora?: number } = {},
): Promise<DatosAgenda> {
  const ahora = opciones.ahora ?? Date.now();
  const supabase = await createSupabaseServerClient();

  const [reservasRes, invitacionesRes, privadas, acceso, suscripcionRes, comprasRes] = await Promise.all([
    supabase.from("live_session_bookings").select("live_session_id, status").eq("user_id", userId).in("status", ["reserved", "waitlisted"]),
    supabase.from("live_session_invitations").select("live_session_id").eq("user_id", userId),
    // Memoizados por request: el layout ya los pidio.
    getMisSesionesPrivadas(userId),
    getAccesoGratis(userId),
    supabase
      .from("subscriptions")
      .select("status, cancel_at_period_end, trial_ends_at, current_period_ends_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<SuscripcionAgenda>(),
    // Solo las que vencen. Hoy se escribe siempre null (packs para siempre):
    // normalmente esto vuelve vacio y no se inventa ninguna fecha.
    supabase.from("pack_purchases").select("pack_id, expires_at").eq("user_id", userId).not("expires_at", "is", null),
  ]);

  const reservas = new Map(
    ((reservasRes.data ?? []) as { live_session_id: string; status: "reserved" | "waitlisted" }[]).map((r) => [r.live_session_id, r.status])
  );
  const invitada = new Set(((invitacionesRes.data ?? []) as { live_session_id: string }[]).map((i) => i.live_session_id));
  const mias = [...new Set([...reservas.keys(), ...invitada])];

  // Las clases en vivo: las suyas por id y, si pidio ver las que puede
  // reservar, todas las programadas del rango. En los dos casos con SU
  // cliente: la policy de live_sessions solo devuelve las de su plan o las
  // que la invitaron, asi que "disponibles" ya viene recortado por la base.
  const compras = (comprasRes.data ?? []) as { pack_id: string; expires_at: string }[];
  const [misVivasRes, disponiblesRes, packsRes] = await Promise.all([
    mias.length
      ? supabase.from("live_sessions").select(COLUMNAS_VIVO).in("id", mias).gte("starts_at", desdeIso).lt("starts_at", hastaIso)
      : Promise.resolve({ data: [] as FilaVivo[] }),
    opciones.disponibles
      ? supabase
          .from("live_sessions")
          .select(COLUMNAS_VIVO)
          // Solo programadas: a la ADMIN RLS le devuelve tambien borradores.
          .eq("status", "scheduled")
          .gte("starts_at", new Date(Math.max(Date.parse(desdeIso), ahora)).toISOString())
          .lt("starts_at", hastaIso)
          .order("starts_at", { ascending: true })
          .limit(200)
      : Promise.resolve({ data: [] as FilaVivo[] }),
    compras.length
      ? supabase.from("packs").select("id, slug, name_i18n").in("id", compras.map((c) => c.pack_id))
      : Promise.resolve({ data: [] as { id: string; slug: string; name_i18n: Record<string, string> | null }[] }),
  ]);

  const eventos: EventoCalendario[] = [];

  for (const f of (misVivasRes.data ?? []) as FilaVivo[]) {
    const s = comoSesion(f);
    const r = reservas.get(f.id);
    if (r) eventos.push(eventoDeReserva(s, r, ahora));
    else if (invitada.has(f.id)) eventos.push(eventoDeInvitacion(s, ahora));
  }

  for (const f of (disponiblesRes.data ?? []) as FilaVivo[]) {
    if (reservas.has(f.id) || invitada.has(f.id)) continue; // ya esta como suya
    eventos.push(eventoDisponible(comoSesion(f)));
  }

  const desde = Date.parse(desdeIso);
  const hasta = Date.parse(hastaIso);
  const enRango = (iso: string) => {
    const t = Date.parse(iso);
    return t >= desde && t < hasta;
  };

  for (const p of privadas.sesiones) {
    if (!enRango(p.starts_at)) continue;
    const e = eventoDePrivada(p, ahora);
    if (e) eventos.push(e);
  }

  const nombreDePack = new Map(
    ((packsRes.data ?? []) as { id: string; slug: string; name_i18n: Record<string, string> | null }[]).map((p) => [
      p.id, { slug: p.slug, nombre: resolveI18nText(p.name_i18n ?? {}) || p.slug },
    ])
  );
  const packs: PackConVencimiento[] = compras.map((c) => ({
    id: c.pack_id,
    slug: nombreDePack.get(c.pack_id)?.slug ?? "",
    // Un pack despublicado no vuelve por la policy: se nombra igual.
    nombre: nombreDePack.get(c.pack_id)?.nombre ?? "tu pack",
    vence: c.expires_at,
  }));

  for (const m of marcasDeCuenta({
    gratisHasta: acceso.disponible ? acceso.hasta : null,
    gratisPlan: acceso.disponible ? acceso.plan : null,
    suscripcion: suscripcionRes.error ? null : (suscripcionRes.data ?? null),
    packs,
  })) {
    if (enRango(m.inicio)) eventos.push(m);
  }

  return { eventos };
}
