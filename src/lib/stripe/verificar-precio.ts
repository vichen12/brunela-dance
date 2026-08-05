import Stripe from "stripe";
import { stripeMode, type StripeMode } from "@/src/lib/stripe/catalog";

/**
 * Le pregunta a Stripe cuanto vale de verdad un price id.
 *
 * PARA QUE EXISTE
 *   Brunela carga a mano el importe que se muestra Y el price id de Stripe, y
 *   son dos cosas separadas que tienen que decir lo mismo. Nada las ata: se
 *   puede cambiar el precio en Stripe y olvidarse del panel, o al reves. El
 *   sintoma es que la landing anuncia 16 EUR y en el checkout aparecen 20.
 *
 *   Esto NO lo impide. Lo MUESTRA. La decision sigue siendo de ella.
 *
 * ⚠️ ESTE MODULO SOLO LEE
 *   Exporta una unica funcion y hace una unica llamada: prices.retrieve. Las
 *   claves extra que usa NO se exportan ni se instancian en ningun otro lado,
 *   justamente para que no puedan terminar creando una sesion de pago. Cobrar
 *   sigue siendo cosa de STRIPE_SECRET_KEY y de nadie mas.
 *
 * ⚠️ POR QUE HACEN FALTA DOS CLAVES
 *   La clave ES el modo. Con una `sk_test_` Stripe no sabe absolutamente nada
 *   de un price de produccion: no dice "es de otro modo", dice "no existe". Y
 *   "no existe" y "te equivocaste de juego" son dos problemas con arreglos
 *   distintos, asi que confundirlos hace inutil el aviso.
 *
 *   Con las dos claves cargadas se puede distinguir de verdad, porque se busca
 *   el id en los dos mundos.
 */

export type ResultadoVerificacion =
  | { estado: "ok"; importeCentimos: number; moneda: string; intervalo: string | null; apodo: string | null }
  | { estado: "archivado"; importeCentimos: number; moneda: string; intervalo: string | null; apodo: string | null }
  | { estado: "modo_equivocado"; modoReal: StripeMode }
  | { estado: "no_existe" }
  | { estado: "no_verificable"; motivo: string }
  | { estado: "error"; mensaje: string };

/**
 * Que clave usar para preguntar por el juego `modo`.
 *
 * Devuelve null cuando no hay ninguna que sirva -- lo cual NO es un fallo: es el
 * caso normal en local, donde solo esta la de test.
 *
 * ⚠️ SE COMPRUEBA EL PREFIJO DE LA CLAVE EXTRA, no se confia en su nombre. Una
 *    `sk_live_` guardada en STRIPE_SECRET_KEY_TEST responderia con total
 *    seguridad sobre el juego equivocado, y el panel mostraria un importe
 *    correcto para el price... equivocado. Un aviso que miente es peor que no
 *    tener aviso.
 */
function claveParaModo(modo: StripeMode): string | null {
  const principal = process.env.STRIPE_SECRET_KEY;
  if (principal && stripeMode(principal) === modo) return principal;

  const extra = modo === "test"
    ? process.env.STRIPE_SECRET_KEY_TEST
    : process.env.STRIPE_SECRET_KEY_LIVE;

  if (extra && stripeMode(extra) === modo) return extra;
  return null;
}

/** True si el price existe en ese modo. Se usa para distinguir "no existe" de "te equivocaste de juego". */
async function existeEn(modo: StripeMode, priceId: string): Promise<boolean> {
  const clave = claveParaModo(modo);
  if (!clave) return false;
  try {
    await new Stripe(clave).prices.retrieve(priceId);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param priceId  el id que cargo Brunela
 * @param modo     el casillero en el que lo cargo (test o live)
 */
export async function verificarPrecio(
  priceId: string,
  modo: StripeMode
): Promise<ResultadoVerificacion> {
  const id = priceId.trim();
  if (!id) return { estado: "no_verificable", motivo: "sin id" };

  const clave = claveParaModo(modo);
  if (!clave) {
    return {
      estado: "no_verificable",
      motivo:
        modo === "test"
          ? "Falta STRIPE_SECRET_KEY_TEST en este entorno."
          : "Falta STRIPE_SECRET_KEY_LIVE en este entorno.",
    };
  }

  try {
    const price = await new Stripe(clave).prices.retrieve(id);

    const datos = {
      // unit_amount viene null en precios escalonados o por uso. No es un error
      // nuestro, pero tampoco se puede comparar contra un importe fijo.
      importeCentimos: price.unit_amount ?? 0,
      moneda: price.currency,
      intervalo: price.recurring?.interval ?? null,
      apodo: price.nickname ?? null,
    };

    return price.active ? { estado: "ok", ...datos } : { estado: "archivado", ...datos };
  } catch (e) {
    const err = e as Stripe.errors.StripeError;

    // 'resource_missing' significa "en ESTE modo no esta". Antes de decir que no
    // existe hay que mirar el otro, que es el error que de verdad se comete.
    if (err?.code === "resource_missing" || err?.statusCode === 404) {
      const otro: StripeMode = modo === "test" ? "live" : "test";
      if (await existeEn(otro, id)) {
        return { estado: "modo_equivocado", modoReal: otro };
      }
      return { estado: "no_existe" };
    }

    return { estado: "error", mensaje: err?.message ?? "No se pudo consultar Stripe." };
  }
}

/**
 * El texto que se le muestra a Brunela.
 *
 * Se arma aca y no en la pantalla para que el mismo resultado diga lo mismo en
 * los planes y en los packs, que son dos formularios distintos.
 *
 * `importeEsperadoCentimos` es lo que ella escribio; puede ser null cuando
 * todavia no cargo nada.
 */
export function leerVerificacion(
  r: ResultadoVerificacion,
  importeEsperadoCentimos: number | null,
  monedaEsperada: string | null
): { tono: "ok" | "aviso" | "gris"; texto: string } {
  const euros = (c: number, moneda: string) =>
    `${(c / 100).toLocaleString("es-ES", { minimumFractionDigits: c % 100 === 0 ? 0 : 2 })} ${moneda.toUpperCase()}`;

  switch (r.estado) {
    case "no_verificable":
      return { tono: "gris", texto: `No verificable desde este entorno. ${r.motivo}` };

    case "no_existe":
      return { tono: "aviso", texto: "⚠️ Este precio no existe en Stripe. Revisá que esté bien copiado." };

    case "modo_equivocado":
      return {
        tono: "aviso",
        texto:
          r.modoReal === "live"
            ? "⚠️ Este precio es de PRODUCCIÓN y lo pusiste en el casillero de prueba."
            : "⚠️ Este precio es de PRUEBA y lo pusiste en el casillero de producción.",
      };

    case "error":
      return { tono: "gris", texto: `No se pudo consultar Stripe: ${r.mensaje}` };

    case "archivado":
      return {
        tono: "aviso",
        texto: `⚠️ En Stripe este precio está ARCHIVADO (${euros(r.importeCentimos, r.moneda)}). No se puede cobrar con él.`,
      };

    case "ok": {
      const avisos: string[] = [];

      if (importeEsperadoCentimos !== null && r.importeCentimos !== importeEsperadoCentimos) {
        avisos.push(
          `en Stripe son ${euros(r.importeCentimos, r.moneda)} y vos pusiste ${euros(importeEsperadoCentimos, monedaEsperada ?? r.moneda)}`
        );
      }
      if (monedaEsperada && r.moneda.toLowerCase() !== monedaEsperada.toLowerCase()) {
        avisos.push(`la moneda en Stripe es ${r.moneda.toUpperCase()}`);
      }

      if (avisos.length > 0) return { tono: "aviso", texto: `⚠️ ${avisos.join("; ")}.` };

      const cada = r.intervalo ? ` cada ${r.intervalo === "month" ? "mes" : r.intervalo === "year" ? "año" : r.intervalo}` : " (pago único)";
      return { tono: "ok", texto: `✓ En Stripe: ${euros(r.importeCentimos, r.moneda)}${cada}.` };
    }
  }
}
