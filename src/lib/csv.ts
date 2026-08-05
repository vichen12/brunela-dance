/**
 * Armado de CSV para la exportacion de alumnas.
 *
 * ⚠️ POR QUE ESTO VIVE EN UN ARCHIVO APARTE
 *   Estaba dentro de la ruta, donde no se puede importar y por lo tanto no se
 *   puede EJERCITAR. La prueba que lo cubria miraba el texto del archivo con un
 *   regex -- o sea comprobaba que el codigo estuviera escrito, no que
 *   funcionara. Aca se le pueden pasar valores y mirar que devuelve.
 */

/**
 * Una celda de CSV, a prueba de Excel.
 *
 * El prefijo con comilla simple cuando empieza por `= + - @` no es capricho:
 * Excel interpreta esas celdas como FORMULA y un nombre que empiece con "=" se
 * EJECUTA al abrir el archivo. Se llama CSV injection, y es la razon por la que
 * un export "solo de lectura" puede terminar corriendo algo en la maquina de
 * Brunela. El nombre lo escribe la alumna: es entrada no confiable.
 *
 * Tambien se neutralizan tab y retorno de carro, que Excel usa para separar.
 */
export function celda(valor: unknown): string {
  let s = valor === null || valor === undefined ? "" : String(valor);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * El BOM de UTF-8.
 *
 * Sin el, Excel en Windows abre el archivo en ANSI y los acentos salen rotos.
 * No es cosmetico: un CSV con "Mart�nez" es un CSV que hay que rehacer.
 */
export const BOM_UTF8 = "\uFEFF";
