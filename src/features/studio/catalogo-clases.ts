/**
 * El vocabulario de una clase: tipo, categoria, nivel, materiales y planes.
 *
 * POR QUE UN SOLO ARCHIVO
 *   Antes categorias y materiales eran texto libre separado por comas. Nadie
 *   escribe dos veces igual: "colchoneta" y "Colchoneta" son dos materiales
 *   distintos para la base, los filtros de la biblioteca se llenan de slugs
 *   crudos en minuscula, y una clase con "stretchin" no aparece en ningun
 *   filtro sin dar ningun error.
 *
 *   Ahora las cinco listas viven aca y las consumen el formulario de subida, el
 *   panel de edicion, los filtros de la biblioteca y el detalle de la clase. La
 *   migracion 20260921 inserta estas MISMAS categorias en public.categories: si
 *   se agrega una aca, hay que agregarla alla tambien.
 *
 * ⚠️ LOS SLUGS SON DATOS, NO ETIQUETAS. Cambiar un slug deja huerfanas a las
 *    clases ya guardadas -- dejan de aparecer en su filtro, en silencio. Para
 *    renombrar algo se cambia el LABEL y se deja el slug quieto; si hay que
 *    cambiar el slug de verdad, va con migracion, como
 *    20260803_unify_pilates_categories.sql.
 */

export type Opcion = { slug: string; label: string };

// -- 5. Tipo de contenido ----------------------------------------------------

export const TIPOS_DE_CONTENIDO = [
  { slug: "clase", label: "Clase" },
  { slug: "mini_training", label: "Mini Training" },
] as const satisfies readonly Opcion[];

export type TipoDeContenido = (typeof TIPOS_DE_CONTENIDO)[number]["slug"];

export const TIPO_LABEL: Record<string, string> = Object.fromEntries(
  TIPOS_DE_CONTENIDO.map((t) => [t.slug, t.label])
);

// -- 6. Categoria / Coleccion ------------------------------------------------

export const CATEGORIAS = [
  { slug: "ballet", label: "Ballet" },
  { slug: "tecnica", label: "Técnica" },
  { slug: "dehors", label: "Dehors" },
  { slug: "movilidad", label: "Movilidad" },
  { slug: "stretching", label: "Stretching" },
  { slug: "pies-y-tobillos", label: "Pies y Tobillos" },
  { slug: "equilibrio", label: "Equilibrio" },
  { slug: "abdominales-para-bailarines", label: "Abdominales para Bailarines" },
  { slug: "linea-y-control", label: "Línea y Control" },
  { slug: "giros", label: "Giros" },
  { slug: "preparacion-fisica", label: "Preparación Física" },
] as const satisfies readonly Opcion[];

export type CategoriaSlug = (typeof CATEGORIAS)[number]["slug"];

export const CATEGORIA_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIAS.map((c) => [c.slug, c.label])
);

// -- 7. Nivel ----------------------------------------------------------------

/**
 * POR QUE NIVEL NO ES UNA COLUMNA NUEVA
 *   `videos` ya tiene recommended_min_level y recommended_max_level, del enum
 *   technical_level (principiante..maestro). Los cuatro niveles del formulario
 *   son un RANGO de ese enum, no otra cosa: agregar una columna `nivel` al lado
 *   dejaria dos fuentes de verdad que se desincronizan sin avisar -- que es
 *   exactamente la familia de errores que ya costo cuatro veces en este
 *   proyecto.
 *
 *   Asi que el formulario habla de cuatro niveles y la base sigue guardando el
 *   par. La ida y la vuelta estan las dos aca abajo.
 */
export const NIVELES = [
  { slug: "inicial", label: "Inicial", min: "principiante", max: "principiante" },
  { slug: "intermedio", label: "Intermedio", min: "intermedio", max: "intermedio" },
  { slug: "avanzado", label: "Avanzado", min: "avanzado", max: "maestro" },
  { slug: "todos", label: "Todos", min: "principiante", max: "maestro" },
] as const;

export type NivelSlug = (typeof NIVELES)[number]["slug"];

export const NIVEL_LABEL: Record<string, string> = Object.fromEntries(
  NIVELES.map((n) => [n.slug, n.label])
);

/** Nivel del formulario -> el par que guarda la base. */
export function nivelARango(slug: string): { min: string; max: string } {
  const nivel = NIVELES.find((n) => n.slug === slug) ?? NIVELES[3];
  return { min: nivel.min, max: nivel.max };
}

/**
 * El par que guarda la base -> nivel del formulario.
 *
 * Es deliberadamente tolerante: las clases viejas pueden tener cualquier
 * combinacion del enum de cinco valores, y el panel tiene que poder abrirlas
 * igual. "profesional" y "maestro" caen en Avanzado, que es donde los pondria
 * cualquiera que mire la lista de cuatro.
 */
export function rangoANivel(min: string | null, max: string | null): NivelSlug {
  if (!min) return "todos";
  if (min === "principiante") return max === "principiante" ? "inicial" : "todos";
  if (min === "intermedio") return "intermedio";
  return "avanzado";
}

/** Un solo texto de nivel para las tarjetas: "Intermedio", "Todos los niveles". */
export function nivelEnTexto(min: string | null, max: string | null): string {
  const slug = rangoANivel(min, max);
  return slug === "todos" ? "Todos los niveles" : NIVEL_LABEL[slug];
}

// -- 9. Materiales -----------------------------------------------------------

/**
 * `sin-material` es EXCLUYENTE: tildarlo destilda todo el resto y viceversa.
 * Esa regla vive en la interfaz porque es ayuda al tipear, no control de
 * acceso: que alguien guarde por otra via una clase con "sin material Y
 * theraband" queda feo, no inseguro.
 */
export const SIN_MATERIAL = "sin-material";

export const MATERIALES = [
  { slug: SIN_MATERIAL, label: "Sin material" },
  { slug: "theraband", label: "Theraband" },
  { slug: "theraloop", label: "TheraLoop" },
  { slug: "fit-ball", label: "Fit Ball" },
  { slug: "fusion-ball", label: "Fusion Ball" },
  { slug: "mat", label: "Mat" },
  { slug: "barra-de-ballet", label: "Barra de ballet" },
  { slug: "pared", label: "Pared" },
  { slug: "cojin", label: "Cojín" },
  { slug: "bloque-de-yoga", label: "Bloque de yoga" },
  { slug: "pelota-pequena-rigida", label: "Pelota pequeña rígida" },
  { slug: "pesas", label: "Pesas" },
  { slug: "kettlebell", label: "Kettlebell" },
  { slug: "tobilleras", label: "Tobilleras" },
  { slug: "munequeras", label: "Muñequeras" },
  { slug: "silla", label: "Silla" },
  { slug: "foam-roller-con-pinchos", label: "Foam Roller con pinchos" },
] as const satisfies readonly Opcion[];

export type MaterialSlug = (typeof MATERIALES)[number]["slug"];

export const MATERIAL_LABEL: Record<string, string> = Object.fromEntries(
  MATERIALES.map((m) => [m.slug, m.label])
);

/** Para mostrar: "Theraband, Mat". Un slug desconocido se muestra crudo. */
export function materialesEnTexto(slugs: string[] | null | undefined): string {
  return (slugs ?? []).map((s) => MATERIAL_LABEL[s] ?? s).join(", ");
}

// -- 10. Planes --------------------------------------------------------------

/**
 * 🔴 ESTO GOBIERNA EL ACCESO AL CATALOGO, no solo como se ve el formulario.
 *
 *   La lista elegida se guarda en videos.planes_permitidos y es lo que lee la
 *   policy videos_select_allowed_by_tier. Es COMBINACION LIBRE: se puede
 *   publicar algo para Corps y Principal y no para Solista. Decidido el
 *   2026-09-21, sabiendo que la alternativa -- "de este plan para arriba" --
 *   no tocaba ninguna policy.
 *
 *   `none` NO esta en la lista y no puede estar: una clase visible para quien
 *   no paga es el catalogo abierto. La base lo rechaza con un check constraint,
 *   no solo esta pantalla.
 */
export const PLANES = [
  { slug: "corps_de_ballet", label: "Corps de Ballet" },
  { slug: "solista", label: "Solista" },
  { slug: "principal", label: "Principal" },
] as const satisfies readonly Opcion[];

export type PlanSlug = (typeof PLANES)[number]["slug"];

export const PLAN_LABEL: Record<string, string> = Object.fromEntries(
  PLANES.map((p) => [p.slug, p.label])
);

const ORDEN_PLAN = new Map(PLANES.map((p, i) => [p.slug as string, i]));

/** Ordena como la lista de arriba, no alfabeticamente. */
export function ordenarPlanes(slugs: string[]): string[] {
  return [...new Set(slugs)]
    .filter((s) => s in PLAN_LABEL)
    .sort((a, b) => (ORDEN_PLAN.get(a) ?? 99) - (ORDEN_PLAN.get(b) ?? 99));
}

/**
 * La regla vieja, "de este plan para arriba", como lista.
 *
 * Sirve para dos cosas: el valor por defecto del panel cuando abre una clase
 * guardada ANTES de la migracion 20260921 (todavia sin lista propia), y el
 * backfill de esa misma migracion, que usa esta misma regla en SQL. Si las dos
 * dejaran de coincidir, una clase cambiaria de manos al abrirla y guardarla.
 */
export function planesDesde(tier: string): string[] {
  const desde = ORDEN_PLAN.get(tier);
  if (desde === undefined) return PLANES.map((p) => p.slug);
  return PLANES.slice(desde).map((p) => p.slug);
}

/**
 * Los planes MÁS CAROS que quedaron afuera habiendo incluido uno más barato.
 *
 * POR QUE EXISTE
 *   La combinación libre permite cualquier conjunto, y eso incluye conjuntos
 *   que casi siempre son un error de tilde: dejar la clase para Corps de Ballet
 *   y no para Principal. Quien paga el plan más caro espera ver todo lo que ven
 *   los de abajo, así que «Corps sí, Principal no» es casi siempre un descuido.
 *
 *   «Casi siempre», no siempre: puede haber una clase de bienvenida solo para
 *   quien recién empieza. Por eso esto AVISA y no bloquea — decidido el
 *   2026-09-21.
 *
 * QUE NO CUENTA COMO ERROR
 *   Un plan más barato afuera. {solista, principal} deja a Corps afuera y eso
 *   es exclusividad normal: lo caro incluye a lo barato, no al revés.
 *
 * Devuelve los slugs en orden de precio. Lista vacía = nada que avisar.
 */
export function planesCarosSinIncluir(elegidos: string[]): string[] {
  const indices = elegidos
    .map((s) => ORDEN_PLAN.get(s))
    .filter((i): i is number => i !== undefined);

  if (indices.length === 0) return [];

  // El más barato de los elegidos marca el piso: de ahí para arriba, todo lo
  // que falte es un hueco.
  const piso = Math.min(...indices);
  return PLANES.filter((p, i) => i > piso && !elegidos.includes(p.slug)).map((p) => p.slug);
}

/** «Principal no va a ver esta clase» / «Solista y Principal no la van a ver». */
export function textoDePlanesSinIncluir(slugs: string[]): string | null {
  if (slugs.length === 0) return null;
  const labels = slugs.map((s) => PLAN_LABEL[s] ?? s);
  if (labels.length === 1) return `${labels[0]} no va a ver esta clase.`;
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]} no van a ver esta clase.`;
}

/** "Corps de Ballet y Solista" / "Todos los planes". */
export function planesEnTexto(slugs: string[] | null | undefined): string {
  const orden = ordenarPlanes(slugs ?? []);
  if (orden.length === 0) return "Sin plan asignado";
  if (orden.length === PLANES.length) return "Todos los planes";
  const labels = orden.map((s) => PLAN_LABEL[s]);
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}

// -- 11. Estado --------------------------------------------------------------

/**
 * "archived" sigue existiendo en el enum video_status y en las clases que ya lo
 * tengan: lo que se saco el 2026-09-21 fue la OPCION del formulario, por pedido
 * explicito. Sacarlo del enum obligaria a migrar filas y a tocar las policies
 * que comparan contra 'published'; no hacia falta para lo que se pidio.
 */
export const ESTADOS = [
  { slug: "draft", label: "Borrador" },
  { slug: "published", label: "Publicado" },
] as const satisfies readonly Opcion[];

export type EstadoSlug = (typeof ESTADOS)[number]["slug"];

// -- Las mismas listas, como tuplas para zod ---------------------------------

/**
 * `z.enum()` pide una tupla no vacia, no un `string[]`. Sin esto cada schema
 * repetiria los slugs a mano, que es justo como se desincronizan: alguien
 * agrega un material arriba, el formulario lo ofrece, y la validacion del
 * servidor lo rechaza con "material invalido".
 */
function slugsDe<T extends string>(opciones: readonly { slug: T }[]): [T, ...T[]] {
  return opciones.map((o) => o.slug) as [T, ...T[]];
}

export const TIPO_SLUGS = slugsDe(TIPOS_DE_CONTENIDO);
export const CATEGORIA_SLUGS = slugsDe(CATEGORIAS);
export const NIVEL_SLUGS = slugsDe(NIVELES);
export const MATERIAL_SLUGS = slugsDe(MATERIALES);
export const PLAN_SLUGS = slugsDe(PLANES);
export const ESTADO_SLUGS = slugsDe(ESTADOS);
