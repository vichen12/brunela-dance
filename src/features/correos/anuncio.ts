import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppUrl } from "../../lib/env";
import { enviarLote, type CorreoAEnviar, type ResultadoLote } from "../../lib/email/enviar";
import { anuncio as plantillaAnuncio } from "../../lib/email/mensajes";
import { avisarFaltaMigracion } from "./enviar-una-vez";
import {
  claves, enLotes, esFaltaDeTablaCorreos, esTipoNoPermitido, tipoDesactivado, urlDeBaja,
  FILTRO_SIN_BAJA_CLASES_NUEVAS, MIGRACION_ANUNCIOS, MIGRACION_CORREOS, TAMANO_LOTE,
} from "./reglas";

/**
 * Un anuncio del estudio, por mail (2026-10-26, pedido de la duena: "los
 * anuncios, que se mande un mail a las personas").
 *
 * ⚠️ SIN "use server": recibe un cliente con service_role. Lo llama solo la
 *    accion de /admin/announcements, despues de requireAdmin().
 *
 * A QUIEN
 *   Las alumnas del plan del anuncio "para arriba" (tier_target es el plan
 *   minimo; "all" = cualquier plan pago o regalado), no admin, con correo,
 *   y que no se dieron de baja: ni de las novedades (enlace de baja / Mis
 *   correos, igual que clase nueva) ni del interruptor "Anuncios del estudio".
 *
 * COMO
 *   Igual que clase nueva (clase-nueva.ts): lotes de 100 por Resend, reserva de
 *   la clave anuncio:<anuncio>:<alumna> ANTES de mandar (nunca dos veces), y si
 *   un lote falla se libera para poder reintentar. Corre en after(): Brunela no
 *   espera.
 */

const RANGO: Record<string, number> = { corps_de_ballet: 1, solista: 2, principal: 3 };
const PAGINA = 1000;
const PAUSA_ENTRE_LOTES_MS = 600;

type Destinataria = {
  id: string;
  email: string | null;
  full_name: string | null;
  unsubscribe_token: string;
  correos_desactivados: string[] | null;
};

export type ResumenAnuncio = { omitido?: string; enviados: number; yaEnviados: number; fallos: number; pendientes: number };

export type AnuncioParaMail = { id: string; title: string; content: string; tier_target: string };

/** Los planes que reciben un anuncio dirigido a `tierTarget`. */
export function planesDelAnuncio(tierTarget: string): string[] {
  const minimo = RANGO[tierTarget] ?? 1; // "all" o desconocido: desde el primero
  return Object.keys(RANGO).filter((p) => RANGO[p] >= minimo);
}

/** Quienes lo reciben. LANZA si una consulta falla: quien llama decide. */
export async function destinatariasDelAnuncio(db: SupabaseClient, a: AnuncioParaMail): Promise<Destinataria[]> {
  const planes = planesDelAnuncio(a.tier_target);
  const out: Destinataria[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await db
      .from("profiles")
      .select("id, email, full_name, unsubscribe_token, correos_desactivados")
      .in("membership_tier", planes)
      .eq("is_admin", false)
      .not("email", "is", null)
      .or(FILTRO_SIN_BAJA_CLASES_NUEVAS)
      .order("id")
      .range(desde, desde + PAGINA - 1)
      .returns<Destinataria[]>();
    if (error) throw new Error("No se pudieron leer las alumnas: " + error.message);
    out.push(...(data ?? []));
    if ((data ?? []).length < PAGINA) break;
  }
  return out.filter((d) => d.email?.trim() && d.unsubscribe_token && !tipoDesactivado(d.correos_desactivados, "anuncio"));
}

/** Manda el anuncio a la lista. Nunca lanza. */
export async function mandarAnuncio(
  db: SupabaseClient,
  a: AnuncioParaMail,
  destinatarias: Destinataria[],
  deps: { enviar?: (c: CorreoAEnviar[]) => Promise<ResultadoLote>; presupuestoMs?: number; appUrl?: string } = {}
): Promise<ResumenAnuncio> {
  const resumen: ResumenAnuncio = { enviados: 0, yaEnviados: 0, fallos: 0, pendientes: 0 };
  const empezo = Date.now();
  const enviar = deps.enviar ?? enviarLote;
  const presupuesto = deps.presupuestoMs ?? 40_000;
  const appUrl = (deps.appUrl ?? getAppUrl()).replace(/\/$/, "");
  try {
    const pedidos = destinatarias.map((d) => {
      const urlBaja = urlDeBaja(appUrl, d.unsubscribe_token);
      return {
        clave: claves.anuncio(a.id, d.id),
        alumnaId: d.id,
        para: d.email!.trim(),
        urlBaja,
        correo: plantillaAnuncio({ nombre: d.full_name, titulo: a.title, contenido: a.content, urlEstudio: `${appUrl}/dashboard`, urlBaja }),
      };
    });
    const lotes = enLotes(pedidos, TAMANO_LOTE);
    for (let i = 0; i < lotes.length; i++) {
      const lote = lotes[i];
      if (Date.now() - empezo > presupuesto) {
        resumen.pendientes = lotes.slice(i).reduce((n, l) => n + l.length, 0);
        break;
      }
      if (i > 0) await new Promise((r) => setTimeout(r, PAUSA_ENTRE_LOTES_MS));

      // 1. Reservar: solo vuelven las claves que no estaban.
      const { data: reservadas, error: errReserva } = await db
        .from("correos_enviados")
        .upsert(lote.map((p) => ({ clave: p.clave, alumna_id: p.alumnaId, tipo: "anuncio", para: p.para })), { onConflict: "clave", ignoreDuplicates: true })
        .select("clave");
      if (errReserva) {
        if (esTipoNoPermitido(errReserva)) return { ...resumen, omitido: `falta la migracion ${MIGRACION_ANUNCIOS}` };
        if (esFaltaDeTablaCorreos(errReserva)) {
          avisarFaltaMigracion();
          return { ...resumen, omitido: `falta la migracion ${MIGRACION_CORREOS}` };
        }
        console.error(`[correo] anuncio: no se pudo reservar el lote: ${errReserva.message}`);
        resumen.fallos += lote.length;
        continue;
      }
      const mias = new Set((reservadas ?? []).map((f) => f.clave as string));
      const aMandar = lote.filter((p) => mias.has(p.clave));
      resumen.yaEnviados += lote.length - aMandar.length;
      if (!aMandar.length) continue;

      // 2. Mandar.
      const r = await enviar(aMandar.map((p) => ({
        para: p.para,
        asunto: p.correo.asunto,
        html: p.correo.html,
        texto: p.correo.texto,
        encabezados: { "List-Unsubscribe": `<${p.urlBaja}>, <mailto:info@bruneladance.com?subject=baja>` },
      })));

      // 3. Bien: guardar ids. Mal: liberar las reservas.
      if (r.ok) {
        resumen.enviados += aMandar.length;
        await db.from("correos_enviados").upsert(
          aMandar.map((p, j) => ({ clave: p.clave, alumna_id: p.alumnaId, tipo: "anuncio", para: p.para, resend_id: r.ids[j] || null })),
          { onConflict: "clave" }
        );
      } else {
        resumen.fallos += aMandar.length;
        await db.from("correos_enviados").delete().in("clave", aMandar.map((p) => p.clave)).is("resend_id", null);
      }
    }
  } catch (e) {
    console.error("[correo] anuncio:", e instanceof Error ? e.message : String(e));
    resumen.fallos++;
  }
  console.log(`[correo] anuncio ${a.id}: ${resumen.enviados} enviados, ${resumen.yaEnviados} ya enviados, ${resumen.fallos} fallos, ${resumen.pendientes} pendientes${resumen.omitido ? ` (${resumen.omitido})` : ""}`);
  return resumen;
}
