/**
 * La "dirección" de una clase, programa, pack, categoría o sesión.
 *
 * Es lo que va en la URL. Brunela no tiene por qué saber qué es un slug ni
 * inventarlo: escribe "Pack de iniciación" y esto devuelve "pack-de-iniciacion".
 *
 * ⚠️ SOLO AL CREAR, NUNCA AL EDITAR
 *   La dirección es el enlace permanente. Si se regenerara al cambiarle el
 *   nombre a algo ya publicado, cualquier enlace compartido dejaria de
 *   funcionar -- y nadie se enteraria hasta que una alumna avise. Quien decide
 *   eso es la pantalla (ver components/auto-direccion.tsx); esta funcion solo
 *   transforma texto.
 */

/**
 * @example aDireccion("Pack de iniciación")  -> "pack-de-iniciacion"
 * @example aDireccion("Ballet · Nivel 2")    -> "ballet-nivel-2"
 * @example aDireccion("  ¿Qué es el PBT?  ") -> "que-es-el-pbt"
 */
export function aDireccion(texto: string): string {
  return (
    texto
      .normalize("NFD")
      // Se quitan los diacriticos y NO se transliteran: "ñ" queda "n", que es lo
      // que se espera en una URL en castellano. La ç del catalan cae en "c" por
      // el mismo camino.
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      // Todo lo que no sea letra o numero pasa a guion. Incluye los signos de
      // apertura del castellano (¿ ¡), que si no dejarian un guion al principio.
      .replace(/[^a-z0-9]+/g, "-")
      // Guiones repetidos y de los extremos: "Ballet — Nivel 2" daria
      // "ballet---nivel-2" sin esto.
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "")
      // Un limite generoso: nadie escribe titulos asi, pero la columna es unica
      // y una direccion de 400 caracteres no le sirve a nadie.
      .slice(0, 80)
      .replace(/-+$/g, "")
  );
}
