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

function fallo(error: string, asunto?: string): ResultadoEnvio {
  // No se loguea el destinatario: es dato personal.
  console.error(`[correo] no se envio${asunto ? ` "${asunto}"` : ""}: ${error}`);
  return { ok: false, error };
}
