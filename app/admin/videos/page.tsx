import { deleteVideoAction, requeueMuxJobAction, upsertVideoAction } from "@/src/features/admin/actions";
import Link from "next/link";
import { AlertCircle, Archive, CheckCircle2, ChevronDown, Eye, Languages, Play, Plus, Rocket, Star } from "lucide-react";
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

            return (
              <li key={video.id} className="acl-fila">
                <div className="acl-fila-cuerpo">
                  <div className="acl-mini">
                    {miniatura ? <img src={miniatura} alt="" /> : <Play size={18} strokeWidth={2} aria-hidden="true" />}
                    <span className="acl-mini-dur">{durMin} min</span>
                  </div>

                  <div className="acl-info">
                    <div className="acl-chips">
                      <span className={"acl-chip " + st.clase}>{st.label}</span>
                      <span className="acl-chip acl-chip--plan">{planesTexto}</span>
                      {video.is_featured && <span className="acl-chip acl-chip--dest"><Star size={11} strokeWidth={2.4} fill="currentColor" aria-hidden="true" /> Destacada</span>}
                      {video.content_type === "mini_training" && <span className="acl-chip acl-chip--plan">Mini Training</span>}
                    </div>
                    <h2 className="acl-titulo-clase">{titulo}</h2>
                    <p className="acl-meta">
                      {video.category_slugs?.length > 0 && <span>{video.category_slugs.map((c) => CATEGORIA_LABEL[c] ?? c).join(", ")}</span>}
                      <span>{nivelEnTexto(video.recommended_min_level, video.recommended_max_level)}</span>
                      <span className="acl-meta-slug">/{video.slug}</span>
                    </p>
                    <p className="acl-estado-video">
                      {tieneVideo
                        ? <span className="acl-ok"><CheckCircle2 size={13} strokeWidth={2.2} aria-hidden="true" /> Video listo</span>
                        : <span className="acl-falta"><AlertCircle size={13} strokeWidth={2.2} aria-hidden="true" /> Sin video</span>}
                      {allLocales.length > 0 && (
                        <span className="acl-idiomas"><Languages size={13} strokeWidth={2} aria-hidden="true" /> {allLocales.map((l) => LOCALE_FLAGS[l] ?? l).join(" · ")}</span>
                      )}
                      {/* Solo en clases PUBLICADAS: una en borrador no tiene
                          por que tener uso, y marcarla seria ruido. */}
                      {mostrarUso && video.status === "published" && (() => {
                        const n = alumnasPorClase.get(video.id)?.size ?? 0;
                        return n === 0
                          ? <span className="acl-falta">No la empezó nadie</span>
                          : <span>La empezaron {n}</span>;
                      })()}
                    </p>
                  </div>

                  <div className="acl-acciones">
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
                        <BotonEnviar className="acl-accion acl-accion--publicar" pendingLabel="Publicando…">
                          <Rocket size={14} strokeWidth={2} aria-hidden="true" /> Publicar
                        </BotonEnviar>
                      </form>
                    )}
                    <form action={quickFeaturedAction}>
                      <input type="hidden" name="id" value={video.id} />
                      <input type="hidden" name="current" value={String(video.is_featured)} />
                      <BotonEnviar className="acl-accion" title={video.is_featured ? "Quitar de destacadas" : "Destacar en la biblioteca"}>
                        <Star size={14} strokeWidth={2} fill={video.is_featured ? "currentColor" : "none"} aria-hidden="true" />
                        {video.is_featured ? "Quitar destaque" : "Destacar"}
                      </BotonEnviar>
                    </form>
                    {video.status !== "archived" && (
                      <form action={quickStatusAction}>
                        <input type="hidden" name="id" value={video.id} />
                        <input type="hidden" name="status" value="archived" />
                        <BotonEnviar className="acl-accion acl-accion--suave" title="Archivar: deja de verse, no se borra">
                          <Archive size={14} strokeWidth={2} aria-hidden="true" /> Archivar
                        </BotonEnviar>
                      </form>
                    )}
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
.acl-nueva[open] .acl-nueva-ico { transform: rotate(45deg); }
.acl-nueva-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.acl-nueva-titulo { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 16px; letter-spacing: -0.02em; color: var(--ink); }
.acl-nueva-sub { font-size: 12.5px; color: #78716c; }
.acl-nueva-flecha { color: #a8a29e; transition: transform .3s; }
.acl-nueva[open] .acl-nueva-flecha { transform: rotate(180deg); }
.acl-nueva-cuerpo { padding: 4px 22px 24px; border-top: 1px solid #f0eeec; }

.acl-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.acl-fila { border-bottom: 1px solid #f0eeec; }
.acl-fila-cuerpo { display: flex; align-items: center; gap: 18px; padding: 16px 8px; margin: 0 -8px; border-radius: 16px; transition: background .2s; }
.acl-fila-cuerpo:hover { background: #fafaf9; }
.acl-mini {
  position: relative; width: 132px; aspect-ratio: 16 / 10; border-radius: 12px; overflow: hidden; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(145deg, var(--pink-wash), var(--pink-soft)); color: var(--pink-mid);
}
.acl-mini img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.acl-mini-dur {
  position: absolute; right: 6px; bottom: 6px; font-size: 10.5px; font-weight: 700; color: #fff;
  padding: 2px 7px; border-radius: 6px; background: rgba(28,25,23,0.55);
}
.acl-info { flex: 1; min-width: 0; }
.acl-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 7px; }
.acl-chip {
  display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 99px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
}
.acl-chip--pub { background: var(--ink); color: #fff; }
.acl-chip--borr { background: var(--pink-wash); color: var(--pink-deep); border: 1px solid var(--pink-line); }
.acl-chip--arch { background: #f5f5f4; color: #78716c; }
.acl-chip--plan { background: #fff; color: #57534e; border: 1px solid #e7e5e4; }
.acl-chip--dest { background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa; }
.acl-titulo-clase {
  font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 18px; letter-spacing: -0.025em;
  color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.acl-meta, .acl-estado-video { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 4px; font-size: 12.5px; color: #78716c; }
.acl-meta-slug { color: #a8a29e; }
.acl-estado-video span { display: inline-flex; align-items: center; gap: 5px; }
.acl-ok { color: #15803d; font-weight: 600; }
.acl-falta { color: var(--pink-deep); font-weight: 600; }
.acl-idiomas { color: #57534e; font-weight: 600; }

.acl-acciones { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.acl-acciones form { display: contents; }
.acl-accion, .acl-editar {
  display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 13px; border-radius: 10px; cursor: pointer;
  border: 1px solid #e7e5e4; background: #fff; color: #44403c; font: inherit; font-size: 12.5px; font-weight: 700;
  white-space: nowrap; transition: border-color .2s, background .2s, color .2s;
}
.acl-accion:hover, .acl-editar:hover { border-color: var(--pink-line); background: var(--pink-wash); color: var(--pink-deep); }
.acl-editar { border-color: var(--ink); color: var(--ink); }
.acl-accion--publicar { background: var(--pink); border-color: var(--pink); color: #fff; }
.acl-accion--publicar:hover { background: var(--pink-mid); border-color: var(--pink-mid); color: #fff; }
.acl-accion--suave { color: #78716c; }

.acl-vacio {
  display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 52px 24px; text-align: center;
  border: 1.5px dashed #e7e5e4; border-radius: 22px;
}
.acl-vacio-titulo { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 22px; letter-spacing: -0.025em; color: var(--ink); }

@media (max-width: 980px) {
  .acl-fila-cuerpo { flex-wrap: wrap; }
  .acl-info { flex-basis: calc(100% - 150px); }
  .acl-acciones { width: 100%; justify-content: flex-start; }
}
@media (max-width: 640px) {
  .acl-cifras { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .acl-cifra:nth-child(3) { border-left: 0; padding-left: 0; }
  .acl-cifra:nth-child(n+3) { border-top: 1px solid #e7e5e4; }
  .acl-mini { width: 100%; }
  .acl-info { flex-basis: 100%; }
}
`;

