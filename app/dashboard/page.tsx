import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, CalendarHeart, Check, Clock, FileText, Flame, ListOrdered, Mail, Megaphone, Play, Sparkles, Timer } from "lucide-react";
import { HoraSesion } from "@/components/hora-sesion";
import { PanelControlAdmin } from "@/components/panel-control-admin";
import { cargarPanelEstudio, fechaDelPanel } from "@/src/features/admin/panel-estudio";
import { Saludo } from "@/components/saludo";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { getProgresoDelUsuario, ultimaVista } from "@/src/features/studio/progress";
import { resolveI18nText } from "@/src/features/studio/helpers";
import { CATEGORIA_LABEL } from "@/src/features/studio/catalogo-clases";

export const dynamic = "force-dynamic";

type MembershipTier = "none" | "corps_de_ballet" | "solista" | "principal";

type ResumeVideo = {
  max_position_seconds: number;
  completion_percent: number;
  updated_at: string;
  videos: {
    title_i18n: Record<string, string>;
    duration_seconds: number;
    slug: string;
    thumbnail_url: string | null;
    category_slugs: string[] | null;
  } | null;
};

/** Clase sugerida en la fila "Para hoy". */
type ClaseSugerida = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  duration_seconds: number;
  category_slugs: string[] | null;
  thumbnail_url: string | null;
};

type LiveSession = {
  id: string;
  title_i18n: Record<string, string>;
  starts_at: string;
  membership_tier_required: MembershipTier;
  cover_image_url: string | null;
};

type Announcement = { id: string; title: string; content: string; tier_target: string };

const TIER_ORDER: Record<MembershipTier, number> = {
  none: 0, corps_de_ballet: 1, solista: 2, principal: 3,
};

/**
 * Etiqueta legible de cada categoria, para no mostrar el slug crudo.
 *
 * Sale de la MISMA lista que el desplegable de /admin/videos: cuando estaba
 * escrita aca aparte, agregar una categoria en el panel dejaba la tarjeta del
 * dashboard mostrando "pies-y-tobillos" en minuscula y con guiones.
 *
 * Los slugs viejos siguen mapeados a mano: la migracion 20260921 los desactiva,
 * pero una clase que todavia los tenga no tiene por que verse rota.
 */
const CAT_LABEL: Record<string, string> = {
  ...CATEGORIA_LABEL,
  pilates: "Pilates",
  reformer: "Pilates",
  mat: "Pilates",
  pbt: "PBT",
  pct: "PCT",
};

const QUICK_LINKS = [
  { href: "/dashboard/library"   as const, label: "Biblioteca",        sub: "Explorá todas las clases", Icono: BookOpen,      tono: "rubor" },
  { href: "/dashboard/programs"  as const, label: "Planes de trabajo", sub: "Tu semana, día por día",   Icono: ListOrdered,   tono: "melocoton" },
  { href: "/dashboard/live"      as const, label: "Calendario",        sub: "Ver próximos en vivo",     Icono: CalendarHeart, tono: "salvia" },
  { href: "/dashboard/documents" as const, label: "Documentos",        sub: "PDFs y guías útiles",      Icono: FileText,      tono: "lila" },
];

/** "Jueves, 8 de octubre": solo la primera letra en mayuscula. */
function formatDate() {
  const t = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) + "h";
}

/** "Sabado 25 de mayo", para la tarjeta de la proxima clase en vivo. */
function formatLiveDate(iso: string) {
  const t = new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function formatDuracion(segundos: number) {
  return `${Math.round(segundos / 60)} min`;
}

export default async function DashboardPage() {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const profile = await getCurrentProfile(user.id);

  const isAdmin = profile?.is_admin ?? false;
  const tier = profile?.membership_tier ?? "none";
  // El nombre de QUIEN entro. Antes toda cuenta admin leia "Brunela", y hay
  // tres admins: el saludo le hablaba a otra persona.
  const nombreReal = profile?.full_name?.trim().split(/\s+/)[0] || null;
  const firstName =
    profile?.full_name?.trim().split(/\s+/)[0] || user.email?.split("@")[0] || "alumna";

  // La admin ve el panel del estudio y nada mas, y se resuelve ANTES de las
  // consultas de alumna (progreso, sugerencias, invitaciones), que en su cuenta
  // no se usan. La seccion personal eran ceros ocupando media pantalla.
  if (isAdmin) {
    const datos = await cargarPanelEstudio();
    return (
      <main className="pb-20 md:pb-10" style={{ minHeight: "100vh", background: "#fff" }}>
        <section style={{ maxWidth: 1440, margin: "0 auto", padding: "clamp(20px, 3vw, 40px) clamp(16px, 3.4vw, 48px)" }}>
          <PanelControlAdmin datos={{ ...datos, nombre: nombreReal, fecha: fechaDelPanel() }} />
        </section>
      </main>
    );
  }

  const now = new Date().toISOString();

  // Base queries — available to all authenticated users
  const [
    progressList,
    { data: liveData },
    { data: announcementsData },
    { data: paraHoy },
    { data: invitacionesData },
  ] = await Promise.all([
    // El progreso viene del helper memoizado: antes esta pantalla lo pedia dos
    // veces y el layout una tercera. Ahora es una sola consulta por request.
    getProgresoDelUsuario(user.id),
    supabase.from("live_sessions")
      .select("id, title_i18n, starts_at, membership_tier_required, cover_image_url")
      .in("status", ["scheduled"]).gte("starts_at", now)
      .order("starts_at", { ascending: true }).limit(1).maybeSingle<LiveSession>(),
    supabase.from("studio_announcements")
      .select("id, title, content, tier_target").eq("is_active", true)
      .or("expires_at.is.null,expires_at.gt." + now)
      .order("published_at", { ascending: false }).limit(3),
    // "Para hoy": las clases publicadas mas recientes a las que llega su plan.
    // La RLS ya filtra por tier, asi que no hace falta condicionarlo aca.
    supabase.from("videos")
      .select("id, slug, title_i18n, duration_seconds, category_slugs, thumbnail_url")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(10)
      .returns<ClaseSugerida[]>(),
    // Invitaciones puntuales de Brunela.
    //
    // ⚠️ Mientras no haya correo, ESTA es la unica forma en que la alumna se
    //    entera. Sin esto, Brunela la invita y del otro lado no pasa nada
    //    visible: aparece una clase de un plan que no tiene, sin explicacion.
    //
    //    La policy ya devuelve solo las propias, asi que no se filtra por
    //    user_id: hacerlo sugeriria que la seguridad esta aca, y esta en la base.
    supabase.from("live_session_invitations")
      .select("live_session_id, live_sessions(id, slug, title_i18n, starts_at, status, session_timezone)"),
  ]);


  // "Continua viendo" sale de la misma lista, sin otra consulta.
  const resume = ultimaVista(progressList);

  const classesWatched = progressList?.length ?? 0;
  const minutesPracticed = Math.floor(
    (progressList ?? []).reduce((acc, p) => acc + p.max_position_seconds, 0) / 60
  );

  // Racha semanal: dias DISTINTOS con actividad en los ultimos 7. Antes esta
  // tarjeta mostraba un guion fijo, sin calcular nada.
  const hace7dias = Date.now() - 7 * 86400000;
  const rachaSemanal = new Set(
    (progressList ?? [])
      .map((p) => (p as { updated_at?: string }).updated_at)
      .filter((f): f is string => Boolean(f) && new Date(f!).getTime() >= hace7dias)
      .map((f) => new Date(f).toISOString().slice(0, 10))
  ).size;

  const sugeridas = ((paraHoy ?? []) as ClaseSugerida[]).slice(0, 8);
  const resumeTitle = resume?.videos ? resolveI18nText(resume.videos.title_i18n) : null;
  const resumeProgress = Math.max(8, Math.min(100, Number(resume?.completion_percent ?? 0)));
  const resumeElapsed = Math.floor((Number(resume?.completion_percent ?? 0) / 100) * (resume?.videos?.duration_seconds ?? 0));
  const resumeMin = Math.floor(resumeElapsed / 60);
  const resumeSec = resumeElapsed % 60;
  const canAccessLive = liveData ? TIER_ORDER[tier] >= TIER_ORDER[liveData.membership_tier_required] : false;
  // Si ya reservo, la tarjeta no puede seguir diciendo "Reservar lugar": se
  // vio con datos de prueba, una alumna con su lugar tomado invitada a
  // reservarlo de nuevo. La policy devuelve solo las reservas propias.
  const { data: miReserva } = liveData
    ? await supabase.from("live_session_bookings").select("id")
        .eq("live_session_id", liveData.id).eq("user_id", user.id)
        .in("status", ["reserved", "waitlisted"]).limit(1).maybeSingle()
    : { data: null };
  const announcements = (announcementsData ?? []) as Announcement[];

  // Solo las que todavia no pasaron y siguen publicadas. Se filtra y ordena en
  // TypeScript y no en la consulta a proposito: una alumna tiene un punado de
  // invitaciones, y filtrar sobre una tabla embebida en PostgREST es de las
  // cosas que se escriben mal en silencio.
  type FilaInvitacion = {
    live_session_id: string;
    live_sessions:
      | { id: string; slug: string; title_i18n: Record<string, string>; starts_at: string; status: string; session_timezone: string }
      | { id: string; slug: string; title_i18n: Record<string, string>; starts_at: string; status: string; session_timezone: string }[]
      | null;
  };
  const invitaciones = ((invitacionesData ?? []) as FilaInvitacion[])
    .map((i) => (Array.isArray(i.live_sessions) ? i.live_sessions[0] : i.live_sessions))
    .filter((s): s is NonNullable<typeof s> => !!s && s.status === "scheduled" && s.starts_at >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));


  return (
    <main className="pb-20 md:pb-10" style={{ minHeight: "100vh", background: "#fff" }}>
      <style>{CSS_INICIO}</style>
      <section className="ini">

        {/* ── PERSONAL SECTION ── */}

        {/* Invitaciones de Brunela. Van ARRIBA de los anuncios: un anuncio es
            para todas, esto es para ella sola y ademas tiene fecha. */}
        {invitaciones.length > 0 && (
          <div className="ini-pila">
            {invitaciones.map((s) => (
              <Link key={s.id} href="/dashboard/live" className="ini-aviso ini-aviso--invita">
                <span className="ini-burbuja ini-burbuja--blanca" aria-hidden="true">
                  <Mail size={18} strokeWidth={2.2} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="ini-aviso-titulo">Brunela te invitó a una clase en vivo</p>
                  <p className="ini-aviso-txt">
                    <strong>{s.title_i18n?.es ?? s.slug}</strong>
                    {" — "}
                    <HoraSesion iso={s.starts_at} zonaEstudio={s.session_timezone} />
                  </p>
                  {/* Lo mas importante del cartel: sin reservar no entra. */}
                  <p className="ini-aviso-nota">
                    Entrás aunque no tengas ese plan, pero tenés que reservar tu lugar.
                  </p>
                </div>
                <ArrowRight size={18} strokeWidth={2.4} className="ini-aviso-flecha" aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}

        {/* Announcements */}
        {announcements.length > 0 && (
          <div className="ini-pila">
            {announcements.map((ann) => (
              <div key={ann.id} className="ini-aviso ini-aviso--anuncio">
                <span className="ini-burbuja ini-burbuja--blanca" aria-hidden="true">
                  <Megaphone size={18} strokeWidth={2.2} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {ann.title && <p className="ini-aviso-titulo">{ann.title}</p>}
                  <p className="ini-aviso-txt">{ann.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Saludo */}
        <header className="ini-hola">
          <span className="ini-mancha ini-mancha--a" aria-hidden="true" />
          <span className="ini-mancha ini-mancha--b" aria-hidden="true" />
          <p className="ini-fecha">
            <CalendarDays size={14} strokeWidth={2.2} aria-hidden="true" />
            {formatDate()}
          </p>
          <h1 className="ini-titulo">
            <Saludo />, <span className="ini-nombre">{firstName}</span>
          </h1>
          <p className="ini-lede">Tu cuerpo te espera. Seguí donde lo dejaste.</p>
        </header>

        {/* Personal stats */}
        <div className="ini-cifras">
          {[
            { value: classesWatched, label: classesWatched === 1 ? "Clase vista" : "Clases vistas", Icono: Play, tono: "rubor" },
            { value: minutesPracticed, label: minutesPracticed === 1 ? "Minuto practicado" : "Minutos practicados", Icono: Timer, tono: "melocoton" },
            { value: rachaSemanal, label: "Racha semanal", Icono: Flame, tono: "salvia" },
          ].map((s, i) => (
            <div key={i} className={`ini-cifra ini-cifra--${s.tono}`}>
              <span className="ini-cifra-ico" aria-hidden="true"><s.Icono size={19} strokeWidth={2.2} /></span>
              <div style={{ minWidth: 0 }}>
                <p className="ini-cifra-num">{s.value}</p>
                <p className="ini-cifra-label">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Continua viendo */}
        <div className="ini-card">
          <p className="ini-card-titulo">
            <span className="ini-burbuja" aria-hidden="true"><Play size={16} strokeWidth={2.2} fill="currentColor" /></span>
            Continuá viendo
          </p>

          {resume && resumeTitle ? (
            <Link href={`/dashboard/library/${resume.videos!.slug}` as never} className="ini-seguir">
              <div className="ini-seguir-img">
                {resume.videos!.thumbnail_url && (
                  <img src={resume.videos!.thumbnail_url} alt="" />
                )}
                <span className="ini-seguir-play" aria-hidden="true"><Play size={16} strokeWidth={2} fill="currentColor" /></span>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="ini-chip">
                  {(resume.videos!.category_slugs ?? []).map((c) => CAT_LABEL[c] ?? c).join(" · ") || "Clase"}
                </p>
                <p className="ini-seguir-titulo">{resumeTitle}</p>
                <div className="ini-barra"><span style={{ width: `${resumeProgress}%` }} /></div>
                <p className="ini-seguir-pct">{resumeProgress}% completado</p>
              </div>

              <span className="ini-seguir-flecha" aria-hidden="true"><ArrowRight size={18} strokeWidth={2.4} /></span>
            </Link>
          ) : (
            <div className="ini-vacio">
              <span className="ini-burbuja ini-burbuja--grande" aria-hidden="true"><Sparkles size={20} strokeWidth={2.2} /></span>
              <p>
                Todavía no empezaste ninguna clase.{" "}
                <Link href="/dashboard/library" className="ini-enlace">Elegí la primera →</Link>
              </p>
            </div>
          )}
        </div>

        {/* Proxima en vivo + accesos rapidos */}
        <div className={"ini-2col" + (liveData ? "" : " es-una")}>
          {liveData && (
            <div className="ini-vivo">
              <span className="ini-mancha ini-mancha--c" aria-hidden="true" />
              <div className="ini-vivo-cuerpo">
                <p className="ini-vivo-eyebrow"><span className="ini-vivo-punto" aria-hidden="true" /> Próxima clase en vivo</p>
                <p className="ini-vivo-titulo">{resolveI18nText(liveData.title_i18n)}</p>
                <div className="ini-vivo-datos">
                  <span><CalendarDays size={14} strokeWidth={2.2} aria-hidden="true" /> {formatLiveDate(liveData.starts_at)}</span>
                  <span><Clock size={14} strokeWidth={2.2} aria-hidden="true" /> {formatTime(liveData.starts_at)}</span>
                </div>
                {miReserva ? (
                  <Link href="/dashboard/live" className="ini-btn ini-btn--lleno">
                    <Check size={15} strokeWidth={2.6} /> Tenés tu lugar · ver enlace
                  </Link>
                ) : canAccessLive ? (
                  <Link href="/dashboard/live" className="ini-btn ini-btn--lleno">
                    Reservar lugar <ArrowRight size={15} strokeWidth={2.4} />
                  </Link>
                ) : (
                  <Link href="/dashboard/plan" className="ini-btn">
                    Actualizar plan <ArrowRight size={15} strokeWidth={2.4} />
                  </Link>
                )}
              </div>
              {liveData.cover_image_url && (
                <div className="ini-vivo-img">
                  <img src={liveData.cover_image_url} alt="" />
                </div>
              )}
            </div>
          )}

          <div className="ini-card">
            <p className="ini-card-titulo">
              <span className="ini-burbuja" aria-hidden="true"><Sparkles size={16} strokeWidth={2.2} /></span>
              Accesos rápidos
            </p>
            <div className="ini-accesos">
              {QUICK_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="ini-acceso">
                  <span className={`ini-acceso-ico ini-acceso-ico--${link.tono}`} aria-hidden="true">
                    <link.Icono size={18} strokeWidth={2.2} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span className="ini-acceso-label">{link.label}</span>
                    <span className="ini-acceso-sub">{link.sub}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Para hoy: carrusel de clases reales */}
        <div>
          <div className="ini-fila-cab">
            <h2 className="ini-h2">Para hoy, {firstName}</h2>
            <Link href="/dashboard/library" className="ini-ver">
              Ver todas las clases <ArrowRight size={14} strokeWidth={2.4} />
            </Link>
          </div>

          {sugeridas.length === 0 ? (
            <div className="ini-vacio ini-vacio--caja">
              <span className="ini-burbuja ini-burbuja--grande" aria-hidden="true"><BookOpen size={20} strokeWidth={2.2} /></span>
              <p>Todavía no hay clases publicadas para tu plan. Muy pronto vas a encontrar acá tus clases del día.</p>
            </div>
          ) : (
            <div className="ini-hoy">
              {sugeridas.map((clase) => (
                <Link key={clase.id} href={`/dashboard/library/${clase.slug}` as never} className="ini-hoy-card">
                  <div className="ini-hoy-img">
                    {clase.thumbnail_url && <img src={clase.thumbnail_url} alt="" />}
                    <span className="ini-hoy-dur">
                      <Clock size={12} strokeWidth={2.4} aria-hidden="true" />
                      {formatDuracion(clase.duration_seconds)}
                    </span>
                  </div>
                  <div className="ini-hoy-info">
                    <span className="ini-chip">
                      {(clase.category_slugs ?? []).map((c) => CAT_LABEL[c] ?? c)[0] ?? "Clase"}
                    </span>
                    <p className="ini-hoy-titulo">{resolveI18nText(clase.title_i18n)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </section>
    </main>
  );
}

// ── Estilos de la vista de alumna ────────────────────────────────────────────
// Suave y calido: tarjetas blancas de radio grande, cifras en tonos pastel,
// iconos en burbujas y nada oscuro de fondo (la tarjeta del vivo era negra).

const CSS_INICIO = `
.ini {
  max-width: 1040px; margin: 0 auto; padding: clamp(20px, 3vw, 36px) clamp(16px, 3vw, 32px);
  display: flex; flex-direction: column; gap: 18px;
}
.ini a:focus { outline: none; }
.ini a:focus-visible { outline: 2px solid var(--pink); outline-offset: 3px; }
.ini-pila { display: flex; flex-direction: column; gap: 10px; }

.ini-burbuja {
  width: 36px; height: 36px; border-radius: 13px; flex-shrink: 0; background: var(--rubor); color: var(--pink-deep);
  display: inline-flex; align-items: center; justify-content: center;
}
.ini-burbuja--blanca { width: 42px; height: 42px; border-radius: 15px; background: #fff; color: var(--pink); box-shadow: var(--sombra); }
.ini-burbuja--grande { width: 46px; height: 46px; border-radius: 16px; }

/* avisos */
.ini-aviso {
  display: flex; gap: 14px; align-items: center; padding: 14px 18px 14px 14px; border-radius: var(--radio);
  border: 1px solid var(--linea); text-decoration: none; color: inherit;
}
.ini-aviso--invita {
  background: linear-gradient(120deg, #FFF1EC 0%, #FFF7F3 55%, #FFEFE6 100%);
  transition: transform .35s var(--curva), box-shadow .35s var(--curva);
}
.ini-aviso--invita:hover { transform: translateY(-2px); box-shadow: var(--sombra-alta); }
.ini-aviso--anuncio { background: #FFF8EF; border-color: #F6E2CC; }
.ini-aviso--anuncio .ini-burbuja--blanca { color: var(--melocoton-deep); }
.ini-aviso-titulo { font-size: 14px; font-weight: 800; color: var(--pink-deep); margin-bottom: 2px; }
.ini-aviso--anuncio .ini-aviso-titulo { color: var(--melocoton-deep); }
.ini-aviso-txt { font-size: 14px; line-height: 1.55; color: #5A4440; }
.ini-aviso-txt strong { color: var(--ink); font-weight: 800; }
.ini-aviso-nota { font-size: 12.5px; color: var(--muted); margin-top: 3px; }
.ini-aviso-flecha { flex-shrink: 0; color: var(--pink); }

/* saludo */
.ini-hola {
  position: relative; overflow: hidden; isolation: isolate;
  padding: clamp(24px, 3.4vw, 38px) clamp(22px, 3.4vw, 40px); border-radius: 32px; border: 1px solid var(--linea);
  background: linear-gradient(120deg, #FFF1EC 0%, #FFF7F3 55%, #FFEFE6 100%);
}
.ini-mancha { position: absolute; z-index: -1; border-radius: 50%; filter: blur(40px); pointer-events: none; }
.ini-mancha--a { width: 300px; height: 300px; right: -70px; top: -140px; background: rgba(255, 210, 186, 0.75); animation: ini-flota 14s ease-in-out infinite; }
.ini-mancha--b { width: 220px; height: 220px; right: 30%; bottom: -150px; background: rgba(253, 205, 205, 0.6); animation: ini-flota 18s ease-in-out infinite reverse; }
.ini-mancha--c { width: 240px; height: 240px; left: -80px; bottom: -140px; background: rgba(255, 214, 196, 0.7); }
@keyframes ini-flota { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-22px, 12px); } }
.ini-fecha {
  display: inline-flex; align-items: center; gap: 7px; margin-bottom: 14px;
  padding: 6px 13px 6px 10px; border-radius: 99px; background: #fff; box-shadow: 0 6px 16px -10px rgba(176,70,70,.45);
  font-size: 12.5px; font-weight: 800; color: var(--pink-deep);
}
.ini-titulo {
  font-family: var(--font-display), sans-serif; font-weight: 900;
  font-size: clamp(28px, 3.6vw, 44px); line-height: 1.1; letter-spacing: -0.02em; color: var(--ink);
}
.ini-nombre { color: var(--pink-mid); }
.ini-lede { margin-top: 8px; font-size: 15.5px; line-height: 1.6; color: var(--muted); }

/* cifras */
.ini-cifras { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.ini-cifra {
  display: flex; align-items: center; gap: 14px; padding: 18px 20px; border-radius: var(--radio);
  border: 1px solid transparent;
}
.ini-cifra--rubor { background: var(--rubor); border-color: #FBE3DC; }
.ini-cifra--melocoton { background: #FFF4E8; border-color: #F8E3CD; }
.ini-cifra--salvia { background: #F2F7EF; border-color: #DFEBD9; }
.ini-cifra-ico {
  width: 44px; height: 44px; border-radius: 15px; flex-shrink: 0; background: #fff;
  display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 6px 14px -8px rgba(150,80,70,.4);
}
.ini-cifra--rubor .ini-cifra-ico { color: var(--pink); }
.ini-cifra--melocoton .ini-cifra-ico { color: var(--melocoton-deep); }
.ini-cifra--salvia .ini-cifra-ico { color: var(--salvia-deep); }
.ini-cifra-num { font-family: var(--font-display), sans-serif; font-size: 30px; font-weight: 900; color: var(--ink); letter-spacing: -0.02em; line-height: 1; }
.ini-cifra-label { font-size: 13px; color: var(--muted); margin-top: 5px; font-weight: 700; }

/* tarjetas */
.ini-card {
  background: #fff; border: 1px solid var(--linea); border-radius: 28px; padding: 20px 22px;
  box-shadow: var(--sombra);
}
.ini-card-titulo {
  display: flex; align-items: center; gap: 10px; margin-bottom: 16px;
  font-family: var(--font-display), sans-serif; font-size: 16.5px; font-weight: 900; color: var(--ink);
}

/* continua viendo */
.ini-seguir { display: flex; align-items: center; gap: 18px; text-decoration: none; color: inherit; border-radius: 20px; }
.ini-seguir-img {
  position: relative; width: 190px; aspect-ratio: 16 / 10; flex-shrink: 0; border-radius: 20px; overflow: hidden;
  background: linear-gradient(140deg, #FFF1EC, #FFD9CF);
}
.ini-seguir-img img { width: 100%; height: 100%; object-fit: cover; transition: transform .9s var(--curva); }
.ini-seguir:hover .ini-seguir-img img { transform: scale(1.05); }
.ini-seguir-play {
  position: absolute; left: 50%; top: 50%; width: 42px; height: 42px; margin: -21px 0 0 -21px; border-radius: 50%;
  background: rgba(255,255,255,.95); color: var(--pink); display: flex; align-items: center; justify-content: center;
  box-shadow: 0 10px 22px -10px rgba(176,70,70,.6);
}
.ini-seguir-play svg { margin-left: 2px; }
.ini-chip {
  display: inline-flex; padding: 4px 11px; border-radius: 99px; background: var(--rubor);
  font-size: 12px; font-weight: 800; color: var(--pink-deep);
}
.ini-seguir-titulo { margin-top: 8px; font-size: 18px; font-weight: 800; color: var(--ink); line-height: 1.3; }
.ini-barra { margin-top: 12px; height: 8px; border-radius: 99px; background: var(--rubor); overflow: hidden; }
.ini-barra span { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #F59A86, var(--pink)); }
.ini-seguir-pct { font-size: 13px; font-weight: 700; color: var(--muted); margin-top: 7px; }
.ini-seguir-flecha {
  width: 46px; height: 46px; border-radius: 50%; flex-shrink: 0; background: var(--pink); color: #fff;
  display: flex; align-items: center; justify-content: center; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85);
  transition: transform .35s var(--curva);
}
.ini-seguir:hover .ini-seguir-flecha { transform: translateX(3px); }
.ini-vacio { display: flex; align-items: center; gap: 14px; font-size: 14.5px; line-height: 1.55; color: var(--muted); }
.ini-vacio--caja { padding: 22px; border-radius: var(--radio); background: var(--crema); border: 1px dashed var(--linea-fuerte); }
.ini-enlace { color: var(--pink-deep); text-decoration: none; font-weight: 800; }
.ini-enlace:hover { color: var(--pink); }

/* vivo + accesos */
.ini-2col { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }
.ini-2col.es-una { grid-template-columns: minmax(0, 1fr); }
.ini-vivo {
  position: relative; overflow: hidden; isolation: isolate; display: flex; gap: 16px; align-items: stretch;
  padding: 22px; border-radius: 28px; border: 1px solid #F6DCCF;
  background: linear-gradient(140deg, #FFF4E8 0%, #FFEDE4 55%, #FFE2D3 100%);
}
.ini-vivo-cuerpo { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; }
.ini-vivo-eyebrow {
  display: inline-flex; align-items: center; gap: 7px; margin-bottom: 12px; padding: 5px 12px 5px 10px;
  border-radius: 99px; background: #fff; font-size: 12.5px; font-weight: 800; color: var(--melocoton-deep);
}
.ini-vivo-punto { width: 8px; height: 8px; border-radius: 50%; background: var(--pink); animation: ini-latido 1.8s ease-in-out infinite; }
@keyframes ini-latido { 0%, 100% { box-shadow: 0 0 0 0 rgba(230,79,85,.45); } 50% { box-shadow: 0 0 0 6px rgba(230,79,85,0); } }
.ini-vivo-titulo { font-family: var(--font-display), sans-serif; font-size: 20px; font-weight: 900; color: var(--ink); line-height: 1.25; letter-spacing: -0.01em; }
.ini-vivo-datos { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 18px; }
.ini-vivo-datos span {
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 99px;
  background: rgba(255,255,255,.75); font-size: 12.5px; font-weight: 700; color: #6E5550;
}
.ini-vivo-datos svg { color: var(--melocoton-deep); }
.ini-vivo-img { width: 38%; max-width: 170px; flex-shrink: 0; border-radius: 20px; overflow: hidden; box-shadow: var(--sombra); }
.ini-vivo-img img { width: 100%; height: 100%; object-fit: cover; }
.ini-btn {
  display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 20px; border-radius: 99px; margin-top: auto;
  text-decoration: none; font-size: 14px; font-weight: 800; color: var(--ink); background: #fff; border: 1px solid var(--linea-fuerte);
  transition: background .2s, border-color .2s, color .2s, transform .35s var(--curva);
}
.ini-btn:hover { background: var(--rubor); border-color: var(--pink-line); color: var(--pink-deep); transform: translateY(-2px); }
.ini-btn--lleno { background: var(--pink); border-color: var(--pink); color: #fff; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); }
.ini-btn--lleno:hover { background: var(--pink-mid); border-color: var(--pink-mid); color: #fff; }

.ini-accesos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.ini-acceso {
  display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 20px; text-decoration: none;
  background: var(--crema); border: 1px solid var(--linea);
  transition: background .2s, border-color .2s, transform .35s var(--curva), box-shadow .35s var(--curva);
}
.ini-acceso:hover { background: #fff; border-color: var(--pink-line); transform: translateY(-2px); box-shadow: var(--sombra); }
.ini-acceso-ico {
  width: 40px; height: 40px; border-radius: 14px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
}
.ini-acceso-ico--rubor { background: var(--rubor); color: var(--pink-deep); }
.ini-acceso-ico--melocoton { background: #FFF0E2; color: var(--melocoton-deep); }
.ini-acceso-ico--salvia { background: #EEF5EA; color: var(--salvia-deep); }
.ini-acceso-ico--lila { background: #F5EDF8; color: #7A4F8C; }
.ini-acceso-label { display: block; font-size: 14px; font-weight: 800; color: var(--ink); }
.ini-acceso-sub { display: block; font-size: 12.5px; color: var(--muted); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* para hoy */
.ini-fila-cab { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 6px 0 14px; }
.ini-h2 { font-family: var(--font-display), sans-serif; font-size: 20px; font-weight: 900; color: var(--ink); letter-spacing: -0.015em; }
.ini-ver {
  display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; height: 36px; padding: 0 14px; border-radius: 99px;
  background: var(--rubor); text-decoration: none; font-size: 13px; font-weight: 800; color: var(--pink-deep);
  transition: background .2s;
}
.ini-ver:hover { background: var(--pink-wash); }
.ini-hoy {
  display: flex; gap: 14px; overflow-x: auto; padding: 4px 4px 18px; margin: 0 -4px;
  scroll-snap-type: x mandatory; scrollbar-width: none;
  -webkit-mask-image: linear-gradient(to right, #000 90%, transparent);
  mask-image: linear-gradient(to right, #000 90%, transparent);
}
.ini-hoy::-webkit-scrollbar { display: none; }
.ini-hoy-card {
  flex: 0 0 auto; width: 220px; scroll-snap-align: start; text-decoration: none; color: inherit;
  background: #fff; border: 1px solid var(--linea); border-radius: 24px; padding: 8px; box-shadow: var(--sombra);
  transition: transform .35s var(--curva), box-shadow .35s var(--curva), border-color .35s;
}
.ini-hoy-card:hover { transform: translateY(-4px); box-shadow: var(--sombra-alta); border-color: var(--pink-line); }
.ini-hoy-img {
  position: relative; aspect-ratio: 4 / 3; border-radius: 18px; overflow: hidden;
  background: linear-gradient(140deg, #FFF1EC, #FFD9CF);
}
.ini-hoy-img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .9s var(--curva); }
.ini-hoy-card:hover .ini-hoy-img img { transform: scale(1.05); }
.ini-hoy-dur {
  position: absolute; right: 8px; bottom: 8px; display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 99px; background: rgba(255,255,255,.94);
  font-size: 12px; font-weight: 800; color: var(--ink);
}
.ini-hoy-dur svg { color: var(--pink); }
.ini-hoy-info { padding: 10px 6px 6px; }
.ini-hoy-titulo {
  margin-top: 8px; font-size: 15px; font-weight: 800; color: var(--ink); line-height: 1.3;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.ini-hoy-card:hover .ini-hoy-titulo { color: var(--pink-deep); }

@media (max-width: 760px) {
  .ini-2col { grid-template-columns: minmax(0, 1fr); }
  .ini-cifras { gap: 8px; }
  .ini-cifra { flex-direction: column; align-items: flex-start; gap: 10px; padding: 14px; border-radius: 20px; }
  .ini-cifra-ico { width: 38px; height: 38px; border-radius: 13px; }
  .ini-cifra-num { font-size: 26px; }
  .ini-cifra-label { font-size: 12px; line-height: 1.3; }
  .ini-hola { border-radius: 26px; }
  .ini-hoy { margin: 0 -16px; padding: 4px 16px 18px; scroll-padding: 0 16px; }
  .ini-hoy-card { width: 200px; }
}
@media (max-width: 520px) {
  .ini-seguir { flex-wrap: wrap; }
  .ini-seguir-img { width: 100%; }
  .ini-seguir-flecha { display: none; }
  .ini-accesos { grid-template-columns: minmax(0, 1fr); }
  .ini-vivo { flex-direction: column-reverse; }
  .ini-vivo-img { width: 100%; max-width: none; aspect-ratio: 16 / 9; }
}
@media (prefers-reduced-motion: reduce) {
  .ini-mancha, .ini-vivo-punto { animation: none; }
  .ini-hoy-card:hover, .ini-acceso:hover, .ini-aviso--invita:hover { transform: none; }
}
`;
