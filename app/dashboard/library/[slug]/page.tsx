import Link from "next/link";
import { ArrowLeft, ArrowRight, BarChart3, Check, Clock, Dumbbell } from "lucide-react";
import { notFound } from "next/navigation";
import {
  formatDurationLabel,
  resolveI18nText,
  safePercent,
  type MembershipTier,
} from "@/src/features/studio/helpers";
import {
  CATEGORIA_LABEL,
  TIPO_LABEL,
  materialesEnTexto,
  nivelEnTexto,
} from "@/src/features/studio/catalogo-clases";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { bunnySignedUrls, bunnyVideoIdFromUrl, hasBunnyStreamEnv } from "@/src/lib/video/bunny";
import { VideoPlayerPanel } from "@/components/video-player-panel";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Shape the mux worker writes: [{locale,label,muxed_at}]. */
type AudioTrack = { locale: string; label: string; muxed_at?: string };

type VideoRecord = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  membership_tier_required: MembershipTier;
  duration_seconds: number;
  category_slugs: string[];
  equipment: string[];
  content_type: string | null;
  recommended_min_level: string | null;
  recommended_max_level: string | null;
  thumbnail_url: string | null;
  stream_provider: string | null;
  stream_playback_id: string | null;
  bunny_video_id: string | null;
  audio_tracks: AudioTrack[] | null;
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
    .select("id, slug, title_i18n, description_i18n, membership_tier_required, duration_seconds, category_slugs, equipment, content_type, recommended_min_level, recommended_max_level, thumbnail_url, stream_provider, stream_playback_id, bunny_video_id, audio_tracks")
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

  const [{ data: progress }, { data: programCtx }, { data: relatedPrograms }, profile] = await Promise.all([
    scopedQ.maybeSingle<ProgressRecord>(),
    programId
      ? supabase.from("programs").select("slug, title_i18n").eq("id", programId).maybeSingle<ProgramContext>()
      : Promise.resolve({ data: null }),
    supabase.from("program_days").select("day_number, programs!inner(slug, title_i18n)").eq("video_id", video.id),
    getCurrentProfile(user.id),
  ]);

  const pct = safePercent(progress?.completion_percent);
  const title = resolveI18nText(video.title_i18n);
  const description = resolveI18nText(video.description_i18n);
  const thumbBg = catGradient(video.category_slugs);

  /**
   * Lo que va arriba del titulo. Un Mini Training se anuncia como tal antes que
   * por su categoria: es lo primero que cambia la expectativa de cuanto dura y
   * que pide, y es la distincion que la alumna busca de un vistazo.
   */
  const categoriaCruda = video.category_slugs[0];
  const categoriaTexto = (
    video.content_type === "mini_training"
      ? TIPO_LABEL.mini_training
      : CATEGORIA_LABEL[categoriaCruda] ?? categoriaCruda ?? "Clase"
  ).toUpperCase();
  const totalMin = Math.floor(video.duration_seconds / 60);
  const elapsedSec = progress?.max_position_seconds ?? 0;
  const elapsedMin = Math.floor(elapsedSec / 60);

  // Playback URLs are SIGNED PER REQUEST and expire. They are never read from
  // the database: stream_playback_id holds an unsigned legacy URL that Bunny
  // rejects once Token Authentication is on. Sign from the stored GUID instead,
  // falling back to parsing the GUID out of the legacy URL for older rows.
  const bunnyId = video.bunny_video_id ?? bunnyVideoIdFromUrl(video.stream_playback_id);
  const signed = bunnyId && hasBunnyStreamEnv() ? bunnySignedUrls(bunnyId) : null;

  const playbackSrc = signed?.hls ?? null;
  const posterSrc = signed?.thumbnail ?? video.thumbnail_url;
  const resumeFrom = progress?.last_position_seconds ?? 0;
  const playerAudioTracks = (video.audio_tracks ?? []).map((t) => ({ locale: t.locale, label: t.label }));

  const planes = (relatedPrograms ?? [])
    .map((item) => {
      const prog = Array.isArray(item.programs) ? item.programs[0] : item.programs;
      return prog ? { slug: prog.slug as string, titulo: resolveI18nText(prog.title_i18n), dia: item.day_number as number } : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
  const materiales = video.equipment.length > 0 ? materialesEnTexto(video.equipment) : null;
  const nivel = nivelEnTexto(video.recommended_min_level, video.recommended_max_level);
  // Circunferencia del anillo de progreso (r = 42).
  const C = 2 * Math.PI * 42;

  return (
    <main className="fc">
      <style>{CSS_FICHA}</style>

      {/* Migas: vuelve al plan de trabajo si se llego desde uno. */}
      <nav className="fc-migas" aria-label="Estás en">
        <Link href={(programCtx ? `/dashboard/programs/${programCtx.slug}` : "/dashboard/library") as never} className="fc-volver">
          <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
          {programCtx ? resolveI18nText(programCtx.title_i18n) : "Biblioteca"}
        </Link>
        <span className="fc-migas-sep" aria-hidden="true">/</span>
        <span className="fc-migas-aca">{title}</span>
      </nav>

      {success && <div role="status" className="fc-aviso fc-aviso--ok"><Check size={15} strokeWidth={2.2} aria-hidden="true" /> {success}</div>}
      {error && <div role="alert" className="fc-aviso fc-aviso--error">{error}</div>}

      <div className="fc-grilla">
        <div className="fc-principal">
          {/* Reproductor real cuando hay fuente de Bunny */}
          <div className="fc-video">
            {playbackSrc ? (
              <VideoPlayerPanel
                src={playbackSrc}
                poster={posterSrc}
                audioTracks={playerAudioTracks}
                durationSeconds={video.duration_seconds}
                initialPositionSeconds={resumeFrom}
                preferredLocale={profile?.preferred_locale ?? "es"}
                videoId={video.id}
                videoSlug={video.slug}
                programId={programId || null}
                programDayNumber={programDayNumber}
              />
            ) : (
              <div className="fc-preparando" style={posterSrc ? undefined : { background: thumbBg }}>
                {posterSrc && <img src={posterSrc} alt="" />}
                <div className="fc-preparando-txt">
                  <span className="fc-preparando-ico"><Clock size={20} strokeWidth={1.8} aria-hidden="true" /></span>
                  <p className="fc-preparando-titulo">Video en preparación</p>
                  <p>Esta clase todavía no tiene el video cargado. Va a estar disponible muy pronto.</p>
                </div>
              </div>
            )}
          </div>

          <header className="fc-cab">
            <p className="fc-eyebrow"><span className="fc-raya" />{categoriaTexto}</p>
            <h1 className="fc-titulo">{title}</h1>
            <ul className="fc-datos">
              <li><Clock size={15} strokeWidth={1.9} aria-hidden="true" /> {formatDurationLabel(video.duration_seconds)}</li>
              <li><BarChart3 size={15} strokeWidth={1.9} aria-hidden="true" /> {nivel}</li>
              {materiales && <li><Dumbbell size={15} strokeWidth={1.9} aria-hidden="true" /> {materiales}</li>}
            </ul>
            <p className="fc-desc">{description || "Brunela todavía no cargó la descripción de esta clase."}</p>
          </header>

          {programCtx && programDayNumber && (
            <div className="fc-contexto">
              <span className="fc-contexto-dia">Día {programDayNumber}</span>
              <p>
                Estás haciendo esta clase como parte de <strong>{resolveI18nText(programCtx.title_i18n)}</strong>.
                Tu progreso se guarda para ese plan.
              </p>
            </div>
          )}

          <div className="fc-profe">
            <span className="fc-profe-ini" aria-hidden="true">B</span>
            <div>
              <p className="fc-profe-rol">Instructora</p>
              <p className="fc-profe-nombre">Brunela</p>
              <p className="fc-profe-sub">Ballet · PBT · PCT · Pilates — Barcelona</p>
            </div>
          </div>
        </div>

        <aside className="fc-lateral">
          <section className="fc-card fc-progreso" aria-label="Tu progreso">
            <p className="fc-card-titulo">Tu progreso</p>
            <div className="fc-anillo">
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="42" className="fc-anillo-fondo" />
                <circle
                  cx="50" cy="50" r="42" className="fc-anillo-valor"
                  style={{ strokeDasharray: C, ["--fc-desde" as string]: C, ["--fc-hasta" as string]: C * (1 - pct / 100) }}
                />
              </svg>
              <span className="fc-anillo-num">{pct}<small>%</small></span>
            </div>
            <p className="fc-progreso-estado">
              {pct >= 90 ? "¡Clase completada!" : pct > 0 ? `Vas por el minuto ${elapsedMin} de ${totalMin}` : "Todavía sin empezar"}
            </p>
            <p className="fc-progreso-nota">
              Se guarda solo mientras mirás. Si la dejás, la retomás donde quedaste.
            </p>
          </section>

          {planes.length > 0 && (
            <section className="fc-card">
              <p className="fc-card-titulo">En planes de trabajo</p>
              <ul className="fc-planes">
                {planes.map((p) => (
                  <li key={`${p.slug}-${p.dia}`}>
                    <Link href={`/dashboard/programs/${p.slug}` as never} className="fc-plan">
                      <span className="fc-plan-dia">Día {p.dia}</span>
                      <span className="fc-plan-titulo">{p.titulo}</span>
                      <ArrowRight size={15} strokeWidth={2} className="fc-plan-flecha" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Link href="/dashboard/library" className="fc-mas">
            Ver más clases <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </main>
  );
}

const CSS_FICHA = `
.fc { max-width: 1440px; margin: 0 auto; padding: clamp(16px, 2.6vw, 32px) clamp(16px, 3.4vw, 48px) 80px; background: #fff; }
.fc-migas { display: flex; align-items: center; gap: 10px; min-width: 0; margin-bottom: 20px; font-size: 13px; }
.fc-volver {
  display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; text-decoration: none;
  font-weight: 700; color: var(--pink-deep); transition: gap .2s;
}
.fc-volver:hover { gap: 9px; }
.fc-migas-sep { color: #d6d3d1; }
.fc-migas-aca { color: #a8a29e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fc-aviso { display: flex; align-items: center; gap: 8px; border-radius: 14px; padding: 12px 16px; margin-bottom: 16px; font-size: 13.5px; }
.fc-aviso--ok { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
.fc-aviso--error { background: var(--pink-wash); color: var(--pink-deep); border: 1px solid var(--pink-line); }

.fc-grilla { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: clamp(24px, 3vw, 44px); align-items: start; }
.fc-principal { min-width: 0; }
.fc-video { border-radius: 22px; box-shadow: 0 28px 60px -30px rgba(28, 25, 23, 0.55); }

.fc-preparando {
  position: relative; aspect-ratio: 16 / 9; border-radius: 22px; overflow: hidden; isolation: isolate;
  background: linear-gradient(145deg, var(--pink-wash), var(--pink-soft));
}
.fc-preparando img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: -1; filter: saturate(0.8); }
.fc-preparando-txt {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; padding: 24px; text-align: center; font-size: 14px; color: #57534e;
  background: rgba(255, 255, 255, 0.55); backdrop-filter: blur(6px);
}
.fc-preparando-ico {
  width: 48px; height: 48px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
  background: #fff; color: var(--pink-mid); margin-bottom: 6px; box-shadow: 0 8px 20px -10px rgba(176, 58, 62, 0.5);
  animation: fc-latido 2.4s ease-in-out infinite;
}
@keyframes fc-latido { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
.fc-preparando-titulo {
  font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 20px; letter-spacing: -0.02em; color: var(--ink);
}

.fc-cab { padding: 28px 0 24px; border-bottom: 1px solid #e7e5e4; }
.fc-eyebrow {
  display: inline-flex; align-items: center; gap: 12px; margin-bottom: 14px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.2em; color: var(--pink-deep);
}
.fc-raya { display: inline-block; width: 28px; height: 1.5px; background: var(--pink); }
.fc-titulo {
  font-family: var(--font-display), sans-serif; font-weight: 800;
  font-size: clamp(30px, 3.6vw, 48px); line-height: 1.05; letter-spacing: -0.04em; color: var(--ink);
}
.fc-datos { list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.fc-datos li {
  display: inline-flex; align-items: center; gap: 7px; padding: 7px 13px; border-radius: 99px;
  background: #fafaf9; border: 1px solid #f0eeec; font-size: 13px; font-weight: 600; color: #57534e;
}
.fc-datos svg { color: var(--pink-mid); }
.fc-desc { margin-top: 18px; max-width: 66ch; font-size: 15.5px; line-height: 1.75; color: #57534e; white-space: pre-line; }

.fc-contexto {
  display: flex; align-items: center; gap: 16px; margin-top: 20px; padding: 16px 18px; border-radius: 16px;
  background: var(--pink-wash); border: 1px solid var(--pink-line); font-size: 14px; color: #57534e;
}
.fc-contexto strong { color: var(--ink); }
.fc-contexto-dia {
  flex-shrink: 0; font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 14px;
  padding: 8px 12px; border-radius: 12px; background: var(--pink); color: #fff;
}

.fc-profe { display: flex; align-items: center; gap: 14px; margin-top: 22px; }
.fc-profe-ini {
  width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  background: var(--pink); color: #fff; font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 18px;
}
.fc-profe-rol { font-size: 10.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #a8a29e; }
.fc-profe-nombre { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 17px; color: var(--ink); letter-spacing: -0.01em; }
.fc-profe-sub { font-size: 12.5px; color: #78716c; }

.fc-lateral { display: flex; flex-direction: column; gap: 14px; position: sticky; top: 20px; }
.fc-card { background: #fff; border: 1px solid #e7e5e4; border-radius: 22px; padding: 22px; }
.fc-card-titulo { font-size: 10.5px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #78716c; margin-bottom: 16px; }
.fc-progreso { text-align: center; }
.fc-anillo { position: relative; width: 132px; height: 132px; margin: 0 auto 14px; }
.fc-anillo svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.fc-anillo-fondo { fill: none; stroke: #f5f5f4; stroke-width: 9; }
.fc-anillo-valor {
  fill: none; stroke: var(--pink); stroke-width: 9; stroke-linecap: round;
  stroke-dashoffset: var(--fc-hasta); animation: fc-llena 1.4s cubic-bezier(.16,1,.3,1) both 0.2s;
}
@keyframes fc-llena { from { stroke-dashoffset: var(--fc-desde); } to { stroke-dashoffset: var(--fc-hasta); } }
.fc-anillo-num {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 32px; letter-spacing: -0.04em; color: var(--ink);
}
.fc-anillo-num small { font-size: 15px; margin-left: 1px; color: #a8a29e; }
.fc-progreso-estado { font-weight: 700; font-size: 14px; color: var(--ink); }
.fc-progreso-nota { margin-top: 6px; font-size: 12.5px; line-height: 1.6; color: #a8a29e; }

.fc-planes { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.fc-plan {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; text-decoration: none;
  background: #fafaf9; border: 1px solid #f0eeec; transition: background .2s, border-color .2s;
}
.fc-plan:hover { background: var(--pink-wash); border-color: var(--pink-line); }
.fc-plan-dia { flex-shrink: 0; font-size: 10.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--pink-deep); }
.fc-plan-titulo { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 700; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fc-plan-flecha { color: var(--pink-deep); transition: transform .2s; }
.fc-plan:hover .fc-plan-flecha { transform: translateX(3px); }
.fc-mas {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 46px; border-radius: 99px;
  border: 1.5px solid #d6d3d1; text-decoration: none; font-size: 13.5px; font-weight: 700; color: var(--ink);
  transition: border-color .2s, transform .2s;
}
.fc-mas:hover { border-color: var(--ink); transform: translateY(-1px); }

@media (max-width: 1020px) {
  .fc-grilla { grid-template-columns: minmax(0, 1fr); }
  .fc-lateral { position: static; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
}
@media (prefers-reduced-motion: reduce) {
  .fc-anillo-valor, .fc-preparando-ico { animation: none; }
}
`;

