/**
 * `fetch` para los clientes de Supabase del servidor, con UN reintento cuando
 * la base rechaza el pedido por un desfase de reloj.
 *
 * POR QUE EXISTE (2026-11-11)
 *   En los registros de produccion aparecia, cada tanto, "JWT issued at
 *   future": el servidor que firma la credencial y el que la revisa tienen
 *   relojes distintos por menos de un segundo, y el segundo la ve "emitida en
 *   el futuro". No es un problema de permisos y se va solo al instante, pero
 *   ese pedido falla: en /packs la pagina publica mostraba "todavia no hay
 *   packs" (y quedaba asi un minuto, por la cache), y en el estudio una lista
 *   llegaba vacia.
 *
 * QUE HACE
 *   Si la respuesta es un error Y el cuerpo dice "issued at future", espera un
 *   momento y repite el MISMO pedido, hasta dos veces. Cualquier otra respuesta
 *   pasa tal cual. Repetir es seguro: el pedido rechazado no llego a ejecutarse.
 */
const ESPERAS_MS = [400, 900];

export async function fetchConReintento(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let respuesta = await fetch(input, init);
  // Un cuerpo que es un flujo no se puede mandar dos veces.
  if (init?.body instanceof ReadableStream || input instanceof Request) return respuesta;

  for (const espera of ESPERAS_MS) {
    if (respuesta.ok || respuesta.status >= 500) return respuesta;
    const texto = await respuesta.clone().text().catch(() => "");
    if (!/issued at future/i.test(texto)) return respuesta;
    await new Promise((r) => setTimeout(r, espera));
    respuesta = await fetch(input, init);
  }
  return respuesta;
}
