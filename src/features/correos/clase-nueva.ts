import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppUrl } from "../../lib/env";
import { enviarLote, type CorreoAEnviar, type ResultadoLote } from "../../lib/email/enviar";
import { claseNueva } from "../../lib/email/mensajes";
import { portadaPublicaDeClase } from "../../lib/video/portada-publica";
import { resolveI18nText, type I18nRecord } from "../studio/helpers";
import { avisarFaltaMigracion, clavesYaEnviadas } from "./enviar-una-vez";
import {
  claves, enLotes, esFaltaDeTablaCorreos, esTipoNoPermitido, recibeClaseNueva, urlDeBaja, urlDeClaseGrabada,
  DIAS_VENTANA_CLASE_NUEVA, FILTRO_SIN_BAJA_CLASES_NUEVAS, MIGRACION_CLASE_NUEVA, MIGRACION_CORREOS, TAMANO_LOTE,
} from "./reglas";

/**
 * ⚠️ SIN "use server" (ver enviar-una-vez.ts): recibe un cliente con
 *    service_role. La llaman la subida (finalize, requireAdmin), las acciones
 *    del panel (requireAdmin) y el cron (CRON_SECRET).
 *
 * Imports relativos a proposito: las pruebas (tests/sistema/clase-nueva.test.ts)
 * lo cargan sin el alias "@/".
 */

function base() {
  return getAppUrl().replace(/\/$/, "");
}

// ─── 7. Clase nueva ────────────────────────────────────────────────────────
//
// Pedido de la dueña (2026-10-12): "cuando se sube una clase, que se envie un
// correo a todas las personas que puedan ver esa clase". A TODAS las que la
// ven, no solo a las que marcaron la casilla del alta; menos las que se dieron
// de baja de forma explicita (enlace de baja o interruptor de Mi perfil).
//
// CUANDO
//   Cuando la clase pasa a publicada por primera vez: al subirla ya publicada
//   (finalize) o al cambiar un borrador a publicada (panel o boton "Publicar").
//   Nunca al volver a guardar una que ya estaba publicada. La clave
//   clase-nueva:<video>:<alumna> impide repetir aunque se despublique y se
//   vuelva a publicar: solo le llega a quien todavia no lo recibio.
//
// COMO
//   La publicacion arma la lista (rapido, pocas consultas) y el envio corre en
//   after(): Brunela no espera. Lotes de 100 por /emails/batch de Resend, con
//   pausa entre lote y lote (2 pedidos por segundo). Lo que no entra en el
//   presupuesto de tiempo lo completa el cron diario durante 3 dias.
//
// BUNNY
//   No hay ninguna señal confiable de "Bunny termino de codificar" en el
//   sistema (no hay webhook de Bunny ni columna de estado; video_mux_jobs es
//   solo para los idiomas extra). Por eso sale al publicar, y el texto no
//   promete que ya se reproduce: "ya esta en tu biblioteca", y una nota por si
//   se esta terminando de preparar.

export type ResumenClaseNueva = { omitido?: string; enviados: number; yaEnviados: number; fallos: number; pendientes: number };
export const RESUMEN_CLASE_NUEVA_VACIO: ResumenClaseNueva = { enviados: 0, yaEnviados: 0, fallos: 0, pendientes: 0 };

type VideoParaAviso = {
  id: string;
  slug: string;
  title_i18n: I18nRecord | null;
  status: string;
  planes_permitidos: string[] | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
};

export type DestinatariaClaseNueva = {
  id: string;
  email: string | null;
  full_name: string | null;
  is_admin: boolean | null;
  membership_tier: string | null;
  marketing_opt_in: boolean | null;
  marketing_opt_out_at: string | null;
  unsubscribe_token: string;
};

export type ClaseNuevaPreparada = { video: VideoParaAviso; destinatarias: DestinatariaClaseNueva[] };

const COLS_DESTINATARIA = "id, email, full_name, is_admin, membership_tier, marketing_opt_in, marketing_opt_out_at, unsubscribe_token";
const PAGINA = 1000; // el maximo de filas que devuelve PostgREST por pedido
const PAUSA_ENTRE_LOTES_MS = 600;

/**
 * Quienes van a recibir el aviso de esta clase. null si la clase no existe o
 * no esta publicada. LANZA si una consulta falla: quien llama decide (y nunca
 * puede romper el guardado de Brunela por esto).
 *
 * La regla es la de la policy videos_select_allowed_by_tier: plan dentro de
 * planes_permitidos, o un pack comprado (vigente) que incluye la clase. El
 * filtro de admins, correo y baja va EN LA CONSULTA; despues se vuelve a pasar
 * por recibeClaseNueva(), que es la regla que prueban los tests.
 */
export async function prepararClaseNueva(db: SupabaseClient, videoId: string): Promise<ClaseNuevaPreparada | null> {
  const { data: video, error } = await db
    .from("videos")
    .select("id, slug, title_i18n, status, planes_permitidos, thumbnail_url, duration_seconds")
    .eq("id", videoId)
    .maybeSingle<VideoParaAviso>();
  if (error) throw new Error("No se pudo leer la clase: " + error.message);
  if (!video || video.status !== "published") return null;

  const planes = (video.planes_permitidos ?? []).filter((p) => p !== "none");
  const porId = new Map<string, DestinatariaClaseNueva>();

  // 1. Por plan, de a paginas.
  if (planes.length > 0) {
    for (let desde = 0; ; desde += PAGINA) {
      const { data, error: e } = await db
        .from("profiles")
        .select(COLS_DESTINATARIA)
        .in("membership_tier", planes)
        .eq("is_admin", false)
        .not("email", "is", null)
        .or(FILTRO_SIN_BAJA_CLASES_NUEVAS)
        .order("id")
        .range(desde, desde + PAGINA - 1)
        .returns<DestinatariaClaseNueva[]>();
      if (e) throw new Error("No se pudieron leer las alumnas del plan: " + e.message);
      for (const p of data ?? []) porId.set(p.id, p);
      if ((data ?? []).length < PAGINA) break;
    }
  }

  // 2. Por pack: quien compro un pack que incluye esta clase la ve sin importar el plan.
  const compradoras = new Set<string>();
  const { data: enPacks, error: ePacks } = await db.from("pack_videos").select("pack_id").eq("video_id", video.id);
  if (ePacks) throw new Error("No se pudieron leer los packs de la clase: " + ePacks.message);
  const packIds = [...new Set((enPacks ?? []).map((f) => f.pack_id as string))];
  if (packIds.length > 0) {
    const ahora = Date.now();
    const { data: compras, error: eCompras } = await db
      .from("pack_purchases")
      .select("user_id, expires_at")
      .in("pack_id", packIds)
      .limit(10_000);
    if (eCompras) throw new Error("No se pudieron leer las compras de packs: " + eCompras.message);
    for (const c of compras ?? []) {
      if (!c.expires_at || Date.parse(c.expires_at as string) > ahora) compradoras.add(c.user_id as string);
    }
    const faltan = [...compradoras].filter((id) => !porId.has(id));
    for (let i = 0; i < faltan.length; i += 200) {
      const { data, error: e } = await db
        .from("profiles")
        .select(COLS_DESTINATARIA)
        .in("id", faltan.slice(i, i + 200))
        .eq("is_admin", false)
        .not("email", "is", null)
        .or(FILTRO_SIN_BAJA_CLASES_NUEVAS)
        .returns<DestinatariaClaseNueva[]>();
      if (e) throw new Error("No se pudieron leer las alumnas con pack: " + e.message);
      for (const p of data ?? []) porId.set(p.id, p);
    }
  }

  const destinatarias = [...porId.values()].filter((p) => recibeClaseNueva(p, planes, compradoras));
  return { video, destinatarias };
}

type DepsClaseNueva = {
  /** Inyectable para las pruebas. Por defecto, /emails/batch de Resend. */
  enviar?: (correos: CorreoAEnviar[]) => Promise<ResultadoLote>;
  presupuestoMs?: number;
  pausaMs?: number;
  appUrl?: string;
};

function duracionLegible(segundos: number | null) {
  if (!segundos || segundos <= 0) return null;
  return `${Math.max(1, Math.round(segundos / 60))} min`;
}

/**
 * Manda el aviso a la lista ya preparada. Nunca lanza.
 *
 * NUNCA DOS VECES, en lote: se reservan las claves del lote con UN insert
 * "on conflict do nothing" que devuelve solo las filas que inserto. Las que no
 * volvieron ya estaban (otro after(), el cron): no se mandan. Bien -> se
 * guardan los ids de Resend. Mal -> se liberan las reservas para reintentar.
 */
export async function mandarClaseNueva(
  db: SupabaseClient,
  prep: ClaseNuevaPreparada,
  deps: DepsClaseNueva = {}
): Promise<ResumenClaseNueva> {
  const resumen: ResumenClaseNueva = { ...RESUMEN_CLASE_NUEVA_VACIO };
  const empezo = Date.now();
  const enviar = deps.enviar ?? enviarLote;
  const presupuesto = deps.presupuestoMs ?? 40_000;
  const pausa = deps.pausaMs ?? PAUSA_ENTRE_LOTES_MS;
  try {
    if (prep.destinatarias.length === 0) return resumen;
    const appUrl = (deps.appUrl ?? base()).replace(/\/$/, "");
    const { video } = prep;
    const titulo = resolveI18nText(video.title_i18n) || "Clase nueva";
    const urlClase = urlDeClaseGrabada(appUrl, video.slug);
    const portada = portadaPublicaDeClase(video);
    const duracion = duracionLegible(video.duration_seconds);

    const pedidos = prep.destinatarias
      .filter((d) => d.email?.trim())
      .map((d) => {
        const urlBaja = urlDeBaja(appUrl, d.unsubscribe_token);
        return {
          clave: claves.claseNueva(video.id, d.id),
          alumnaId: d.id,
          para: d.email!.trim(),
          urlBaja,
          correo: claseNueva({ nombre: d.full_name, titulo, urlClase, portada, duracion, urlBaja }),
        };
      });

    const hechas = await clavesYaEnviadas(db, pedidos.map((p) => p.clave));
    if (!hechas) return { ...resumen, omitido: `falta la migracion ${MIGRACION_CORREOS}` };
    const nuevos = pedidos.filter((p) => !hechas.has(p.clave));
    resumen.yaEnviados = pedidos.length - nuevos.length;

    const lotes = enLotes(nuevos, TAMANO_LOTE);
    for (let i = 0; i < lotes.length; i++) {
      const lote = lotes[i];
      if (Date.now() - empezo > presupuesto) {
        resumen.pendientes = lotes.slice(i).reduce((n, l) => n + l.length, 0);
        break;
      }
      if (i > 0 && pausa > 0) await new Promise((r) => setTimeout(r, pausa));

      // 1. Reservar el lote entero.
      const { data: reservadas, error: errReserva } = await db
        .from("correos_enviados")
        .upsert(
          lote.map((p) => ({ clave: p.clave, alumna_id: p.alumnaId, tipo: "clase_nueva", para: p.para })),
          { onConflict: "clave", ignoreDuplicates: true }
        )
        .select("clave");
      if (errReserva) {
        if (esTipoNoPermitido(errReserva)) {
          console.warn(
            `[correo] falta la migracion ${MIGRACION_CLASE_NUEVA}: correos_enviados todavia no acepta 'clase_nueva'. ` +
              `NO se manda ningun aviso de clase nueva hasta aplicarla.`
          );
          return { ...resumen, omitido: `falta la migracion ${MIGRACION_CLASE_NUEVA}` };
        }
        if (esFaltaDeTablaCorreos(errReserva)) {
          avisarFaltaMigracion();
          return { ...resumen, omitido: `falta la migracion ${MIGRACION_CORREOS}` };
        }
        console.error(`[correo] clase nueva: no se pudo reservar el lote: ${errReserva.message}`);
        resumen.fallos += lote.length;
        continue;
      }
      const mias = new Set((reservadas ?? []).map((f) => f.clave as string));
      const aMandar = lote.filter((p) => mias.has(p.clave));
      resumen.yaEnviados += lote.length - aMandar.length;
      if (aMandar.length === 0) continue;

      // 2. Mandar.
      const r = await enviar(
        aMandar.map((p) => ({
          para: p.para,
          asunto: p.correo.asunto,
          html: p.correo.html,
          texto: p.correo.texto,
          encabezados: { "List-Unsubscribe": `<${p.urlBaja}>, <mailto:info@bruneladance.com?subject=baja>` },
        }))
      );

      // 3. Bien: guardar los ids. Mal: liberar para reintentar (after() o cron).
      if (r.ok) {
        resumen.enviados += aMandar.length;
        const { error: errIds } = await db.from("correos_enviados").upsert(
          aMandar.map((p, j) => ({ clave: p.clave, alumna_id: p.alumnaId, tipo: "clase_nueva", para: p.para, resend_id: r.ids[j] || null })),
          { onConflict: "clave" }
        );
        if (errIds) console.error(`[correo] clase nueva: salio el lote pero no se guardaron los ids: ${errIds.message}`);
      } else {
        resumen.fallos += aMandar.length;
        const { error: errBorrar } = await db
          .from("correos_enviados")
          .delete()
          .in("clave", aMandar.map((p) => p.clave))
          .is("resend_id", null);
        if (errBorrar) console.error(`[correo] clase nueva: no se pudieron liberar las reservas: ${errBorrar.message}`);
      }
    }
  } catch (e) {
    console.error("[correo] clase nueva:", e instanceof Error ? e.message : String(e));
    resumen.fallos++;
  }
  console.log(
    `[correo] clase nueva ${prep.video.id}: ${resumen.enviados} enviados, ${resumen.yaEnviados} ya enviados, ` +
      `${resumen.fallos} fallos, ${resumen.pendientes} pendientes${resumen.omitido ? ` (${resumen.omitido})` : ""}`
  );
  return resumen;
}


/**
 * Lo que llaman la subida y el panel: arma la lista AHORA (para poder decir
 * "se va a avisar a N alumnas") y devuelve la tarea de envio para after().
 * null si no hay a quien avisar o si fallo la lectura (se loguea; el guardado
 * de la clase no se entera).
 */
export async function prepararAvisoDeClaseNueva(
  db: SupabaseClient,
  videoId: string
): Promise<{ cuantas: number; mandar: () => Promise<ResumenClaseNueva> } | null> {
  try {
    const prep = await prepararClaseNueva(db, videoId);
    if (!prep || prep.destinatarias.length === 0) return null;
    return { cuantas: prep.destinatarias.length, mandar: () => mandarClaseNueva(db, prep) };
  } catch (e) {
    console.error("[correo] clase nueva: no se pudo armar la lista:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * Desde el cron: las clases publicadas en los ultimos 3 dias CUYO AVISO YA
 * EMPEZO (al menos una reserva clase-nueva:<video>:* en correos_enviados). Para
 * cada una, los avisos que faltaron: no entraron en el after(), Resend fallo,
 * o la alumna gano acceso despues. Nunca lanza.
 *
 * ⚠️ POR QUE "YA EMPEZO" Y NO SOLO published_at
 *    Hasta este cambio cada guardado de una clase publicada le ponia
 *    published_at = ahora. El primer cron despues de desplegar habria tomado
 *    por nueva cualquier clase vieja editada en los ultimos 3 dias y le habria
 *    escrito a todas. El cron COMPLETA avisos; no decide cuales empiezan: eso
 *    lo hace solo la publicacion.
 */
export async function clasesNuevasDelCron(db: SupabaseClient, ahora: number, presupuestoMs: number): Promise<ResumenClaseNueva> {
  const total: ResumenClaseNueva = { ...RESUMEN_CLASE_NUEVA_VACIO };
  const empezo = Date.now();
  try {
    const { data, error } = await db
      .from("videos")
      .select("id")
      .eq("status", "published")
      .gte("published_at", new Date(ahora - DIAS_VENTANA_CLASE_NUEVA * 86400000).toISOString())
      .order("published_at", { ascending: true })
      .limit(50);
    if (error) throw new Error("No se pudieron leer las clases recientes: " + error.message);
    for (const v of data ?? []) {
      const { data: empezado, error: eEmp } = await db
        .from("correos_enviados")
        .select("clave")
        .like("clave", `clase-nueva:${v.id as string}:%`)
        .limit(1);
      if (eEmp) {
        if (esFaltaDeTablaCorreos(eEmp)) {
          avisarFaltaMigracion();
          total.omitido = `falta la migracion ${MIGRACION_CORREOS}`;
          break;
        }
        throw new Error("No se pudo leer correos_enviados: " + eEmp.message);
      }
      if (!empezado?.length) continue;
      const restante = presupuestoMs - (Date.now() - empezo);
      if (restante < 3_000) {
        total.omitido = "sin tiempo: sigue mañana";
        break;
      }
      const prep = await prepararClaseNueva(db, v.id as string);
      if (!prep) continue;
      const r = await mandarClaseNueva(db, prep, { presupuestoMs: restante });
      total.enviados += r.enviados;
      total.yaEnviados += r.yaEnviados;
      total.fallos += r.fallos;
      total.pendientes += r.pendientes;
      if (r.omitido) {
        total.omitido = r.omitido;
        break;
      }
    }
  } catch (e) {
    console.error("[correo] cron, clases nuevas:", e instanceof Error ? e.message : String(e));
    total.fallos++;
  }
  return total;
}
