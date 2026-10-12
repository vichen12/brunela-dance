/**
 * Envia un correo por Resend (https://resend.com/docs/api-reference/emails/send-email).
 *
 * SOLO SERVIDOR. Usa RESEND_API_KEY, que no puede llegar nunca al navegador.
 * El proyecto no tiene el paquete `server-only`; la guarda de abajo cumple el
 * mismo papel en tiempo de ejecucion: si alguien lo importa desde un componente
 * de cliente, falla en vez de mandar la clave.
 *
 * NUNCA ROMPE AL QUE LLAMA. Un correo es un aviso, no parte de la transaccion:
 * si Resend esta caido, si falta la clave o si la direccion es invalida, se
 * loguea y se devuelve { ok: false }. Nada de esto tira una excepcion.
 *
 * ⚠️ Resend opera en Estados Unidos (ver CLAUDE.md, "Decisiones conscientes").
 */

export interface CorreoAEnviar {
  para: string | string[];
  asunto: string;
  html: string;
  texto?: string;
  /** Direccion de respuesta. Por defecto, la del estudio. */
  responderA?: string;
  /** Evita duplicados si el que llama reintenta (Resend la respeta 24 h). */
  claveIdempotencia?: string;
  /** Cabeceras extra del correo (List-Unsubscribe). */
  encabezados?: Record<string, string>;
}

export type ResultadoEnvio = { ok: true; id: string } | { ok: false; error: string };

const RESEND_URL = "https://api.resend.com/emails";
const TIEMPO_MAXIMO_MS = 10_000;

export async function enviarCorreo(correo: CorreoAEnviar): Promise<ResultadoEnvio> {
  try {
    if (typeof window !== "undefined") {
      return fallo("enviarCorreo se llamo desde el navegador; solo puede usarse en el servidor");
    }

    const apiKey = process.env.RESEND_API_KEY;
    const remitente = process.env.EMAIL_REMITENTE;
    if (!apiKey || !remitente) {
      return fallo("faltan RESEND_API_KEY o EMAIL_REMITENTE");
    }

    const destinatarios = (Array.isArray(correo.para) ? correo.para : [correo.para])
      .map((d) => d.trim())
      .filter(Boolean);
    if (destinatarios.length === 0) {
      return fallo("no hay destinatario");
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (correo.claveIdempotencia) {
      headers["Idempotency-Key"] = correo.claveIdempotencia;
    }

    const respuesta = await fetch(RESEND_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: remitente,
        to: destinatarios,
        subject: correo.asunto,
        html: correo.html,
        text: correo.texto,
        reply_to: correo.responderA ?? "info@bruneladance.com",
        ...(correo.encabezados ? { headers: correo.encabezados } : null),
      }),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      cache: "no-store",
    });

    const cuerpo = (await respuesta.json().catch(() => null)) as
      | { id?: string; message?: string; name?: string }
      | null;

    if (!respuesta.ok || !cuerpo?.id) {
      return fallo(
        `Resend respondio ${respuesta.status}: ${cuerpo?.message ?? cuerpo?.name ?? "sin detalle"}`,
        correo.asunto,
      );
    }

    return { ok: true, id: cuerpo.id };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    return fallo(mensaje, correo.asunto);
  }
}

export type ResultadoLote = { ok: true; ids: string[] } | { ok: false; error: string };

const RESEND_LOTE_URL = "https://api.resend.com/emails/batch";
/** Tope de Resend por llamada a /emails/batch. */
export const MAXIMO_POR_LOTE = 100;

/**
 * Hasta 100 correos en UNA llamada (https://resend.com/docs/api-reference/emails/send-batch-emails).
 * Resend cuenta el lote como un solo pedido para su limite de 2 por segundo.
 *
 * Modo estricto (el de Resend por defecto): si un correo del lote es invalido
 * no sale NINGUNO, y los ids vuelven en el mismo orden que se mandaron. Eso es
 * lo que permite asociar cada id a su reserva en correos_enviados.
 *
 * Sin Idempotency-Key a proposito: Resend la rechaza (409) si el mismo valor
 * vuelve con otro contenido, y un lote reintentado nunca trae las mismas
 * alumnas. Lo que impide el doble envio es la reserva en correos_enviados.
 *
 * Cada correo lleva UN destinatario: un lote no es un correo con 100
 * direcciones a la vista.
 */
export async function enviarLote(correos: CorreoAEnviar[]): Promise<ResultadoLote> {
  try {
    if (typeof window !== "undefined") {
      return falloLote("enviarLote se llamo desde el navegador; solo puede usarse en el servidor");
    }
    if (correos.length === 0) return { ok: true, ids: [] };
    if (correos.length > MAXIMO_POR_LOTE) return falloLote(`un lote admite hasta ${MAXIMO_POR_LOTE} correos`);

    const apiKey = process.env.RESEND_API_KEY;
    const remitente = process.env.EMAIL_REMITENTE;
    if (!apiKey || !remitente) return falloLote("faltan RESEND_API_KEY o EMAIL_REMITENTE");

    const cuerpo = correos.map((c) => ({
      from: remitente,
      to: (Array.isArray(c.para) ? c.para : [c.para]).map((d) => d.trim()).filter(Boolean),
      subject: c.asunto,
      html: c.html,
      text: c.texto,
      reply_to: c.responderA ?? "info@bruneladance.com",
      ...(c.encabezados ? { headers: c.encabezados } : null),
    }));
    if (cuerpo.some((c) => c.to.length !== 1)) return falloLote("cada correo del lote lleva exactamente un destinatario");

    const respuesta = await fetch(RESEND_LOTE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const json = (await respuesta.json().catch(() => null)) as
      | { data?: { id?: string }[]; message?: string; name?: string }
      | null;
    if (!respuesta.ok) {
      return falloLote(`Resend respondio ${respuesta.status}: ${json?.message ?? json?.name ?? "sin detalle"}`);
    }
    // 2xx = Resend los acepto. Aunque la respuesta venga rara, se da por
    // enviado: liberar las reservas aca haria que salieran dos veces.
    const datos = json?.data ?? [];
    return { ok: true, ids: correos.map((_, i) => datos[i]?.id ?? "") };
  } catch (error) {
    return falloLote(error instanceof Error ? error.message : String(error));
  }
}

function falloLote(error: string): ResultadoLote {
  console.error(`[correo] no se envio el lote: ${error}`);
  return { ok: false, error };
}

function fallo(error: string, asunto?: string): ResultadoEnvio {
  // No se loguea el destinatario: es dato personal.
  console.error(`[correo] no se envio${asunto ? ` "${asunto}"` : ""}: ${error}`);
  return { ok: false, error };
}
