import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarCorreo, type CorreoAEnviar, type ResultadoEnvio } from "../../lib/email/enviar";
import type { CorreoArmado } from "../../lib/email/mensajes";
import { esClaveRepetida, esFaltaDeTablaCorreos, MIGRACION_CORREOS, type TipoCorreo } from "./reglas";

/**
 * Manda un correo del estudio UNA SOLA VEZ por clave, para siempre.
 *
 * ⚠️ SIN "use server", Y A PROPOSITO. Un archivo con "use server" convierte
 *    cada funcion exportada en un endpoint POST publico (trampa 4). Esta recibe
 *    un cliente con service_role y una direccion de correo: expuesta, cualquiera
 *    podria mandar correos con la firma del estudio. Se llama solo desde
 *    codigo de servidor que ya comprobo quien es quien.
 *
 * COMO EVITA EL DOBLE ENVIO
 *   1. RESERVA la clave con un INSERT en correos_enviados. La primary key es la
 *      que decide: si el webhook reintenta, si el cron corre otra vez o si dos
 *      ejecuciones llegan juntas, solo una inserta; las demas reciben 23505 y
 *      no mandan nada.
 *   2. Manda (con la misma clave como Idempotency-Key de Resend, que cubre un
 *      reintento dentro de las 24 h aunque la base fallara en el medio).
 *   3. Bien -> guarda el id de Resend. Mal -> BORRA la reserva, para que la
 *      proxima ejecucion lo reintente.
 *
 *   Si el proceso muere entre 1 y 2, la reserva queda sin resend_id y ese
 *   correo no sale nunca. Es el lado correcto del error: perder un aviso es
 *   mejor que mandarlo dos veces.
 *
 * SIN LA MIGRACION NO MANDA
 *   Si la tabla no existe, no hay forma de saber si ya se mando, y el cron le
 *   escribiria lo mismo a la misma alumna todos los dias. Se avisa en los
 *   registros y se devuelve `sin_migracion`.
 *
 * NUNCA LANZA. Un correo es un aviso: no puede romper un pago, un onboarding
 * ni el cron.
 */

export type PedidoDeCorreo = {
  clave: string;
  tipo: TipoCorreo;
  /** null si no hay perfil (no deberia pasar en estos cinco correos). */
  alumnaId: string | null;
  para: string;
  correo: CorreoArmado;
};

export type ResultadoUnaVez =
  | { estado: "enviado"; id: string }
  | { estado: "ya_enviado" }
  | { estado: "sin_migracion" }
  | { estado: "fallo"; error: string };

type Dependencias = {
  db: SupabaseClient;
  /** Inyectable para las pruebas. Por defecto, Resend de verdad. */
  enviar?: (c: CorreoAEnviar) => Promise<ResultadoEnvio>;
};

let avisoSinMigracionDado = false;

export function avisarFaltaMigracion() {
  // Una vez por instancia: el cron puede intentar decenas en la misma corrida.
  if (avisoSinMigracionDado) return;
  avisoSinMigracionDado = true;
  console.warn(
    `[correo] falta la migracion ${MIGRACION_CORREOS}: NO se manda ningun correo del estudio ` +
      `hasta aplicarla (sin el registro no hay forma de no mandarlos dos veces).`
  );
}

export async function enviarUnaVez(pedido: PedidoDeCorreo, deps: Dependencias): Promise<ResultadoUnaVez> {
  const { db } = deps;
  const enviar = deps.enviar ?? enviarCorreo;
  const para = pedido.para.trim();

  try {
    if (!para) return { estado: "fallo", error: "la alumna no tiene correo" };

    // 1. Reservar.
    const { error: errReserva } = await db.from("correos_enviados").insert({
      clave: pedido.clave,
      alumna_id: pedido.alumnaId,
      tipo: pedido.tipo,
      para,
    });
    if (errReserva) {
      if (esClaveRepetida(errReserva)) return { estado: "ya_enviado" };
      if (esFaltaDeTablaCorreos(errReserva)) {
        avisarFaltaMigracion();
        return { estado: "sin_migracion" };
      }
      // Ante cualquier otra duda, no se manda: no se puede garantizar el "una vez".
      console.error(`[correo] no se pudo reservar ${pedido.tipo}: ${errReserva.message}`);
      return { estado: "fallo", error: errReserva.message };
    }

    // 2. Mandar.
    const r = await enviar({
      para,
      asunto: pedido.correo.asunto,
      html: pedido.correo.html,
      texto: pedido.correo.texto,
      claveIdempotencia: pedido.clave,
    });

    // 3a. Fallo: liberar la reserva para que se reintente.
    if (!r.ok) {
      const { error: errBorrar } = await db
        .from("correos_enviados")
        .delete()
        .eq("clave", pedido.clave)
        .is("resend_id", null);
      if (errBorrar) console.error(`[correo] no se pudo liberar la reserva de ${pedido.tipo}: ${errBorrar.message}`);
      return { estado: "fallo", error: r.error };
    }

    // 3b. Bien: guardar el id. Si esto falla el correo ya salio y la reserva
    //     sigue en pie, que es lo que importa: no se va a repetir.
    const { error: errId } = await db.from("correos_enviados").update({ resend_id: r.id }).eq("clave", pedido.clave);
    if (errId) console.error(`[correo] salio ${pedido.tipo} pero no se guardo el id: ${errId.message}`);
    return { estado: "enviado", id: r.id };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    console.error(`[correo] ${pedido.tipo}: ${mensaje}`);
    return { estado: "fallo", error: mensaje };
  }
}

/**
 * De una lista de claves, cuales ya se mandaron. Para que el cron no gaste su
 * tope en correos que la reserva igual iba a frenar.
 * null = falta la migracion (no mandar nada).
 */
export async function clavesYaEnviadas(db: SupabaseClient, lista: string[]): Promise<Set<string> | null> {
  const hechas = new Set<string>();
  for (let i = 0; i < lista.length; i += 200) {
    const { data, error } = await db.from("correos_enviados").select("clave").in("clave", lista.slice(i, i + 200));
    if (error) {
      if (esFaltaDeTablaCorreos(error)) {
        avisarFaltaMigracion();
        return null;
      }
      throw new Error("No se pudo leer correos_enviados: " + error.message);
    }
    for (const f of data ?? []) hechas.add(f.clave as string);
  }
  return hechas;
}
