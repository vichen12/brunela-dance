import Link from "next/link";
import { ArrowLeft, ArrowRight, BarChart3, BookOpen, Check, Clock, Dumbbell, ListOrdered } from "lucide-react";
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
  ballet:     "linear-gradient(140deg, #FFF1EC 0%, #FFD9CF 100%)",
  reformer:   "linear-gradient(140deg, #FFF4E8 0%, #FFDCC4 100%)",
  mat:        "linear-gradient(140deg, #FFF4E8 0%, #FFDCC4 100%)",
  stretching: "linear-gradient(140deg, #FFF0EA 0%, #FFD9CC 100%)",
  pbt:        "linear-gradient(140deg, #FFF4E8 0%, #FFDCC4 100%)",
  pct:        "linear-gradient(140deg, #FDECEC 0%, #F8CFCF 100%)",
};

function catGradient(slugs: string[]): string {
  for (const s of slugs) if (CAT_GRADIENTS[s]) return CAT_GRADIENTS[s];
  return "linear-gradient(140deg, #FFF1EC 0%, #FFDCCB 100%)";
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
  );
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
    <main className="fc-fondo">
      <style>{CSS_FICHA}</style>
      <div className="fc">

      {/* Migas: vuelve al plan de trabajo si se llego desde uno. */}
      <nav className="fc-migas" aria-label="Estás en">
        <Link href={(programCtx ? `/dashboard/programs/${programCtx.slug}` : "/dashboard/library") as never} className="fc-volver">
          <ArrowLeft size={15} strokeWidth={2.4} aria-hidden="true" />
          {programCtx ? resolveI18nText(programCtx.title_i18n) : "Biblioteca"}
        </Link>
        <span className="fc-migas-sep" aria-hidden="true">/</span>
        <span className="fc-migas-aca">{title}</span>
      </nav>

      {success && <div role="status" className="fc-aviso fc-aviso--ok"><Check size={15} strokeWidth={2.4} aria-hidden="true" /> {success}</div>}
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
                <span className="fc-preparando-mancha fc-preparando-mancha--a" aria-hidden="true" />
                <span className="fc-preparando-mancha fc-preparando-mancha--b" aria-hidden="true" />
                <div className="fc-preparando-txt">
                  <span className="fc-preparando-ico"><Clock size={22} strokeWidth={2.2} aria-hidden="true" /></span>
                  <p className="fc-preparando-titulo">Video en preparación</p>
                  <p>Esta clase todavía no tiene el video cargado. Va a estar disponible muy pronto.</p>
                </div>
              </div>
            )}
          </div>

          <header className="fc-cab">
            <p className="fc-eyebrow"><span className="fc-punto" aria-hidden="true" />{categoriaTexto}</p>
            <h1 className="fc-titulo">{title}</h1>
            <ul className="fc-datos">
              <li className="fc-dato fc-dato--dur"><Clock size={15} strokeWidth={2.2} aria-hidden="true" /> {formatDurationLabel(video.duration_seconds)}</li>
              <li className="fc-dato fc-dato--nivel"><BarChart3 size={15} strokeWidth={2.2} aria-hidden="true" /> {nivel}</li>
              {materiales && <li className="fc-dato fc-dato--mat"><Dumbbell size={15} strokeWidth={2.2} aria-hidden="true" /> {materiales}</li>}
            </ul>
          </header>

          <section className="fc-card fc-sobre" aria-label="Sobre esta clase">
            <p className="fc-card-titulo">
              <span className="fc-burbuja" aria-hidden="true"><BookOpen size={17} strokeWidth={2.2} /></span>
              Sobre esta clase
            </p>
            <p className="fc-desc">{description || "Brunela todavía no cargó la descripción de esta clase."}</p>
          </section>

          {programCtx && programDayNumber && (
            <div className="fc-contexto">
              <span className="fc-contexto-dia">
                <small>Día</small>
                {programDayNumber}
              </span>
              <p>
                Estás haciendo esta clase como parte de <strong>{resolveI18nText(programCtx.title_i18n)}</strong>.
                Tu progreso se guarda para ese plan.
              </p>
            </div>
          )}

          <div className="fc-card fc-profe">
            <span className="fc-profe-ini" aria-hidden="true">B</span>
            <div>
              <p className="fc-profe-rol">Tu instructora</p>
              <p className="fc-profe-nombre">Brunela</p>
              <p className="fc-profe-sub">Ballet · PBT · PCT · Pilates — Barcelona</p>
            </div>
          </div>
        </div>

        <aside className="fc-lateral">
          <section className="fc-card fc-progreso" aria-label="Tu progreso">
            <p className="fc-card-titulo fc-card-titulo--centro">Tu progreso</p>
            <div className="fc-anillo">
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <defs>
                  <linearGradient id="fc-anillo-degrade" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#F59A86" />
                    <stop offset="100%" stopColor="#E64F55" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="42" className="fc-anillo-fondo" />
                <circle
                  cx="50" cy="50" r="42" className="fc-anillo-valor"
                  style={{ strokeDasharray: C, ["--fc-desde" as string]: C, ["--fc-hasta" as string]: C * (1 - pct / 100) }}
                />
              </svg>
              <span className="fc-anillo-num">{pct}<small>%</small></span>
            </div>
            <p className={"fc-progreso-estado" + (pct >= 90 ? " es-completa" : pct > 0 ? " es-empezada" : "")}>
              {pct >= 90 ? "¡Clase completada!" : pct > 0 ? `Vas por el minuto ${elapsedMin} de ${totalMin}` : "Todavía sin empezar"}
            </p>
            <p className="fc-progreso-nota">
              Se guarda solo mientras mirás. Si la dejás, la retomás donde quedaste.
            </p>
          </section>

          {planes.length > 0 && (
            <section className="fc-card">
              <p className="fc-card-titulo">
                <span className="fc-burbuja" aria-hidden="true"><ListOrdered size={17} strokeWidth={2.2} /></span>
                En planes de trabajo
              </p>
              <ul className="fc-planes">
                {planes.map((p) => (
                  <li key={`${p.slug}-${p.dia}`}>
                    <Link href={`/dashboard/programs/${p.slug}` as never} className="fc-plan">
                      <span className="fc-plan-dia">Día {p.dia}</span>
                      <span className="fc-plan-titulo">{p.titulo}</span>
                      <ArrowRight size={15} strokeWidth={2.4} className="fc-plan-flecha" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Link href="/dashboard/library" className="fc-mas">
            Ver más clases <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        </aside>
      </div>
      </div>
    </main>
  );
}

const CSS_FICHA = `
.fc-fondo { background: #fff; min-height: 100vh; }
.fc { max-width: 1440px; margin: 0 auto; padding: clamp(16px, 2.6vw, 32px) clamp(16px, 3.4vw, 48px) 96px; }
.fc-migas { display: flex; align-items: center; gap: 10px; min-width: 0; margin-bottom: 20px; font-size: 13.5px; }
.fc-volver {
  display: inline-flex; align-items: center; gap: 7px; flex-shrink: 0; text-decoration: none;
  height: 38px; padding: 0 16px 0 12px; border-radius: 99px; background: #fff; border: 1px solid var(--linea-fuerte);
  font-weight: 800; color: var(--pink-deep);
  transition: background .2s, border-color .2s, transform .3s var(--curva);
}
.fc-volver:hover { background: var(--rubor); border-color: var(--pink-line); transform: translateX(-2px); }
.fc-volver:focus-visible, .fc-plan:focus-visible, .fc-mas:focus-visible { outline: 2px solid var(--pink); outline-offset: 3px; }
.fc-migas-sep { color: var(--linea-fuerte); }
.fc-migas-aca { font-weight: 700; color: #B39189; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fc-aviso { display: flex; align-items: center; gap: 8px; border-radius: var(--radio-chico); padding: 12px 16px; margin-bottom: 16px; font-size: 14px; font-weight: 600; }
.fc-aviso--ok { background: var(--salvia); color: var(--salvia-deep); border: 1px solid #D3E6CD; }
.fc-aviso--error { background: var(--pink-wash); color: var(--pink-deep); border: 1px solid var(--pink-line); }

.fc-grilla { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: clamp(20px, 2.6vw, 36px); align-items: start; }
.fc-principal { min-width: 0; display: flex; flex-direction: column; gap: 16px; }

/* El marco del reproductor: tarjeta blanca con sombra tibia. La logica del
   reproductor no se toca; esto solo lo enmarca. */
.fc-video {
  padding: 10px; border-radius: 32px; background: #fff; border: 1px solid var(--linea);
  box-shadow: 0 2px 4px rgba(150, 80, 70, 0.05), 0 34px 70px -34px rgba(176, 70, 70, 0.5);
}

.fc-preparando {
  position: relative; aspect-ratio: 16 / 9; border-radius: 22px; overflow: hidden; isolation: isolate;
  background: linear-gradient(140deg, #FFF1EC, #FFDCCB);
}
.fc-preparando img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: -1; filter: saturate(0.85); }
.fc-preparando-mancha { position: absolute; z-index: 0; border-radius: 50%; pointer-events: none; }
.fc-preparando-mancha--a { width: 44%; aspect-ratio: 1; right: -8%; top: -24%; background: rgba(255,255,255,.5); animation: fc-flota 16s ease-in-out infinite; }
.fc-preparando-mancha--b { width: 30%; aspect-ratio: 1; left: -6%; bottom: -18%; background: rgba(255,255,255,.4); animation: fc-flota 20s ease-in-out infinite reverse; }
@keyframes fc-flota { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-18px, 12px); } }
.fc-preparando-txt {
  position: absolute; inset: 0; z-index: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; padding: 24px; text-align: center; font-size: 14.5px; line-height: 1.6; color: var(--muted);
}
.fc-preparando-ico {
  width: 58px; height: 58px; border-radius: 20px; display: inline-flex; align-items: center; justify-content: center;
  background: #fff; color: var(--pink); margin-bottom: 10px; box-shadow: var(--sombra-alta);
  animation: fc-latido 2.6s ease-in-out infinite;
}
@keyframes fc-latido { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.07); } }
.fc-preparando-titulo {
  font-family: var(--font-display), sans-serif; font-weight: 900; font-size: 21px; letter-spacing: -0.015em; color: var(--ink);
}

.fc-cab { padding: 14px 4px 2px; }
.fc-eyebrow {
  display: inline-flex; align-items: center; gap: 8px; margin-bottom: 12px;
  padding: 6px 13px 6px 11px; border-radius: 99px; background: var(--rubor);
  font-size: 12.5px; font-weight: 800; color: var(--pink-deep);
}
.fc-punto { width: 7px; height: 7px; border-radius: 50%; background: var(--pink); }
.fc-titulo {
  font-family: var(--font-display), sans-serif; font-weight: 900;
  font-size: clamp(28px, 3.2vw, 42px); line-height: 1.12; letter-spacing: -0.02em; color: var(--ink);
}
.fc-datos { list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.fc-dato {
  display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; border-radius: 99px;
  font-size: 13.5px; font-weight: 800;
}
.fc-dato--dur { background: #FFF4E8; color: var(--melocoton-deep); }
.fc-dato--nivel { background: #FFF4E8; color: var(--salvia-deep); }
.fc-dato--mat { background: #FFF0EA; color: #B4533A; }

.fc-card {
  background: #fff; border: 1px solid var(--linea); border-radius: var(--radio); padding: 22px 24px;
  box-shadow: var(--sombra);
}
.fc-card-titulo {
  display: flex; align-items: center; gap: 10px; margin-bottom: 14px;
  font-family: var(--font-display), sans-serif; font-size: 16px; font-weight: 900; color: var(--ink);
}
.fc-card-titulo--centro { justify-content: center; }
.fc-burbuja {
  width: 36px; height: 36px; border-radius: 13px; flex-shrink: 0; background: var(--rubor); color: var(--pink-deep);
  display: inline-flex; align-items: center; justify-content: center;
}
.fc-desc { max-width: 70ch; font-size: 15.5px; line-height: 1.75; color: #6E5550; white-space: pre-line; }

.fc-contexto {
  display: flex; align-items: center; gap: 16px; padding: 16px 20px; border-radius: var(--radio);
  background: linear-gradient(120deg, #FFF1EC 0%, #FFF7F3 55%, #FFEFE6 100%); border: 1px solid var(--linea);
  font-size: 14.5px; line-height: 1.55; color: var(--muted);
}
.fc-contexto strong { color: var(--ink); }
.fc-contexto-dia {
  flex-shrink: 0; width: 60px; height: 60px; border-radius: 20px; background: #fff; color: var(--pink-deep);
  display: inline-flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: var(--sombra);
  font-family: var(--font-display), sans-serif; font-weight: 900; font-size: 22px; line-height: 1;
}
.fc-contexto-dia small { font-size: 11.5px; font-weight: 800; color: var(--muted); margin-bottom: 3px; }

.fc-profe { display: flex; align-items: center; gap: 16px; }
.fc-profe-ini {
  width: 54px; height: 54px; border-radius: 50%; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(140deg, #F59A86, var(--pink)); color: #fff; box-shadow: 0 12px 22px -12px rgba(230,79,85,.9);
  font-family: var(--font-display), sans-serif; font-weight: 900; font-size: 21px;
}
.fc-profe-rol { font-size: 12.5px; font-weight: 800; color: var(--pink-deep); }
.fc-profe-nombre { font-family: var(--font-display), sans-serif; font-weight: 900; font-size: 18px; color: var(--ink); }
.fc-profe-sub { font-size: 13px; font-weight: 600; color: var(--muted); }

.fc-lateral { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 20px; }
.fc-progreso { text-align: center; padding: 24px 24px 26px; background: linear-gradient(170deg, #FFF7F3 0%, #fff 60%); }
.fc-anillo { position: relative; width: 148px; height: 148px; margin: 4px auto 16px; }
.fc-anillo svg { width: 100%; height: 100%; transform: rotate(-90deg); overflow: visible; }
.fc-anillo-fondo { fill: none; stroke: var(--rubor); stroke-width: 10; }
.fc-anillo-valor {
  fill: none; stroke: url(#fc-anillo-degrade); stroke-width: 10; stroke-linecap: round;
  stroke-dashoffset: var(--fc-hasta); animation: fc-llena 1.4s var(--curva) both 0.2s;
  filter: drop-shadow(0 4px 6px rgba(230, 79, 85, 0.3));
}
@keyframes fc-llena { from { stroke-dashoffset: var(--fc-desde); } to { stroke-dashoffset: var(--fc-hasta); } }
.fc-anillo-num {
  position: absolute; inset: 14px; border-radius: 50%; background: #fff; box-shadow: inset 0 0 0 1px var(--linea);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display), sans-serif; font-weight: 900; font-size: 34px; letter-spacing: -0.02em; color: var(--ink);
}
.fc-anillo-num small { font-size: 15px; margin-left: 1px; color: var(--pink); }
.fc-progreso-estado {
  display: inline-flex; padding: 6px 14px; border-radius: 99px; background: var(--rubor);
  font-weight: 800; font-size: 13.5px; color: var(--pink-deep);
}
.fc-progreso-estado.es-empezada { background: #FFF4E8; color: var(--melocoton-deep); }
.fc-progreso-estado.es-completa { background: var(--salvia); color: var(--salvia-deep); }
.fc-progreso-nota { margin-top: 10px; font-size: 13px; line-height: 1.6; color: var(--muted); }

.fc-planes { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.fc-plan {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 10px; border-radius: 18px; text-decoration: none;
  background: var(--crema); border: 1px solid var(--linea); transition: background .2s, border-color .2s, transform .3s var(--curva);
}
.fc-plan:hover { background: var(--rubor); border-color: var(--pink-line); transform: translateY(-1px); }
.fc-plan-dia {
  flex-shrink: 0; padding: 5px 10px; border-radius: 99px; background: #fff;
  font-size: 12px; font-weight: 800; color: var(--pink-deep); box-shadow: 0 3px 8px -5px rgba(176,70,70,.5);
}
.fc-plan-titulo { flex: 1; min-width: 0; font-size: 14px; font-weight: 800; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fc-plan-flecha { color: var(--pink); transition: transform .25s var(--curva); }
.fc-plan:hover .fc-plan-flecha { transform: translateX(3px); }
.fc-mas {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 48px; border-radius: 99px;
  border: 1px solid var(--linea-fuerte); background: #fff; text-decoration: none; font-size: 14px; font-weight: 800; color: var(--ink);
  transition: border-color .2s, background .2s, color .2s, transform .35s var(--curva);
}
.fc-mas:hover { background: var(--rubor); border-color: var(--pink-line); color: var(--pink-deep); transform: translateY(-2px); }

@media (max-width: 1020px) {
  .fc-grilla { grid-template-columns: minmax(0, 1fr); }
  .fc-lateral { position: static; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
}
@media (max-width: 560px) {
  .fc-video { padding: 6px; border-radius: 26px; }
  .fc-card { padding: 20px; }
  .fc-migas-aca, .fc-migas-sep { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .fc-anillo-valor, .fc-preparando-ico, .fc-preparando-mancha { animation: none; }
}
`;
