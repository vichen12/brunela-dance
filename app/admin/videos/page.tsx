import { deleteVideoAction, requeueMuxJobAction, upsertVideoAction } from "@/src/features/admin/actions";
import Link from "next/link";
import { Archive, BarChart3, Check, ChevronDown, Clock, Eye, EyeOff, Languages, Play, Plus, Rocket, Star, Tag, Users, X } from "lucide-react";
import { BotonEnviar } from "@/components/boton-enviar";
import { AdminBuscador } from "@/components/admin-buscador";
import { EditarClase } from "@/components/admin-video-drawer";
import { AdminVideoUpload } from "@/components/admin-video-upload";
import {
  armarPlanesDeTrabajo,
  type DiaDePlan,
  type PlanParaElegir,
  type UbicacionEnPlan,
} from "@/src/features/admin/planes-de-trabajo";
import {
  CATEGORIA_LABEL,
  nivelEnTexto,
  planesDesde,
  planesEnTexto
} from "@/src/features/studio/catalogo-clases";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { hasBunnyStreamEnv } from "@/src/lib/env";
import { bunnySignedUrls, bunnyVideoIdFromUrl } from "@/src/lib/video/bunny";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Shape the mux worker writes: [{locale,label,muxed_at}]. */
type AudioTrack = { locale: string; label: string; muxed_at?: string };

type VideoRecord = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  status: "draft" | "published" | "archived";
  membership_tier_required: "corps_de_ballet" | "solista" | "principal";
  /** Lo que de verdad decide quien ve la clase. Ver la migracion 20260921. */
  planes_permitidos: string[] | null;
  content_type: string | null;
  recommended_min_level: string | null;
  recommended_max_level: string | null;
  duration_seconds: number;
  category_slugs: string[];
  equipment: string[];
  thumbnail_url: string | null;
  stream_playback_id: string | null;
  bunny_video_id: string | null;
  audio_tracks: AudioTrack[];
  is_featured: boolean;
};

/**
 * Thumbnails sit behind the token-protected pull zone, so the stored
 * thumbnail_url is a 403 once Token Authentication is on. Sign per request.
 */
function adminThumb(video: VideoRecord): string | null {
  const bunnyId = video.bunny_video_id ?? bunnyVideoIdFromUrl(video.stream_playback_id);
  if (bunnyId && hasBunnyStreamEnv()) return bunnySignedUrls(bunnyId).thumbnail;
  return video.thumbnail_url;
}

// ── Quick actions ──────────────────────────────────────────────────────────────

async function quickStatusAction(fd: FormData) {
  "use server";
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = fd.get("id") as string;
  const status = fd.get("status") as string;
  await supabase.from("videos").update({ status }).eq("id", id);
  revalidatePath("/admin/videos");
  redirect("/admin/videos" as never);
}

async function quickFeaturedAction(fd: FormData) {
  "use server";
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = fd.get("id") as string;
  const current = fd.get("current") === "true";
  await supabase.from("videos").update({ is_featured: !current }).eq("id", id);
  revalidatePath("/admin/videos");
  redirect("/admin/videos" as never);
}

// ── Style maps ─────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { clase: string; label: string }> = {
  published: { clase: "acl-chip--pub",  label: "Publicada" },
  draft:     { clase: "acl-chip--borr", label: "Borrador" },
  archived:  { clase: "acl-chip--arch", label: "Archivada" },
};

const LOCALE_FLAGS: Record<string, string> = { es: "ES", en: "EN", fr: "FR", it: "IT" };

const ESTADOS = [
  { key: "", label: "Cualquier estado" },
  { key: "published", label: "Publicadas" },
  { key: "draft", label: "Borradores" },
  { key: "archived", label: "Archivadas" },
];

const PLANES = [
  { key: "", label: "Cualquier plan" },
  { key: "corps_de_ballet", label: "Corps de ballet" },
  { key: "solista", label: "Solista" },
  { key: "principal", label: "Principal" },
];

// ── Mux job state ──────────────────────────────────────────────────────────────

type MuxJob = {
  id: string;
  video_id: string;
  status: "pending" | "processing" | "done" | "failed";
  attempts: number;
  last_error: string | null;
  expected_locales: string[] | null;
  created_at: string;
  claimed_at: string | null;
};

const MUX_STYLE: Record<MuxJob["status"], { bg: string; border: string; color: string; label: string }> = {
  pending:    { bg: "#fffbeb", border: "#fde68a", color: "#92400e", label: "Idiomas en cola" },
  processing: { bg: "#eff6ff", border: "#bfdbfe", color: "#1e40af", label: "Muxeando ahora" },
  failed:     { bg: "#fef2f2", border: "#fecaca", color: "#991b1b", label: "Muxeo fallido" },
  done:       { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534", label: "Muxeo listo" },
};

/** The worker polls every 30s, so this much waiting means nobody is polling. */
const WORKER_SILENT_MINUTES = 10;

function minutesSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function sinceLabel(iso: string): string {
  const mins = minutesSince(iso);
  if (mins < 1) return "recien";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

/**
 * Mux state for one class.
 *
 * Only rendered while a job is unfinished: a completed mux already shows up as
 * the language list on the row above, so repeating it would be noise. The point
 * of this strip is the states that need someone to DO something -- a queue that
 * nothing is draining, or a failure with its reason.
 */
function MuxStatus({ job }: { job: MuxJob }) {
  const style = MUX_STYLE[job.status];
  const locales = (job.expected_locales ?? [])
    .map((l) => LOCALE_FLAGS[l] ?? l.toUpperCase())
    .join(" · ");
  const workerSilent =
    job.status === "pending" && minutesSince(job.created_at) >= WORKER_SILENT_MINUTES;

  return (
    <div style={{
      background: style.bg, borderTop: `1px solid ${style.border}`,
      padding: "10px 18px", display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap",
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: style.color, padding: "2px 8px", borderRadius: 99, background: "#fff", flexShrink: 0 }}>
        {style.label}
      </span>

      <div style={{ flex: 1, minWidth: 200, fontSize: 11, color: style.color, lineHeight: 1.6 }}>
        {locales && <span style={{ fontWeight: 600 }}>{locales}</span>}
        <span style={{ opacity: 0.75 }}>
          {locales ? " — " : ""}
          {job.status === "processing" && job.claimed_at
            ? `tomado ${sinceLabel(job.claimed_at)}`
            : `en cola ${sinceLabel(job.created_at)}`}
          {job.attempts > 0 && ` · ${job.attempts} ${job.attempts === 1 ? "intento" : "intentos"}`}
        </span>

        {workerSilent && (
          <div style={{ marginTop: 4, fontWeight: 600 }}>
            Nadie lo tomo en {WORKER_SILENT_MINUTES} minutos: probablemente el worker de muxeo no
            este corriendo. La clase igual se ve en espanol.
          </div>
        )}

        {job.status === "failed" && job.last_error && (
          <div style={{
            marginTop: 6, padding: "6px 9px", background: "#fff", borderRadius: 8,
            border: "1px solid #fecaca", fontSize: 10.5, color: "#7f1d1d",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            wordBreak: "break-word", maxHeight: 90, overflow: "auto",
          }}>
            {job.last_error}
          </div>
        )}
      </div>

      {job.status === "failed" && (
        <form action={requeueMuxJobAction} style={{ flexShrink: 0 }}>
          <input type="hidden" name="jobId" value={job.id} />
          <BotonEnviar pendingLabel="Reintentando…" style={{
            fontSize: 10, fontWeight: 700, padding: "5px 13px", borderRadius: 99,
            background: "#991b1b", color: "#fff", border: "none", cursor: "pointer",
          }}>REINTENTAR</BotonEnviar>
        </form>
      )}
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: "100%", borderRadius: 10, border: "1px solid #e7e5e4",
  background: "#fff", color: "#1c1917", padding: "9px 13px",
  fontSize: 13, outline: "none", fontFamily: "inherit",
};

const sel: React.CSSProperties = {
  ...inp, appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23a8a29e' strokeWidth='1.5' strokeLinecap='round' fill='none'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 34,
};

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", color: "#78716c", textTransform: "uppercase", marginBottom: 5 }}>
      {children}
    </span>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column" }}>
      <Lbl>{label}</Lbl>
      {children}
    </label>
  );
}

function Flash({ message, tone }: { message: string | null; tone: "success" | "error" }) {
  if (!message) return null;
  return (
    <div style={{
      borderRadius: 12, padding: "11px 16px", fontSize: 13, fontWeight: 600,
      background: tone === "success" ? "#f0fdf4" : "#fef2f2",
      color: tone === "success" ? "#166534" : "#991b1b",
      border: `1px solid ${tone === "success" ? "#bbf7d0" : "#fecaca"}`,
      marginBottom: 20,
    }}>{message}</div>
  );
}


// ── Upload form (real Bunny upload: video file + audio file per language) ────────

function UploadForm({ bunnyReady, programas }: { bunnyReady: boolean; programas: PlanParaElegir[] }) {
  if (!bunnyReady) {
    return (
      <div style={{ fontSize: 13, color: "#9a3412", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: "14px 16px", lineHeight: 1.6 }}>
        Para subir videos falta configurar <strong>Bunny Stream</strong> en las variables de entorno:
        <code style={{ display: "block", marginTop: 8, fontSize: 12 }}>
          BUNNY_STREAM_API_KEY · BUNNY_STREAM_LIBRARY_ID · BUNNY_STREAM_CDN_HOSTNAME
        </code>
      </div>
    );
  }

  return <AdminVideoUpload programas={programas} />;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function AdminVideosPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;
  const bunnyReady = hasBunnyStreamEnv();

  // Buscador y filtros, del lado del SERVIDOR.
  //
  // Filtrar en memoria sobre lo ya traido parece mas simple y miente: el
  // contador de arriba diria "3 borradores" contando solo los de la pagina.
  // Y con paginacion futura seria directamente incorrecto.
  const q = (typeof params.q === "string" ? params.q : "").trim();
  const fEstado = ESTADOS.some((e) => e.key === params.estado) ? (params.estado as string) : "";
  const fPlan = PLANES.some((e) => e.key === params.plan) ? (params.plan as string) : "";

  let consultaVideos = supabase
    .from("videos")
    .select("id, slug, title_i18n, description_i18n, status, membership_tier_required, planes_permitidos, content_type, recommended_min_level, recommended_max_level, duration_seconds, category_slugs, equipment, thumbnail_url, stream_playback_id, bunny_video_id, audio_tracks, is_featured");

  if (fEstado) consultaVideos = consultaVideos.eq("status", fEstado);
  // `contains` y no `eq`: desde la migracion 20260921 el acceso vive en la
  // LISTA. Con `eq` sobre el minimo derivado, filtrar por "Solista" no
  // encontraria una clase {corps, solista} -- su minimo es corps -- aunque
  // Solista la vea perfectamente.
  if (fPlan) consultaVideos = consultaVideos.contains("planes_permitidos", [fPlan]);
  if (q) {
    // Titulo en espanol o slug. `or` de PostgREST: una sola consulta.
    const t = q.replace(/[,()]/g, " ");
    consultaVideos = consultaVideos.or(`slug.ilike.%${t}%,title_i18n->>es.ilike.%${t}%`);
  }

  const [{ data }, { data: jobData }, { count: totalVideos }, { data: programsData }, { data: programDaysData }] =
    await Promise.all([
      consultaVideos.order("created_at", { ascending: false }),
      supabase
        .from("video_mux_jobs")
        .select("id, video_id, status, attempts, last_error, expected_locales, created_at, claimed_at")
        .order("created_at", { ascending: false }),
      // El total SIN filtrar, para que el contador diga "5 de 19" y no "5 de 5".
      supabase.from("videos").select("*", { count: "exact", head: true }),
      // Los planes de trabajo, para poder enganchar la clase a uno al subirla
      // o desde su propio panel. Van en el mismo Promise.all y no en una
      // consulta aparte: son dos viajes mas a Frankfurt, ~30 ms cada uno, y en
      // paralelo no cuestan nada.
      supabase.from("programs").select("id, title_i18n, duration_days").order("title_i18n->>es"),
      // `id` y `video_id` hacen falta para el panel de la clase: `id` es lo
      // unico con lo que se puede QUITAR una fila, y `video_id` es por donde se
      // agrupa "¿en que planes esta esta clase?".
      supabase.from("program_days").select("id, program_id, day_number, video_id"),
    ]);

  // Los planes ofrecibles y, por clase, en que dia de que plan esta puesta.
  // Las dos cosas salen de la misma pasada: ver src/features/admin/planes-de-trabajo.ts
  const { paraElegir: programas, ubicacionesPorClase } = armarPlanesDeTrabajo(
    (programsData ?? []) as { id: string; title_i18n: Record<string, string> | null; duration_days: number }[],
    (programDaysData ?? []) as DiaDePlan[]
  );
  const SIN_UBICACION: UbicacionEnPlan[] = [];

  const videos = (data ?? []) as VideoRecord[];
  const published = videos.filter((v) => v.status === "published").length;
  const drafts = videos.filter((v) => v.status === "draft").length;

  // Cuantas alumnas EMPEZARON cada clase.
  //
  // No es "vistas" y no se llama asi: hoy lo unico contable es cuantas alumnas
  // tienen una fila de progreso. Ver el encabezado de
  // src/features/admin/analitica/queries.ts -- ponerle "vistas" haria que el
  // numero cambiara de significado solo cuando lleguen los eventos.
  const { data: progresoData } = await supabase
    .from("user_progress")
    .select("user_id, video_id");

  const alumnasPorClase = new Map<string, Set<string>>();
  for (const g of progresoData ?? []) {
    if (!alumnasPorClase.has(g.video_id)) alumnasPorClase.set(g.video_id, new Set());
    alumnasPorClase.get(g.video_id)!.add(g.user_id);
  }
  // Con muy pocas alumnas, "sin uso" no dice nada del contenido: dice que el
  // estudio recien arranca. Mismo umbral que el panel.
  const totalAlumnas = new Set((progresoData ?? []).map((g) => g.user_id)).size;
  const mostrarUso = totalAlumnas >= 5;

  // Newest job per video. A class can be re-queued after a failure, and only the
  // current attempt is worth showing.
  const latestJob = new Map<string, MuxJob>();
  for (const job of (jobData ?? []) as MuxJob[]) {
    if (!latestJob.has(job.video_id)) latestJob.set(job.video_id, job);
  }
  const openJobs = [...latestJob.values()].filter((j) => j.status !== "done");

  const stats = [
    { value: videos.length, label: "Total",      sub: "en el catalogo" },
    { value: published,     label: "Publicados", sub: "visibles a alumnas" },
    { value: drafts,        label: "Borradores", sub: "sin publicar" },
    ...(openJobs.length > 0
      ? [{
          value: openJobs.length,
          label: "Muxeos abiertos",
          sub: openJobs.some((j) => j.status === "failed") ? "hay alguno fallido" : "idiomas en proceso"
        }]
      : [])
  ];

  // "Nueva clase" de la cabecera abre el formulario: un <details> no se abre
  // con un ancla, asi que se pide por la URL y el servidor lo pinta abierto.
  const abrirNueva = params.nueva === "1";
  const hayFiltro = Boolean(q || fEstado || fPlan);

  return (
    <main className="acl">
      <style>{CSS_CLASES}</style>

      <header className="acl-mast">
        <div style={{ minWidth: 0 }}>
          <p className="acl-eyebrow"><span className="acl-raya" />Gestión de contenido</p>
          <h1 className="acl-titulo">Clases<em>.</em></h1>
          <p className="acl-lede">
            Subí, editá y publicá las clases del estudio, con su video, sus pistas de audio y los planes que las ven.
          </p>
        </div>
        <div className="acl-mast-acciones">
          <Link href="/admin/videos?nueva=1#nueva" className="acl-btn acl-btn--lleno">
            <Plus size={16} strokeWidth={2.2} aria-hidden="true" /> Nueva clase
          </Link>
          <Link href="/dashboard/library" className="acl-btn">
            <Eye size={15} strokeWidth={2} aria-hidden="true" /> Ver como alumna
          </Link>
        </div>
      </header>

      <Flash message={success} tone="success" />
      <Flash message={error} tone="error" />

      {/* Cifras. Con filtro, la cuenta de la lista ya dice "x de y" en el buscador:
          estas son siempre las del catalogo entero. */}
      <div className="acl-cifras" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
        {stats.map((s) => (
          <div key={s.label} className="acl-cifra">
            <span className="acl-cifra-label">{s.label}</span>
            <span className="acl-cifra-num">{s.value}</span>
            <span className="acl-cifra-sub">{s.sub}</span>
          </div>
        ))}
      </div>

      {/* Subir una clase, plegado. */}
      <details className="acl-nueva" id="nueva" open={abrirNueva}>
        <summary>
          <span className="acl-nueva-ico" aria-hidden="true"><Plus size={18} strokeWidth={2.2} /></span>
          <span className="acl-nueva-txt">
            <span className="acl-nueva-titulo">Subir una clase nueva</span>
            <span className="acl-nueva-sub">Video, idiomas, categoría, nivel, materiales y planes</span>
          </span>
          <ChevronDown size={18} strokeWidth={2} className="acl-nueva-flecha" aria-hidden="true" />
        </summary>
        <div className="acl-nueva-cuerpo">
          <UploadForm bunnyReady={bunnyReady} programas={programas} />
        </div>
      </details>

      <AdminBuscador
        action="/admin/videos"
        q={q}
        placeholder="Buscar por título o dirección"
        total={totalVideos ?? videos.length}
        mostrando={videos.length}
        filtros={[
          { name: "estado", valor: fEstado, etiqueta: "Estado", opciones: ESTADOS },
          { name: "plan", valor: fPlan, etiqueta: "Plan", opciones: PLANES },
        ]}
      />

      {videos.length === 0 ? (
        <div className="acl-vacio">
          <p className="acl-vacio-titulo">{hayFiltro ? "Ninguna clase coincide." : "Todavía no hay clases."}</p>
          {hayFiltro
            ? <Link href="/admin/videos" className="acl-btn">Ver todas</Link>
            : <Link href="/admin/videos?nueva=1#nueva" className="acl-btn acl-btn--lleno"><Plus size={16} strokeWidth={2.2} /> Subir la primera</Link>}
        </div>
      ) : (
        <ul className="acl-lista">
          {videos.map((video) => {
            const st = STATUS_STYLE[video.status] ?? STATUS_STYLE.draft;
            // El texto sale de la LISTA: la ficha tiene que decir quien ve la
            // clase de verdad. Con {corps, principal} el minimo es corps y
            // Solista NO la ve; mostrar solo "Corps" diria lo contrario.
            const planesTexto = planesEnTexto(
              video.planes_permitidos?.length ? video.planes_permitidos : planesDesde(video.membership_tier_required)
            );
            const tieneVideo = !!(video.bunny_video_id || video.stream_playback_id);
            // El espanol viaja dentro del archivo de video, asi que nunca esta en
            // audio_tracks -- pero es un idioma en el que la clase se escucha.
            const audioLocales = (video.audio_tracks ?? []).map((t) => t.locale);
            const allLocales = audioLocales.length > 0 ? ["es", ...audioLocales] : [];
            const durMin = Math.floor(video.duration_seconds / 60);
            const job = latestJob.get(video.id);
            const miniatura = adminThumb(video);
            const titulo = video.title_i18n.es ?? video.slug;

            // Lo que una alumna nota si falta. Se muestra en la tarjeta para
            // saber que le falta a una clase SIN abrirla.
            const listo = [
              { clave: "Video", ok: tieneVideo },
              { clave: "Portada", ok: Boolean(miniatura) },
              { clave: "Descripción", ok: Boolean(video.description_i18n?.es?.trim()) },
              { clave: "Categoría", ok: (video.category_slugs?.length ?? 0) > 0 },
            ];
            const cuantosListos = listo.filter((l) => l.ok).length;
            const categorias = (video.category_slugs ?? []).map((c) => CATEGORIA_LABEL[c] ?? c).join(", ");
            const usoN = alumnasPorClase.get(video.id)?.size ?? 0;

            return (
              <li key={video.id} className={"acl-card acl-card--" + video.status}>
                <div className="acl-card-cuerpo">
                  <div className="acl-mini">
                    {miniatura ? <img src={miniatura} alt="" /> : <span className="acl-mini-vacia"><Play size={22} strokeWidth={1.8} aria-hidden="true" /></span>}
                    <span className="acl-mini-dur"><Clock size={11} strokeWidth={2.4} aria-hidden="true" /> {durMin} min</span>
                    {video.is_featured && <span className="acl-mini-dest" title="Destacada"><Star size={12} strokeWidth={2.4} fill="currentColor" aria-hidden="true" /></span>}
                  </div>

                  <div className="acl-info">
                    <div className="acl-linea-estado">
                      <span className={"acl-estado " + st.clase}><span className="acl-punto" aria-hidden="true" />{st.label}</span>
                      {video.content_type === "mini_training" && <span className="acl-tipo">Mini Training</span>}
                      {mostrarUso && video.status === "published" && (
                        <span className={usoN === 0 ? "acl-uso acl-uso--cero" : "acl-uso"}>
                          {usoN === 0 ? "No la empezó nadie" : `La empezaron ${usoN}`}
                        </span>
                      )}
                    </div>
                    <h2 className="acl-titulo-clase" title={titulo}>{titulo}</h2>
                    <ul className="acl-datos">
                      <li title="Quién la ve"><Users size={14} strokeWidth={2} aria-hidden="true" /> {planesTexto}</li>
                      <li title="Nivel"><BarChart3 size={14} strokeWidth={2} aria-hidden="true" /> {nivelEnTexto(video.recommended_min_level, video.recommended_max_level)}</li>
                      {categorias && <li title="Categoría"><Tag size={14} strokeWidth={2} aria-hidden="true" /> {categorias}</li>}
                      {allLocales.length > 0 && <li title="Idiomas"><Languages size={14} strokeWidth={2} aria-hidden="true" /> {allLocales.map((l) => LOCALE_FLAGS[l] ?? l).join(" · ")}</li>}
                    </ul>

                    <div className="acl-listo" aria-label={`Lista para publicar: ${cuantosListos} de ${listo.length}`}>
                      <span className="acl-listo-barra" aria-hidden="true">
                        <span style={{ width: `${(cuantosListos / listo.length) * 100}%` }} className={cuantosListos === listo.length ? "es-completa" : ""} />
                      </span>
                      {listo.map((l) => (
                        <span key={l.clave} className={"acl-check" + (l.ok ? " es-ok" : "")}>
                          {l.ok ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : <X size={12} strokeWidth={3} aria-hidden="true" />}
                          {l.clave}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="acl-acciones">
                    <div className="acl-acciones-fila">
                      {/* Edicion en panel lateral: el formulario no existe en el
                          DOM hasta que se abre (con 19 clases eran ~250 controles). */}
                      <EditarClase
                        video={video}
                        planes={programas}
                        ubicaciones={ubicacionesPorClase.get(video.id) ?? SIN_UBICACION}
                      />
                      {video.status !== "published" && (
                        <form action={quickStatusAction}>
                          <input type="hidden" name="id" value={video.id} />
                          <input type="hidden" name="status" value="published" />
                          <BotonEnviar
                            className="acl-accion acl-accion--publicar"
                            pendingLabel="Publicando…"
                            confirmar={tieneVideo ? undefined : "Esta clase todavía no tiene video: una alumna la abriría y no vería nada. ¿Publicarla igual?"}
                          >
                            <Rocket size={14} strokeWidth={2} aria-hidden="true" /> Publicar
                          </BotonEnviar>
                        </form>
                      )}
                    </div>
                    <div className="acl-acciones-fila acl-acciones-fila--iconos">
                      <form action={quickFeaturedAction}>
                        <input type="hidden" name="id" value={video.id} />
                        <input type="hidden" name="current" value={String(video.is_featured)} />
                        <BotonEnviar className={"acl-icono" + (video.is_featured ? " es-activo" : "")} title={video.is_featured ? "Quitar de destacadas" : "Destacar en la biblioteca"} pendingLabel="…">
                          <Star size={15} strokeWidth={2} fill={video.is_featured ? "currentColor" : "none"} aria-hidden="true" />
                        </BotonEnviar>
                      </form>
                      {video.status === "published" && (
                        <form action={quickStatusAction}>
                          <input type="hidden" name="id" value={video.id} />
                          <input type="hidden" name="status" value="draft" />
                          <BotonEnviar className="acl-icono" title="Pasar a borrador: deja de verse hasta que la vuelvas a publicar" pendingLabel="…">
                            <EyeOff size={15} strokeWidth={2} aria-hidden="true" />
                          </BotonEnviar>
                        </form>
                      )}
                      {video.status !== "archived" && (
                        <form action={quickStatusAction}>
                          <input type="hidden" name="id" value={video.id} />
                          <input type="hidden" name="status" value="archived" />
                          <BotonEnviar className="acl-icono" title="Archivar: deja de verse, no se borra" pendingLabel="…">
                            <Archive size={15} strokeWidth={2} aria-hidden="true" />
                          </BotonEnviar>
                        </form>
                      )}
                    </div>
                  </div>
                </div>

                {/* Estado del muxeo: solo mientras haya algo que hacer */}
                {job && job.status !== "done" && <MuxStatus job={job} />}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

const CSS_CLASES = `
.acl { display: flex; flex-direction: column; }
.acl-mast {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 20px 28px; flex-wrap: wrap;
  padding-bottom: clamp(22px, 3vw, 30px);
}
.acl-eyebrow {
  display: inline-flex; align-items: center; gap: 12px; margin-bottom: 14px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--pink-deep);
}
.acl-raya { display: inline-block; width: 28px; height: 1.5px; background: var(--pink); }
.acl-titulo {
  font-family: var(--font-display), sans-serif; font-weight: 800;
  font-size: clamp(40px, 5vw, 68px); line-height: 1; letter-spacing: -0.045em; color: var(--ink);
}
.acl-titulo em { font-style: normal; color: var(--pink); }
.acl-lede { margin-top: 14px; max-width: 56ch; font-size: 15px; line-height: 1.7; color: #57534e; }
.acl-mast-acciones { display: flex; gap: 10px; flex-wrap: wrap; padding-bottom: 6px; }
.acl-btn {
  display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 20px; border-radius: 99px;
  border: 1.5px solid #d6d3d1; background: #fff; color: var(--ink); text-decoration: none;
  font-size: 13px; font-weight: 700; white-space: nowrap; transition: border-color .2s, transform .2s, background .2s;
}
.acl-btn:hover { border-color: var(--ink); transform: translateY(-1px); }
.acl-btn--lleno { background: var(--pink); border-color: var(--pink); color: #fff; box-shadow: 0 8px 22px -10px rgba(230,79,85,0.7); }
.acl-btn--lleno:hover { background: var(--pink-mid); border-color: var(--pink-mid); }

.acl-cifras { display: grid; border-top: 1px solid var(--ink); border-bottom: 1px solid #e7e5e4; margin-bottom: 18px; }
.acl-cifra { display: flex; flex-direction: column; gap: 8px; padding: 18px 22px 20px; }
.acl-cifra:first-child { padding-left: 0; }
.acl-cifra + .acl-cifra { border-left: 1px solid #e7e5e4; }
.acl-cifra-label { font-size: 10.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #78716c; }
.acl-cifra-num { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 40px; line-height: 0.95; letter-spacing: -0.045em; color: var(--ink); }
.acl-cifra-sub { font-size: 12px; color: var(--pink-muted); }

.acl-nueva { margin-bottom: 8px; border: 1.5px dashed #e7e5e4; border-radius: 20px; transition: border-color .2s, background .2s; }
.acl-nueva:hover { border-color: var(--pink-line); }
.acl-nueva[open] { border-style: solid; border-color: var(--pink-line); background: #fff; }
.acl-nueva summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 14px; padding: 16px 20px; user-select: none; }
.acl-nueva summary::-webkit-details-marker { display: none; }
.acl-nueva-ico {
  width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  background: var(--pink); color: #fff; transition: transform .35s cubic-bezier(.16,1,.3,1);
}
.acl-nueva-ico svg { transition: transform .35s cubic-bezier(.16,1,.3,1); }
.acl-nueva[open] .acl-nueva-ico svg { transform: rotate(45deg); }
.acl-nueva-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.acl-nueva-titulo { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 16px; letter-spacing: -0.02em; color: var(--ink); }
.acl-nueva-sub { font-size: 12.5px; color: #78716c; }
.acl-nueva-flecha { color: #a8a29e; transition: transform .3s; }
.acl-nueva[open] .acl-nueva-flecha { transform: rotate(180deg); }
.acl-nueva-cuerpo { padding: 4px 22px 24px; border-top: 1px solid #f0eeec; }

.acl-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.acl-card {
  position: relative; border: 1px solid #e7e5e4; border-radius: 20px; background: #fff; overflow: hidden;
  transition: transform .35s cubic-bezier(.16,1,.3,1), box-shadow .35s, border-color .25s;
}
.acl-card::before {
  content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #e7e5e4;
}
.acl-card--published::before { background: var(--pink); }
.acl-card--draft::before { background: var(--pink-line); }
.acl-card:hover { transform: translateY(-2px); border-color: var(--pink-line); box-shadow: 0 22px 40px -26px rgba(176,58,62,0.5); }
.acl-card-cuerpo { display: grid; grid-template-columns: 196px minmax(0, 1fr) auto; gap: 22px; align-items: center; padding: 16px 18px 16px 22px; }

.acl-mini {
  position: relative; aspect-ratio: 16 / 10; border-radius: 14px; overflow: hidden;
  background: linear-gradient(145deg, var(--pink-wash), var(--pink-soft));
}
.acl-mini img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .8s cubic-bezier(.16,1,.3,1); }
.acl-card:hover .acl-mini img { transform: scale(1.05); }
.acl-mini-vacia { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--pink-mid); }
.acl-mini-dur {
  position: absolute; right: 8px; bottom: 8px; display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 700; color: #fff; padding: 3px 8px; border-radius: 8px;
  background: rgba(28,25,23,0.55); backdrop-filter: blur(6px);
}
.acl-mini-dest {
  position: absolute; left: 8px; top: 8px; width: 26px; height: 26px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center; background: #fff; color: #ea580c;
  box-shadow: 0 4px 10px -4px rgba(28,25,23,0.3);
}

.acl-info { min-width: 0; }
.acl-linea-estado { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
.acl-estado { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
.acl-punto { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.acl-chip--pub { color: #15803d; }
.acl-chip--pub .acl-punto { box-shadow: 0 0 0 4px rgba(21,128,61,0.14); animation: acl-latido 2.4s ease-in-out infinite; }
.acl-chip--borr { color: var(--pink-deep); }
.acl-chip--arch { color: #78716c; }
@keyframes acl-latido { 0%, 100% { box-shadow: 0 0 0 3px rgba(21,128,61,0.16); } 50% { box-shadow: 0 0 0 6px rgba(21,128,61,0.04); } }
.acl-tipo, .acl-uso { font-size: 11.5px; font-weight: 600; color: #78716c; padding: 2px 9px; border-radius: 99px; background: #f5f5f4; }
.acl-uso--cero { color: var(--pink-deep); background: var(--pink-wash); }
.acl-titulo-clase {
  font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 21px; line-height: 1.15; letter-spacing: -0.03em;
  color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.acl-datos { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 16px; }
.acl-datos li { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #57534e; }
.acl-datos svg { color: #a8a29e; flex-shrink: 0; }

.acl-listo { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.acl-listo-barra { width: 56px; height: 5px; border-radius: 99px; background: #f0eeec; overflow: hidden; margin-right: 4px; }
.acl-listo-barra span { display: block; height: 100%; border-radius: 99px; background: var(--pink); transition: width .6s; }
.acl-listo-barra span.es-completa { background: #16a34a; }
.acl-check {
  display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px 3px 7px; border-radius: 99px;
  font-size: 11.5px; font-weight: 600; color: var(--pink-deep); background: var(--pink-wash);
}
.acl-check.es-ok { color: #57534e; background: #f5f5f4; }
.acl-check.es-ok svg { color: #16a34a; }

.acl-acciones { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.acl-acciones-fila { display: flex; align-items: center; gap: 6px; }
.acl-acciones form { display: contents; }
.acl-accion, .acl-editar {
  display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 15px; border-radius: 11px; cursor: pointer;
  border: 1.5px solid #e7e5e4; background: #fff; color: #44403c; font: inherit; font-size: 13px; font-weight: 700;
  white-space: nowrap; transition: border-color .2s, background .2s, color .2s, transform .2s;
}
.acl-editar { border-color: var(--ink); color: var(--ink); }
.acl-editar:hover { background: var(--ink); color: #fff; }
.acl-accion--publicar { background: var(--pink); border-color: var(--pink); color: #fff; box-shadow: 0 8px 18px -10px rgba(230,79,85,0.8); }
.acl-accion--publicar:hover { background: var(--pink-mid); border-color: var(--pink-mid); transform: translateY(-1px); }
.acl-icono {
  width: 36px; height: 36px; border-radius: 10px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid transparent; background: transparent; color: #a8a29e; transition: background .2s, color .2s, border-color .2s;
}
.acl-icono:hover { background: #f5f5f4; color: var(--ink); border-color: #e7e5e4; }
.acl-icono.es-activo { color: #ea580c; }

@media (max-width: 1080px) {
  .acl-card-cuerpo { grid-template-columns: 160px minmax(0, 1fr); }
  .acl-acciones { grid-column: 1 / -1; flex-direction: row; justify-content: space-between; align-items: center; }
}
@media (max-width: 640px) {
  .acl-card-cuerpo { grid-template-columns: minmax(0, 1fr); padding: 14px 14px 14px 18px; }
  .acl-titulo-clase { white-space: normal; }
}
@media (prefers-reduced-motion: reduce) {
  .acl-chip--pub .acl-punto { animation: none; }
}

.acl-vacio {
  display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 52px 24px; text-align: center;
  border: 1.5px dashed #e7e5e4; border-radius: 22px;
}
.acl-vacio-titulo { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 22px; letter-spacing: -0.025em; color: var(--ink); }

@media (max-width: 640px) {
  .acl-cifras { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .acl-cifra:nth-child(3) { border-left: 0; padding-left: 0; }
  .acl-cifra:nth-child(n+3) { border-top: 1px solid #e7e5e4; }
}
`;

