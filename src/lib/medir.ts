/**
 * Anota en los registros de Vercel lo que tarda de mas.
 *
 * POR QUE EXISTE (2026-11-09)
 *   Crear un pack o agendar una sesion privada guardaba en el acto, pero el
 *   boton se quedaba minutos en "Creando…". Sin registros no hay forma de saber
 *   que paso lo frena, y Vercel (plan Hobby) los guarda una sola hora. Esto deja
 *   una linea `[lento] <que>: <ms> ms` solo cuando algo pasa el umbral, asi los
 *   registros no se llenan de ruido.
 */
export async function medir<T>(nombre: string, trabajo: PromiseLike<T> | (() => PromiseLike<T>), umbralMs = 1500): Promise<T> {
  const empezo = Date.now();
  try {
    return await (typeof trabajo === "function" ? trabajo() : trabajo);
  } finally {
    const ms = Date.now() - empezo;
    if (ms >= umbralMs) console.warn(`[lento] ${nombre}: ${ms} ms`);
  }
}
