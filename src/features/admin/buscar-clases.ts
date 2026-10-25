/**
 * Buscador de clases del panel (/admin/videos): la regla de coincidencia, PURA.
 *
 * Pedido de Brunela (2026-10-25): "mientras escribo «relevé», que se abra una
 * lista con las clases que coinciden". La usan dos lados con la MISMA regla:
 *
 *   · las sugerencias mientras escribe (components/buscador-de-clases.tsx)
 *   · la busqueda del servidor al apretar Enter (app/admin/videos/page.tsx)
 *
 * Si fueran dos reglas, la lista desplegable diria «Relevé» y el Enter
 * contestaria «Ninguna clase coincide»: el ilike de Postgres distingue acentos
 * y «releve» no encuentra «Relevé». Por eso el servidor tambien busca con esto,
 * sobre la lista liviana que ya trae para las sugerencias.
 *
 * Sin imports: la usan el navegador, el servidor y las pruebas
 * (tests/sistema/buscar-clases.test.ts).
 */

export type ClaseParaBuscar = {
  id: string;
  slug: string;
  titulo: string;
  tituloEn: string;
  /** Nombres de las categorias, ya legibles ("Pies, Barra"). */
  categorias: string;
  /** Recortada: es para encontrar, no para leer. */
  descripcion: string;
  estado: "draft" | "published" | "archived";
  duracionMin: number;
  portada: string | null;
};

/** Minusculas, sin acentos ni diacriticos, espacios colapsados. «Relevé» -> «releve». */
export function normalizarBusqueda(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s\-_/]+/g, " ")
    .trim();
}

/** Cuanto pesa una coincidencia segun DONDE esta. Mas alto = mas arriba. */
function puntaje(c: ClaseParaBuscar, palabras: string[]): number {
  const titulo = normalizarBusqueda(c.titulo);
  const resto = [c.tituloEn, c.slug, c.categorias, c.descripcion].map(normalizarBusqueda);
  const todo = [titulo, ...resto].join(" ");

  // Todas las palabras tienen que estar en algun lado: "pies barra" no trae
  // cualquier clase que diga solo "pies".
  if (!palabras.every((p) => todo.includes(p))) return 0;

  const frase = palabras.join(" ");
  if (titulo.startsWith(frase)) return 100;
  if (titulo.includes(frase)) return 80;
  if (palabras.every((p) => titulo.includes(p))) return 60;
  const [en, slug, cats] = resto;
  if (palabras.every((p) => en.includes(p) || slug.includes(p))) return 40;
  if (palabras.every((p) => cats.includes(p) || titulo.includes(p))) return 30;
  return 10; // solo en la descripcion
}

/**
 * Las clases que coinciden con lo escrito, de la mejor a la peor. Con menos de
 * `minimo` caracteres no sugiere nada (una letra coincide con todo).
 */
export function buscarClases(
  clases: readonly ClaseParaBuscar[],
  q: string,
  opciones: { max?: number; minimo?: number } = {}
): ClaseParaBuscar[] {
  const { max = Infinity, minimo = 1 } = opciones;
  const n = normalizarBusqueda(q);
  if (n.length < minimo) return [];
  const palabras = n.split(" ").filter(Boolean);
  return clases
    .map((c, i) => ({ c, i, p: puntaje(c, palabras) }))
    .filter((x) => x.p > 0)
    // Mismo puntaje: se respeta el orden de entrada (la mas nueva primero).
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .slice(0, max)
    .map((x) => x.c);
}

/** La direccion que abre una clase: la lista filtrada a ella y su panel abierto. */
export function urlParaEditarClase(id: string): string {
  return `/admin/videos?editar=${encodeURIComponent(id)}`;
}
