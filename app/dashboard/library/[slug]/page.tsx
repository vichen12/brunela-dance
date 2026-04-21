import Link from "next/link";
import { notFound } from "next/navigation";
import { upsertProgressAction } from "@/src/features/studio/actions";
import {
  formatDurationLabel,
  resolveI18nText,
  safePercent,
  type MembershipTier,
} from "@/src/features/studio/helpers";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type VideoRecord = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  membership_tier_required: MembershipTier;
  duration_seconds: number;
  category_slugs: string[];
  equipment: string[];
  thumbnail_url: string | null;
  stream_playback_id: string | null;
};

type ProgressRecord = {
  last_position_seconds: number;
  max_position_seconds: number;
  completion_percent: number;
};

type ProgramContext = { title_i18n: Record<string, string>; slug: string };

const CAT_GRADIENTS: Record<string, string> = {
  ballet:     "linear-gradient(145deg, #F0DDD9 0%, #C9938E 100%)",
  reformer:   "linear-gradient(145deg, #E8D0CB 0%, #B87870 100%)",
  mat:        "linear-gradient(145deg, #EAD5D0 0%, #C08880 100%)",
  stretching: "linear-gradient(145deg, #E4D4CE 0%, #B89088 100%)",
  pbt:        "linear-gradient(145deg, #DCC8C2 0%, #A87870 100%)",
  pct:        "linear-gradient(145deg, #D8C0BC 0%, #9C6860 100%)",
};

function catGradient(slugs: string[]): string {
  for (const s of slugs) if (CAT_GRADIENTS[s]) return CAT_GRADIENTS[s];
  return "linear-gradient(145deg, #EDE0DB 0%, #C9A8A0 100%)";
}

export default async function VideoDetailPage({ params, searchParams }: { params: Params; searchParams?: SearchParams }) {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const success = typeof sp.success === "string" ? sp.success : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  const programId = typeof sp.programId === "string" ? sp.programId : "";
  const programDayNumber = typeof sp.day === "string" && sp.day ? Number(sp.day) : null;

  const { data: video, error: videoError } = await supabase
    .from("videos")
    .select("id, slug, title_i18n, description_i18n, membership_tier_required, duration_seconds, category_slugs, equipment, thumbnail_url, stream_playback_id")
    .eq("slug", slug)
    .maybeSingle<VideoRecord>();

  if (videoError || !video) notFound();

  const progressQ = supabase
    .from("user_progress")
    .select("last_position_seconds, max_position_seconds, completion_percent")
    .eq("user_id", user.id)
    .eq("video_id", video.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  const scopedQ = programId ? progressQ.eq("program_id", programId) : progressQ.is("program_id", null);

  const [{ data: progress }, { data: programCtx }, { data: relatedPrograms }] = await Promise.all([
    scopedQ.maybeSingle<ProgressRecord>(),
    programId
      ? supabase.from("programs").select("slug, title_i18n").eq("id", programId).maybeSingle<ProgramContext>()
      : Promise.resolve({ data: null }),
    supabase.from("program_days").select("day_number, programs!inner(slug, title_i18n)").eq("video_id", video.id),
  ]);

  const pct = safePercent(progress?.completion_percent);
  const title = resolveI18nText(video.title_i18n);
  const description = resolveI18nText(video.description_i18n);
  const thumbBg = catGradient(video.category_slugs);
  const totalMin = Math.floor(video.duration_seconds / 60);
  const elapsedSec = progress?.max_position_seconds ?? 0;
  const elapsedMin = Math.floor(elapsedSec / 60);

  return (
    <div style={{
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      background: "linear-gradient(160deg, #FDF8F6 0%, #FAF3F0 60%, #FDF6F4 100%)",
      minHeight: "100vh", overflowY: "auto",
    }}>

      {/* Top bar */}
      <div style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid #EDE0DB", padding: "14px 48px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link href={programCtx ? `/dashboard/programs/${programCtx.slug}` : "/dashboard/library"} style={{
          display: "flex", alignItems: "center", gap: 8, textDecoration: "none",
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="#B8857F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 9, letterSpacing: "0.15em", color: "#B8857F", fontWeight: 700 }}>
            {programCtx ? "PROGRAMA" : "CLASES"}
          </span>
        </Link>
        <span style={{ color: "#DFC0BB", fontSize: 10 }}>›</span>
        <span style={{ fontSize: 9, letterSpacing: "0.1em", color: "#A89490" }}>
          {video.category_slugs[0]?.toUpperCase()} — {title}
        </span>
      </div>

      {success && (
        <div style={{ margin: "16px 48px 0", background: "#DFF0E8", border: "1px solid #4CAF82", borderRadius: 8, padding: "12px 20px", fontSize: 11, color: "#2E7D5E", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke="#2E7D5E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {success}
        </div>
      )}
      {error && (
        <div style={{ margin: "16px 48px 0", background: "#FFF0F0", border: "1px solid #F0A0A0", borderRadius: 8, padding: "12px 20px", fontSize: 11, color: "#8C3A3A" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 0, padding: "32px 48px" }}>

        {/* Main: video area */}
        <div style={{ flex: 1, minWidth: 0, paddingRight: 32 }}>

          {/* Video display */}
          <div style={{
            position: "relative", borderRadius: 22, overflow: "hidden",
            aspectRatio: "16/9", marginBottom: 24,
            background: "#1C1618",
            boxShadow: "0 12px 48px rgba(28,22,24,0.22)",
          }}>
            {video.thumbnail_url ? (
              <img src={video.thumbnail_url} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.7 }}/>
            ) : (
              <div style={{ position: "absolute", inset: 0, background: thumbBg, opacity: 0.5 }}/>
            )}

            {/* Language track pills */}
            <div style={{ position: "absolute", top: 18, right: 18, display: "flex", gap: 6 }}>
              {["ES", "EN"].map((l) => (
                <div key={l} style={{
                  padding: "5px 13px", fontSize: 9, letterSpacing: "0.12em", fontWeight: 700,
                  background: l === "ES" ? "#B8857F" : "rgba(28,22,24,0.55)",
                  color: l === "ES" ? "#FDF8F6" : "rgba(253,248,246,0.6)",
                  border: `1px solid ${l === "ES" ? "#B8857F" : "rgba(253,248,246,0.2)"}`,
                  borderRadius: 20, backdropFilter: "blur(4px)",
                }}>{l}</div>
              ))}
            </div>

            {/* Play button */}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "rgba(253,248,246,0.15)", border: "2px solid rgba(253,248,246,0.85)",
                display: "flex", alignItems: "center", justifyContent: "center",
                backdropFilter: "blur(4px)",
              }}>
                <div style={{ width: 0, height: 0, borderTop: "11px solid transparent", borderBottom: "11px solid transparent", borderLeft: "20px solid rgba(253,248,246,0.9)", marginLeft: 4 }}/>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 16px 14px" }}>
              <div style={{ height: 3, background: "rgba(253,248,246,0.2)", borderRadius: 2 }}>
                <div style={{ height: "100%", background: "#B8857F", width: `${pct}%`, borderRadius: 2 }}/>
              </div>
            </div>

            {/* Time */}
            {elapsedSec > 0 && (
              <div style={{ position: "absolute", bottom: 22, right: 20, fontSize: 9, color: "rgba(253,248,246,0.7)", letterSpacing: "0.06em" }}>
                {elapsedMin}:{String(elapsedSec % 60).padStart(2,"0")} / {totalMin}:00
              </div>
            )}
          </div>

          {/* Video info */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 8.5, letterSpacing: "0.15em", color: "#B8857F", marginBottom: 8 }}>
              {video.category_slugs[0]?.toUpperCase()} · {formatDurationLabel(video.duration_seconds)}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1C1618", letterSpacing: "0.03em", marginBottom: 12, lineHeight: 1.2 }}>
              {title}
            </div>
            <div style={{ fontSize: 12, color: "#8A7470", lineHeight: 1.8, maxWidth: 560 }}>
              {description || "Descripción pendiente en el panel de administración."}
            </div>
          </div>

          {/* Instructor card */}
          <div style={{ background: "rgba(255,255,255,0.88)", borderRadius: 20, padding: "18px 22px", border: "1px solid rgba(220,192,187,0.4)", display: "flex", gap: 14, alignItems: "center", backdropFilter: "blur(12px)", boxShadow: "0 4px 20px rgba(28,22,24,0.05)" }}>
            <div style={{
              width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, #DFC0BB, #B8857F)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 17, fontWeight: 800, color: "#FDF8F6",
            }}>B</div>
            <div>
              <div style={{ fontSize: 8.5, letterSpacing: "0.14em", color: "#C49490", marginBottom: 4 }}>INSTRUCTORA</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1618", letterSpacing: "0.04em" }}>BRUNELA</div>
              <div style={{ fontSize: 10, color: "#8A7470", marginTop: 2 }}>Ballet · PBT · PCT · Pilates — Barcelona</div>
            </div>
            {video.equipment.length > 0 && (
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontSize: 8.5, letterSpacing: "0.1em", color: "#C49490", marginBottom: 4 }}>MATERIALES</div>
                <div style={{ fontSize: 11, color: "#1C1618" }}>{video.equipment.join(", ")}</div>
              </div>
            )}
          </div>

          {programCtx && programDayNumber && (
            <div style={{ marginTop: 16, background: "rgba(245,228,224,0.4)", border: "1px solid rgba(223,192,187,0.6)", borderRadius: 18, padding: "16px 20px", backdropFilter: "blur(8px)" }}>
              <div style={{ fontSize: 8.5, letterSpacing: "0.14em", color: "#B8857F", marginBottom: 6 }}>CONTEXTO DE PROGRAMA</div>
              <div style={{ fontSize: 12, color: "#4A3C3A" }}>
                Estás viendo esta clase como parte de <strong>{resolveI18nText(programCtx.title_i18n)}</strong>, día {programDayNumber}.
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar: progress actions */}
        <div style={{ width: 280, flexShrink: 0 }}>

          {/* Progress card */}
          <div style={{ background: "rgba(255,255,255,0.88)", borderRadius: 20, padding: "22px", border: "1px solid rgba(220,192,187,0.4)", marginBottom: 16, backdropFilter: "blur(12px)", boxShadow: "0 4px 20px rgba(28,22,24,0.05)" }}>
            <div style={{ fontSize: 8.5, letterSpacing: "0.18em", color: "#B8857F", marginBottom: 16 }}>TU PROGRESO</div>

            <div style={{ background: "#F5E4E0", borderRadius: 6, height: 6, marginBottom: 8 }}>
              <div style={{ background: "linear-gradient(90deg, #DFC0BB, #B8857F)", height: "100%", width: `${pct}%`, borderRadius: 6, transition: "width 0.4s" }}/>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <span style={{ fontSize: 9, color: "#C49490" }}>{pct}% completado</span>
              {elapsedSec > 0 && <span style={{ fontSize: 9, color: "#C49490" }}>{elapsedMin} min</span>}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {([25, 50, 100] as const).map((percent) => {
                const seconds = Math.floor((video.duration_seconds * percent) / 100);
                const isComplete = percent === 100;
                return (
                  <form key={percent} action={upsertProgressAction}>
                    <input name="slug" type="hidden" value={video.slug}/>
                    <input name="videoId" type="hidden" value={video.id}/>
                    <input name="programId" type="hidden" value={programId}/>
                    <input name="programDayNumber" type="hidden" value={programDayNumber ?? ""}/>
                    <input name="lastPositionSeconds" type="hidden" value={seconds}/>
                    <input name="completionPercent" type="hidden" value={percent}/>
                    <button type="submit" style={{
                      width: "100%", padding: "11px 16px",
                      background: isComplete ? "#8C5A55" : "transparent",
                      color: isComplete ? "#FDF8F6" : "#8C5A55",
                      border: `1px solid ${isComplete ? "#8C5A55" : "#DFC0BB"}`,
                      borderRadius: 8, fontSize: 9, letterSpacing: "0.12em", fontWeight: 700, cursor: "pointer",
                      transition: "all 0.15s",
                    }}>
                      {isComplete ? "MARCAR COMPLETADA" : `GUARDAR ${percent}%`}
                    </button>
                  </form>
                );
              })}
            </div>
          </div>

          {/* Related programs */}
          {(relatedPrograms ?? []).length > 0 && (
            <div style={{ background: "rgba(255,255,255,0.9)", borderRadius: 12, padding: "22px", border: "1px solid #EDE0DB", backdropFilter: "blur(8px)" }}>
              <div style={{ fontSize: 8.5, letterSpacing: "0.18em", color: "#B8857F", marginBottom: 16 }}>EN PROGRAMAS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(relatedPrograms ?? []).map((item) => {
                  const prog = Array.isArray(item.programs) ? item.programs[0] : item.programs;
                  if (!prog) return null;
                  return (
                    <Link key={`${prog.slug}-${item.day_number}`} href={`/dashboard/programs/${prog.slug}`} style={{
                      display: "block", padding: "12px 14px", background: "#FBF0EE",
                      border: "1px solid #EDE0DB", borderRadius: 8, textDecoration: "none",
                    }}>
                      <div style={{ fontSize: 8.5, color: "#B8857F", marginBottom: 4 }}>DÍA {item.day_number}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1C1618" }}>{resolveI18nText(prog.title_i18n)}</div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
