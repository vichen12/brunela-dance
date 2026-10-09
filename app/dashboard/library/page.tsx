import Link from "next/link";
import { Pencil, Rocket, Archive, Play, Lock, Search, Plus, Tag, ArrowRight, ArrowUpRight, X } from "lucide-react";
import { Movimiento, Revelar, Aparecer, Grilla, Item, Pildoras, SelectAuto } from "@/components/biblioteca-motion";
import { requireUser, requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { getProgresoDelUsuario } from "@/src/features/studio/progress";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

/** "22 MAYO" */
function fechaCorta(iso: string | null) {
  if (!iso) return null;
  return new Date(iso)
    .toLocaleDateString("es-ES", { day: "numeric", month: "long" })
    .replace(" de ", " ")
    .toUpperCase();
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

// ── Admin inline actions ──────────────────────────────────────────────────────

async function quickPublishToggleAction(formData: FormData) {
  "use server";
  // Una server action es un endpoint POST publico: que el formulario se
  // renderice bajo {isAdmin && ...} no impide que la llamen. Y esta corre con
  // service_role, que saltea RLS -- sin esta linea, cualquier alumna logueada
  // puede despublicar el catalogo.
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = String(formData.get("id") ?? "");
  const current = formData.get("status") as string;
  const next = current === "published" ? "draft" : "published";
  await supabase.from("videos").update({ status: next }).eq("id", id);
  revalidatePath("/dashboard/library");
  revalidatePath("/admin/videos");
}

async function quickDeleteVideoAction(formData: FormData) {
  "use server";
  // Ver quickPublishToggleAction. Esta ademas es destructiva.
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = String(formData.get("id") ?? "");
  await supabase.from("videos").delete().eq("id", id);
  revalidatePath("/dashboard/library");
  revalidatePath("/admin/videos");
  redirect("/dashboard/library" as never);
}

// ── Styles ───────────────────────────────────────────────────────────────────

const TIER_META: Record<string, { bg: string; color: string; label: string }> = {
  none:            { bg: "#f5f5f4", color: "#78716c", label: "Básico" },
  corps_de_ballet: { bg: "var(--pink-wash)", color: "var(--pink-deep)", label: "Corps" },
  solista:         { bg: "var(--pink-soft)", color: "var(--pink-deep)", label: "Solista" },
  principal:       { bg: "#1c1917", color: "var(--pink-wash)", label: "Principal" },
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
  ballet:                        "linear-gradient(145deg, var(--pink-soft) 0%, var(--rose) 100%)",
  tecnica:                       "linear-gradient(145deg, var(--pink-wash) 0%, var(--pink-soft) 100%)",
  dehors:                        "linear-gradient(145deg, var(--pink-wash) 0%, var(--pink) 100%)",
  movilidad:                     "linear-gradient(145deg, var(--pink-soft) 0%, var(--pink-mid) 100%)",
  stretching:                    "linear-gradient(145deg, var(--pink-wash) 0%, var(--rose) 100%)",
  "pies-y-tobillos":             "linear-gradient(145deg, var(--rose) 0%, var(--pink) 100%)",
  equilibrio:                    "linear-gradient(145deg, var(--pink-wash) 0%, var(--pink-mid) 100%)",
  "abdominales-para-bailarines": "linear-gradient(145deg, var(--pink-soft) 0%, var(--pink) 100%)",
  "linea-y-control":             "linear-gradient(145deg, var(--rose) 0%, var(--pink-mid) 100%)",
  giros:                         "linear-gradient(145deg, var(--pink-wash) 0%, var(--pink-soft) 100%)",
  "preparacion-fisica":          "linear-gradient(145deg, var(--pink-soft) 0%, var(--rose) 100%)",

  pilates:    "linear-gradient(145deg, var(--pink-wash) 0%, var(--rose) 100%)",
  pbt:        "linear-gradient(145deg, var(--pink-wash) 0%, var(--pink) 100%)",
  pct:        "linear-gradient(145deg, var(--pink-wash) 0%, var(--pink-mid) 100%)",
  reformer:   "linear-gradient(145deg, var(--pink-wash) 0%, var(--rose) 100%)",
  mat:        "linear-gradient(145deg, var(--pink-wash) 0%, var(--rose) 100%)",
};

function catGradient(slugs: string[]): string {
  for (const s of slugs) if (CAT_GRADIENTS[s]) return CAT_GRADIENTS[s];
  return "linear-gradient(145deg, var(--pink-wash) 0%, var(--pink-line) 100%)";
}

/** Cuantas clases por tanda. Con menos, "Ver más" aparece demasiado seguido. */
const POR_PAGINA = 24;

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

const OPCIONES_PLAN = [
  { key: "",                label: "Todos los planes" },
  { key: "none",            label: "Sin plan" },
  { key: "corps_de_ballet", label: "Corps de ballet" },
  { key: "solista",         label: "Solista" },
  { key: "principal",       label: "Principal" },
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
  const fPlanPedido = uno("plan", OPCIONES_PLAN.map((o) => o.key));
  const fEstado   = uno("estado", OPCIONES_ESTADO.map((o) => o.key));

  // Paginacion acumulativa: "Ver más" trae la pagina siguiente SIN perder las
  // anteriores, que es lo que espera alguien recorriendo un catalogo. Se pide
  // uno de mas para saber si hay siguiente sin una segunda consulta de conteo.
  const pagina = Math.max(0, Math.min(50, Number(params.pagina) || 0));

  const profileData = await getCurrentProfile(user.id);
  const isAdmin = profileData?.is_admin ?? false;

  /**
   * El filtro por PLAN es configuracion de Brunela, no algo de la alumna.
   *
   * A quien no es admin se le ignora aunque lo escriba a mano en la URL
   * (?plan=solista): esconder el desplegable no alcanza si el parametro
   * sigue filtrando. Para la alumna el plan existe solo como candado en las
   * clases que no puede abrir.
   */
  const fPlan = isAdmin ? fPlanPedido : "";
  const hayFiltros = Boolean(fNivel || fDuracion || fPlan || fEstado);
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
    .select("id", { count: "exact", head: true });

  const sinNada =
    !isAdmin &&
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
  // `contains` y no `eq`: desde la migracion 20260921 el acceso vive en la
  // LISTA. Con `eq` sobre el minimo derivado, filtrar por "Solista" descartaba
  // en SQL una clase {corps, solista} -- su minimo es corps -- aunque Solista la
  // vea perfectamente, y el filtro en memoria de mas abajo ya no la recibia.
  if (fPlan) consulta = consulta.contains("planes_permitidos", [fPlan]);

  const [{ data: videosData }, progressData] = await Promise.all([
    consulta
      .order("is_featured", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(POR_PAGINA * (pagina + 1) + 1),
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

  // Se pidio una fila de mas que el tope de la pagina: si volvio, hay
  // siguiente. Evita un `count exact` aparte solo para saber si mostrar el
  // boton -- que seria un viaje mas en cada carga.
  const crudas = (videosData ?? []) as unknown as VideoRecord[];
  const tope = POR_PAGINA * (pagina + 1);
  const hayMasPaginas = !modoTodo && crudas.length > tope;

  const videos = (modoTodo ? vitrina : crudas.slice(0, tope));

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
    const { data } = await supabase.from("videos").select("id");
    for (const v of (data ?? []) as { id: string }[]) accesibles.add(v.id);
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
    // Desde la migracion 20260921 el acceso vive en la LISTA. Comparar contra
    // el minimo derivado dejaria afuera una clase {corps, solista} al filtrar
    // por "Solista", aunque Solista la vea perfectamente.
    if (fPlan && !planesDeLaClase(v).includes(fPlan)) return false;

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
      plan: fPlan,
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

  const borradores = visible.filter((v) => v.status !== "published").length;
  // null fuera de "Explorar todo": ahi no hay nada que aclarar.
  const tuyas = modoTodo && !sinNada ? visible.filter((v) => !bloqueada(v.id)).length : null;
  const filtros = ([
    { name: "nivel",  valor: fNivel,    ops: OPCIONES_NIVEL,    etiqueta: "Nivel" },
    { name: "dur",    valor: fDuracion, ops: OPCIONES_DURACION, etiqueta: "Duración" },
    { name: "plan",   valor: fPlan,     ops: OPCIONES_PLAN,     etiqueta: "Plan" },
    { name: "estado", valor: fEstado,   ops: OPCIONES_ESTADO,   etiqueta: "Estado" },
  ] as const).filter((f) => isAdmin || f.name !== "plan");

  return (
    <main className="pb-20 md:pb-28" style={{ minHeight: "100vh", background: "#fff" }}>
      <style>{CSS_BIBLIOTECA}</style>
      <Movimiento>
      <section className="bib">
        {/* ⚠️ El texto NO promete que ya esten desbloqueadas. Stripe redirige al
            instante y el webhook puede tardar unos segundos: decirle "ya podés
            verlas" y que no aparezcan es peor que avisarle de la demora. */}
        {avisoCompra && (
          <div role="status" className="bib-aviso">{avisoCompra}</div>
        )}

        {/* ── Cabecera ── */}
        <header className="bib-mast">
          <div style={{ minWidth: 0 }}>
            <Aparecer>
              <p className="bib-eyebrow">
                <span className="bib-eyebrow-raya" />
                Biblioteca de clases
              </p>
            </Aparecer>
            <h1 className="bib-titulo">
              {isAdmin ? (
                <>
                  <Revelar retraso={0.05}>Gestión de</Revelar>
                  <Revelar retraso={0.15}><em>clases.</em></Revelar>
                </>
              ) : (
                <Revelar retraso={0.05}>Tus <em>clases.</em></Revelar>
              )}
            </h1>
            <Aparecer retraso={0.3}>
              <p className="bib-lede">
                {isAdmin
                  ? "Publicá, editá y organizá todas las clases del estudio. Como admin ves también los borradores."
                  : "Todo el contenido disponible según tu plan, para que sigas creciendo cada día."}
              </p>
            </Aparecer>
          </div>

          {isAdmin && (
            <Aparecer retraso={0.4} className="bib-mast-acciones">
              <Link href="/admin/videos" className="bib-btn bib-btn--lleno">
                <Plus size={16} strokeWidth={2.2} /> Nueva clase
              </Link>
              <Link href="/admin/categories" className="bib-btn">
                <Tag size={15} strokeWidth={2} /> Categorías
              </Link>
              <Link href="/admin/videos" className="bib-btn bib-btn--texto">
                Panel de clases <ArrowUpRight size={15} strokeWidth={2.2} />
              </Link>
            </Aparecer>
          )}
        </header>

        {/* ── Buscar y filtrar ── */}
        <Aparecer retraso={0.35} className="bib-barra">
          {/* Buscador: formulario GET, sin JavaScript. Conserva categoria, filtros y vista. */}
          <form method="get" action="/dashboard/library" className="bib-buscar" role="search">
            {activeCategory !== "all" && <input type="hidden" name="category" value={activeCategory} />}
            {fNivel && <input type="hidden" name="nivel" value={fNivel} />}
            {fDuracion && <input type="hidden" name="dur" value={fDuracion} />}
            {fPlan && <input type="hidden" name="plan" value={fPlan} />}
            {fEstado && <input type="hidden" name="estado" value={fEstado} />}
            {modoTodo && !sinNada && <input type="hidden" name="ver" value="todo" />}
            <Search size={18} strokeWidth={1.8} className="bib-buscar-ico" aria-hidden="true" />
            <input
              type="search"
              name="q"
              defaultValue={busqueda}
              placeholder="Buscar por título, categoría o descripción"
              aria-label="Buscar clases"
            />
            <button type="submit" className="bib-buscar-btn" aria-label="Buscar">
              <ArrowRight size={16} strokeWidth={2} />
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
              <Link href={enlace({ nivel: null, dur: null, plan: null, estado: null }) as never} className="bib-quitar">
                <X size={13} strokeWidth={2.2} /> Quitar filtros
              </Link>
            )}
          </form>
        </Aparecer>

        {/* ── Vista y categorias ──
            El conmutador va solo para quien tiene algo: quien no tiene nada ya
            esta viendo el catalogo completo, y "Explorar todo" no haria nada.
            Es un segmento y no una pildora mas porque no acota: cambia QUE
            conjunto se mira. */}
        <Aparecer retraso={0.45} className="bib-nav">
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
            {isAdmin && borradores > 0 ? ` · ${borradores} ${borradores === 1 ? "borrador" : "borradores"}` : ""}
          </span>
        </div>

        {/* ── Grilla ── */}
        {visible.length === 0 ? (
          <div className="bib-vacio">
            <p className="bib-vacio-titulo">
              {isAdmin && !busqueda && !hayFiltros
                ? "Todavía no hay clases."
                : busqueda
                  ? `No encontramos clases para “${busqueda}”.`
                  : "No hay clases para este filtro."}
            </p>
            {isAdmin
              ? <Link href="/admin/videos" className="bib-btn bib-btn--lleno"><Plus size={16} strokeWidth={2.2} /> Subir una clase</Link>
              : hayFiltros || busqueda
                ? <Link href="/dashboard/library" className="bib-btn">Ver todas las clases</Link>
                : null}
          </div>
        ) : (
          <Grilla className="bib-grilla">
            {visible.map((video) => {
              const pct = safePercent(progressMap.get(video.id)?.completion_percent);
              const title = resolveI18nText(video.title_i18n);
              const isDraft = video.status !== "published";
              // Las miniaturas viven detras de la misma pull zone con token que
              // el video, asi que tambien se firman por request.
              const bunnyId = video.bunny_video_id ?? bunnyVideoIdFromUrl(video.stream_playback_id);
              const thumbSrc =
                bunnyId && hasBunnyStreamEnv() ? bunnySignedUrls(bunnyId).thumbnail : video.thumbnail_url;
              const categoria = CATEGORIA_LABEL[video.category_slugs[0]] ?? video.category_slugs[0] ?? "Clase";
              const fecha = fechaCorta(video.published_at);

              return (
                <Item key={video.id} className="bib-item">
                  <article className={"bib-card" + (isDraft && !isAdmin ? " es-apagada" : "")}>
                    {/* ⚠️ EL CANDADO ES POR CLASE, NO POR ALUMNA.
                        Lo decide `bloqueada()`, que sale de RLS: la misma regla
                        que usa el reproductor. Quien compro un pack sigue en
                        'none' y aun asi tiene que poder abrir su clase. */}
                    <Link
                      href={(bloqueada(video.id) ? "/dashboard/plan" : `/dashboard/library/${video.slug}`) as never}
                      className="bib-card-link"
                    >
                      <div className="bib-img" style={thumbSrc ? undefined : { background: catGradient(video.category_slugs) }}>
                        {thumbSrc && <img src={thumbSrc} alt="" loading="lazy" />}
                        {thumbSrc && <span className="bib-img-sombra" aria-hidden="true" />}
                        <span className="bib-chips">
                          {isDraft && isAdmin && <span className="bib-chip bib-chip--borrador">Borrador</span>}
                          {video.is_featured && <span className="bib-chip bib-chip--dest">Destacada</span>}
                        </span>
                        {bloqueada(video.id) && (
                          <span className="bib-candado">
                            <Lock size={11} strokeWidth={2.2} aria-hidden="true" />
                            {TIER_META[planQueDesbloquea(video, planDeLaAlumna)]?.label ?? "Plan"}
                          </span>
                        )}
                        <span className="bib-play" aria-hidden="true">
                          {bloqueada(video.id) ? <Lock size={18} strokeWidth={2} /> : <Play size={18} strokeWidth={2} fill="currentColor" />}
                        </span>
                        <span className="bib-dur">{mmss(video.duration_seconds)}</span>
                        {pct > 0 && (
                          <span className="bib-prog" aria-label={`${pct}% visto`}>
                            <span style={{ width: `${pct}%` }} />
                          </span>
                        )}
                      </div>
                      <div className="bib-info">
                        <p className="bib-cat">
                          {categoria}
                          {fecha ? <span className="bib-fecha"> · {fecha}</span> : null}
                        </p>
                        <h3 className="bib-card-titulo">{title}</h3>
                        <p className="bib-meta">
                          {nivelTexto(video.recommended_min_level, video.recommended_max_level)}
                          {pct > 0 ? <span className="bib-meta-pct"> · {pct >= 90 ? "Completada" : `${pct}% visto`}</span> : null}
                        </p>
                      </div>
                    </Link>

                    {/* Acciones de admin. Son server actions con requireAdmin():
                        esconderlas no protege nada, la guarda esta en la accion. */}
                    {isAdmin && (
                      <div className="bib-admin">
                        <Link
                          href={`/admin/videos?q=${encodeURIComponent(title)}` as never}
                          title="Editar en el panel"
                          aria-label={`Editar ${title}`}
                          className="bib-admin-btn"
                        >
                          <Pencil size={14} strokeWidth={2} />
                          <span>Editar</span>
                        </Link>
                        <form action={quickPublishToggleAction}>
                          <input type="hidden" name="id" value={video.id} />
                          <input type="hidden" name="status" value={video.status} />
                          <button
                            type="submit"
                            title={isDraft ? "Publicar" : "Volver a borrador"}
                            aria-label={isDraft ? `Publicar ${title}` : `Pasar ${title} a borrador`}
                            className={"bib-admin-btn" + (isDraft ? " es-publicar" : "")}
                          >
                            {isDraft ? <Rocket size={14} strokeWidth={2} /> : <Archive size={14} strokeWidth={2} />}
                            <span>{isDraft ? "Publicar" : "Despublicar"}</span>
                          </button>
                        </form>
                      </div>
                    )}
                  </article>
                </Item>
              );
            })}

            {isAdmin && (
              <Item className="bib-item">
                <Link href="/admin/videos" className="bib-nueva">
                  <span className="bib-nueva-ico"><Plus size={22} strokeWidth={1.8} /></span>
                  <span className="bib-nueva-titulo">Nueva clase</span>
                  <span className="bib-nueva-sub">Subir un video al catálogo</span>
                </Link>
              </Item>
            )}
          </Grilla>
        )}

        {/* Fase D: "Ver más" en vez de traer el catalogo entero de una. Es
            acumulativo: la pagina siguiente se suma, no reemplaza. */}
        {hayMasPaginas && (
          <div className="bib-mas">
            <Link href={enlace({ pagina: String(pagina + 1) }) as never} className="bib-btn">
              Ver más clases <ArrowRight size={15} strokeWidth={2} />
            </Link>
          </div>
        )}
      </section>
      </Movimiento>
    </main>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────
// Misma direccion que el panel del estudio: titular en Bodoni, filetes finos en
// vez de cajas, coral de la landing y nada negro de fondo.

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
  border-radius: 16px; padding: 13px 18px; margin-bottom: 20px; font-size: 13.5px; line-height: 1.55;
  background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0;
}

/* cabecera */
.bib-mast {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; flex-wrap: wrap;
  padding-bottom: clamp(22px, 3vw, 32px);
}
.bib-eyebrow {
  display: flex; align-items: center; gap: 12px; margin-bottom: 18px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--pink-deep);
}
.bib-eyebrow-raya { display: inline-block; width: 36px; height: 1.5px; background: var(--pink); }
.bib-titulo {
  font-family: var(--font-display), sans-serif; font-weight: 800;
  font-size: clamp(38px, 5vw, 72px); line-height: 1; letter-spacing: -0.04em; color: var(--ink);
}
.bib-titulo em { font-style: normal; color: var(--pink-mid); }
.bib-lede { margin-top: 18px; max-width: 54ch; font-size: 15px; line-height: 1.7; color: #57534e; }
.bib-mast-acciones { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; padding-bottom: 8px; }

.bib-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; white-space: nowrap;
  height: 44px; padding: 0 20px; border-radius: 99px; text-decoration: none; cursor: pointer;
  font: inherit; font-size: 13px; font-weight: 700; letter-spacing: 0.02em;
  color: var(--ink); border: 1.5px solid #d6d3d1; background: #fff;
  transition: border-color .2s, background .2s, color .2s, transform .2s, box-shadow .2s;
}
.bib-btn:hover { border-color: var(--ink); transform: translateY(-1px); }
.bib-btn--lleno { background: var(--pink); border-color: var(--pink); color: #fff; box-shadow: 0 8px 22px -10px rgba(230,79,85,0.7); }
.bib-btn--lleno:hover { background: var(--pink-mid); border-color: var(--pink-mid); }
.bib-btn--texto { border-color: transparent; background: transparent; color: var(--pink-deep); padding: 0 8px; }
.bib-btn--texto:hover { border-color: transparent; color: var(--ink); }

/* buscar y filtrar */
.bib-barra {
  display: flex; align-items: center; justify-content: space-between; gap: 16px 28px; flex-wrap: wrap;
  border-top: 1px solid var(--ink); border-bottom: 1px solid #e7e5e4; padding: 14px 0;
}
.bib-buscar { position: relative; flex: 1 1 320px; max-width: 520px; display: flex; align-items: center; }
.bib-buscar-ico { position: absolute; left: 2px; color: #a8a29e; pointer-events: none; }
.bib-buscar input {
  width: 100%; height: 46px; padding: 0 44px 0 32px; border: 0; background: transparent;
  font: inherit; font-size: 15px; color: var(--ink); outline: none;
}
.bib-buscar input::placeholder { color: #a8a29e; }
.bib-buscar:focus-within .bib-buscar-ico { color: var(--pink); }
.bib-buscar-btn {
  position: absolute; right: 0; width: 36px; height: 36px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
  border: 0; background: var(--pink-wash); color: var(--pink-deep); transition: background .2s, color .2s;
}
.bib-buscar-btn:hover { background: var(--pink); color: #fff; }

.bib-filtros { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.bib-quitar {
  display: inline-flex; align-items: center; gap: 5px; height: 40px; padding: 0 10px;
  font-size: 12px; font-weight: 700; color: var(--pink-deep); text-decoration: none;
}
.bib-quitar:hover { color: var(--ink); }

/* vista y categorias */
.bib-nav { display: flex; align-items: center; gap: 14px 20px; flex-wrap: wrap; padding: 20px 0 6px; }
.bib-seg {
  display: inline-flex; padding: 4px; border-radius: 99px; background: #f5f5f4; flex-shrink: 0;
}
.bib-seg-op {
  position: relative; padding: 9px 18px; border-radius: 99px; text-decoration: none;
  font-size: 13px; font-weight: 700; color: #78716c; transition: color .2s;
}
.bib-seg-op:hover { color: var(--ink); }
.bib-seg-op.es-activa { color: var(--ink); }
.bib-seg-fondo {
  position: absolute; inset: 0; border-radius: 99px; background: #fff;
  box-shadow: 0 1px 2px rgba(28,25,23,0.08), 0 4px 12px -4px rgba(28,25,23,0.12);
}
.bib-pildoras {
  display: flex; gap: 6px; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none;
  padding: 2px 0; -webkit-mask-image: linear-gradient(to right, #000 92%, transparent);
  mask-image: linear-gradient(to right, #000 92%, transparent);
}
.bib-pildoras::-webkit-scrollbar { display: none; }
.bib-pildora {
  position: relative; flex-shrink: 0; padding: 8px 16px; border-radius: 99px; text-decoration: none;
  font-size: 12.5px; font-weight: 600; color: #57534e; border: 1px solid #e7e5e4; transition: border-color .2s, color .2s;
}
.bib-pildora:hover { border-color: var(--pink-line); color: var(--pink-deep); }
.bib-pildora.es-activa { color: #fff; border-color: transparent; }
.bib-pildora-fondo { position: absolute; inset: -1px; border-radius: 99px; background: var(--pink); }
.bib-pildora-txt { position: relative; }

.bib-contador {
  display: flex; align-items: baseline; gap: 10px; padding: 18px 0 22px;
  font-size: 13px; color: #78716c;
}
.bib-contador-num { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 28px; line-height: 1; letter-spacing: -0.03em; color: var(--ink); }

/* grilla */
.bib-grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 34px 22px; }
.bib-item { min-width: 0; }
.bib-card { position: relative; height: 100%; }
.bib-card.es-apagada { opacity: 0.5; }
.bib-card-link { display: block; text-decoration: none; color: inherit; }
.bib-img {
  position: relative; aspect-ratio: 16 / 11; border-radius: 18px; overflow: hidden; isolation: isolate;
  background: var(--pink-wash);
  transition: box-shadow .4s, transform .4s cubic-bezier(.16,1,.3,1);
}
.bib-img img {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
  transition: transform .9s cubic-bezier(.16,1,.3,1);
}
.bib-card-link:hover .bib-img { transform: translateY(-4px); box-shadow: 0 22px 40px -22px rgba(176,58,62,0.55); }
.bib-card-link:hover .bib-img img { transform: scale(1.06); }
.bib-img-sombra {
  position: absolute; inset: 0; z-index: 1;
  background: linear-gradient(to top, rgba(28,25,23,0.45) 0%, rgba(28,25,23,0) 45%);
}
.bib-chips { position: absolute; top: 12px; left: 12px; z-index: 2; display: flex; gap: 6px; }
.bib-chip {
  font-size: 9.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
  padding: 5px 10px; border-radius: 99px; backdrop-filter: blur(8px);
}
.bib-chip--borrador { background: rgba(255,255,255,0.92); color: var(--pink-deep); }
.bib-chip--dest { background: var(--pink); color: #fff; }
.bib-candado {
  position: absolute; top: 12px; right: 12px; z-index: 2;
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border-radius: 99px;
  background: rgba(255,255,255,0.94); color: var(--pink-deep);
  font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
}
.bib-play {
  position: absolute; z-index: 2; left: 50%; top: 50%; width: 54px; height: 54px; margin: -27px 0 0 -27px;
  display: flex; align-items: center; justify-content: center; border-radius: 50%;
  background: rgba(255,255,255,0.94); color: var(--pink-mid);
  opacity: 0; transform: scale(0.7); transition: opacity .3s, transform .4s cubic-bezier(.16,1,.3,1);
}
.bib-card-link:hover .bib-play { opacity: 1; transform: scale(1); }
.bib-dur {
  position: absolute; z-index: 2; right: 12px; bottom: 12px;
  font-size: 11.5px; font-weight: 700; color: #fff; font-variant-numeric: tabular-nums;
  padding: 3px 9px; border-radius: 8px; background: rgba(28,25,23,0.45); backdrop-filter: blur(6px);
}
.bib-prog { position: absolute; z-index: 2; left: 0; right: 0; bottom: 0; height: 4px; background: rgba(255,255,255,0.35); }
.bib-prog span { display: block; height: 100%; background: var(--pink); }

.bib-info { padding: 14px 2px 0; }
.bib-cat { font-size: 10.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--pink-deep); }
.bib-fecha { color: #a8a29e; }
.bib-card-titulo {
  margin-top: 6px; font-family: var(--font-display), sans-serif; font-weight: 700;
  font-size: 17px; line-height: 1.25; letter-spacing: -0.015em; color: var(--ink);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.bib-card-link:hover .bib-card-titulo { color: var(--pink-deep); }
.bib-meta { margin-top: 6px; font-size: 12.5px; color: #78716c; }
.bib-meta-pct { color: var(--pink-deep); font-weight: 600; }

.bib-admin { display: flex; gap: 6px; margin-top: 12px; }
.bib-admin form { display: contents; }
.bib-admin-btn {
  display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; border-radius: 10px;
  border: 1px solid #e7e5e4; background: #fff; color: #57534e; cursor: pointer; text-decoration: none;
  font: inherit; font-size: 11.5px; font-weight: 700; transition: border-color .2s, background .2s, color .2s;
}
.bib-admin-btn:hover { border-color: var(--pink-line); background: var(--pink-wash); color: var(--pink-deep); }
.bib-admin-btn.es-publicar { border-color: var(--pink); background: var(--pink); color: #fff; }
.bib-admin-btn.es-publicar:hover { background: var(--pink-mid); border-color: var(--pink-mid); color: #fff; }

.bib-nueva {
  height: 100%; min-height: 240px; aspect-ratio: auto; border-radius: 18px; border: 1.5px dashed #d6d3d1;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  text-decoration: none; color: #78716c; transition: border-color .25s, background .25s, color .25s;
}
.bib-nueva:hover { border-color: var(--pink); background: var(--pink-wash); color: var(--pink-deep); }
.bib-nueva-ico {
  width: 52px; height: 52px; border-radius: 50%; border: 1.5px solid currentColor; margin-bottom: 6px;
  display: inline-flex; align-items: center; justify-content: center; transition: transform .5s cubic-bezier(.16,1,.3,1);
}
.bib-nueva:hover .bib-nueva-ico { transform: rotate(90deg); }
.bib-nueva-titulo { font-family: var(--font-display), sans-serif; font-weight: 700; font-size: 17px; letter-spacing: -0.015em; color: var(--ink); }
.bib-nueva-sub { font-size: 12px; }

.bib-vacio {
  display: flex; flex-direction: column; align-items: center; gap: 18px; text-align: center;
  padding: 56px 24px; border-radius: 22px; border: 1.5px dashed #e7e5e4;
}
.bib-vacio-titulo { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 24px; letter-spacing: -0.025em; color: var(--ink); }
.bib-mas { display: flex; justify-content: center; padding-top: 40px; }

@media (max-width: 760px) {
  .bib-barra { flex-direction: column; align-items: stretch; }
  .bib-buscar { flex: none; max-width: none; }
  .bib-filtros { overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none; }
  .bib-filtros::-webkit-scrollbar { display: none; }
  .bib-filtros .dsp { flex-shrink: 0; }
  .bib-nav { flex-direction: column; align-items: stretch; }
  .bib-seg { align-self: flex-start; }
  .bib-grilla { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 28px 16px; }
}
@media (max-width: 480px) {
  .bib-mast-acciones { width: 100%; }
  .bib-mast-acciones .bib-btn:not(.bib-btn--texto) { flex: 1; }
  .bib-grilla { grid-template-columns: minmax(0, 1fr); }
}
`;
