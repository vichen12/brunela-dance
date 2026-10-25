import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppUrl } from "../../lib/env";
import { enviarLote, type CorreoAEnviar, type ResultadoLote } from "../../lib/email/enviar";
import { volverAlEstudio, type NovedadParaVolver } from "../../lib/email/mensajes";
import { portadaPublicaDeClase } from "../../lib/video/portada-publica";
import { resolveI18nText, type I18nRecord } from "../studio/helpers";
import { tieneAccesoAlEstudio } from "../acceso/reglas";
import {
  claves, enLotes, esColumnaAusente, esFaltaDeTablaCorreos, esTipoNoPermitido, motivoNoRecibeVolver, proximoVolverPosible,
  urlDeBaja, urlDeVolver, DIAS_ENTRE_VOLVER, MIGRACION_CORREOS, MIGRACION_VOLVER, TAMANO_LOTE, TEXTO_NO_RECIBE_VOLVER,
  type MotivoNoRecibeVolver,
} from "./reglas";

/**
 * "Volver al estudio": la invitacion por mail a las alumnas sin acceso.
 *
 * ⚠️ SIN "use server" (ver enviar-una-vez.ts): todo recibe un cliente con
 *    service_role. Lo llaman solo las pantallas y acciones del panel, despues
 *    de requireAdmin() (src/features/admin/volver-actions.ts).
 *
 * Imports relativos a proposito: las pruebas
 * (tests/sistema/volver-al-estudio.test.ts) lo cargan sin el alias "@/".
 *
 * QUIEN ESTA "SIN ACCESO"
 *   La regla de la compuerta del estudio (tieneAccesoAlEstudio): plan 'none',
 *   no admin, sin pack comprado y sin un acceso gratis vigente. Las que tienen
 *   plan 'none' PERO pack o regalo vigente entran al estudio: no son "sin
 *   plan" para esto, y la lista filtrada de /admin/users tampoco las muestra.
 *
 * NUNCA DOS VECES
 *   Igual que clase nueva: reserva por lote en correos_enviados ("on conflict
 *   do nothing" devuelve solo las insertadas) con la clave
 *   volver:<alumna>:<dia>, manda, guarda los ids o libera las reservas. Y
 *   ANTES de reservar se vuelve a leer la ultima invitacion de cada una: lo que
 *   llega del navegador nunca decide quien recibe.
 */

const PAGINA = 1000;
const PAUSA_ENTRE_LOTES_MS = 600;
const DIAS_NOVEDADES = 30;

export type CandidataVolver = {
  id: string;
  email: string | null;
  nombre: string;
  full_name: string | null;
  creadaEl: string;
  unsubscribe_token: string | null;
  ultimoVolver: string | null;
  /** null = se le puede mandar. */
  motivo: MotivoNoRecibeVolver | null;
  /** Desde cuando se le puede volver a mandar, si hoy no se puede por los 14 dias. */
  proximo: string | null;
};

type PerfilSinPlan = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  marketing_opt_in: boolean | null;
  marketing_opt_out_at: string | null;
  unsubscribe_token: string | null;
};

const COLS = "id, email, full_name, created_at, marketing_opt_in, marketing_opt_out_at, unsubscribe_token";

function nombreDe(p: { full_name: string | null; email: string | null }) {
  return p.full_name?.trim() || p.email?.split("@")[0] || "Sin nombre";
}

/**
 * Las de plan 'none' (no admin) que IGUAL entran al estudio: compraron un pack
 * o tienen un acceso gratis vigente. Son las que hay que sacar de "sin acceso".
 * Sin la columna de acceso gratis (falta 20261009_acceso_gratis.sql) cuentan
 * solo los packs. LANZA si una consulta falla.
 */
export async function sinPlanQueIgualEntran(db: SupabaseClient, idsSinPlan: readonly string[], ahora = Date.now()): Promise<Set<string>> {
  const entran = new Set<string>();
  if (idsSinPlan.length === 0) return entran;
  const sinPlan = new Set(idsSinPlan);

  const { data: compras, error: eCompras } = await db.from("pack_purchases").select("user_id").limit(10_000);
  if (eCompras) throw new Error("No se pudieron leer las compras de packs: " + eCompras.message);
  for (const c of compras ?? []) if (sinPlan.has(c.user_id as string)) entran.add(c.user_id as string);

  const { data: regalos, error: eRegalos } = await db
    .from("profiles")
    .select("id, acceso_gratis_hasta")
    .eq("membership_tier", "none")
    .eq("is_admin", false)
    .gt("acceso_gratis_hasta", new Date(ahora).toISOString())
    .limit(10_000);
  if (eRegalos && !esColumnaAusente(eRegalos)) throw new Error("No se pudo leer el acceso gratis: " + eRegalos.message);
  for (const r of regalos ?? []) {
    const datos = { esAdmin: false, tier: "none" as const, tienePack: false, gratisHasta: r.acceso_gratis_hasta as string | null };
    if (tieneAccesoAlEstudio(datos, ahora)) entran.add(r.id as string);
  }
  return entran;
}

/**
 * Las alumnas SIN ACCESO, cada una con su motivo para no recibir (o null).
 * `soloIds` limita a esas (la accion de enviar relee solo las elegidas).
 * `registro` es false si falta la tabla correos_enviados (entonces no se
 * puede saber quien recibio hace poco: no se manda nada). LANZA si falla.
 */
export async function leerCandidatasVolver(
  db: SupabaseClient,
  opciones: { soloIds?: readonly string[]; ahora?: number } = {}
): Promise<{ candidatas: CandidataVolver[]; registro: boolean }> {
  const ahora = opciones.ahora ?? Date.now();
  const perfiles: PerfilSinPlan[] = [];

  if (opciones.soloIds) {
    for (let i = 0; i < opciones.soloIds.length; i += 200) {
      const { data, error } = await db
        .from("profiles")
        .select(COLS)
        .in("id", opciones.soloIds.slice(i, i + 200))
        .eq("membership_tier", "none")
        .eq("is_admin", false)
        .returns<PerfilSinPlan[]>();
      if (error) throw new Error("No se pudieron leer las alumnas: " + error.message);
      perfiles.push(...(data ?? []));
    }
  } else {
    for (let desde = 0; ; desde += PAGINA) {
      const { data, error } = await db
        .from("profiles")
        .select(COLS)
        .eq("membership_tier", "none")
        .eq("is_admin", false)
        .order("created_at", { ascending: false })
        .order("id")
        .range(desde, desde + PAGINA - 1)
        .returns<PerfilSinPlan[]>();
      if (error) throw new Error("No se pudieron leer las alumnas sin plan: " + error.message);
      perfiles.push(...(data ?? []));
      if ((data ?? []).length < PAGINA) break;
    }
  }

  const entran = await sinPlanQueIgualEntran(db, perfiles.map((p) => p.id), ahora);
  const sinAcceso = perfiles.filter((p) => !entran.has(p.id));

  // Ultima invitacion de cada una, solo dentro de la ventana de 14 dias: lo
  // de antes no cambia nada.
  const ultimo = new Map<string, string>();
  let registro = true;
  const desdeIso = new Date(ahora - DIAS_ENTRE_VOLVER * 86400000).toISOString();
  for (let i = 0; i < sinAcceso.length; i += 200) {
    const { data, error } = await db
      .from("correos_enviados")
      .select("alumna_id, enviado_at")
      .eq("tipo", "volver_al_estudio")
      .gte("enviado_at", desdeIso)
      .in("alumna_id", sinAcceso.slice(i, i + 200).map((p) => p.id));
    if (error) {
      if (esFaltaDeTablaCorreos(error)) {
        registro = false;
        break;
      }
      throw new Error("No se pudo leer correos_enviados: " + error.message);
    }
    for (const f of data ?? []) {
      const id = f.alumna_id as string;
      const cuando = f.enviado_at as string;
      if (!ultimo.has(id) || Date.parse(cuando) > Date.parse(ultimo.get(id)!)) ultimo.set(id, cuando);
    }
  }

  const candidatas = sinAcceso.map((p): CandidataVolver => {
    const ultimoVolver = ultimo.get(p.id) ?? null;
    return {
      id: p.id,
      email: p.email,
      nombre: nombreDe(p),
      full_name: p.full_name,
      creadaEl: p.created_at,
      unsubscribe_token: p.unsubscribe_token,
      ultimoVolver,
      motivo: motivoNoRecibeVolver(
        { is_admin: false, email: p.email, marketing_opt_in: p.marketing_opt_in, marketing_opt_out_at: p.marketing_opt_out_at, tieneAcceso: false, ultimoVolver },
        ahora
      ),
      proximo: proximoVolverPosible(ultimoVolver, ahora),
    };
  });
  return { candidatas, registro };
}

/**
 * ¿Corrio 20261025_2_volver_al_estudio.sql? La migracion crea una funcion que
 * solo devuelve true (y solo para service_role). Sin escribir nada en la base.
 */
export async function registroVolverDisponible(db: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await db.rpc("correo_volver_al_estudio_disponible");
    return !error && data === true;
  } catch {
    return false;
  }
}

export const AVISO_FALTA_MIGRACION_VOLVER = `Para mandar este mail falta correr la migración ${MIGRACION_VOLVER} en Supabase.`;

export type NovedadesDelEstudio = { clasesNuevas: number; novedades: NovedadParaVolver[] };

/** Lo nuevo del ultimo mes: cuantas clases se publicaron y las 3 mas recientes. Nunca lanza. */
export async function leerNovedades(db: SupabaseClient, ahora = Date.now()): Promise<NovedadesDelEstudio> {
  try {
    const desde = new Date(ahora - DIAS_NOVEDADES * 86400000).toISOString();
    const [{ count, error: eCount }, { data, error: eData }] = await Promise.all([
      db.from("videos").select("id", { count: "exact", head: true }).eq("status", "published").gte("published_at", desde),
      db
        .from("videos")
        .select("title_i18n, thumbnail_url, published_at")
        .eq("status", "published")
        .gte("published_at", desde)
        .order("published_at", { ascending: false })
        .limit(3),
    ]);
    if (eCount || eData) throw new Error((eCount ?? eData)!.message);
    return {
      clasesNuevas: count ?? 0,
      novedades: ((data ?? []) as { title_i18n: I18nRecord | null; thumbnail_url: string | null }[])
        .map((v) => ({ titulo: resolveI18nText(v.title_i18n) || "Clase nueva", portada: portadaPublicaDeClase(v) })),
    };
  } catch (e) {
    console.error("[correo] volver: no se pudieron leer las novedades:", e instanceof Error ? e.message : String(e));
    return { clasesNuevas: 0, novedades: [] };
  }
}

export type ResumenVolver = {
  /** Si no se mando NADA por un motivo general (falta la migracion). */
  omitido?: string;
  enviadas: string[];
  salteadas: { id: string; nombre: string; motivo: string }[];
  fallos: number;
};

type DepsVolver = {
  /** Inyectable para las pruebas. Por defecto, /emails/batch de Resend. */
  enviar?: (correos: CorreoAEnviar[]) => Promise<ResultadoLote>;
  pausaMs?: number;
  appUrl?: string;
  ahora?: number;
};

/**
 * Manda la invitacion a las candidatas YA RELEIDAS por el servidor
 * (leerCandidatasVolver). Las que tienen motivo no se mandan y vuelven en
 * `salteadas` con el texto para Brunela. Nunca lanza.
 */
export async function mandarVolverAlEstudio(
  db: SupabaseClient,
  candidatas: readonly CandidataVolver[],
  novedades: NovedadesDelEstudio,
  deps: DepsVolver = {}
): Promise<ResumenVolver> {
  const resumen: ResumenVolver = { enviadas: [], salteadas: [], fallos: 0 };
  const enviar = deps.enviar ?? enviarLote;
  const pausa = deps.pausaMs ?? PAUSA_ENTRE_LOTES_MS;
  const ahoraIso = new Date(deps.ahora ?? Date.now()).toISOString();
  try {
    const appUrl = (deps.appUrl ?? getAppUrl()).replace(/\/$/, "");
    const urlVolver = urlDeVolver(appUrl);

    const pedidos: { id: string; nombre: string; clave: string; para: string; urlBaja: string; correo: ReturnType<typeof volverAlEstudio> }[] = [];
    for (const c of candidatas) {
      // Sin token no hay enlace de baja: un correo opcional sin forma de darse
      // de baja no sale (no deberia pasar: la columna es NOT NULL con default).
      const motivo = c.motivo ? TEXTO_NO_RECIBE_VOLVER[c.motivo] : !c.unsubscribe_token ? "no tiene enlace de baja" : null;
      if (motivo) {
        resumen.salteadas.push({ id: c.id, nombre: c.nombre, motivo });
        continue;
      }
      const urlBaja = urlDeBaja(appUrl, c.unsubscribe_token!);
      pedidos.push({
        id: c.id,
        nombre: c.nombre,
        clave: claves.volver(c.id, ahoraIso),
        para: c.email!.trim(),
        urlBaja,
        correo: volverAlEstudio({ nombre: c.full_name, clasesNuevas: novedades.clasesNuevas, novedades: novedades.novedades, urlVolver, urlBaja }),
      });
    }

    const lotes = enLotes(pedidos, TAMANO_LOTE);
    for (let i = 0; i < lotes.length; i++) {
      const lote = lotes[i];
      if (i > 0 && pausa > 0) await new Promise((r) => setTimeout(r, pausa));

      // 1. Reservar el lote entero.
      const { data: reservadas, error: errReserva } = await db
        .from("correos_enviados")
        .upsert(
          lote.map((p) => ({ clave: p.clave, alumna_id: p.id, tipo: "volver_al_estudio", para: p.para })),
          { onConflict: "clave", ignoreDuplicates: true }
        )
        .select("clave");
      if (errReserva) {
        if (esTipoNoPermitido(errReserva)) return { ...resumen, omitido: `falta correr la migración ${MIGRACION_VOLVER}` };
        if (esFaltaDeTablaCorreos(errReserva)) return { ...resumen, omitido: `falta correr la migración ${MIGRACION_CORREOS}` };
        console.error(`[correo] volver: no se pudo reservar el lote: ${errReserva.message}`);
        resumen.fallos += lote.length;
        continue;
      }
      const mias = new Set((reservadas ?? []).map((f) => f.clave as string));
      const aMandar = lote.filter((p) => mias.has(p.clave));
      for (const p of lote) {
        if (!mias.has(p.clave)) resumen.salteadas.push({ id: p.id, nombre: p.nombre, motivo: "ya le llegó hoy" });
      }
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

      // 3. Bien: guardar los ids. Mal: liberar las reservas para poder reintentar.
      if (r.ok) {
        resumen.enviadas.push(...aMandar.map((p) => p.id));
        const { error: errIds } = await db.from("correos_enviados").upsert(
          aMandar.map((p, j) => ({ clave: p.clave, alumna_id: p.id, tipo: "volver_al_estudio", para: p.para, resend_id: r.ids[j] || null })),
          { onConflict: "clave" }
        );
        if (errIds) console.error(`[correo] volver: salio el lote pero no se guardaron los ids: ${errIds.message}`);
      } else {
        resumen.fallos += aMandar.length;
        const { error: errBorrar } = await db
          .from("correos_enviados")
          .delete()
          .in("clave", aMandar.map((p) => p.clave))
          .is("resend_id", null);
        if (errBorrar) console.error(`[correo] volver: no se pudieron liberar las reservas: ${errBorrar.message}`);
      }
    }
  } catch (e) {
    console.error("[correo] volver:", e instanceof Error ? e.message : String(e));
    resumen.fallos++;
  }
  console.log(
    `[correo] volver al estudio: ${resumen.enviadas.length} enviados, ${resumen.salteadas.length} salteadas, ${resumen.fallos} fallos` +
      (resumen.omitido ? ` (${resumen.omitido})` : "")
  );
  return resumen;
}
