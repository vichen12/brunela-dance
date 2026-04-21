import { deleteVideoAction, upsertVideoAction } from "@/src/features/admin/actions";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

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

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  published: { bg: "rgba(209,250,229,0.8)", color: "#065f46", label: "Publicado" },
  draft:     { bg: "rgba(254,249,195,0.8)", color: "#854d0e", label: "Borrador" },
  archived:  { bg: "rgba(241,245,249,0.8)", color: "#475569", label: "Archivado" },
};

const TIER_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  corps_de_ballet: { bg: "#F5E4E0", color: "#8C5A55", label: "Corps de Ballet" },
  solista:         { bg: "#DFC0BB", color: "#5C2E29", label: "Solista" },
  principal:       { bg: "#1C1618", color: "#FDF8F6", label: "Principal" },
};

const LOCALE_FLAGS: Record<string, string> = { es: "ES", en: "EN", pt: "PT" };

function Flash({ message, tone }: { message: string | null; tone: "success" | "error" }) {
  if (!message) return null;
  return (
    <div style={{
      borderRadius: 16, padding: "14px 20px", fontSize: 13, fontWeight: 600,
      background: tone === "success" ? "rgba(209,250,229,0.9)" : "rgba(254,226,226,0.9)",
      color: tone === "success" ? "#065f46" : "#991b1b",
      border: `1px solid ${tone === "success" ? "rgba(52,211,153,0.4)" : "rgba(252,165,165,0.5)"}`,
      backdropFilter: "blur(8px)",
    }}>{message}</div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 8.5, letterSpacing: "0.22em", fontWeight: 700, color: "#B8857F",
      marginBottom: 18, textTransform: "uppercase",
    }}>{children}</div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", color: "#6B5C58", textTransform: "uppercase" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", borderRadius: 12,
  border: "1.5px solid rgba(220,192,187,0.5)",
  background: "rgba(255,255,255,0.8)",
  color: "#1C1618", padding: "10px 14px",
  fontSize: 13, outline: "none",
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  backdropFilter: "blur(4px)",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23B8857F' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' fill='none'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 14px center",
  paddingRight: 36,
};

function VideoForm({ video }: { video?: VideoRecord }) {
  const isNew = !video;
  const trackEs = video?.audio_tracks?.find((t) => t.locale === "es")?.track_id ?? "";
  const trackEn = video?.audio_tracks?.find((t) => t.locale === "en")?.track_id ?? "";
  const trackPt = video?.audio_tracks?.find((t) => t.locale === "pt")?.track_id ?? "";

  return (
    <form action={upsertVideoAction}>
      <input name="id" type="hidden" value={video?.id ?? ""} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Col 1 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Slug">
            <input style={inputStyle} defaultValue={video?.slug ?? ""} name="slug" required placeholder="ballet-centro-basico" />
          </Field>

          <Field label="Titulo en Espanol">
            <input style={inputStyle} defaultValue={video?.title_i18n?.es ?? ""} name="titleEs" required placeholder="Ballet centro basico" />
          </Field>

          <Field label="Titulo en Ingles">
            <input style={inputStyle} defaultValue={video?.title_i18n?.en ?? ""} name="titleEn" placeholder="Basic ballet center" />
          </Field>

          <Field label="Duracion (segundos)">
            <input style={inputStyle} defaultValue={video?.duration_seconds ?? 900} min={1} name="durationSeconds" required type="number" />
          </Field>

          <Field label="Categorias (coma separada)">
            <input style={inputStyle} defaultValue={video?.category_slugs?.join(", ") ?? ""} name="categories" placeholder="ballet, reformer" />
          </Field>

          <Field label="Materiales (coma separada)">
            <input style={inputStyle} defaultValue={video?.equipment?.join(", ") ?? ""} name="equipment" placeholder="colchoneta, banda elastica" />
          </Field>
        </div>

        {/* Col 2 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Tier requerido">
            <select style={selectStyle} defaultValue={video?.membership_tier_required ?? "corps_de_ballet"} name="membershipTierRequired">
              <option value="corps_de_ballet">Corps de Ballet</option>
              <option value="solista">Solista</option>
              <option value="principal">Principal</option>
            </select>
          </Field>

          <Field label="Estado">
            <select style={selectStyle} defaultValue={video?.status ?? "draft"} name="status">
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
              <option value="archived">Archivado</option>
            </select>
          </Field>

          <Field label="Thumbnail URL">
            <input style={inputStyle} defaultValue={video?.thumbnail_url ?? ""} name="thumbnailUrl" placeholder="https://..." type="url" />
          </Field>

          <Field label="Mux Playback ID">
            <input style={inputStyle} defaultValue={video?.stream_playback_id ?? ""} name="streamPlaybackId" placeholder="xxxxxxxxxxxxxxxx" />
          </Field>

          <Field label="Mux Asset ID">
            <input style={inputStyle} defaultValue={video?.stream_asset_id ?? ""} name="streamAssetId" placeholder="xxxxxxxxxxxxxxxx" />
          </Field>

          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginTop: 4 }}>
            <input
              defaultChecked={video?.is_featured ?? false}
              name="isFeatured"
              type="checkbox"
              style={{ width: 16, height: 16, accentColor: "#B8857F" }}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#4A3C3A" }}>Destacar este video</span>
          </label>
        </div>
      </div>

      {/* Descripciones */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <Field label="Descripcion en Espanol">
          <textarea
            style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
            defaultValue={video?.description_i18n?.es ?? ""}
            name="descriptionEs"
            required
            placeholder="Descripcion de la clase..."
          />
        </Field>
        <Field label="Descripcion en Ingles">
          <textarea
            style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
            defaultValue={video?.description_i18n?.en ?? ""}
            name="descriptionEn"
            placeholder="Class description..."
          />
        </Field>
      </div>

      {/* Pistas de audio */}
      <div style={{
        marginTop: 20, borderRadius: 16, padding: "18px 20px",
        background: "rgba(245,228,224,0.25)",
        border: "1.5px solid rgba(220,192,187,0.4)",
      }}>
        <div style={{ fontSize: 9, letterSpacing: "0.2em", fontWeight: 700, color: "#B8857F", marginBottom: 14 }}>
          PISTAS DE AUDIO POR IDIOMA
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {[
            { locale: "es", label: "Espanol (ES)", value: trackEs, name: "audioTrackEs", flag: "🇪🇸" },
            { locale: "en", label: "Ingles (EN)", value: trackEn, name: "audioTrackEn", flag: "🇬🇧" },
            { locale: "pt", label: "Portugues (PT)", value: trackPt, name: "audioTrackPt", flag: "🇧🇷" },
          ].map((track) => (
            <label key={track.locale} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", color: "#6B5C58" }}>
                {track.flag} {track.label}
              </span>
              <input
                style={{ ...inputStyle, fontSize: 12 }}
                defaultValue={track.value}
                name={track.name}
                placeholder="Mux Audio Track ID"
              />
            </label>
          ))}
        </div>
        <p style={{ fontSize: 10.5, color: "#B0A09C", marginTop: 10 }}>
          ID de pista de audio de Mux. Deja en blanco si el idioma no esta disponible.
        </p>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button
          type="submit"
          style={{
            background: isNew ? "linear-gradient(135deg, #C49490, #B8857F)" : "linear-gradient(135deg, #2A1E22, #1C1618)",
            color: "#FDF8F6", border: "none", borderRadius: 99,
            padding: "11px 28px", fontSize: 9, letterSpacing: "0.16em", fontWeight: 700,
            cursor: "pointer", boxShadow: isNew ? "0 4px 14px rgba(184,133,127,0.4)" : "0 4px 14px rgba(28,22,24,0.3)",
          }}
        >
          {isNew ? "CREAR VIDEO" : "GUARDAR CAMBIOS"}
        </button>

        {!isNew && (
          <form action={deleteVideoAction} style={{ display: "inline" }}>
            <input name="id" type="hidden" value={video.id} />
            <button
              type="submit"
              style={{
                background: "transparent", color: "#C49490",
                border: "1.5px solid rgba(220,192,187,0.6)",
                borderRadius: 99, padding: "11px 22px",
                fontSize: 9, letterSpacing: "0.14em", fontWeight: 700, cursor: "pointer",
              }}
            >
              ELIMINAR
            </button>
          </form>
        )}
      </div>
    </form>
  );
}

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
    <main style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>

      {/* Header hero */}
      <div style={{
        borderRadius: 24, marginBottom: 24,
        background: "linear-gradient(135deg, #F7E2DC 0%, #E8C4BC 60%, #D4A8A0 100%)",
        padding: "36px 40px", position: "relative", overflow: "hidden",
        boxShadow: "0 8px 32px rgba(180,120,110,0.18)",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to right, rgba(253,248,246,0.9) 50%, transparent)",
        }}/>
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 8.5, letterSpacing: "0.22em", color: "#B8857F", fontWeight: 700, marginBottom: 10 }}>
            PANEL DE ADMINISTRACION
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "0.04em", color: "#1C1618", marginBottom: 8 }}>
            Gestion de Videos
          </div>
          <div style={{ fontSize: 12.5, color: "#8A7470", lineHeight: 1.6 }}>
            Crea, edita y publica videos con titulos multi-idioma, pistas de audio y control de acceso por tier.
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
            {[
              { value: String(videos.length), label: "Total" },
              { value: String(published), label: "Publicados" },
              { value: String(drafts), label: "Borradores" },
            ].map((s) => (
              <div key={s.label} style={{
                background: "rgba(255,255,255,0.6)", backdropFilter: "blur(8px)",
                borderRadius: 14, padding: "10px 18px",
                border: "1px solid rgba(220,192,187,0.4)",
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1C1618", letterSpacing: "-0.02em" }}>{s.value}</div>
                <div style={{ fontSize: 8, letterSpacing: "0.14em", color: "#B8857F", fontWeight: 700 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Flash messages */}
      {(success || error) && (
        <div style={{ marginBottom: 20 }}>
          <Flash message={success} tone="success" />
          <Flash message={error} tone="error" />
        </div>
      )}

      {/* Create new video */}
      <div style={{
        background: "rgba(255,255,255,0.88)", backdropFilter: "blur(14px)",
        borderRadius: 24, padding: "28px 32px", marginBottom: 20,
        border: "1px solid rgba(220,192,187,0.35)",
        boxShadow: "0 4px 24px rgba(28,22,24,0.06)",
      }}>
        <SectionLabel>Nuevo video</SectionLabel>
        <VideoForm />
      </div>

      {/* Video list */}
      <div style={{
        background: "rgba(255,255,255,0.88)", backdropFilter: "blur(14px)",
        borderRadius: 24, padding: "28px 32px",
        border: "1px solid rgba(220,192,187,0.35)",
        boxShadow: "0 4px 24px rgba(28,22,24,0.06)",
      }}>
        <SectionLabel>Videos existentes — {videos.length}</SectionLabel>

        {videos.length === 0 ? (
          <div style={{
            border: "1.5px dashed rgba(220,192,187,0.6)", borderRadius: 18,
            padding: "28px 24px", fontSize: 13, color: "#A89490", textAlign: "center",
          }}>
            No hay videos todavia. Crea el primero arriba.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {videos.map((video) => {
              const status = STATUS_STYLE[video.status] ?? STATUS_STYLE.draft;
              const tier = TIER_STYLE[video.membership_tier_required] ?? TIER_STYLE.corps_de_ballet;
              const hasMux = !!(video.stream_playback_id || video.stream_asset_id);
              const audioLocales = (video.audio_tracks ?? []).map((t) => t.locale);

              return (
                <div key={video.id} style={{
                  borderRadius: 20, border: "1px solid rgba(220,192,187,0.3)",
                  background: "rgba(253,248,246,0.6)", overflow: "hidden",
                }}>
                  {/* Video header */}
                  <div style={{
                    display: "flex", alignItems: "flex-start", gap: 16,
                    padding: "18px 22px", borderBottom: "1px solid rgba(220,192,187,0.2)",
                    background: "rgba(255,255,255,0.5)",
                  }}>
                    {/* Thumb placeholder */}
                    <div style={{
                      width: 80, height: 52, borderRadius: 10, flexShrink: 0, overflow: "hidden",
                      background: "linear-gradient(145deg, #F0DDD9, #C9938E)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {video.thumbnail_url ? (
                        <img src={video.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <polygon points="7,4 16,10 7,16" fill="rgba(253,248,246,0.8)" />
                        </svg>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#1C1618" }}>
                          {video.title_i18n.es ?? video.slug}
                        </span>
                        <span style={{
                          fontSize: 7.5, letterSpacing: "0.14em", fontWeight: 700,
                          background: status.bg, color: status.color,
                          padding: "3px 9px", borderRadius: 99,
                        }}>{status.label}</span>
                        <span style={{
                          fontSize: 7.5, letterSpacing: "0.14em", fontWeight: 700,
                          background: tier.bg, color: tier.color,
                          padding: "3px 9px", borderRadius: 99,
                        }}>{tier.label}</span>
                        {video.is_featured && (
                          <span style={{
                            fontSize: 7.5, letterSpacing: "0.14em", fontWeight: 700,
                            background: "rgba(254,243,199,0.9)", color: "#92400e",
                            padding: "3px 9px", borderRadius: 99,
                          }}>Destacado</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#A89490", display: "flex", gap: 14, flexWrap: "wrap" }}>
                        <span>/{video.slug}</span>
                        <span>{Math.floor(video.duration_seconds / 60)} min</span>
                        {video.category_slugs?.length > 0 && (
                          <span>{video.category_slugs.join(", ")}</span>
                        )}
                        {hasMux && (
                          <span style={{ color: "#059669", fontWeight: 600 }}>Mux OK</span>
                        )}
                        {audioLocales.length > 0 && (
                          <span style={{ color: "#7C3AED", fontWeight: 600 }}>
                            Audio: {audioLocales.map((l) => LOCALE_FLAGS[l] ?? l).join(" · ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Form */}
                  <div style={{ padding: "20px 22px" }}>
                    <VideoForm video={video} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
