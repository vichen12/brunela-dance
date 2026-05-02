import { deleteVideoAction, upsertVideoAction } from "@/src/features/admin/actions";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type AudioTrack = { locale: string; track_id: string; label: string };

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
  audio_tracks: AudioTrack[];
  is_featured: boolean;
};

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
  corps_de_ballet: { bg: "#fdf2f8", color: "#9d174d", label: "Corps" },
  solista:         { bg: "#fce7f3", color: "#be185d", label: "Solista" },
  principal:       { bg: "#1c1917", color: "#fdf2f8", label: "Principal" },
};

const LOCALE_FLAGS: Record<string, string> = { es: "ES", en: "EN", pt: "PT" };

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

function VideoForm({ video }: { video?: VideoRecord }) {
  const isNew = !video;
  const trackEs = video?.audio_tracks?.find((t) => t.locale === "es")?.track_id ?? "";
  const trackEn = video?.audio_tracks?.find((t) => t.locale === "en")?.track_id ?? "";
  const trackPt = video?.audio_tracks?.find((t) => t.locale === "pt")?.track_id ?? "";

  return (
    <form action={upsertVideoAction}>
      <input name="id" type="hidden" value={video?.id ?? ""} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <F label="Slug">
          <input style={inp} defaultValue={video?.slug ?? ""} name="slug" required placeholder="ballet-centro-basico" />
        </F>
        <F label="Estado">
          <select style={sel} defaultValue={video?.status ?? "draft"} name="status">
            <option value="draft">Borrador</option>
            <option value="published">Publicado</option>
            <option value="archived">Archivado</option>
          </select>
        </F>

        <F label="Titulo en Espanol">
          <input style={inp} defaultValue={video?.title_i18n?.es ?? ""} name="titleEs" required placeholder="Ballet centro basico" />
        </F>
        <F label="Titulo en Ingles">
          <input style={inp} defaultValue={video?.title_i18n?.en ?? ""} name="titleEn" placeholder="Basic ballet center" />
        </F>

        <F label="Duracion (segundos)">
          <input style={inp} defaultValue={video?.duration_seconds ?? 900} min={1} name="durationSeconds" required type="number" />
        </F>
        <F label="Tier requerido">
          <select style={sel} defaultValue={video?.membership_tier_required ?? "corps_de_ballet"} name="membershipTierRequired">
            <option value="corps_de_ballet">Corps de Ballet</option>
            <option value="solista">Solista</option>
            <option value="principal">Principal</option>
          </select>
        </F>

        <F label="Categorias (coma separada)">
          <input style={inp} defaultValue={video?.category_slugs?.join(", ") ?? ""} name="categories" placeholder="ballet, reformer" />
        </F>
        <F label="Materiales (coma separada)">
          <input style={inp} defaultValue={video?.equipment?.join(", ") ?? ""} name="equipment" placeholder="colchoneta, banda elastica" />
        </F>

        <F label="Thumbnail URL">
          <input style={inp} defaultValue={video?.thumbnail_url ?? ""} name="thumbnailUrl" placeholder="https://..." type="url" />
        </F>
        <F label="Mux Playback ID">
          <input style={inp} defaultValue={video?.stream_playback_id ?? ""} name="streamPlaybackId" placeholder="xxxxxxxxxxxxxxxx" />
        </F>

        <F label="Mux Asset ID">
          <input style={inp} defaultValue={video?.stream_asset_id ?? ""} name="streamAssetId" placeholder="xxxxxxxxxxxxxxxx" />
        </F>
        <div style={{ display: "flex", alignItems: "center", paddingTop: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input defaultChecked={video?.is_featured ?? false} name="isFeatured" type="checkbox" style={{ width: 16, height: 16, accentColor: "#be185d" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#44403c" }}>Destacar este video</span>
          </label>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <F label="Descripcion en Espanol">
          <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} defaultValue={video?.description_i18n?.es ?? ""} name="descriptionEs" required placeholder="Descripcion de la clase..." />
        </F>
        <F label="Descripcion en Ingles">
          <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} defaultValue={video?.description_i18n?.en ?? ""} name="descriptionEn" placeholder="Class description..." />
        </F>
      </div>

      <div style={{ marginTop: 14, borderRadius: 12, padding: "16px 18px", background: "#fafaf9", border: "1px solid #f0eeec" }}>
        <Lbl>Pistas de audio por idioma</Lbl>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 8 }}>
          {[
            { flag: "ES", label: "Espanol", value: trackEs, name: "audioTrackEs" },
            { flag: "EN", label: "Ingles",  value: trackEn, name: "audioTrackEn" },
            { flag: "PT", label: "Portugues", value: trackPt, name: "audioTrackPt" },
          ].map((t) => (
            <label key={t.flag} style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#78716c", marginBottom: 5 }}>{t.flag} {t.label}</span>
              <input style={{ ...inp, fontSize: 12 }} defaultValue={t.value} name={t.name} placeholder="Mux Audio Track ID" />
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
        <button type="submit" style={{
          background: isNew ? "linear-gradient(135deg, #db2777, #be185d)" : "#1c1917",
          color: "#fff", border: "none", borderRadius: 99,
          padding: "10px 24px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
          cursor: "pointer",
        }}>
          {isNew ? "CREAR VIDEO" : "GUARDAR CAMBIOS"}
        </button>
        {!isNew && (
          <form action={deleteVideoAction} style={{ display: "inline" }}>
            <input name="id" type="hidden" value={video.id} />
            <button type="submit" style={{
              background: "transparent", color: "#ef4444", border: "1px solid #fecaca",
              borderRadius: 99, padding: "10px 22px", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.1em", cursor: "pointer",
            }}>ELIMINAR</button>
          </form>
        )}
      </div>
    </form>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function AdminVideosPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;

  const { data } = await supabase
    .from("videos")
    .select("id, slug, title_i18n, description_i18n, status, membership_tier_required, duration_seconds, category_slugs, equipment, thumbnail_url, stream_playback_id, stream_asset_id, audio_tracks, is_featured")
    .order("created_at", { ascending: false });

  const videos = (data ?? []) as VideoRecord[];
  const published = videos.filter((v) => v.status === "published").length;
  const drafts = videos.filter((v) => v.status === "draft").length;

  return (
    <main style={{ fontFamily: "inherit" }}>
      <Flash message={success} tone="success" />
      <Flash message={error} tone="error" />

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { value: videos.length, label: "Total",        sub: "en el catalogo" },
          { value: published,     label: "Publicados",   sub: "visibles a alumnas" },
          { value: drafts,        label: "Borradores",   sub: "sin publicar" },
        ].map((s) => (
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
            background: "linear-gradient(135deg, #db2777, #be185d)",
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
          <VideoForm />
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
              const hasMux = !!(video.stream_playback_id || video.stream_asset_id);
              const audioLocales = (video.audio_tracks ?? []).map((t) => t.locale);
              const durMin = Math.floor(video.duration_seconds / 60);

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
                      background: "linear-gradient(145deg, #fce7f3, #f9a8d4)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {video.thumbnail_url ? (
                        <img src={video.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                          <polygon points="7,4 16,10 7,16" fill="rgba(190,24,93,0.5)" />
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
                        {hasMux && <span style={{ color: "#059669", fontWeight: 600 }}>Mux OK</span>}
                        {audioLocales.length > 0 && (
                          <span style={{ color: "#7c3aed", fontWeight: 600 }}>Audio: {audioLocales.map((l) => LOCALE_FLAGS[l] ?? l).join(" · ")}</span>
                        )}
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div style={{ display: "flex", gap: 5, flexShrink: 0, alignItems: "center" }}>
                      {video.status !== "published" && (
                        <form action={quickStatusAction}>
                          <input type="hidden" name="id" value={video.id} />
                          <input type="hidden" name="status" value="published" />
                          <button type="submit" style={{
                            fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 99,
                            background: "#dcfce7", color: "#166534", border: "none", cursor: "pointer",
                          }}>Publicar</button>
                        </form>
                      )}
                      {video.status !== "archived" && (
                        <form action={quickStatusAction}>
                          <input type="hidden" name="id" value={video.id} />
                          <input type="hidden" name="status" value="archived" />
                          <button type="submit" style={{
                            fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 99,
                            background: "#f1f5f9", color: "#64748b", border: "none", cursor: "pointer",
                          }}>Archivar</button>
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
