import Link from "next/link";
import { Pencil, Rocket, Archive, Clapperboard } from "lucide-react";
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

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type VideoRecord = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  membership_tier_required: MembershipTier;
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

const NIVEL_LABEL: Record<string, string> = {
  principiante: "Principiante",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
  profesional: "Profesional",
  maestro: "Maestro",
};

/** Un solo texto de nivel, como en el diseno: "Intermedio" o "Todos los niveles". */
function nivelTexto(min: string | null, max: string | null) {
  if (!min || !max) return "Todos los niveles";
  if (min === "principiante" && max === "maestro") return "Todos los niveles";
  if (min === max) return NIVEL_LABEL[min] ?? min;
  return `${NIVEL_LABEL[min] ?? min} a ${NIVEL_LABEL[max] ?? max}`;
}

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

const CAT_GRADIENTS: Record<string, string> = {
  ballet:     "linear-gradient(145deg, var(--pink-soft) 0%, var(--rose) 100%)",
  pilates:    "linear-gradient(145deg, var(--pink-wash) 0%, var(--rose) 100%)",
  stretching: "linear-gradient(145deg, var(--pink-wash) 0%, var(--rose) 100%)",
  pbt:        "linear-gradient(145deg, var(--pink-wash) 0%, var(--pink) 100%)",
  pct:        "linear-gradient(145deg, var(--pink-wash) 0%, var(--pink-mid) 100%)",

  // Se dejan mapeadas para que una clase que todavia tenga el slug viejo no
  // pierda su degrade y caiga en el gris de reserva. Desaparecen solas cuando
  // se corra 20260803_unify_pilates_categories.sql; antes de eso, la pantalla
  // no se rompe.
  reformer:   "linear-gradient(145deg, var(--pink-wash) 0%, var(--rose) 100%)",
  mat:        "linear-gradient(145deg, var(--pink-wash) 0%, var(--rose) 100%)",
};

function catGradient(slugs: string[]): string {
  for (const s of slugs) if (CAT_GRADIENTS[s]) return CAT_GRADIENTS[s];
  return "linear-gradient(145deg, var(--pink-wash) 0%, var(--pink-line) 100%)";
}

const FIXED_FILTERS = [
  { key: "all",        label: "Todas"      },
  { key: "ballet",     label: "Ballet"     },
  { key: "pilates",    label: "Pilates"    },
  { key: "stretching", label: "Stretching" },
  { key: "pbt",        label: "PBT"        },
  { key: "pct",        label: "PCT"        },
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

// ── Los cuatro filtros ───────────────────────────────────────────────────────
// Todos salen de datos que ya existen: ninguno necesita capturar nada nuevo.

const NIVELES = ["principiante", "intermedio", "avanzado", "profesional", "maestro"] as const;
const NIVEL_ORDEN = new Map(NIVELES.map((n, i) => [n as string, i]));

const OPCIONES_NIVEL = [
  { key: "",              label: "Todos los niveles" },
  { key: "principiante",  label: "Principiante" },
  { key: "intermedio",    label: "Intermedio" },
  { key: "avanzado",      label: "Avanzado" },
  { key: "profesional",   label: "Profesional" },
  { key: "maestro",       label: "Maestro" },
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
function coincideNivel(min: string | null, max: string | null, nivel: string): boolean {
  if (!nivel) return true;
  const buscado = NIVEL_ORDEN.get(nivel);
  if (buscado === undefined) return true;
  const desde = min ? NIVEL_ORDEN.get(min) ?? 0 : 0;
  const hasta = max ? NIVEL_ORDEN.get(max) ?? NIVELES.length - 1 : NIVELES.length - 1;
  return buscado >= desde && buscado <= hasta;
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
  const fPlan     = uno("plan",   OPCIONES_PLAN.map((o) => o.key));
  const fEstado   = uno("estado", OPCIONES_ESTADO.map((o) => o.key));
  const hayFiltros = Boolean(fNivel || fDuracion || fPlan || fEstado);

  const profileData = await getCurrentProfile(user.id);
  const isAdmin = profileData?.is_admin ?? false;
  // Sin plan: RLS le devuelve CERO clases, asi que veria el estudio vacio y
  // pareceria roto. Se le muestra el catalogo con candado -- ver `vitrina`.
  const sinPlan = !isAdmin && (profileData?.membership_tier ?? "none") === "none";

  const [{ data: videosData }, progressData] = await Promise.all([
    supabase.from("videos")
      .select("id, slug, title_i18n, description_i18n, membership_tier_required, duration_seconds, category_slugs, thumbnail_url, stream_playback_id, bunny_video_id, is_featured, status, published_at, recommended_min_level, recommended_max_level")
      .order("is_featured", { ascending: false })
      .order("published_at", { ascending: false }),
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
  if (sinPlan) {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("videos")
      .select("id, slug, title_i18n, description_i18n, membership_tier_required, duration_seconds, category_slugs, thumbnail_url, is_featured, status, published_at, recommended_min_level, recommended_max_level")
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

  const videos = (sinPlan ? vitrina : ((videosData ?? []) as VideoRecord[]));
  const progressMap = new Map(progressData.map((p) => [p.video_id, p]));

  const dbCats = Array.from(new Set(videos.flatMap((v) => v.category_slugs).filter(Boolean))).sort();
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
          [resolveI18nText(v.title_i18n), resolveI18nText(v.description_i18n), ...v.category_slugs].join(" ")
        ).includes(termino)
      )
    : porCategoria;

  // Los cuatro filtros, al final de la cadena. El estado personal se resuelve
  // con el progreso que ya vino memoizado del layout: no agrega ningun viaje.
  const visible = porTexto.filter((v) => {
    if (!coincideNivel(v.recommended_min_level, v.recommended_max_level, fNivel)) return false;
    if (!coincideDuracion(v.duration_seconds, fDuracion)) return false;
    if (fPlan && v.membership_tier_required !== fPlan) return false;

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

  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">

        {/* Header */}
        <header className="hero-stage" style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
            <div style={{ minWidth: 280, flex: 1 }}>
              <p className="eyebrow">Biblioteca de clases</p>
              <h1 className="display mt-5 text-5xl leading-none md:text-7xl">
                {isAdmin ? (
                  <>Gestión de <span style={{ color: "var(--pink)", fontStyle: "italic" }}>clases.</span></>
                ) : (
                  <>Tus <span style={{ color: "var(--pink)", fontStyle: "italic" }}>clases.</span></>
                )}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-[color:var(--ink-soft)]">
                {isAdmin
                  ? "Publicá, editá y organizá todas las clases del estudio."
                  : "Todo el contenido disponible según tu plan, para que sigas creciendo cada día."}
              </p>
            </div>

            {/* Buscador: formulario GET, sin JavaScript. Conserva la categoria activa. */}
            <form method="get" action="/dashboard/library" style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
              {activeCategory !== "all" && <input type="hidden" name="category" value={activeCategory} />}
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", display: "flex" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  type="search"
                  name="q"
                  defaultValue={busqueda}
                  placeholder="Buscar clases, categorías, etc."
                  aria-label="Buscar clases"
                  style={{
                    width: 300, maxWidth: "100%", padding: "13px 18px 13px 44px",
                    borderRadius: 999, border: "1px solid #F1E9E7", background: "#fff",
                    fontSize: 13, color: "var(--ink)", outline: "none", fontFamily: "inherit",
                  }}
                />
              </div>
              <button type="submit" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "13px 22px", borderRadius: 999, cursor: "pointer",
                background: "var(--pink-wash)", color: "var(--pink)",
                border: "none", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
              }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4.5h12M4.5 8h7M6.5 11.5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Buscar
              </button>
            </form>
          </div>

          {/* Los cuatro filtros. Van DENTRO de un form GET propio y con
              autoSubmit por onChange deshabilitado a proposito: sin JavaScript
              igual funcionan con el boton, y con el teclado se recorren en
              orden. Conservan la busqueda y la categoria activa. */}
          <form
            method="get"
            action="/dashboard/library"
            style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap", alignItems: "center" }}
          >
            {activeCategory !== "all" && <input type="hidden" name="category" value={activeCategory} />}
            {busqueda && <input type="hidden" name="q" value={busqueda} />}

            {([
              { name: "nivel",  valor: fNivel,    ops: OPCIONES_NIVEL,    etiqueta: "Nivel" },
              { name: "dur",    valor: fDuracion, ops: OPCIONES_DURACION, etiqueta: "Duración" },
              { name: "plan",   valor: fPlan,     ops: OPCIONES_PLAN,     etiqueta: "Plan" },
              { name: "estado", valor: fEstado,   ops: OPCIONES_ESTADO,   etiqueta: "Estado" },
            ] as const).map((f) => (
              <select
                key={f.name}
                name={f.name}
                defaultValue={f.valor}
                aria-label={f.etiqueta}
                style={{
                  minHeight: 40, padding: "9px 14px", borderRadius: 999,
                  border: `1px solid ${f.valor ? "var(--pink)" : "#F1E9E7"}`,
                  background: f.valor ? "var(--pink-wash)" : "#fff",
                  color: f.valor ? "var(--pink-deep)" : "var(--muted)",
                  fontSize: 12.5, fontWeight: f.valor ? 700 : 500,
                  fontFamily: "inherit", cursor: "pointer", outline: "none",
                }}
              >
                {f.ops.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            ))}

            <button type="submit" style={{
              minHeight: 40, padding: "9px 18px", borderRadius: 999, cursor: "pointer",
              background: "var(--pink)", color: "#fff", border: "none",
              fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
            }}>
              Aplicar
            </button>

            {hayFiltros && (
              <a
                href={`/dashboard/library${
                  activeCategory !== "all" || busqueda
                    ? `?${[
                        activeCategory !== "all" ? `category=${encodeURIComponent(activeCategory)}` : "",
                        busqueda ? `q=${encodeURIComponent(busqueda)}` : "",
                      ].filter(Boolean).join("&")}`
                    : ""
                }` as never}
                style={{
                  minHeight: 40, display: "inline-flex", alignItems: "center",
                  padding: "9px 16px", borderRadius: 999, textDecoration: "none",
                  color: "var(--pink-deep)", fontSize: 12.5, fontWeight: 700,
                }}
              >
                Quitar filtros
              </a>
            )}
          </form>
          {isAdmin && (
            <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              <a
                href="/admin/videos"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 20px", borderRadius: 99,
                  background: "var(--pink)", color: "#fff",
                  fontSize: 12, fontWeight: 700, textDecoration: "none",
                  boxShadow: "0 4px 14px rgba(230, 79, 85,0.35)",
                }}
              >
                <span style={{ fontSize: 15 }}>+</span> Nueva clase
              </a>
              <a
                href="/admin/categories"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 20px", borderRadius: 99,
                  background: "var(--pink-wash)", color: "var(--pink)",
                  border: "1.5px solid var(--pink-soft)",
                  fontSize: 12, fontWeight: 700, textDecoration: "none",
                }}
              >
                Categorías
              </a>
            </div>
          )}
        </header>

        {/* Admin bar — visible to admin only */}
        {isAdmin && (
          <div style={{
            borderRadius: 18, padding: "14px 20px",
            background: "linear-gradient(135deg, #1c1917, #292524)",
            border: "1px solid #44403c",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Clapperboard size={16} strokeWidth={1.9} />
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--pink-wash)" }}>Modo administración</p>
                <p style={{ fontSize: 10, color: "#a8a29e", marginTop: 1 }}>Ves todas las clases incluidas borradores. Los botones de edición aparecen en cada tarjeta.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <a href="/admin/videos" style={{
                padding: "6px 14px", borderRadius: 99, fontSize: 10, fontWeight: 700,
                background: "var(--pink)", color: "#fff", textDecoration: "none",
              }}>Panel completo</a>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {filters.map((f) => (
            <Link
              key={f.key}
              // Conserva la busqueda Y los cuatro filtros. Antes solo llevaba
              // `q`: cambiar de categoria con un filtro puesto lo borraba en
              // silencio y la lista cambiaba por dos motivos a la vez.
              href={
                (() => {
                  const qs = [
                    f.key !== "all" ? `category=${encodeURIComponent(f.key)}` : "",
                    busqueda ? `q=${encodeURIComponent(busqueda)}` : "",
                    fNivel ? `nivel=${fNivel}` : "",
                    fDuracion ? `dur=${fDuracion}` : "",
                    fPlan ? `plan=${fPlan}` : "",
                    fEstado ? `estado=${fEstado}` : "",
                  ].filter(Boolean).join("&");
                  return `/dashboard/library${qs ? `?${qs}` : ""}`;
                })() as never
              }
              style={{
                padding: "7px 18px", textDecoration: "none", borderRadius: 99,
                fontSize: 12, fontWeight: 700, letterSpacing: "0.02em",
                background: activeCategory === f.key ? "var(--pink)" : "#fff",
                color: activeCategory === f.key ? "#fff" : "var(--pink)",
                border: activeCategory === f.key ? "none" : "1px solid var(--pink-wash)",
              }}
            >{f.label}</Link>
          ))}
        </div>

        {/* Count */}
        <p className="eyebrow">
          {visible.length} {visible.length === 1 ? "clase" : "clases"}
          {busqueda ? ` para “${busqueda}”` : ""}
          {isAdmin ? ` (${visible.filter(v => v.status !== "published").length} borradores)` : ""}
        </p>

        {/* Grid */}
        {visible.length === 0 ? (
          <div style={{
            border: "1.5px dashed var(--pink-line)", borderRadius: 20, padding: "40px 24px",
            fontSize: 13, color: "var(--muted)", textAlign: "center",
          }}>
            {isAdmin
              ? <>No hay clases todavía. <a href="/admin/videos" style={{ color: "var(--pink)", fontWeight: 700 }}>Subí la primera.</a></>
              : busqueda
                ? `No encontramos clases para “${busqueda}”.`
                : "No hay clases para este filtro todavía."
            }
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(232px, 1fr))", gap: 16 }}>
            {visible.map((video) => {
              const pct = safePercent(progressMap.get(video.id)?.completion_percent);
              const title = resolveI18nText(video.title_i18n);
              const desc = resolveI18nText(video.description_i18n);
              const tier = TIER_META[video.membership_tier_required] ?? TIER_META.none;
              const isDraft = video.status !== "published";
              // Thumbnails live behind the same token-protected pull zone as the
              // video, so they have to be signed per request too.
              const bunnyId = video.bunny_video_id ?? bunnyVideoIdFromUrl(video.stream_playback_id);
              const thumbSrc =
                bunnyId && hasBunnyStreamEnv() ? bunnySignedUrls(bunnyId).thumbnail : video.thumbnail_url;

              return (
                <div key={video.id} style={{ position: "relative" }}>
                  {/* Draft overlay badge */}
                  {isDraft && isAdmin && (
                    <div style={{
                      position: "absolute", top: 10, left: 10, zIndex: 10,
                      fontSize: 8, fontWeight: 700, letterSpacing: "0.12em",
                      background: "#fef9c3", color: "#854d0e",
                      padding: "3px 8px", borderRadius: 99, textTransform: "uppercase",
                    }}>BORRADOR</div>
                  )}

                  {/* Admin action buttons */}
                  {isAdmin && (
                    <div style={{
                      position: "absolute", top: 10, right: 10, zIndex: 10,
                      display: "flex", gap: 5,
                    }}>
                      <a
                        href={`/admin/videos`}
                        title="Editar en panel"
                        style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: "rgba(255,255,255,0.92)", backdropFilter: "blur(4px)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, textDecoration: "none",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                          border: "1px solid rgba(0,0,0,0.06)",
                        }}
                      ><Pencil size={13} strokeWidth={2} /></a>
                      <form action={quickPublishToggleAction} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={video.id}/>
                        <input type="hidden" name="status" value={video.status}/>
                        <button
                          type="submit"
                          title={isDraft ? "Publicar" : "Volver a borrador"}
                          style={{
                            width: 28, height: 28, borderRadius: 8, cursor: "pointer",
                            background: isDraft ? "rgba(230, 79, 85,0.9)" : "rgba(255,255,255,0.92)",
                            backdropFilter: "blur(4px)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, border: "1px solid rgba(0,0,0,0.06)",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                          }}
                        >{isDraft ? <Rocket size={13} strokeWidth={2} /> : <Archive size={13} strokeWidth={2} />}</button>
                      </form>
                    </div>
                  )}

                  {/* Sin plan la tarjeta NO enlaza al detalle: lleva a elegir
                      plan. El detalle es donde se firma la URL del video. */}
                  <Link
                    href={(sinPlan ? "/dashboard/plan" : `/dashboard/library/${video.slug}`) as never}
                    style={{ textDecoration: "none", display: "block", height: "100%", position: "relative" }}
                  >
                    {sinPlan && (
                      <span style={{
                        position: "absolute", top: 12, right: 12, zIndex: 3,
                        display: "inline-flex", alignItems: "center", gap: 6,
                        background: "rgba(255,255,255,0.94)", color: "var(--pink-deep)",
                        borderRadius: 999, padding: "6px 12px",
                        fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
                        textTransform: "uppercase", border: "1px solid var(--pink-line)",
                        boxShadow: "0 4px 14px rgba(28,25,23,0.12)",
                      }}>
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
                          <path d="M4.5 7V5a3.5 3.5 0 1 1 7 0v2M3.5 7h9v6h-9V7Z"
                            stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                        </svg>
                        {TIER_META[video.membership_tier_required]?.label ?? "Plan"}
                      </span>
                    )}
                    <div className="feature-tile" style={{
                      padding: 0, overflow: "hidden", height: "100%", display: "flex", flexDirection: "column",
                      opacity: isDraft && !isAdmin ? 0.5 : 1,
                    }}>
                      {/* Thumbnail */}
                      <div style={{ position: "relative", height: 166, flexShrink: 0 }}>
                        {thumbSrc ? (
                          <img src={thumbSrc} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
                        ) : (
                          <div style={{ width: "100%", height: "100%", background: catGradient(video.category_slugs) }}/>
                        )}
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(28,25,23,0.5) 0%, transparent 55%)" }}/>
                        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6 }}>
                          <span style={{
                            fontSize: 9, letterSpacing: "0.1em", fontWeight: 700,
                            background: "#fff", color: "var(--pink)",
                            padding: "5px 11px", borderRadius: 99, textTransform: "uppercase",
                          }}>
                            {video.category_slugs[0] ?? "Clase"}
                          </span>
                          {video.is_featured && (
                            <span style={{
                              fontSize: 9, letterSpacing: "0.1em", fontWeight: 700,
                              background: "var(--pink)", color: "#fff",
                              padding: "5px 11px", borderRadius: 99,
                            }}>DESTACADA</span>
                          )}
                        </div>
                        <div style={{
                          position: "absolute", bottom: 10, right: 12,
                          fontSize: 11, fontWeight: 600,
                          background: "rgba(28,25,23,0.72)", color: "#fff",
                          padding: "4px 10px", borderRadius: 8,
                        }}>{mmss(video.duration_seconds)}</div>
                      </div>

                      {/* Info */}
                      <div style={{ padding: "16px 18px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
                        {fechaCorta(video.published_at) && (
                          <p style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--muted)", marginBottom: 7, fontWeight: 600 }}>
                            {fechaCorta(video.published_at)}
                          </p>
                        )}
                        <p style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)", marginBottom: 6, lineHeight: 1.3 }}>
                          {title}
                        </p>
                        <p style={{
                          fontSize: 12, marginBottom: 12,
                          color: pct > 0 ? "var(--pink)" : "var(--muted)",
                        }}>
                          {nivelTexto(video.recommended_min_level, video.recommended_max_level)}
                        </p>

                        {pct > 0 && (
                          <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ flex: 1, background: "var(--pink-wash)", borderRadius: 99, height: 4 }}>
                              <div style={{ background: "var(--pink)", height: "100%", width: `${pct}%`, borderRadius: 99 }}/>
                            </div>
                            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{pct}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}

            {/* Add new card — admin only */}
            {isAdmin && (
              <a href="/admin/videos" style={{ textDecoration: "none" }}>
                <div style={{
                  height: "100%", minHeight: 280, borderRadius: "2rem",
                  border: "2px dashed var(--pink-line)", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 12,
                  background: "rgba(253,242,248,0.4)",
                  transition: "background 0.2s, border-color 0.2s",
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: "linear-gradient(135deg, var(--pink), var(--pink-mid))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, color: "#fff", boxShadow: "0 4px 12px rgba(230, 79, 85,0.3)",
                  }}>+</div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--pink)" }}>Nueva clase</p>
                  <p style={{ fontSize: 11, color: "var(--muted)" }}>Subir video al catálogo</p>
                </div>
              </a>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
