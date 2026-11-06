/**
 * Que entra en las Novedades del inicio. Aparte de las consultas para poder
 * probarlo sin base, y para que la accion de packs importe el prefijo sin
 * arrastrar el cliente de Supabase.
 */

/** Hasta cuando algo sigue siendo "nuevo". */
export const DIAS_DE_NOVEDAD = 45;
const MAXIMO = 6;
/** Sin tope, una tanda de planes nuevos tapa la clase de ayer: primero se reparte. */
const POR_TIPO_PRIMERO = 2;

/** Empieza asi el anuncio que crea "Avisar a las alumnas": el pack ya sale como pack. */
export const PREFIJO_ANUNCIO_DE_PACK = "Pack nuevo: ";

export type TipoNovedad = "clase" | "plan" | "pack" | "anuncio";

export type Novedad = {
  clave: string;
  tipo: TipoNovedad;
  titulo: string;
  /** "Mini training", "9,99 EUR · pago único" o el texto del anuncio. */
  detalle: string | null;
  href: string | null;
  imagen: string | null;
  fecha: string;
  gratis: boolean;
};

/**
 * Lo reciente, lo mas nuevo primero, sin repetir el pack con su anuncio. Entra
 * de todo un poco; si sobra lugar (hay solo clases, por ejemplo) se completa
 * con lo que quedo afuera.
 */
export function ordenarNovedades(lista: Novedad[], ahora = Date.now()): Novedad[] {
  const corte = ahora - DIAS_DE_NOVEDAD * 86_400_000;
  const porFecha = (a: Novedad, b: Novedad) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
  const recientes = lista
    .filter((n) => new Date(n.fecha).getTime() >= corte)
    .filter((n) => !(n.tipo === "anuncio" && n.titulo.startsWith(PREFIJO_ANUNCIO_DE_PACK)))
    .sort(porFecha);

  const vistos = new Map<TipoNovedad, number>();
  const primero: Novedad[] = [];
  const resto: Novedad[] = [];
  for (const n of recientes) {
    const cuantos = vistos.get(n.tipo) ?? 0;
    vistos.set(n.tipo, cuantos + 1);
    (cuantos < POR_TIPO_PRIMERO ? primero : resto).push(n);
  }
  return [...primero, ...resto].slice(0, MAXIMO).sort(porFecha);
}
