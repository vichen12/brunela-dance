import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppUrl } from "@/src/lib/env";
import {
  accesoGratisPorVencer, accesoGratisTerminado, bienvenidaAlumna, invitacionAClaseEnVivo, recordatorioClaseEnVivo,
} from "@/src/lib/email/mensajes";
import { resolveI18nText, type I18nRecord } from "@/src/features/studio/helpers";
import { conSuscripcionQueDaAcceso } from "@/src/features/studio/acceso-gratis";
import { esFaltaDeMigracion } from "@/src/features/studio/acceso-gratis-reglas";
import { clavesYaEnviadas, enviarUnaVez, type PedidoDeCorreo, type ResultadoUnaVez } from "./enviar-una-vez";
import {
  claves, diasParaAvisoPorVencer, fechaYHoraDeClase, rangoDeHoyEnMadrid, tocaAvisoTerminado, tocaRecordatorio, urlDeClase,
  DIAS_AVISO_POR_VENCER, DIAS_VENTANA_TERMINADO,
} from "./reglas";

/**
 * Cuando sale cada correo del estudio. Todo pasa por enviarUnaVez().
 *
 * ⚠️ SIN "use server" (ver enviar-una-vez.ts): estas funciones reciben ids y
 *    un cliente con service_role. Las llaman el webhook de Stripe (firma
 *    verificada), el cron (CRON_SECRET), actions con requireAdmin() y el
 *    onboarding con el id de la SESION. Nunca un id que venga de un formulario
 *    sin pasar por una de esas guardas.
 *
 * Solo correos TRANSACCIONALES, a la direccion de la propia alumna
 * (profiles.email). Nada de marketing: eso pide marketing_opt_in y es otro
 * camino.
 */

type Perfil = { id: string; email: string | null; full_name: string | null; is_admin: boolean };

function base() {
  return getAppUrl().replace(/\/$/, "");
}

async function perfil(db: SupabaseClient, id: string): Promise<Perfil | null> {
  const { data, error } = await db.from("profiles").select("id, email, full_name, is_admin").eq("id", id).maybeSingle<Perfil>();
  if (error) throw new Error("No se pudo leer el perfil: " + error.message);
  return data;
}

// ─── 1. Bienvenida ─────────────────────────────────────────────────────────

/**
 * La primera vez que una alumna tiene acceso al estudio. Desde el webhook (plan
 * o pack pagado) y desde el onboarding (alta con meses gratis, pack, etc.).
 * A una admin no: no es alumna.
 */
export async function enviarBienvenida(db: SupabaseClient, alumnaId: string): Promise<ResultadoUnaVez | { estado: "omitido"; motivo: string }> {
  try {
    const p = await perfil(db, alumnaId);
    if (!p) return { estado: "omitido", motivo: "no hay perfil" };
    if (p.is_admin) return { estado: "omitido", motivo: "es admin" };
    if (!p.email) return { estado: "omitido", motivo: "sin correo" };
    return await enviarUnaVez(
      {
        clave: claves.bienvenida(p.id),
        tipo: "bienvenida",
        alumnaId: p.id,
        para: p.email,
        correo: bienvenidaAlumna({ nombre: p.full_name, urlEstudio: `${base()}/dashboard` }),
      },
      { db }
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[correo] bienvenida:", error);
    return { estado: "fallo", error };
  }
}

// ─── 5. Invitacion a una clase en vivo ─────────────────────────────────────

type Sesion = { id: string; slug: string; title_i18n: I18nRecord | null; starts_at: string; status: string };

/**
 * Cuando Brunela invita a una alumna. Solo si la clase esta publicada
 * ('scheduled') y todavia no empezo: invitar a un borrador no es una noticia
 * para ella todavia (no la puede ver), y a una clase pasada, tampoco.
 */
export async function enviarInvitacion(
  db: SupabaseClient,
  sesionId: string,
  alumnaId: string
): Promise<ResultadoUnaVez | { estado: "omitido"; motivo: string }> {
  try {
    const [p, { data: s, error }] = await Promise.all([
      perfil(db, alumnaId),
      db.from("live_sessions").select("id, slug, title_i18n, starts_at, status").eq("id", sesionId).maybeSingle<Sesion>(),
    ]);
    if (error) throw new Error("No se pudo leer la clase: " + error.message);
    if (!p || !s) return { estado: "omitido", motivo: "no se encontro la alumna o la clase" };
    if (!p.email) return { estado: "omitido", motivo: "sin correo" };
    if (s.status !== "scheduled") return { estado: "omitido", motivo: "la clase no esta publicada" };
    if (Date.parse(s.starts_at) <= Date.now()) return { estado: "omitido", motivo: "la clase ya empezo" };

    const { fecha, hora } = fechaYHoraDeClase(s.starts_at);
    return await enviarUnaVez(
      {
        clave: claves.invitacion(s.id, p.id),
        tipo: "invitacion_vivo",
        alumnaId: p.id,
        para: p.email,
        correo: invitacionAClaseEnVivo({
          nombre: p.full_name,
          titulo: resolveI18nText(s.title_i18n) || "Clase en vivo",
          fecha,
          hora,
          urlClase: urlDeClase(base(), s.slug),
        }),
      },
      { db }
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[correo] invitacion:", error);
    return { estado: "fallo", error };
  }
}

/** El agregado a un cartel de exito del panel. "" si salio o si no tocaba. */
export function avisoDelCorreo(r: ResultadoUnaVez | { estado: "omitido"; motivo: string }): string {
  if (r.estado === "enviado") return " También le llegó por correo.";
  if (r.estado === "sin_migracion") return " El correo no salió: falta aplicar la migración 20261009_3_correos_enviados.sql.";
  if (r.estado === "fallo") return ` No se le pudo mandar el correo (${r.error}).`;
  return "";
}

// ─── 2, 3 y 4. El cron diario ──────────────────────────────────────────────

/** Tope de correos por corrida, entre los tres tipos. */
export const TOPE_POR_CORRIDA = 200;
/** Presupuesto de tiempo: el resto queda para mañana (o se pierde, si es de hoy). */
const PRESUPUESTO_MS = 45_000;
/** Resend limita a 2 envios por segundo por cuenta. */
const PAUSA_ENTRE_ENVIOS_MS = 600;

export type ResumenCorreosCron = {
  omitido?: string;
  recordatorios: number;
  porVencer: number;
  terminados: number;
  yaEnviados: number;
  fallos: number;
  pendientes: number;
};

type Candidato = PedidoDeCorreo & { grupo: "recordatorios" | "porVencer" | "terminados" };

/**
 * Los tres correos del cron, en orden de urgencia: el recordatorio es de HOY
 * (mañana ya no sirve), el "por vencer" tiene margen de tres dias y el
 * "terminado" de siete.
 *
 * Nunca lanza: lo que falle se cuenta y se loguea. El keepalive y las bajas ya
 * corrieron antes y no dependen de esto.
 */
export async function correosDelCron(db: SupabaseClient, ahora = Date.now()): Promise<ResumenCorreosCron> {
  const resumen: ResumenCorreosCron = { recordatorios: 0, porVencer: 0, terminados: 0, yaEnviados: 0, fallos: 0, pendientes: 0 };
  const empezo = Date.now();
  try {
    const appUrl = base();
    const candidatos: Candidato[] = [
      ...(await candidatosRecordatorio(db, appUrl, ahora)),
      ...(await candidatosAccesoGratis(db, appUrl, ahora)),
    ];
    if (candidatos.length === 0) return resumen;

    const hechas = await clavesYaEnviadas(db, candidatos.map((c) => c.clave));
    if (!hechas) return { ...resumen, omitido: "falta la migracion 20261009_3_correos_enviados.sql" };

    const nuevos = candidatos.filter((c) => !hechas.has(c.clave));
    resumen.yaEnviados = candidatos.length - nuevos.length;

    let intentados = 0;
    for (const c of nuevos) {
      if (intentados >= TOPE_POR_CORRIDA || Date.now() - empezo > PRESUPUESTO_MS) {
        resumen.pendientes = nuevos.length - intentados;
        break;
      }
      if (intentados > 0) await new Promise((r) => setTimeout(r, PAUSA_ENTRE_ENVIOS_MS));
      intentados++;
      const r = await enviarUnaVez(c, { db });
      if (r.estado === "enviado") resumen[c.grupo]++;
      else if (r.estado === "ya_enviado") resumen.yaEnviados++;
      else if (r.estado === "sin_migracion") return { ...resumen, omitido: "falta la migracion 20261009_3_correos_enviados.sql" };
      else resumen.fallos++;
    }
  } catch (e) {
    console.error("[correo] cron:", e instanceof Error ? e.message : e);
    resumen.fallos++;
  }
  console.log(
    `[correo] cron: ${resumen.recordatorios} recordatorios, ${resumen.porVencer} por vencer, ` +
      `${resumen.terminados} terminados, ${resumen.yaEnviados} ya enviados, ${resumen.fallos} fallos, ` +
      `${resumen.pendientes} pendientes`
  );
  return resumen;
}

/** 4. Reservas confirmadas para una clase publicada que es HOY (Madrid) y no empezo. */
async function candidatosRecordatorio(db: SupabaseClient, appUrl: string, ahora: number): Promise<Candidato[]> {
  const { desde, hasta } = rangoDeHoyEnMadrid(ahora);
  const { data: sesiones, error } = await db
    .from("live_sessions")
    .select("id, slug, title_i18n, starts_at, status")
    .eq("status", "scheduled")
    .gte("starts_at", desde)
    .lt("starts_at", hasta)
    .returns<Sesion[]>();
  if (error) throw new Error("No se pudieron leer las clases de hoy: " + error.message);
  const deHoy = (sesiones ?? []).filter((s) => tocaRecordatorio(s.starts_at, ahora));
  if (deHoy.length === 0) return [];

  const { data: reservas, error: e2 } = await db
    .from("live_session_bookings")
    .select("id, user_id, live_session_id")
    .in("live_session_id", deHoy.map((s) => s.id))
    .eq("status", "reserved")
    .limit(2000);
  if (e2) throw new Error("No se pudieron leer las reservas: " + e2.message);
  if (!reservas?.length) return [];

  const perfiles = await perfilesPorId(db, [...new Set(reservas.map((r) => r.user_id as string))]);
  const porSesion = new Map(deHoy.map((s) => [s.id, s]));
  const out: Candidato[] = [];
  for (const r of reservas) {
    const s = porSesion.get(r.live_session_id as string);
    const p = perfiles.get(r.user_id as string);
    if (!s || !p?.email) continue;
    const { fecha, hora } = fechaYHoraDeClase(s.starts_at);
    out.push({
      grupo: "recordatorios",
      clave: claves.recordatorio(r.id as string),
      tipo: "recordatorio_vivo",
      alumnaId: p.id,
      para: p.email,
      correo: recordatorioClaseEnVivo({
        nombre: p.full_name,
        titulo: resolveI18nText(s.title_i18n) || "Clase en vivo",
        fecha,
        hora,
        urlClase: urlDeClase(appUrl, s.slug),
      }),
    });
  }
  return out;
}

/** 2 y 3. Acceso gratis por vencer (1 a 3 dias) y recien terminado (hasta 7 dias). */
async function candidatosAccesoGratis(db: SupabaseClient, appUrl: string, ahora: number): Promise<Candidato[]> {
  const desde = new Date(ahora - DIAS_VENTANA_TERMINADO * 86400000).toISOString();
  const hasta = new Date(ahora + (DIAS_AVISO_POR_VENCER + 1) * 86400000).toISOString();
  const { data, error } = await db
    .from("profiles")
    .select("id, email, full_name, is_admin, acceso_gratis_hasta")
    .gt("acceso_gratis_hasta", desde)
    .lt("acceso_gratis_hasta", hasta)
    .eq("is_admin", false)
    .limit(2000);
  if (error) {
    // Sin 20261009_acceso_gratis.sql no hay acceso gratis que avisar.
    if (esFaltaDeMigracion(error)) return [];
    throw new Error("No se pudo leer el acceso gratis: " + error.message);
  }
  const filas = (data ?? []) as (Perfil & { acceso_gratis_hasta: string })[];
  if (filas.length === 0) return [];

  // Quien paga no recibe ninguno de los dos: ya eligio su plan. Ante un error
  // de lectura, conSuscripcionQueDaAcceso lanza y no sale nada (mejor callar).
  const ids = filas.map((f) => f.id);
  const pagan = await conSuscripcionQueDaAcceso(db, ids);
  // Quien compro un pack sigue entrando al estudio: "tus clases quedan en
  // pausa" seria falso para ella.
  const conPack = await conPackComprado(db, ids);

  const out: Candidato[] = [];
  for (const f of filas) {
    if (!f.email || pagan.has(f.id)) continue;
    const dias = diasParaAvisoPorVencer(f.acceso_gratis_hasta, ahora);
    if (dias !== null) {
      out.push({
        grupo: "porVencer",
        clave: claves.gratisPorVencer(f.id, f.acceso_gratis_hasta),
        tipo: "gratis_por_vencer",
        alumnaId: f.id,
        para: f.email,
        // /dashboard/plan y no /registro/plan: mientras le quede acceso, /registro/plan
        // la devuelve al estudio (destinoDeElegirPlan).
        correo: accesoGratisPorVencer({ nombre: f.full_name, diasRestantes: dias, urlPlan: `${appUrl}/dashboard/plan` }),
      });
    } else if (tocaAvisoTerminado(f.acceso_gratis_hasta, ahora) && !conPack.has(f.id)) {
      out.push({
        grupo: "terminados",
        clave: claves.gratisTerminado(f.id, f.acceso_gratis_hasta),
        tipo: "gratis_terminado",
        alumnaId: f.id,
        para: f.email,
        correo: accesoGratisTerminado({ nombre: f.full_name, urlPlan: `${appUrl}/registro/plan` }),
      });
    }
  }
  return out;
}

async function perfilesPorId(db: SupabaseClient, ids: string[]): Promise<Map<string, Perfil>> {
  const m = new Map<string, Perfil>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from("profiles").select("id, email, full_name, is_admin").in("id", ids.slice(i, i + 200));
    if (error) throw new Error("No se pudieron leer los perfiles: " + error.message);
    for (const p of (data ?? []) as Perfil[]) m.set(p.id, p);
  }
  return m;
}

async function conPackComprado(db: SupabaseClient, ids: string[]): Promise<Set<string>> {
  const { data, error } = await db.from("pack_purchases").select("user_id").in("user_id", ids);
  if (error) throw new Error("No se pudieron leer los packs: " + error.message);
  return new Set((data ?? []).map((r) => r.user_id as string));
}
