import { deleteVideoAction, requeueMuxJobAction, upsertVideoAction } from "@/src/features/admin/actions";
import { Archive, BarChart3, Check, Clapperboard, Clock, Eye, EyeOff, Languages, Play, Plus, Rocket, Search, Star, Tag, Users, X } from "lucide-react";
import { AdminAviso, AdminBoton, AdminCabecera, AdminCifras, AdminNueva, AdminVacio } from "@/components/admin-ui";
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
  pending:    { bg: "#FFF4E8", border: "#FFE2D3", color: "#8A4A2E", label: "Idiomas en cola" },
  processing: { bg: "#FFF0EA", border: "#F6D9CF", color: "#A0472F", label: "Muxeando ahora" },
  failed:     { bg: "#FDECEC", border: "#F2C6C6", color: "#B03A3E", label: "Muxeo fallido" },
  done:       { bg: "#FFF4E8", border: "#CFE3C9", color: "#3F7A45", label: "Muxeo listo" },
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
      background: style.bg, border: `1px solid ${style.border}`, borderRadius: 18,
      margin: "0 14px 14px", padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap",
    }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: style.color, padding: "4px 11px", borderRadius: 99, background: "#fff", flexShrink: 0 }}>
        {style.label}
      </span>

      <div style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: style.color, lineHeight: 1.6, paddingTop: 2 }}>
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
            marginTop: 8, padding: "8px 11px", background: "#fff", borderRadius: 12,
            border: "1px solid #F2C6C6", fontSize: 11.5, color: "#8A2E32",
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
            fontSize: 13, fontWeight: 800, fontFamily: "inherit", padding: "8px 16px", borderRadius: 99,
            background: "var(--pink)", color: "#fff", border: "none", cursor: "pointer",
            boxShadow: "0 10px 20px -12px rgba(230,79,85,.85)",
          }}>Reintentar</BotonEnviar>
        </form>
      )}
    </div>
  );
}

// ── Upload form (real Bunny upload: video file + audio file per language) ────────

function UploadForm({ bunnyReady, programas }: { bunnyReady: boolean; programas: PlanParaElegir[] }) {
  if (!bunnyReady) {
    return (
      <div style={{ marginTop: 16, fontSize: 13.5, color: "#8A4A2E", background: "#FFF4E8", border: "1px solid #FFE2D3", borderRadius: 20, padding: "16px 18px", lineHeight: 1.6 }}>
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

      <AdminCabecera
        eyebrow="Gestión de contenido"
        titulo="Clases"
        lede="Subí, editá y publicá las clases del estudio, con su video, sus pistas de audio y los planes que las ven."
        acciones={<>
          <AdminBoton href="/admin/videos?nueva=1#nueva" lleno><Plus size={16} strokeWidth={2.2} aria-hidden="true" /> Nueva clase</AdminBoton>
          <AdminBoton href="/dashboard/library"><Eye size={15} strokeWidth={2} aria-hidden="true" /> Ver como alumna</AdminBoton>
        </>}
      />

      <AdminAviso mensaje={success} tono="ok" />
      <AdminAviso mensaje={error} tono="error" />

      {/* Cifras. Con filtro, la cuenta de la lista ya dice "x de y" en el buscador:
          estas son siempre las del catalogo entero. */}
      <AdminCifras items={stats} />

      {/* Subir una clase, plegado. */}
      <AdminNueva abierto={abrirNueva} titulo="Subir una clase nueva" sub="Video, idiomas, categoría, nivel, materiales y planes">
        <UploadForm bunnyReady={bunnyReady} programas={programas} />
      </AdminNueva>

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
        <AdminVacio titulo={hayFiltro ? "Ninguna clase coincide." : "Todavía no hay clases."}>
          <span className="acl-vacio-ico" aria-hidden="true">
            {hayFiltro ? <Search size={22} strokeWidth={2} /> : <Clapperboard size={22} strokeWidth={2} />}
          </span>
          <p>{hayFiltro ? "Probá con otra palabra o sacá algún filtro." : "Subí la primera y aparece acá, con todo lo que le falta para publicarla."}</p>
          {hayFiltro
            ? <AdminBoton href="/admin/videos">Ver todas</AdminBoton>
            : <AdminBoton href="/admin/videos?nueva=1#nueva" lleno><Plus size={16} strokeWidth={2.2} aria-hidden="true" /> Subir la primera</AdminBoton>}
        </AdminVacio>
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
                    {miniatura ? <img src={miniatura} alt="" /> : <span className="acl-mini-vacia"><span className="acl-mini-play"><Play size={20} strokeWidth={2} fill="currentColor" aria-hidden="true" /></span></span>}
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

                    <div className={"acl-listo" + (cuantosListos === listo.length ? " es-completa" : "")} aria-label={`Lista para publicar: ${cuantosListos} de ${listo.length}`}>
                      <span className="acl-listo-cab" aria-hidden="true">
                        <span className="acl-listo-txt">
                          {cuantosListos === listo.length ? "Lista para publicar" : "Para publicarla falta"}
                        </span>
                        <span className="acl-listo-barra">
                          <span style={{ width: `${(cuantosListos / listo.length) * 100}%` }} />
                        </span>
                        <span className="acl-listo-n">{cuantosListos}/{listo.length}</span>
                      </span>
                      <span className="acl-checks">
                        {listo.map((l) => (
                          <span key={l.clave} className={"acl-check" + (l.ok ? " es-ok" : "")}>
                            <span className="acl-check-ico">
                              {l.ok ? <Check size={11} strokeWidth={3.2} aria-hidden="true" /> : <X size={11} strokeWidth={3.2} aria-hidden="true" />}
                            </span>
                            {l.clave}
                          </span>
                        ))}
                      </span>
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
.acl .ad-vacio .acl-vacio-ico { order: -1; }
.acl-vacio-ico { width: 54px; height: 54px; border-radius: 18px; display: grid; place-items: center; background: #fff; color: var(--pink-deep); box-shadow: var(--sombra); }

.acl-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.acl-card {
  position: relative; border: 1px solid var(--linea); border-radius: 28px; background: #fff; overflow: hidden;
  box-shadow: var(--sombra);
  transition: transform .35s var(--curva), box-shadow .35s, border-color .25s;
  animation: acl-entra .7s var(--curva) both;
}
.acl-lista > li:nth-child(2) { animation-delay: .05s; }
.acl-lista > li:nth-child(3) { animation-delay: .1s; }
.acl-lista > li:nth-child(n+4) { animation-delay: .15s; }
@keyframes acl-entra { from { opacity: 0; transform: translateY(10px) scale(.99); } to { opacity: 1; transform: none; } }
.acl-card:hover { transform: translateY(-3px); border-color: var(--linea-fuerte); box-shadow: var(--sombra-alta); }
.acl-card--archived { opacity: .72; }
.acl-card-cuerpo { display: grid; grid-template-columns: 232px minmax(0, 1fr) auto; gap: 24px; align-items: center; padding: 14px 20px 14px 14px; }

.acl-mini {
  position: relative; aspect-ratio: 16 / 10; border-radius: 20px; overflow: hidden;
  background:
    radial-gradient(120px 90px at 85% 15%, rgba(255,205,185,.9), transparent 70%),
    linear-gradient(145deg, #FFF1EC, #FDE3E0);
}
.acl-mini img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .8s var(--curva); }
.acl-card:hover .acl-mini img { transform: scale(1.05); }
.acl-mini-vacia { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.acl-mini-play {
  width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; padding-left: 3px;
  background: rgba(255,255,255,.92); color: var(--pink); box-shadow: 0 12px 26px -14px rgba(176,70,70,.6);
  transition: transform .4s var(--curva);
}
.acl-card:hover .acl-mini-play { transform: scale(1.08); }
.acl-mini-dur {
  position: absolute; right: 10px; bottom: 10px; display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 800; color: var(--ink); padding: 4px 10px; border-radius: 99px;
  background: rgba(255,255,255,0.92); backdrop-filter: blur(6px);
}
.acl-mini-dur svg { color: var(--pink-deep); }
.acl-mini-dest {
  position: absolute; left: 10px; top: 10px; width: 30px; height: 30px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center; background: #fff; color: var(--melocoton-deep);
  box-shadow: 0 6px 14px -8px rgba(176,70,70,0.5);
}

.acl-info { min-width: 0; }
.acl-linea-estado { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.acl-estado { display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px 5px 10px; border-radius: 99px; font-size: 12.5px; font-weight: 800; }
.acl-punto { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.acl-chip--pub { color: var(--salvia-deep); background: var(--salvia); }
.acl-chip--pub .acl-punto { animation: acl-latido 2.4s ease-in-out infinite; }
.acl-chip--borr { color: var(--melocoton-deep); background: #FFEBDF; }
.acl-chip--arch { color: var(--muted); background: #F6EEEA; }
@keyframes acl-latido { 0%, 100% { box-shadow: 0 0 0 2px rgba(63,122,69,0.18); } 50% { box-shadow: 0 0 0 5px rgba(63,122,69,0.04); } }
.acl-tipo, .acl-uso { font-size: 12.5px; font-weight: 800; color: #A0472F; padding: 5px 12px; border-radius: 99px; background: #FFF0EA; }
.acl-uso { color: var(--muted); background: var(--rubor); }
.acl-uso--cero { color: var(--pink-deep); background: var(--pink-wash); }
.acl-titulo-clase {
  font-weight: 900; font-size: 21px; line-height: 1.2; letter-spacing: -0.02em;
  color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.acl-datos { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.acl-datos li { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px 5px 9px; border-radius: 99px; font-size: 13px; font-weight: 700; color: #6E5550; background: var(--crema); border: 1px solid var(--linea); }
.acl-datos svg { color: var(--pink); flex-shrink: 0; }

.acl-listo { margin-top: 12px; padding: 10px 12px; border-radius: 18px; background: #FFF8F3; border: 1px dashed var(--linea-fuerte); display: flex; flex-direction: column; gap: 8px; max-width: 560px; }
.acl-listo.es-completa { background: #F6FAF3; border: 1px solid #DCEBD6; }
.acl-listo-cab { display: flex; align-items: center; gap: 10px; }
.acl-listo-txt { font-size: 12.5px; font-weight: 800; color: var(--melocoton-deep); white-space: nowrap; }
.acl-listo.es-completa .acl-listo-txt { color: var(--salvia-deep); }
.acl-listo-barra { flex: 1; max-width: 140px; height: 7px; border-radius: 99px; background: #FFE9DC; overflow: hidden; }
.acl-listo-barra span { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #FFB59A, var(--pink)); transition: width .6s var(--curva); }
.acl-listo.es-completa .acl-listo-barra { background: #E1EEDB; }
.acl-listo.es-completa .acl-listo-barra span { background: linear-gradient(90deg, #9CCB98, #5E9E62); }
.acl-listo-n { font-size: 12px; font-weight: 800; color: var(--muted); }
.acl-checks { display: flex; flex-wrap: wrap; gap: 6px; }
.acl-check {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px 4px 5px; border-radius: 99px;
  font-size: 12.5px; font-weight: 800; color: var(--melocoton-deep); background: #FFEBDF;
}
.acl-check-ico { width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; background: #fff; color: var(--melocoton-deep); }
.acl-check.es-ok { color: var(--salvia-deep); background: var(--salvia); }
.acl-check.es-ok .acl-check-ico { background: var(--salvia-deep); color: #fff; }

.acl-acciones { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.acl-acciones-fila { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.acl-acciones form { display: contents; }
.acl-accion, .acl-editar {
  display: inline-flex; align-items: center; gap: 7px; height: 42px; padding: 0 18px; border-radius: 99px; cursor: pointer;
  border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); font: inherit; font-size: 14px; font-weight: 800;
  white-space: nowrap; transition: border-color .2s, background .2s, color .2s, transform .3s var(--curva), box-shadow .3s;
}
.acl-editar:hover { background: var(--rubor); border-color: var(--pink-line); transform: translateY(-2px); }
.acl-editar svg { color: var(--pink-deep); }
.acl-accion--publicar { background: var(--pink); border-color: var(--pink); color: #fff; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); }
.acl-accion--publicar:hover { background: var(--pink-mid); border-color: var(--pink-mid); transform: translateY(-2px); }
.acl-icono {
  width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  border: 1.5px solid var(--linea); background: #fff; color: var(--muted); transition: background .2s, color .2s, border-color .2s, transform .3s var(--curva);
}
.acl-icono:hover { background: var(--rubor); color: var(--pink-deep); border-color: var(--pink-line); transform: scale(1.06); }
.acl-icono.es-activo { color: var(--melocoton-deep); background: #FFEBDF; border-color: #FFD6C2; }
.acl-guardado {
  display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 99px;
  font-size: 12.5px; font-weight: 800; color: var(--salvia-deep); background: var(--salvia);
}

@media (max-width: 1180px) {
  .acl-card-cuerpo { grid-template-columns: 190px minmax(0, 1fr); }
  .acl-acciones { grid-column: 1 / -1; flex-direction: row; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid var(--linea); }
}
@media (max-width: 640px) {
  .acl-card { border-radius: 24px; }
  .acl-card-cuerpo { grid-template-columns: minmax(0, 1fr); gap: 14px; padding: 12px 12px 16px; }
  .acl-titulo-clase { white-space: normal; font-size: 19px; }
  .acl-info { padding: 0 4px; }
  .acl-acciones { flex-wrap: wrap; gap: 10px; }
  .acl-listo-txt { white-space: normal; }
}
@media (prefers-reduced-motion: reduce) {
  .acl-chip--pub .acl-punto, .acl-card { animation: none; }
  .acl-card:hover { transform: none; }
}
`;
