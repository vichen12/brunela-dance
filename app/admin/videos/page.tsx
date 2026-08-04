import { deleteVideoAction, requeueMuxJobAction, upsertVideoAction } from "@/src/features/admin/actions";
import { BotonEnviar } from "@/components/boton-enviar";
import { AdminVideoUpload } from "@/components/admin-video-upload";
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
  duration_seconds: number;
  category_slugs: string[];
  equipment: string[];
  thumbnail_url: string | null;
  stream_playback_id: string | null;
  stream_asset_id: string | null;
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

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  published: { bg: "#dcfce7", color: "#166534", label: "Publicado" },
  draft:     { bg: "#fef9c3", color: "#854d0e", label: "Borrador" },
  archived:  { bg: "#f1f5f9", color: "#475569", label: "Archivado" },
};

const TIER_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  corps_de_ballet: { bg: "var(--pink-wash)", color: "var(--pink-deep)", label: "Corps" },
  solista:         { bg: "var(--pink-soft)", color: "var(--pink-deep)", label: "Solista" },
  principal:       { bg: "#1c1917", color: "var(--pink-wash)", label: "Principal" },
};

const LOCALE_FLAGS: Record<string, string> = { es: "ES", en: "EN", fr: "FR", it: "IT" };

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

// ── Video form ─────────────────────────────────────────────────────────────────

/**
 * Editor de una clase YA EXISTENTE.
 *
 * Crear una clase se hace solo desde AdminVideoUpload, que sube el archivo. Este
 * formulario tenia tambien modo creacion, y convivian dos maneras de dar de alta
 * una clase: Brunela veia las dos y no tenia como saber cual usar -- y la de
 * aca creaba una clase SIN video.
 */
function VideoForm({ video }: { video: VideoRecord }) {
  // Read-only: audio_tracks is owned by the mux worker, not by this form.
  const muxedLocales = (video.audio_tracks ?? []).map((t) => t.locale);

  return (
    <form action={upsertVideoAction}>
      <input name="id" type="hidden" value={video.id} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <F label="Dirección">
          {/* Solo lectura: cambiar el slug de una clase publicada rompe
              cualquier enlace que alguien haya guardado o compartido. Se muestra
              porque es la direccion de esa clase y a Brunela le sirve verla. */}
          <input style={{ ...inp, background: "#fafaf9", color: "#78716c" }} defaultValue={video.slug} name="slug" readOnly />
        </F>
        <F label="Estado">
          <select style={sel} defaultValue={video.status} name="status">
            <option value="draft">Borrador</option>
            <option value="published">Publicado</option>
            <option value="archived">Archivado</option>
          </select>
        </F>

        <F label="Título en español">
          <input style={inp} defaultValue={video.title_i18n?.es ?? ""} name="titleEs" required placeholder="Ballet centro basico" />
        </F>
        <F label="Título en inglés">
          <input style={inp} defaultValue={video.title_i18n?.en ?? ""} name="titleEn" placeholder="Basic ballet center" />
        </F>

        <F label="Duración (minutos)">
          {/* En minutos, que es como piensa una clase quien la da. La conversion
              a segundos se hace en la accion: la base sigue guardando segundos. */}
          <input style={inp} defaultValue={Math.round(video.duration_seconds / 60)} min={1} name="durationMinutes" required type="number" />
        </F>
        <F label="Plan que la puede ver">
          <select style={sel} defaultValue={video.membership_tier_required} name="membershipTierRequired">
            <option value="corps_de_ballet">Corps de Ballet</option>
            <option value="solista">Solista</option>
            <option value="principal">Principal</option>
          </select>
        </F>

        <F label="Categorías">
          <input style={inp} defaultValue={video.category_slugs?.join(", ") ?? ""} name="categories" placeholder="ballet, reformer" />
        </F>
        <F label="Materiales">
          <input style={inp} defaultValue={video.equipment?.join(", ") ?? ""} name="equipment" placeholder="colchoneta, banda elastica" />
        </F>

        <F label="Imagen de portada">
          <input style={inp} defaultValue={video.thumbnail_url ?? ""} name="thumbnailUrl" placeholder="https://..." type="url" />
        </F>
        {/* Los campos "Mux Playback ID" y "Mux Asset ID" salieron el 2026-08-03:
            Mux fue reemplazado por Bunny, y esos valores los escribe sola la ruta
            de finalizacion de subida. Editarlos a mano solo podia romper la
            reproduccion.

            OJO: stream_playback_id NO es basura -- Bunny lo escribe con la URL
            del HLS y el proxy de video lo usa como respaldo para las clases
            viejas. Lo que se saco es el CAMPO del formulario, no la columna. */}
        <div style={{ display: "flex", alignItems: "center", paddingTop: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input defaultChecked={video.is_featured} name="isFeatured" type="checkbox" style={{ width: 16, height: 16, accentColor: "var(--pink-mid)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#44403c" }}>Destacar este video</span>
          </label>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <F label="Descripción en español">
          <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} defaultValue={video?.description_i18n?.es ?? ""} name="descriptionEs" required placeholder="Descripción de la clase…" />
        </F>
        <F label="Descripción en inglés">
          <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} defaultValue={video?.description_i18n?.en ?? ""} name="descriptionEn" placeholder="Class description..." />
        </F>
      </div>

      <div style={{ marginTop: 14, borderRadius: 12, padding: "16px 18px", background: "#fafaf9", border: "1px solid #f0eeec" }}>
        <Lbl>Pistas de audio por idioma</Lbl>
        <div style={{ fontSize: 11, color: "#78716c", marginTop: 8, lineHeight: 1.7 }}>
          {muxedLocales.length > 0 ? (
            <>
              Idiomas ya integrados en el video:{" "}
              <strong style={{ color: "#1c1917" }}>
                {["es", ...muxedLocales].join(", ").toUpperCase()}
              </strong>
            </>
          ) : (
            <>Solo espanol. Los idiomas extra se cargan al subir la clase, como un mp3 por idioma.</>
          )}
          <div style={{ marginTop: 6, color: "#a8a29e" }}>
            Esto no se edita a mano: el worker de muxeo lo escribe cuando verifica que el
            idioma quedo dentro del video.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
        <BotonEnviar style={{
          background: "#1c1917",
          color: "#fff", border: "none", borderRadius: 99,
          padding: "10px 24px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
          cursor: "pointer",
        }}>GUARDAR CAMBIOS</BotonEnviar>
        {/* formAction en el boton, NO un <form> adentro de otro <form>.
            Los formularios anidados son HTML invalido: el parser descarta el
            interno, asi que el boton quedaba como submit del formulario de
            arriba y ELIMINAR terminaba llamando a upsertVideoAction. O sea que
            no borraba: guardaba. El id ya viaja en el hidden del form externo,
            que es el que deleteVideoAction lee. */}
        {(
          <BotonEnviar pendingLabel="Borrando…" formAction={deleteVideoAction} style={{
            background: "transparent", color: "#ef4444", border: "1px solid #fecaca",
            borderRadius: 99, padding: "10px 22px", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.1em", cursor: "pointer",
          }}>ELIMINAR</BotonEnviar>
        )}
      </div>
    </form>
  );
}

// ── Upload form (real Bunny upload: video file + audio file per language) ────────

function UploadForm({ bunnyReady }: { bunnyReady: boolean }) {
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

  return <AdminVideoUpload />;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function AdminVideosPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;
  const bunnyReady = hasBunnyStreamEnv();

  const [{ data }, { data: jobData }] = await Promise.all([
    supabase
      .from("videos")
      .select("id, slug, title_i18n, description_i18n, status, membership_tier_required, duration_seconds, category_slugs, equipment, thumbnail_url, stream_playback_id, stream_asset_id, bunny_video_id, audio_tracks, is_featured")
      .order("created_at", { ascending: false }),
    supabase
      .from("video_mux_jobs")
      .select("id, video_id, status, attempts, last_error, expected_locales, created_at, claimed_at")
      .order("created_at", { ascending: false })
  ]);

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

  return (
    <main style={{ fontFamily: "inherit" }}>
      <header className="hero-stage">
        <p className="eyebrow">Gestión de contenido</p>
        <h1 className="display mt-5 text-5xl leading-none md:text-6xl">Clases.</h1>
        <p className="mt-5 max-w-xl text-base leading-8 text-[color:var(--ink-soft)]">
          Subí, editá y publicá las clases del estudio, con su video, sus pistas de audio y el plan que las habilita.
        </p>
      </header>

      <Flash message={success} tone="success" />
      <Flash message={error} tone="error" />

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 12, marginBottom: 24 }}>
        {stats.map((s) => (
          <div key={s.label} style={{
            background: "#fff", border: "1px solid #f0eeec", borderRadius: 16, padding: "20px 22px",
          }}>
            <p style={{ fontSize: 30, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.02em", lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#44403c", marginTop: 6 }}>{s.label}</p>
            <p style={{ fontSize: 11, color: "#a8a29e", marginTop: 2 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* New video form — collapsed by default */}
      <details style={{ marginBottom: 16 }}>
        <summary style={{
          listStyle: "none", cursor: "pointer",
          background: "#fff", border: "1px solid #f0eeec", borderRadius: 14,
          padding: "14px 20px", display: "flex", alignItems: "center", gap: 10,
          fontSize: 13, fontWeight: 700, color: "#1c1917", userSelect: "none",
        }}>
          <span style={{
            width: 24, height: 24, borderRadius: 8,
            background: "linear-gradient(135deg, var(--pink), var(--pink-mid))",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 16, fontWeight: 800, flexShrink: 0,
          }}>+</span>
          Nuevo video
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#a8a29e", fontWeight: 500 }}>Clic para desplegar formulario</span>
        </summary>
        <div style={{
          background: "#fff", border: "1px solid #f0eeec", borderTop: "none",
          borderRadius: "0 0 14px 14px", padding: "24px 22px",
        }}>
          <UploadForm bunnyReady={bunnyReady} />
        </div>
      </details>

      {/* Video list */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "#a8a29e", textTransform: "uppercase", marginBottom: 12 }}>
          Videos — {videos.length}
        </p>
        {videos.length === 0 ? (
          <div style={{
            background: "#fff", border: "1.5px dashed #f0eeec", borderRadius: 16,
            padding: "40px 24px", textAlign: "center", color: "#a8a29e", fontSize: 13,
          }}>
            No hay videos todavia. Crea el primero arriba.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {videos.map((video) => {
              const st = STATUS_STYLE[video.status] ?? STATUS_STYLE.draft;
              const tier = TIER_STYLE[video.membership_tier_required] ?? TIER_STYLE.corps_de_ballet;
              // El nombre viejo era hasMux y el badge decia "Mux OK": nombraba al
              // proveedor en vez de responder lo unico que importa mirando la lista,
              // que es si esa clase ya se puede ver.
              const tieneVideo = !!(video.bunny_video_id || video.stream_playback_id);
              // Spanish always rides inside the video file, so it is never in
              // audio_tracks -- but it IS a language the class plays in.
              const audioLocales = (video.audio_tracks ?? []).map((t) => t.locale);
              const allLocales = audioLocales.length > 0 ? ["es", ...audioLocales] : [];
              const durMin = Math.floor(video.duration_seconds / 60);
              const job = latestJob.get(video.id);

              return (
                <div key={video.id} style={{ background: "#fff", border: "1px solid #f0eeec", borderRadius: 16, overflow: "hidden" }}>

                  {/* Card header — always visible */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 18px",
                  }}>
                    {/* Thumbnail */}
                    <div style={{
                      width: 64, height: 42, borderRadius: 10, flexShrink: 0, overflow: "hidden",
                      background: "linear-gradient(145deg, var(--pink-soft), var(--rose))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {adminThumb(video) ? (
                        <img src={adminThumb(video)!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                          <polygon points="7,4 16,10 7,16" fill="rgba(230, 79, 85,0.5)" />
                        </svg>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#1c1917" }}>
                          {video.title_i18n.es ?? video.slug}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: st.bg, color: st.color }}>{st.label}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: tier.bg, color: tier.color }}>{tier.label}</span>
                        {video.is_featured && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "#fef9c3", color: "#854d0e" }}>Destacado</span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#a8a29e", flexWrap: "wrap" }}>
                        <span>/{video.slug}</span>
                        <span>{durMin} min</span>
                        {video.category_slugs?.length > 0 && <span>{video.category_slugs.join(", ")}</span>}
                        {tieneVideo && <span style={{ color: "#059669", fontWeight: 600 }}>Video listo</span>}
                        {allLocales.length > 0 && (
                          <span style={{ color: "#7c3aed", fontWeight: 600 }}>Audio: {allLocales.map((l) => LOCALE_FLAGS[l] ?? l).join(" · ")}</span>
                        )}
                        {/* Solo en clases PUBLICADAS: una en borrador no tiene
                            por que tener uso, y marcarla seria ruido. */}
                        {mostrarUso && video.status === "published" && (() => {
                          const n = alumnasPorClase.get(video.id)?.size ?? 0;
                          return n === 0 ? (
                            <span style={{ color: "var(--pink-deep)", fontWeight: 700 }}>
                              No la empezó nadie
                            </span>
                          ) : (
                            <span>La empezaron {n}</span>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div style={{ display: "flex", gap: 5, flexShrink: 0, alignItems: "center" }}>
                      {video.status !== "published" && (
                        <form action={quickStatusAction}>
                          <input type="hidden" name="id" value={video.id} />
                          <input type="hidden" name="status" value="published" />
                          <BotonEnviar style={{
                            fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 99,
                            background: "#dcfce7", color: "#166534", border: "none", cursor: "pointer",
                          }}>Publicar</BotonEnviar>
                        </form>
                      )}
                      {video.status !== "archived" && (
                        <form action={quickStatusAction}>
                          <input type="hidden" name="id" value={video.id} />
                          <input type="hidden" name="status" value="archived" />
                          <BotonEnviar style={{
                            fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 99,
                            background: "#f1f5f9", color: "#64748b", border: "none", cursor: "pointer",
                          }}>Archivar</BotonEnviar>
                        </form>
                      )}
                      <form action={quickFeaturedAction}>
                        <input type="hidden" name="id" value={video.id} />
                        <input type="hidden" name="current" value={String(video.is_featured)} />
                        <button type="submit" style={{
                          fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 99,
                          background: video.is_featured ? "#fef9c3" : "#f9fafb",
                          color: video.is_featured ? "#854d0e" : "#6b7280",
                          border: "none", cursor: "pointer",
                        }}>{video.is_featured ? "Quitar destaque" : "Destacar"}</button>
                      </form>
                    </div>
                  </div>

                  {/* Mux state — only while there is something to act on */}
                  {job && job.status !== "done" && <MuxStatus job={job} />}

                  {/* Collapsible edit form */}
                  <details>
                    <summary style={{
                      listStyle: "none", cursor: "pointer",
                      padding: "9px 18px", fontSize: 11, fontWeight: 600, color: "#a8a29e",
                      borderTop: "1px solid #f9f7f6",
                      userSelect: "none", display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 4.5h8M2 7.5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      Editar video
                    </summary>
                    <div style={{ padding: "22px 22px", borderTop: "1px solid #f9f7f6" }}>
                      <VideoForm video={video} />
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
