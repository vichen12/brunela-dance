import Link from "next/link";
import { Paginacion } from "@/components/paginacion";
import { Play, Lock, Search, ArrowRight, X, Clock, BarChart3, Sparkles, CheckCircle2, Library } from "lucide-react";
import { Movimiento, Revelar, Aparecer, Grilla, Item, Pildoras, SelectAuto } from "@/components/biblioteca-motion";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { getProgresoDelUsuario } from "@/src/features/studio/progress";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { bunnySignedUrls, bunnyVideoIdFromUrl, hasBunnyStreamEnv } from "@/src/lib/video/bunny";
import {
  formatDurationLabel,
  resolveI18nText,
  safePercent,
  type MembershipTier,
  type VideoStatus,
} from "@/src/features/studio/helpers";
import {
  CATEGORIAS,
  CATEGORIA_LABEL,
  NIVELES,
  nivelEnTexto,
  planesDesde,
  rangoANivel,
} from "@/src/features/studio/catalogo-clases";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type VideoRecord = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  /** Solo viaja cuando hay busqueda. Ver la consulta de la fase D. */
  description_i18n?: Record<string, string>;
  membership_tier_required: MembershipTier;
  /** Lo que de verdad decide quien ve la clase. Ver la migracion 20260921. */
  planes_permitidos: string[] | null;
  duration_seconds: number;
  category_slugs: string[];
  thumbnail_url: string | null;
  stream_playback_id: string | null;
  bunny_video_id: string | null;
  is_featured: boolean;
  status: VideoStatus;
  published_at: string | null;
  recommended_min_level: string | null;
  recommended_max_level: string | null;
};

/** "42:18" -- mismo formato que muestra el reproductor. */
function mmss(segundos: number) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** "22 mayo" */
function fechaCorta(iso: string | null) {
  if (!iso) return null;
  return new Date(iso)
    .toLocaleDateString("es-ES", { day: "numeric", month: "long" })
    .replace(" de ", " ");
}

/**
 * El nivel se lee del par (recommended_min_level, recommended_max_level), que
 * es como lo guarda la base desde el primer dia, pero se MUESTRA con los cuatro
 * niveles que ofrece el formulario de carga: Inicial, Intermedio, Avanzado y
 * Todos. La conversion vive en catalogo-clases.ts, que es tambien de donde sale
 * el desplegable de /admin/videos: una sola lista para elegir y para mostrar.
 */
const nivelTexto = nivelEnTexto;

type ProgressRecord = { video_id: string; completion_percent: number };

// Antes aca vivian quickPublishToggleAction y quickDeleteVideoAction (publicar
// y borrar desde la biblioteca). Se sacaron: /dashboard/** es la vista de
// alumna, identica para todas, y gestionar clases vive en /admin/videos. Una
// server action que nadie usa sigue siendo un endpoint POST publico.

// ── Styles ───────────────────────────────────────────────────────────────────

const TIER_META: Record<string, { bg: string; color: string; label: string }> = {
  none:            { bg: "#FBF0EB", color: "#8A6F68", label: "Básico" },
  corps_de_ballet: { bg: "var(--pink-wash)", color: "var(--pink-deep)", label: "Corps" },
  solista:         { bg: "var(--pink-soft)", color: "var(--pink-deep)", label: "Solista" },
  principal:       { bg: "var(--pink)", color: "#fff", label: "Principal" },
};

/**
 * Un degrade por categoria, para la tarjeta de la clase que todavia no tiene
 * miniatura.
 *
 * Escrito a mano y no generado por indice: con `CATEGORIAS[i % paleta.length]`
 * agregar una categoria en el medio le cambia el color a todas las de abajo, y
 * la biblioteca entera se ve distinta por haber sumado una fila a una lista.
 *
 * Los slugs viejos (pilates, pbt, pct, reformer, mat) quedan mapeados abajo: la
 * migracion 20260921 los desactiva, pero una clase que todavia los tenga no
 * tiene por que perder su color y caer en el gris de reserva.
 */
const CAT_GRADIENTS: Record<string, string> = {
  ballet:                        "linear-gradient(140deg, #FFF1EC 0%, #FFD9CF 100%)",
  tecnica:                       "linear-gradient(140deg, #FFF4E8 0%, #FFDCC4 100%)",
  dehors:                        "linear-gradient(140deg, #FDECEC 0%, #F8CFCF 100%)",
  movilidad:                     "linear-gradient(140deg, #FFF4E8 0%, #FFDCC4 100%)",
  stretching:                    "linear-gradient(140deg, #FFF0EA 0%, #FFD9CC 100%)",
  "pies-y-tobillos":             "linear-gradient(140deg, #FFF4E8 0%, #FBD3BE 100%)",
  equilibrio:                    "linear-gradient(140deg, #FFF4E8 0%, #FFE0CB 100%)",
  "abdominales-para-bailarines": "linear-gradient(140deg, #FFF1EC 0%, #FAD0C8 100%)",
  "linea-y-control":             "linear-gradient(140deg, #FFF0EA 0%, #FFDCD0 100%)",
  giros:                         "linear-gradient(140deg, #FDECEC 0%, #FFDCCB 100%)",
  "preparacion-fisica":          "linear-gradient(140deg, #FFF4E8 0%, #F6D5C2 100%)",

  pilates:    "linear-gradient(140deg, #FFF4E8 0%, #FFDCC4 100%)",
  pbt:        "linear-gradient(140deg, #FFF1EC 0%, #FFD9CF 100%)",
  pct:        "linear-gradient(140deg, #FFF0EA 0%, #FFD9CC 100%)",
  reformer:   "linear-gradient(140deg, #FFF4E8 0%, #FFDCC4 100%)",
  mat:        "linear-gradient(140deg, #FFF4E8 0%, #FFDCC4 100%)",
};

function catGradient(slugs: string[]): string {
  for (const s of slugs) if (CAT_GRADIENTS[s]) return CAT_GRADIENTS[s];
  return "linear-gradient(140deg, #FFF2EE 0%, #FBDDD3 100%)";
}

/** Clases por pagina: tres filas de cuatro en escritorio. */
const POR_PAGINA = 12;
/** Tope de la consulta. El catalogo es de decenas o pocos cientos de clases. */
const TOPE_CATALOGO = 600;

/**
 * Los chips fijos salen de la MISMA lista que el desplegable de /admin/videos.
 * Cuando estaban escritos aca aparte, agregar una categoria en el panel la
 * dejaba en el filtro como slug crudo en minuscula -- "pies-y-tobillos" -- y
 * nadie se enteraba hasta verlo en pantalla.
 */
const FIXED_FILTERS = [
  { key: "all", label: "Todas" },
  ...CATEGORIAS.map((c) => ({ key: c.slug, label: c.label })),
];

/**
 * Slugs que cuentan como parte de una categoria.
 *
 * "Pilates" absorbe reformer y mat. Esto NO sobra despues de correr la
 * migracion: el codigo se despliega antes que ella, y sin esta equivalencia
 * las clases de reformer desaparecerian del filtro en la ventana entre las dos
 * cosas. Tambien cubre el caso de que alguien cargue una clase vieja mas
 * adelante.
 */
const CATEGORIA_EQUIVALENTES: Record<string, string[]> = {
  pilates: ["pilates", "reformer", "mat"],
};

function coincideCategoria(slugsDeLaClase: string[], filtro: string): boolean {
  if (filtro === "all") return true;
  const aceptados = CATEGORIA_EQUIVALENTES[filtro] ?? [filtro];
  return slugsDeLaClase.some((s) => aceptados.includes(s));
}

/** Invierte CATEGORIA_EQUIVALENTES: 'reformer' -> 'pilates'. Una sola fuente. */
const SLUG_CANONICO: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORIA_EQUIVALENTES).flatMap(([canonico, variantes]) =>
    variantes.map((v) => [v, canonico])
  )
);

const canonico = (slug: string) => SLUG_CANONICO[slug] ?? slug;

// ── Los cuatro filtros ───────────────────────────────────────────────────────
// Todos salen de datos que ya existen: ninguno necesita capturar nada nuevo.

/**
 * El filtro ofrece los mismos niveles que el formulario de carga, no los cinco
 * crudos del enum. Ofrecer "Profesional" cuando ninguna clase se puede cargar
 * como profesional es un filtro que solo puede devolver vacio.
 */
const OPCIONES_NIVEL = [
  { key: "", label: "Todos los niveles" },
  ...NIVELES.filter((n) => n.slug !== "todos").map((n) => ({ key: n.slug, label: n.label })),
];

const OPCIONES_DURACION = [
  { key: "",      label: "Cualquier duración" },
  { key: "corta", label: "Hasta 20 min" },
  { key: "media", label: "20 a 45 min" },
  { key: "larga", label: "Más de 45 min" },
];

const OPCIONES_ESTADO = [
  { key: "",           label: "Cualquier estado" },
  { key: "sin_empezar", label: "Sin empezar" },
  { key: "empezadas",   label: "Empezadas" },
  { key: "completadas", label: "Completadas" },
];

/**
 * Una clase cae dentro de un nivel si ese nivel esta en su rango recomendado.
 * No es igualdad: una clase marcada de principiante a avanzado tiene que
 * aparecer cuando alguien filtra por "intermedio", que es justo lo que la
 * profesora quiso decir al poner un rango.
 *
 * Los limites sin definir se tratan como abiertos: sin esto, una clase a la
 * que nadie le cargo el rango desaparece de todos los filtros de nivel.
 */
/**
 * Los planes que ven una clase.
 *
 * El `?? planesDesde(...)` cubre a las clases guardadas ANTES de la migracion
 * 20260921, que todavia no tienen lista propia: ahi vale la regla vieja, "de
 * ese plan para arriba", que es exactamente la que uso el backfill.
 */
function planesDeLaClase(v: { planes_permitidos: string[] | null; membership_tier_required: string }): string[] {
  return v.planes_permitidos?.length ? v.planes_permitidos : planesDesde(v.membership_tier_required);
}

const ORDEN_DE_PLANES = ["corps_de_ballet", "solista", "principal"];

/**
 * Que plan nombrar en el candado de una clase que la alumna no puede abrir.
 *
 * 🔴 NO ES `membership_tier_required`.
 *    Desde la combinacion libre de planes (migracion 20260921) esa columna es
 *    el plan MAS BAJO de la lista, no el que hace falta. Con una clase para
 *    {corps, principal}, una alumna Solista veia "🔒 Corps" -- un plan mas
 *    barato que el que ya paga -- justo en el momento de venderle la subida.
 *
 * La respuesta correcta es el plan mas barato DE LA LISTA que este por encima
 * del suyo. Si no hay ninguno (caso raro: la clase es solo para planes mas
 * bajos), se nombra el mas barato de la lista.
 */
function planQueDesbloquea(
  v: { planes_permitidos: string[] | null; membership_tier_required: string },
  planActual: string
): string {
  const lista = planesDeLaClase(v)
    .filter((p) => ORDEN_DE_PLANES.includes(p))
    .sort((a, b) => ORDEN_DE_PLANES.indexOf(a) - ORDEN_DE_PLANES.indexOf(b));
  const rango = ORDEN_DE_PLANES.indexOf(planActual); // -1 si no tiene plan
  return lista.find((p) => ORDEN_DE_PLANES.indexOf(p) > rango) ?? lista[0] ?? "corps_de_ballet";
}

/**
 * Una clase marcada "Todos" entra en cualquier filtro de nivel; el resto tiene
 * que coincidir. Se compara por el nivel del FORMULARIO y no por el par crudo,
 * para que una clase vieja guardada como principiante..profesional caiga en la
 * misma casilla que muestra su ficha.
 */
function coincideNivel(min: string | null, max: string | null, nivel: string): boolean {
  if (!nivel) return true;
  const suyo = rangoANivel(min, max);
  return suyo === "todos" || suyo === nivel;
}

function coincideDuracion(segundos: number, rango: string): boolean {
  if (!rango) return true;
  const min = segundos / 60;
  if (rango === "corta") return min <= 20;
  if (rango === "media") return min > 20 && min <= 45;
  if (rango === "larga") return min > 45;
  return true;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardLibraryPage({ searchParams }: { searchParams?: SearchParams }) {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  // ⚠️ El checkout de packs vuelve aca con ?success=. Antes nadie lo leia: la
  //    alumna pagaba y aterrizaba en la biblioteca SIN NINGUNA confirmacion,
  //    con un parametro en la URL que no dibujaba nada.
  const avisoCompra = typeof params.success === "string" ? decodeURIComponent(params.success) : null;
  const activeCategory = typeof params.category === "string" ? params.category : "all";
  const busqueda = (typeof params.q === "string" ? params.q : "").trim();

  // Los cuatro filtros. Se validan contra sus listas en vez de confiar en la
  // URL: un ?nivel=<script> tiene que quedar en "todos", no viajar al render.
  const uno = (k: string, permitidos: string[]) => {
    const v = typeof params[k] === "string" ? (params[k] as string) : "";
    return permitidos.includes(v) ? v : "";
  };
  const fNivel    = uno("nivel",  OPCIONES_NIVEL.map((o) => o.key));
  const fDuracion = uno("dur",    OPCIONES_DURACION.map((o) => o.key));
  const fEstado   = uno("estado", OPCIONES_ESTADO.map((o) => o.key));

  // Paginas numeradas (pedido de la duena: "¡paginá!"). Antes era "Ver más"
  // acumulativo. Se pagina DESPUES de los filtros en memoria (categoria,
  // nivel, duracion, texto): paginar la consulta y filtrar despues dejaba
  // paginas con 3 clases y un "Siguiente" que no tenia nada.
  const pagina = Math.max(0, Math.min(200, Number(params.pagina) || 0));

  const profileData = await getCurrentProfile(user.id);
  /**
   * /dashboard/** ES LA VISTA DE ALUMNA, identica para todas -- admin incluida.
   * Gestionar clases (borradores, publicar, filtrar por plan) vive en
   * /admin/videos.
   *
   * ⚠️ RLS a la admin le devuelve TODO (las policies de `videos` llevan
   *    is_admin()), borradores incluidos. Para que vea exactamente lo que
   *    veria una alumna de SU plan, se recorta a mano: status = published y
   *    la lista de planes de la clase contra el plan de su perfil. Para una
   *    alumna esos recortes no cambian nada: RLS ya los hizo.
   *
   * El filtro por PLAN ya no existe aca: era una herramienta de Brunela. Un
   * ?plan= escrito a mano en la URL se ignora.
   */
  const isAdmin = profileData?.is_admin ?? false;
  const hayFiltros = Boolean(fNivel || fDuracion || fEstado);
  const planDeLaAlumna = profileData?.membership_tier ?? "none";
  /**
   * ⚠️ TENER UN PACK NO ES "NO TENER PLAN".
   *
   *    Esto miraba solo `membership_tier === "none"`, y quien compra un pack
   *    SIGUE en 'none': un pack da acceso a clases sueltas, no un plan. Asi que
   *    a una alumna que YA HABIA PAGADO se le mostraba el catalogo entero con
   *    candado, y cada tarjeta -- incluida la que compro -- enlazaba a
   *    /dashboard/plan. No podia ni abrir su propia clase desde la biblioteca.
   *
   *    La pregunta correcta no es "¿que plan tiene?" sino "¿tiene algo?".
   */
  const { count: comprasPropias } = await supabase
    .from("pack_purchases")
    .select("id", { count: "exact", head: true })
    // Las de ELLA: a la admin RLS le cuenta las de todas.
    .eq("user_id", user.id);

  const sinNada =
    (profileData?.membership_tier ?? "none") === "none" &&
    (comprasPropias ?? 0) === 0;

  /**
   * "Explorar todo": ver el catalogo completo con candados aun teniendo acceso.
   *
   * Va como conmutador de VISTA y no como un quinto filtro porque no acota el
   * conjunto: lo cambia. Los filtros contestan "de lo que veo, ¿cual?"; esto
   * contesta "¿que estoy mirando?". Mezclarlos haria que "Explorar todo" con un
   * filtro de plan puesto signifique dos cosas a la vez.
   *
   * Para quien no tiene nada da igual: ya esta viendo todo.
   */
  const modoTodo = sinNada || params.ver === "todo";

  // ── Fase D: lo que puede filtrar SQL, lo filtra SQL ───────────────────────
  //
  // La categoria usa `.contains()`, que es un `@>` de Postgres y va contra
  // idx_videos_category_slugs -- un indice GIN que existe desde el primer dia
  // y que hasta ahora no se usaba nunca, porque el filtrado se hacia en
  // JavaScript despues de traer TODAS las clases.
  //
  // Lo que NO se puede empujar a SQL, y por que:
  //   - el estado personal (empezada / completada) depende del progreso de esta
  //     alumna, que es otra tabla y otra consulta
  //   - nivel y duracion son rangos derivados; con el volumen de un catalogo de
  //     clases no justifican complicar la consulta
  //   - la busqueda por texto necesitaria full-text search, que es una
  //     migracion aparte
  //
  // `description_i18n` SOLO viaja cuando hay busqueda: es el campo mas pesado
  // de la fila y en el listado no se muestra. Con 200 clases son cientos de KB
  // por carga que no se usaban para nada.
  const COLUMNAS_BASE =
    "id, slug, title_i18n, membership_tier_required, planes_permitidos, duration_seconds, category_slugs, thumbnail_url, stream_playback_id, bunny_video_id, is_featured, status, published_at, recommended_min_level, recommended_max_level";
  const columnas = busqueda ? `${COLUMNAS_BASE}, description_i18n` : COLUMNAS_BASE;

  let consulta = supabase.from("videos").select(columnas);
  if (activeCategory !== "all") {
    consulta = consulta.overlaps("category_slugs", CATEGORIA_EQUIVALENTES[activeCategory] ?? [activeCategory]);
  }
  // Vista de alumna: nunca borradores. Para la alumna RLS ya los saca; para
  // la admin no, y por eso va explicito.
  consulta = consulta.eq("status", "published");
  // La admin ve lo de SU plan, como una alumna con ese plan. `contains` y no
  // `eq`: desde la migracion 20260921 el acceso vive en la LISTA, y con `eq`
  // sobre el minimo derivado una clase {corps, solista} no apareceria para
  // Solista.
  if (isAdmin) consulta = consulta.contains("planes_permitidos", [planDeLaAlumna]);

  const [{ data: videosData }, progressData] = await Promise.all([
    consulta
      .order("is_featured", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(TOPE_CATALOGO),
    // Mismo progreso memoizado que ya trajo el layout: sin esto era un segundo
    // viaje a Supabase por la misma tabla.
    getProgresoDelUsuario(user.id),
  ]);

  // ── VITRINA para quien todavia no pago ────────────────────────────────────
  //
  // Se lee con service_role porque RLS -- correctamente -- no le deja ver nada.
  // Por eso la lista de columnas es CORTA Y EXPLICITA: solo lo que hace falta
  // para dibujar la tarjeta.
  //
  // 🔴 NUNCA agregar aca bunny_video_id, stream_playback_id ni stream_asset_id.
  //    Con cualquiera de esos, alguien sin plan podria armar la URL del video y
  //    saltarse el pago entero. La tarjeta de la vitrina tampoco enlaza al
  //    detalle: lleva a /dashboard/plan.
  let vitrina: VideoRecord[] = [];
  if (modoTodo) {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("videos")
      .select("id, slug, title_i18n, description_i18n, membership_tier_required, planes_permitidos, duration_seconds, category_slugs, thumbnail_url, is_featured, status, published_at, recommended_min_level, recommended_max_level")
      .eq("status", "published")
      .order("is_featured", { ascending: false })
      .order("published_at", { ascending: false });
    vitrina = ((data ?? []) as unknown as VideoRecord[]).map((v) => ({
      ...v,
      // Explicito: aunque la consulta ya no los pide, quedan en null para que
      // ningun render futuro los pueda leer por accidente.
      stream_playback_id: null,
      bunny_video_id: null,
    }));
  }

  const crudas = (videosData ?? []) as unknown as VideoRecord[];
  const videos = (modoTodo ? vitrina : crudas);

  /**
   * Que clases puede ver DE VERDAD, para poner el candado tarjeta por tarjeta.
   *
   * ⚠️ Se pregunta con el cliente DE LA ALUMNA: contesta RLS, o sea la MISMA
   *    regla que decide si el reproductor va a servir el video. Un calculo
   *    aparte en JavaScript podria decir que si y el proxy que no.
   *
   *    Solo se piden los `id`. Y solo hace falta en modo explorar teniendo
   *    acceso: quien no tiene nada tiene todo bloqueado y no hay que preguntar.
   */
  const accesibles = new Set<string>();
  if (modoTodo && !sinNada) {
    if (isAdmin) {
      // A la admin RLS le contesta "todo", asi que preguntarle no sirve para
      // mostrarle la vista de alumna: el candado sale del plan de su perfil,
      // con la misma lista que lee la policy.
      for (const v of vitrina) if (planesDeLaClase(v).includes(planDeLaAlumna)) accesibles.add(v.id);
    } else {
      const { data } = await supabase.from("videos").select("id");
      for (const v of (data ?? []) as { id: string }[]) accesibles.add(v.id);
    }
  }

  /** Con candado y sin enlace al detalle. */
  const bloqueada = (id: string) => modoTodo && !accesibles.has(id);
  const progressMap = new Map(progressData.map((p) => [p.video_id, p]));

  // Los slugs se canonizan ANTES de armar los chips. Sin esto, mientras las
  // clases sigan con 'reformer' en la base, el chip "Pilates" no aparece (no
  // esta entre los slugs presentes) y en su lugar sale uno crudo en minuscula.
  // Es la misma ventana entre despliegue y migracion que ya cubren el degrade y
  // la etiqueta del dashboard.
  const dbCats = Array.from(
    new Set(videos.flatMap((v) => v.category_slugs).filter(Boolean).map(canonico))
  ).sort();
  const filters = [
    FIXED_FILTERS[0],
    ...FIXED_FILTERS.slice(1).filter((f) => dbCats.includes(f.key)),
    ...dbCats.filter((c) => !FIXED_FILTERS.some((f) => f.key === c)).map((c) => ({ key: c, label: c })),
  ];

  const porCategoria = videos.filter((v) => coincideCategoria(v.category_slugs, activeCategory));

  // Busqueda por titulo, descripcion y categoria. Sin acentos ni mayusculas,
  // para que "tecnica" encuentre "Tecnica clasica".
  const normalizar = (t: string) =>
    t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const termino = normalizar(busqueda);
  const porTexto = termino
    ? porCategoria.filter((v) =>
        normalizar(
          [resolveI18nText(v.title_i18n), resolveI18nText(v.description_i18n ?? {}), ...v.category_slugs].join(" ")
        ).includes(termino)
      )
    : porCategoria;

  // Los cuatro filtros, al final de la cadena. El estado personal se resuelve
  // con el progreso que ya vino memoizado del layout: no agrega ningun viaje.
  const visible = porTexto.filter((v) => {
    if (!coincideNivel(v.recommended_min_level, v.recommended_max_level, fNivel)) return false;
    if (!coincideDuracion(v.duration_seconds, fDuracion)) return false;
    if (fEstado) {
      const p = progressMap.get(v.id);
      // "Completada" usa el mismo umbral que el reproductor para marcarla
      // (completion_percent >= 90). Si aca fuera 100, una clase que la alumna
      // ve como terminada no aparceria en su propio filtro de completadas.
      const completada = Boolean(p?.is_completed) || (p?.completion_percent ?? 0) >= 90;
      const empezada = Boolean(p) && !completada;
      if (fEstado === "completadas" && !completada) return false;
      if (fEstado === "empezadas" && !empezada) return false;
      if (fEstado === "sin_empezar" && p) return false;
    }
    return true;
  });

  const totalPaginas = Math.max(1, Math.ceil(visible.length / POR_PAGINA));
  const paginaReal = Math.min(pagina, totalPaginas - 1);
  const enPagina = visible.slice(paginaReal * POR_PAGINA, paginaReal * POR_PAGINA + POR_PAGINA);

  /**
   * Arma un enlace de la biblioteca conservando TODO lo que esta puesto
   * (busqueda, categoria, filtros y vista) salvo lo que se pisa. Antes cada
   * enlace armaba su propio query string a mano, y en mas de un lugar se perdia
   * un parametro en silencio.
   */
  const enlace = (cambios: Record<string, string | null> = {}) => {
    const base: Record<string, string> = {
      category: activeCategory !== "all" ? activeCategory : "",
      q: busqueda,
      nivel: fNivel,
      dur: fDuracion,
      estado: fEstado,
      ver: modoTodo && !sinNada ? "todo" : "",
    };
    for (const [k, v] of Object.entries(cambios)) base[k] = v ?? "";
    const qs = Object.entries(base)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return `/dashboard/library${qs ? `?${qs}` : ""}`;
  };

  // null fuera de "Explorar todo": ahi no hay nada que aclarar.
  const tuyas = modoTodo && !sinNada ? visible.filter((v) => !bloqueada(v.id)).length : null;
  const filtros = ([
    { name: "nivel",  valor: fNivel,    ops: OPCIONES_NIVEL,    etiqueta: "Nivel" },
    { name: "dur",    valor: fDuracion, ops: OPCIONES_DURACION, etiqueta: "Duración" },
    { name: "estado", valor: fEstado,   ops: OPCIONES_ESTADO,   etiqueta: "Estado" },
  ] as const);

  return (
    <main className="pb-20 md:pb-28" style={{ minHeight: "100vh", background: "#fff" }}>
      <style>{CSS_BIBLIOTECA}</style>
      <Movimiento>
      <section className="bib">
        {/* ⚠️ El texto NO promete que ya esten desbloqueadas. Stripe redirige al
            instante y el webhook puede tardar unos segundos: decirle "ya podés
            verlas" y que no aparezcan es peor que avisarle de la demora. */}
        {avisoCompra && (
          <div role="status" className="bib-aviso">
            <span className="bib-aviso-ico" aria-hidden="true"><CheckCircle2 size={18} strokeWidth={2} /></span>
            <span>{avisoCompra}</span>
          </div>
        )}

        {/* ── Cabecera ── */}
        <header className="bib-mast">
          <span className="bib-mast-mancha bib-mast-mancha--a" aria-hidden="true" />
          <span className="bib-mast-mancha bib-mast-mancha--b" aria-hidden="true" />
          <div className="bib-mast-txt">
            <Aparecer>
              <p className="bib-eyebrow">
                <Library size={14} strokeWidth={2.2} aria-hidden="true" />
                Biblioteca de clases
              </p>
            </Aparecer>
            <h1 className="bib-titulo">
              <Revelar retraso={0.05}>Tus <em>clases</em></Revelar>
            </h1>
            <Aparecer retraso={0.25}>
              <p className="bib-lede">
                Todo el contenido disponible según tu plan, para que sigas creciendo cada día.
              </p>
            </Aparecer>
          </div>

        </header>

        {/* ── Buscar y filtrar ── */}
        <Aparecer retraso={0.3} className="bib-barra">
          {/* Buscador: formulario GET, sin JavaScript. Conserva categoria, filtros y vista. */}
          <form method="get" action="/dashboard/library" className="bib-buscar" role="search">
            {activeCategory !== "all" && <input type="hidden" name="category" value={activeCategory} />}
            {fNivel && <input type="hidden" name="nivel" value={fNivel} />}
            {fDuracion && <input type="hidden" name="dur" value={fDuracion} />}
            {fEstado && <input type="hidden" name="estado" value={fEstado} />}
            {modoTodo && !sinNada && <input type="hidden" name="ver" value="todo" />}
            <Search size={18} strokeWidth={2} className="bib-buscar-ico" aria-hidden="true" />
            <input
              type="search"
              name="q"
              defaultValue={busqueda}
              placeholder="Buscar por título, categoría o descripción"
              aria-label="Buscar clases"
            />
            <button type="submit" className="bib-buscar-btn" aria-label="Buscar">
              <ArrowRight size={16} strokeWidth={2.4} />
            </button>
          </form>

          {/* Los filtros se aplican al cambiarlos. Sin JavaScript queda el
              boton de <noscript>. Conservan busqueda, categoria y vista. */}
          <form method="get" action="/dashboard/library" className="bib-filtros">
            {activeCategory !== "all" && <input type="hidden" name="category" value={activeCategory} />}
            {busqueda && <input type="hidden" name="q" value={busqueda} />}
            {modoTodo && !sinNada && <input type="hidden" name="ver" value="todo" />}
            {filtros.map((f) => (
              <SelectAuto
                key={f.name}
                name={f.name}
                defaultValue={f.valor}
                etiqueta={f.etiqueta}
                opciones={f.ops.map((o) => ({ key: o.key, label: o.label }))}
              />
            ))}
            <noscript>
              <button type="submit" className="bib-btn bib-btn--lleno">Aplicar</button>
            </noscript>
            {hayFiltros && (
              <Link href={enlace({ nivel: null, dur: null, estado: null }) as never} className="bib-quitar">
                <X size={13} strokeWidth={2.4} /> Quitar filtros
              </Link>
            )}
          </form>
        </Aparecer>

        {/* ── Vista y categorias ──
            El conmutador va solo para quien tiene algo: quien no tiene nada ya
            esta viendo el catalogo completo, y "Explorar todo" no haria nada.
            Es un segmento y no una pildora mas porque no acota: cambia QUE
            conjunto se mira. */}
        <Aparecer retraso={0.4} className="bib-nav">
          {!sinNada && (
            <Pildoras
              variante="segmento"
              etiqueta="Vista"
              items={[
                { href: enlace({ ver: null, pagina: null }), label: "Mis clases", activa: !modoTodo, ayuda: "Lo que ya podés ver" },
                { href: enlace({ ver: "todo", pagina: null }), label: "Explorar todo", activa: modoTodo, ayuda: "El catálogo completo" },
              ]}
            />
          )}
          <Pildoras
            etiqueta="Categorías"
            items={filters.map((f) => ({
              href: enlace({ category: f.key !== "all" ? f.key : null }),
              label: f.label,
              activa: activeCategory === f.key,
            }))}
          />
        </Aparecer>

        {/* Contador.
            ⚠️ En "Explorar todo" el numero grande es el CATALOGO, no lo que ella
               puede ver: al lado va cuantas tiene abiertas. */}
        <div className="bib-contador">
          <span className="bib-contador-num">{visible.length}</span>
          <span>
            {visible.length === 1 ? "clase" : "clases"}
            {busqueda ? ` para “${busqueda}”` : ""}
            {tuyas !== null ? ` · ${tuyas} ${tuyas === 1 ? "tuya" : "tuyas"}` : ""}
          </span>
        </div>

        {/* ── Grilla ── */}
        {visible.length === 0 ? (
          <div className="bib-vacio">
            <div className="bib-vacio-ilus" aria-hidden="true">
              <span className="bib-vacio-burbuja bib-vacio-burbuja--a"><Play size={18} strokeWidth={2.2} fill="currentColor" /></span>
              <span className="bib-vacio-burbuja bib-vacio-burbuja--b"><Search size={22} strokeWidth={2.2} /></span>
              <span className="bib-vacio-burbuja bib-vacio-burbuja--c"><Sparkles size={16} strokeWidth={2.2} /></span>
            </div>
            <p className="bib-vacio-titulo">
              {!busqueda && !hayFiltros
                ? "Todavía no hay clases."
                : busqueda
                  ? `No encontramos clases para “${busqueda}”.`
                  : "No hay clases para este filtro."}
            </p>
            <p className="bib-vacio-sub">
              {!busqueda && !hayFiltros
                ? "Muy pronto van a aparecer acá las clases de tu plan."
                : "Probá con otra palabra o sacá algún filtro: seguro hay algo lindo esperándote."}
            </p>
            {hayFiltros || busqueda
              ? <Link href="/dashboard/library" className="bib-btn">Ver todas las clases</Link>
              : null}
          </div>
        ) : (
          <Grilla className="bib-grilla">
            {enPagina.map((video) => {
              const pct = safePercent(progressMap.get(video.id)?.completion_percent);
              const title = resolveI18nText(video.title_i18n);
              // Las miniaturas viven detras de la misma pull zone con token que
              // el video, asi que tambien se firman por request.
              const bunnyId = video.bunny_video_id ?? bunnyVideoIdFromUrl(video.stream_playback_id);
              const thumbSrc =
                bunnyId && hasBunnyStreamEnv() ? bunnySignedUrls(bunnyId).thumbnail : video.thumbnail_url;
              const categoria = CATEGORIA_LABEL[video.category_slugs[0]] ?? video.category_slugs[0] ?? "Clase";
              const fecha = fechaCorta(video.published_at);

              return (
                <Item key={video.id} className="bib-item">
                  <article className="bib-card">
                    {/* ⚠️ EL CANDADO ES POR CLASE, NO POR ALUMNA.
                        Lo decide `bloqueada()`, que sale de RLS: la misma regla
                        que usa el reproductor. Quien compro un pack sigue en
                        'none' y aun asi tiene que poder abrir su clase. */}
                    <Link
                      href={(bloqueada(video.id) ? "/dashboard/plan" : `/dashboard/library/${video.slug}`) as never}
                      className="bib-card-link"
                    >
                      <div
                        className={"bib-img" + (thumbSrc ? "" : " es-sin-foto")}
                        style={thumbSrc ? undefined : { background: catGradient(video.category_slugs) }}
                      >
                        {thumbSrc && <img src={thumbSrc} alt="" loading="lazy" />}
                        {thumbSrc && <span className="bib-img-sombra" aria-hidden="true" />}
                        <span className="bib-chips">
                          {video.is_featured && <span className="bib-chip bib-chip--dest"><Sparkles size={11} strokeWidth={2.4} aria-hidden="true" /> Destacada</span>}
                        </span>
                        {bloqueada(video.id) && (
                          <span className="bib-candado">
                            <Lock size={11} strokeWidth={2.4} aria-hidden="true" />
                            {TIER_META[planQueDesbloquea(video, planDeLaAlumna)]?.label ?? "Plan"}
                          </span>
                        )}
                        <span className="bib-play" aria-hidden="true">
                          {bloqueada(video.id) ? <Lock size={18} strokeWidth={2.2} /> : <Play size={18} strokeWidth={2} fill="currentColor" />}
                        </span>
                        <span className="bib-dur">
                          <Clock size={12} strokeWidth={2.4} aria-hidden="true" />
                          {mmss(video.duration_seconds)}
                        </span>
                      </div>
                      <div className="bib-info">
                        <p className="bib-cat">
                          <span className="bib-cat-chip">{categoria}</span>
                          {fecha ? <span className="bib-fecha">{fecha}</span> : null}
                        </p>
                        <h3 className="bib-card-titulo">{title}</h3>
                        <p className="bib-meta">
                          <BarChart3 size={13} strokeWidth={2.2} aria-hidden="true" />
                          {nivelTexto(video.recommended_min_level, video.recommended_max_level)}
                          {pct > 0 ? <span className="bib-meta-pct">{pct >= 90 ? "Completada" : `${pct}% visto`}</span> : null}
                        </p>
                        {pct > 0 && (
                          <span className="bib-prog" aria-label={`${pct}% visto`}>
                            <span style={{ width: `${pct}%` }} />
                          </span>
                        )}
                      </div>
                    </Link>

                  </article>
                </Item>
              );
            })}

          </Grilla>
        )}

        <Paginacion pagina={paginaReal} total={visible.length} porPagina={POR_PAGINA} href={(n) => enlace({ pagina: n > 0 ? String(n) : null })} />
      </section>
      </Movimiento>
    </main>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────
// Direccion "suave y calida": tarjetas blancas con radio grande y sombra tibia,
// chips pastel, nada negro de fondo y ninguna etiqueta en mayusculas espaciadas.

const CSS_BIBLIOTECA = `
.bib {
  max-width: 1440px; margin: 0 auto;
  padding: clamp(20px, 3vw, 40px) clamp(16px, 3.4vw, 48px) 0;
  display: flex; flex-direction: column;
}
.bib a:focus { outline: none; }
.bib a:focus-visible, .bib button:focus-visible, .bib select:focus-visible, .bib input:focus-visible {
  outline: 2px solid var(--pink); outline-offset: 3px;
}
.bib-aviso {
  display: flex; align-items: center; gap: 12px;
  border-radius: var(--radio-chico); padding: 12px 16px; margin-bottom: 18px; font-size: 14px; font-weight: 600; line-height: 1.55;
  background: var(--rubor); color: var(--pink-deep); border: 1px solid var(--pink-line);
}
.bib-aviso-ico {
  width: 34px; height: 34px; border-radius: 12px; flex-shrink: 0; background: #fff;
  display: inline-flex; align-items: center; justify-content: center;
}

/* cabecera: tarjeta-hero suave con manchas difusas */
.bib-mast {
  position: relative; overflow: hidden; isolation: isolate;
  display: flex; align-items: flex-end; justify-content: space-between; gap: 22px 28px; flex-wrap: wrap;
  padding: clamp(24px, 3.2vw, 40px) clamp(22px, 3.2vw, 44px);
  border-radius: 32px; border: 1px solid var(--linea);
  background: linear-gradient(120deg, #FFF1EC 0%, #FFF7F3 55%, #FFEFE6 100%);
}
.bib-mast-mancha { position: absolute; z-index: -1; border-radius: 50%; filter: blur(40px); pointer-events: none; }
.bib-mast-mancha--a { width: 340px; height: 340px; right: -80px; top: -160px; background: rgba(255, 210, 186, 0.75); animation: bib-flota 14s ease-in-out infinite; }
.bib-mast-mancha--b { width: 260px; height: 260px; right: 26%; bottom: -170px; background: rgba(253, 205, 205, 0.6); animation: bib-flota 18s ease-in-out infinite reverse; }
@keyframes bib-flota { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-24px, 14px); } }
.bib-mast-txt { min-width: 0; flex: 1 1 380px; }
.bib-eyebrow {
  display: inline-flex; align-items: center; gap: 7px; margin-bottom: 14px;
  padding: 6px 13px 6px 10px; border-radius: 99px; background: #fff; box-shadow: 0 6px 16px -10px rgba(176, 70, 70, 0.45);
  font-size: 12.5px; font-weight: 800; color: var(--pink-deep);
}
.bib-titulo {
  font-family: var(--font-display), sans-serif; font-weight: 900;
  font-size: clamp(32px, 3.8vw, 50px); line-height: 1.08; letter-spacing: -0.02em; color: var(--ink);
}
.bib-titulo em { font-style: normal; color: var(--pink-mid); }
.bib-lede { margin-top: 10px; max-width: 56ch; font-size: 15.5px; line-height: 1.65; color: var(--muted); }

.bib-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; white-space: nowrap;
  height: 46px; padding: 0 22px; border-radius: 99px; text-decoration: none; cursor: pointer;
  font: inherit; font-size: 14px; font-weight: 800;
  color: var(--ink); border: 1px solid var(--linea-fuerte); background: #fff;
  transition: border-color .25s, background .25s, color .25s, transform .35s var(--curva), box-shadow .35s var(--curva);
}
.bib-btn:hover { background: var(--rubor); border-color: var(--pink-line); color: var(--pink-deep); transform: translateY(-2px); }
.bib-btn--lleno { background: var(--pink); border-color: var(--pink); color: #fff; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); }
.bib-btn--lleno:hover { background: var(--pink-mid); border-color: var(--pink-mid); color: #fff; box-shadow: 0 18px 30px -14px rgba(230,79,85,.9); }
.bib-btn--texto { border-color: transparent; background: transparent; color: var(--pink-deep); padding: 0 10px; }
.bib-btn--texto:hover { border-color: transparent; background: rgba(255,255,255,.7); }

/* buscar y filtrar */
.bib-barra {
  display: flex; align-items: center; justify-content: space-between; gap: 14px 20px; flex-wrap: wrap;
  margin-top: 22px;
}
.bib-buscar { position: relative; flex: 1 1 320px; max-width: 540px; display: flex; align-items: center; }
.bib-buscar-ico { position: absolute; left: 18px; color: var(--muted); pointer-events: none; transition: color .2s; }
.bib-buscar input {
  width: 100%; height: 52px; padding: 0 56px 0 48px; border-radius: 99px;
  border: 1px solid var(--linea-fuerte); background: #fff; box-shadow: var(--sombra);
  font: inherit; font-size: 15px; font-weight: 600; color: var(--ink); outline: none;
  transition: border-color .2s, box-shadow .3s;
}
.bib-buscar input::placeholder { color: #B39189; font-weight: 500; }
.bib-buscar input:focus { border-color: var(--pink-line); box-shadow: 0 0 0 4px var(--pink-wash), var(--sombra); }
.bib-buscar input:focus-visible { outline: none; }
.bib-buscar:focus-within .bib-buscar-ico { color: var(--pink); }
.bib-buscar-btn {
  position: absolute; right: 7px; width: 38px; height: 38px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
  border: 0; background: var(--pink); color: #fff; box-shadow: 0 10px 18px -10px rgba(230,79,85,.9);
  transition: background .2s, transform .3s var(--curva);
}
.bib-buscar-btn:hover { background: var(--pink-mid); transform: scale(1.06); }

.bib-filtros { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.bib-filtros .dsp-boton { height: 42px; min-height: 42px; border-width: 1px; border-color: var(--linea-fuerte); background: #fff; }
.bib-filtros .dsp-boton:hover:not(:disabled) { border-color: var(--pink-line); background: var(--rubor); }
.bib-filtros .dsp-prefijo { font-size: 12.5px; letter-spacing: 0; text-transform: none; font-weight: 700; color: var(--muted); }
.bib-quitar {
  display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 14px; border-radius: 99px;
  background: var(--rubor); font-size: 13px; font-weight: 800; color: var(--pink-deep); text-decoration: none;
  transition: background .2s;
}
.bib-quitar:hover { background: var(--pink-wash); }

/* vista y categorias */
.bib-nav { display: flex; align-items: center; gap: 12px 18px; flex-wrap: wrap; padding: 22px 0 4px; }
.bib-seg {
  display: inline-flex; padding: 5px; border-radius: 99px; background: var(--rubor); border: 1px solid var(--linea); flex-shrink: 0;
}
.bib-seg-op {
  position: relative; padding: 9px 18px; border-radius: 99px; text-decoration: none;
  font-size: 13.5px; font-weight: 800; color: var(--muted); transition: color .2s;
}
.bib-seg-op:hover { color: var(--pink-deep); }
.bib-seg-op.es-activa { color: var(--pink-deep); }
.bib-seg-fondo {
  position: absolute; inset: 0; border-radius: 99px; background: #fff;
  box-shadow: 0 1px 2px rgba(150,80,70,.08), 0 6px 14px -6px rgba(176,70,70,.3);
}
.bib-pildoras {
  display: flex; gap: 8px; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none;
  padding: 4px 2px 8px; -webkit-mask-image: linear-gradient(to right, #000 92%, transparent);
  mask-image: linear-gradient(to right, #000 92%, transparent);
}
.bib-pildoras::-webkit-scrollbar { display: none; }
.bib-pildora {
  position: relative; flex-shrink: 0; padding: 9px 17px; border-radius: 99px; text-decoration: none;
  font-size: 13.5px; font-weight: 700; color: var(--muted); background: #fff; border: 1px solid var(--linea);
  transition: border-color .2s, color .2s, background .2s, transform .3s var(--curva);
}
.bib-pildora:hover { border-color: var(--pink-line); color: var(--pink-deep); background: var(--rubor); transform: translateY(-1px); }
.bib-pildora.es-activa { color: #fff; border-color: transparent; background: transparent; }
.bib-pildora-fondo { position: absolute; inset: -1px; border-radius: 99px; background: var(--pink); box-shadow: 0 10px 20px -12px rgba(230,79,85,.9); }
.bib-pildora-txt { position: relative; }

.bib-contador {
  display: inline-flex; align-items: center; gap: 8px; align-self: flex-start; margin: 14px 0 22px;
  padding: 6px 14px 6px 6px; border-radius: 99px; background: var(--crema); border: 1px solid var(--linea);
  font-size: 13.5px; font-weight: 700; color: var(--muted);
}
.bib-contador-num {
  min-width: 30px; height: 30px; padding: 0 8px; border-radius: 99px; background: #fff;
  display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px -6px rgba(176,70,70,.4);
  font-weight: 900; font-size: 15px; color: var(--pink-deep);
}

/* grilla */
.bib-grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 24px; }
.bib-item { min-width: 0; }
.bib-card {
  position: relative; height: 100%; display: flex; flex-direction: column;
  background: #fff; border: 1px solid var(--linea); border-radius: 28px; padding: 10px;
  box-shadow: var(--sombra);
  transition: transform .35s var(--curva), box-shadow .35s var(--curva), border-color .35s;
}
.bib-card:hover { transform: translateY(-4px); box-shadow: var(--sombra-alta); border-color: var(--pink-line); }
.bib-card-link { display: block; flex: 1; text-decoration: none; color: inherit; border-radius: 20px; }
.bib-img {
  position: relative; aspect-ratio: 16 / 11; border-radius: 20px; overflow: hidden; isolation: isolate;
  background: var(--rubor);
}
.bib-img img {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
  transition: transform .9s var(--curva);
}
.bib-card:hover .bib-img img { transform: scale(1.05); }
.bib-img.es-sin-foto::before, .bib-img.es-sin-foto::after {
  content: ""; position: absolute; z-index: 0; border-radius: 50%; pointer-events: none;
}
.bib-img.es-sin-foto::before { width: 62%; aspect-ratio: 1; right: -14%; top: -22%; background: rgba(255,255,255,.55); }
.bib-img.es-sin-foto::after { width: 38%; aspect-ratio: 1; left: -8%; bottom: -16%; background: rgba(255,255,255,.4); }
.bib-img-sombra {
  position: absolute; inset: 0; z-index: 1;
  background: linear-gradient(to top, rgba(120,60,50,0.18) 0%, rgba(120,60,50,0) 40%);
}
.bib-chips { position: absolute; top: 12px; left: 12px; z-index: 2; display: flex; gap: 6px; flex-wrap: wrap; }
.bib-chip {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 800; padding: 5px 11px; border-radius: 99px;
}
.bib-chip--borrador { background: var(--melocoton); color: var(--melocoton-deep); box-shadow: 0 4px 12px -6px rgba(194,94,58,.5); }
.bib-chip--dest { background: var(--pink); color: #fff; box-shadow: 0 6px 14px -8px rgba(230,79,85,.9); }
.bib-candado {
  position: absolute; top: 12px; right: 12px; z-index: 2;
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 99px;
  background: rgba(255,255,255,0.95); color: var(--pink-deep);
  font-size: 12px; font-weight: 800; box-shadow: 0 6px 14px -8px rgba(176,70,70,.5);
}
.bib-play {
  position: absolute; z-index: 2; left: 50%; top: 50%; width: 56px; height: 56px; margin: -28px 0 0 -28px;
  display: flex; align-items: center; justify-content: center; border-radius: 50%;
  background: rgba(255,255,255,0.96); color: var(--pink);
  box-shadow: 0 14px 28px -12px rgba(176,70,70,.55);
  opacity: 0; transform: scale(0.75); transition: opacity .3s, transform .45s var(--curva);
}
.bib-play svg { margin-left: 2px; }
.bib-card:hover .bib-play { opacity: 1; transform: scale(1); }
.bib-dur {
  position: absolute; z-index: 2; right: 12px; bottom: 12px;
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12.5px; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums;
  padding: 5px 11px; border-radius: 99px; background: rgba(255,255,255,0.94);
  box-shadow: 0 4px 12px -6px rgba(150,80,70,.45);
}
.bib-dur svg { color: var(--pink); }

.bib-info { padding: 14px 8px 8px; }
.bib-cat { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.bib-cat-chip {
  display: inline-flex; padding: 4px 11px; border-radius: 99px; background: var(--rubor);
  font-size: 12px; font-weight: 800; color: var(--pink-deep);
}
.bib-fecha { font-size: 12px; font-weight: 700; color: #B39189; }
.bib-card-titulo {
  margin-top: 10px; font-family: var(--font-display), sans-serif; font-weight: 800;
  font-size: 18px; line-height: 1.3; letter-spacing: -0.01em; color: var(--ink);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  transition: color .2s;
}
.bib-card:hover .bib-card-titulo { color: var(--pink-deep); }
.bib-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 6px; font-size: 13px; font-weight: 600; color: var(--muted); }
.bib-meta svg { color: #C9A79E; }
.bib-meta-pct {
  margin-left: auto; padding: 3px 10px; border-radius: 99px; background: var(--rubor);
  color: var(--pink-deep); font-size: 12px; font-weight: 800;
}
.bib-prog { display: block; margin-top: 12px; height: 7px; border-radius: 99px; background: var(--rubor); overflow: hidden; }
.bib-prog span { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #F48A7A, var(--pink)); }

.bib-vacio {
  display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;
  padding: 48px 24px 52px; border-radius: 32px; border: 1px solid var(--linea);
  background: linear-gradient(160deg, #FFF7F3 0%, #fff 70%);
}
.bib-vacio-ilus { position: relative; width: 150px; height: 104px; margin-bottom: 8px; }
.bib-vacio-burbuja {
  position: absolute; display: inline-flex; align-items: center; justify-content: center; box-shadow: var(--sombra);
}
.bib-vacio-burbuja--a { width: 54px; height: 54px; left: 4px; top: 28px; border-radius: 18px; background: var(--rubor); color: var(--pink); transform: rotate(-8deg); }
.bib-vacio-burbuja--b { width: 68px; height: 68px; left: 46px; top: 4px; border-radius: 22px; background: #fff; color: var(--pink-deep); z-index: 1; }
.bib-vacio-burbuja--c { width: 44px; height: 44px; right: 4px; top: 50px; border-radius: 15px; background: var(--melocoton); color: var(--melocoton-deep); transform: rotate(10deg); }
.bib-vacio-titulo { font-family: var(--font-display), sans-serif; font-weight: 900; font-size: 22px; letter-spacing: -0.015em; color: var(--ink); }
.bib-vacio-sub { max-width: 44ch; font-size: 14.5px; line-height: 1.6; color: var(--muted); margin-bottom: 8px; }
.bib-mas { display: flex; justify-content: center; padding-top: 40px; }

@media (max-width: 760px) {
  .bib-mast { border-radius: 26px; }
  .bib-barra { flex-direction: column; align-items: stretch; flex-wrap: nowrap; }
  .bib-buscar { flex: none; max-width: none; }
  .bib-filtros { overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none; margin: 0 -16px; padding: 2px 16px 6px; }
  .bib-filtros::-webkit-scrollbar { display: none; }
  .bib-filtros .dsp { flex-shrink: 0; }
  .bib-nav { flex-direction: column; align-items: stretch; }
  .bib-seg { align-self: flex-start; }
  .bib-grilla { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px; }
}
@media (max-width: 480px) {
  .bib-grilla { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) {
  .bib-mast-mancha { animation: none; }
  .bib-card, .bib-card:hover { transform: none; }
}
`;
