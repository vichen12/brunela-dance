/**
 * ¿Esta direccion es una ruta de ESTE sitio? Para todo "a donde volver" que
 * llega del navegador (callbackUrl, next, destino).
 *
 * POR QUE UNA SOLA FUNCION (2026-11-12)
 *   Habia cuatro comprobaciones escritas a mano y tres dejaban pasar "/\otro.com":
 *   el navegador lee la barra invertida como una barra comun, o sea "//otro.com",
 *   que es OTRO dominio. Alguien podia mandar un enlace de bruneladance.com que,
 *   despues de entrar, llevaba a una pagina falsa.
 *
 * Vale: empieza con UNA barra, sin espacios ni barras invertidas en ningun lado.
 */
export function esRutaPropia(raw: string | null | undefined): raw is string {
  return typeof raw === "string" && /^\/(?![/\\])[^\s\\]*$/.test(raw);
}

export function rutaPropia(raw: string | null | undefined, porDefecto: string): string {
  return esRutaPropia(raw) ? raw : porDefecto;
}
