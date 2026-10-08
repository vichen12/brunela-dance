import Link from "next/link";
import { HoraSesion } from "@/components/hora-sesion";
import { PanelControlAdmin } from "@/components/panel-control-admin";
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

type ClaseReciente = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  status: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
};

type SesionProxima = {
  id: string;
  title_i18n: Record<string, string>;
  starts_at: string;
  session_timezone: string;
  live_session_bookings: { count: number }[] | null;
};

type RecentUser = {
  id: string;
  full_name: string | null;
  membership_tier: MembershipTier;
  created_at: string;
};

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
  { href: "/dashboard/library"   as const, label: "Biblioteca",  sub: "Explorá todas las clases",
    d: "M2.5 3h4a2 2 0 012 2v8a1.6 1.6 0 00-1.6-1.4H2.5V3z", d2: "M13.5 3h-4a2 2 0 00-2 2v8a1.6 1.6 0 011.6-1.4h4.4V3z" },
  { href: "/dashboard/programs"  as const, label: "Planes de trabajo", sub: "Tu semana, día por día",
    d: "M3 4.5h10M3 8h10M3 11.5h6" },
  { href: "/dashboard/live"      as const, label: "Calendario",  sub: "Ver próximos en vivo",
    d: "M3 4.5h10v9H3v-9z", d2: "M3 7.2h10M5.6 2.6v3M10.4 2.6v3" },
  { href: "/dashboard/documents" as const, label: "Documentos",  sub: "PDFs y guías útiles",
    d: "M5 1.5h5.5L14 5V14H5V1.5z", d2: "M10 1.5V5h4" },
];

/** Icono de línea, del mismo trazo que el menú lateral. */
function Ico({ d, d2, size = 16 }: { d: string; d2?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d={d} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      {d2 && <path d={d2} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

/** Cuadradito de color detrás de un icono, como en las tarjetas de la referencia. */
function IcoCaja({ d, d2 }: { d: string; d2?: string }) {
  return (
    <div style={{
      width: 38, height: 38, borderRadius: 12, flexShrink: 0,
      background: "var(--pink-wash)", color: "var(--pink)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <Ico d={d} d2={d2} size={18} />
    </div>
  );
}

function formatDate() {
  return new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
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

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem`;
  // "hace 5m" se leia como cinco MINUTOS. Se escribe la palabra entera.
  if (days < 365) { const m = Math.floor(days / 30); return `hace ${m} ${m === 1 ? "mes" : "meses"}`; }
  const a = Math.floor(days / 365);
  return `hace ${a} ${a === 1 ? "año" : "años"}`;
}

export default async function DashboardPage() {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const profile = await getCurrentProfile(user.id);

  const isAdmin = profile?.is_admin ?? false;
  const tier = profile?.membership_tier ?? "none";
  // El nombre de QUIEN entro. Antes toda cuenta admin leia "Brunela", y hay
  // tres admins: el saludo le hablaba a otra persona.
  const nombreReal = profile?.full_name?.trim().split(/s+/)[0] || null;
  const firstName =
    profile?.full_name?.trim().split(/s+/)[0] || user.email?.split("@")[0] || "alumna";

  const now = new Date().toISOString();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

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

  // Admin-only queries — only run when the user is an admin and the admin client is available
  let totalUsers: number | null = null;
  let corpsCount: number | null = null;
  let solistaCount: number | null = null;
  let principalCount: number | null = null;
  let noPlanCount: number | null = null;
  let totalVideos: number | null = null;
  let publishedVideos: number | null = null;
  let draftVideos: number | null = null;
  let scheduledLive: number | null = null;
  let totalBookings: number | null = null;
  let newUsersMonth: number | null = null;
  let activeAnnouncements: number | null = null;
  let recentUsersRaw: RecentUser[] | null = null;
  let clasesRecientesRaw: ClaseReciente[] = [];
  let proximasEnVivoRaw: SesionProxima[] = [];

  if (isAdmin) {
    try {
      const { createSupabaseAdminClient } = await import("@/src/lib/supabase/admin");
      const supabaseAdmin = createSupabaseAdminClient();

      const [
        r0, r1, r2, r3, r4,
        r5, r6, r7, r8, r9,
        r10, r11, r12, r13, r14,
      ] = await Promise.all([
        supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("membership_tier", "corps_de_ballet"),
        supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("membership_tier", "solista"),
        supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("membership_tier", "principal"),
        supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("membership_tier", "none"),
        supabaseAdmin.from("videos").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("videos").select("*", { count: "exact", head: true }).eq("status", "published"),
        supabaseAdmin.from("videos").select("*", { count: "exact", head: true }).eq("status", "draft"),
        supabaseAdmin.from("live_sessions").select("*", { count: "exact", head: true })
          .eq("status", "scheduled").gte("starts_at", now),
        supabaseAdmin.from("live_session_bookings").select("*", { count: "exact", head: true }).eq("status", "reserved"),
        supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", startOfMonth),
        supabaseAdmin.from("studio_announcements").select("*", { count: "exact", head: true })
          .eq("is_active", true).or("expires_at.is.null,expires_at.gt." + now),
        supabaseAdmin.from("profiles")
          .select("id, full_name, membership_tier, created_at")
          .order("created_at", { ascending: false }).limit(6),
        // Lo ultimo que se subio, en cualquier estado: un borrador olvidado es
        // justo lo que la admin tiene que ver al entrar.
        supabaseAdmin.from("videos")
          .select("id, slug, title_i18n, status, thumbnail_url, duration_seconds")
          .order("created_at", { ascending: false }).limit(4),
        supabaseAdmin.from("live_sessions")
          .select("id, title_i18n, starts_at, session_timezone, live_session_bookings(count)")
          .eq("status", "scheduled").gte("starts_at", now)
          .eq("live_session_bookings.status", "reserved")
          .order("starts_at", { ascending: true }).limit(3),
      ]);

      totalUsers = r0.count;
      corpsCount = r1.count;
      solistaCount = r2.count;
      principalCount = r3.count;
      noPlanCount = r4.count;
      totalVideos = r5.count;
      publishedVideos = r6.count;
      draftVideos = r7.count;
      scheduledLive = r8.count;
      totalBookings = r9.count;
      newUsersMonth = r10.count;
      activeAnnouncements = r11.count;
      recentUsersRaw = (r12.data ?? []) as RecentUser[];
      clasesRecientesRaw = (r13.data ?? []) as ClaseReciente[];
      proximasEnVivoRaw = (r14.data ?? []) as SesionProxima[];
    } catch {
      // Admin client unavailable (missing SUPABASE_SERVICE_ROLE_KEY) — degrade gracefully
    }
  }

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

  const recentUsers = (recentUsersRaw ?? []) as RecentUser[];
  const paidUsers = (corpsCount ?? 0) + (solistaCount ?? 0) + (principalCount ?? 0);


  // La admin ve el panel del estudio y nada mas. La seccion personal (clases
  // vistas, racha, "continua viendo") es la vista de una alumna: en la cuenta de
  // la profesora eran ceros ocupando media pantalla.
  if (isAdmin) {
    return (
      <main className="pb-20 md:pb-10" style={{ minHeight: "100vh", background: "#fff" }}>
        <section style={{ maxWidth: 1440, margin: "0 auto", padding: "clamp(20px, 3vw, 40px) clamp(16px, 3.4vw, 48px)" }}>
          <PanelControlAdmin datos={{
            nombre: nombreReal,
            fecha: formatDate(),
            metricas: {
              alumnas: totalUsers ?? 0,
              altasDelMes: newUsersMonth ?? 0,
              conPlan: paidUsers,
              principal: principalCount ?? 0,
              sinPlan: noPlanCount ?? 0,
              reservas: totalBookings ?? 0,
              sesiones: scheduledLive ?? 0,
              publicadas: publishedVideos ?? 0,
              borradores: draftVideos ?? 0,
              totales: totalVideos ?? 0,
              anuncios: activeAnnouncements ?? 0,
            },
            porPlan: [
              { tier: "principal", cantidad: principalCount ?? 0 },
              { tier: "solista", cantidad: solistaCount ?? 0 },
              { tier: "corps_de_ballet", cantidad: corpsCount ?? 0 },
              { tier: "none", cantidad: noPlanCount ?? 0 },
            ],
            ultimas: recentUsers.map((u) => ({
              id: u.id,
              nombre: u.full_name?.trim() || null,
              tier: u.membership_tier,
              cuando: timeAgo(u.created_at),
            })),
            clases: clasesRecientesRaw.map((v) => ({
              id: v.id,
              titulo: resolveI18nText(v.title_i18n) || "Sin título",
              estado: v.status,
              portada: v.thumbnail_url,
              minutos: v.duration_seconds ? Math.round(v.duration_seconds / 60) : null,
            })),
            enVivo: proximasEnVivoRaw.map((s) => ({
              id: s.id,
              titulo: resolveI18nText(s.title_i18n) || "Clase en vivo",
              iso: s.starts_at,
              zona: s.session_timezone,
              reservas: s.live_session_bookings?.[0]?.count ?? 0,
            })),
          }} />
        </section>
      </main>
    );
  }

  return (
    <main className="pb-20 md:pb-10" style={{ minHeight: "100vh" }}>
      <section style={{ maxWidth: 980, margin: "0 auto", padding: "32px 28px", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── PERSONAL SECTION ── */}

        {/* Invitaciones de Brunela. Van ARRIBA de los anuncios: un anuncio es
            para todas, esto es para ella sola y ademas tiene fecha. */}
        {invitaciones.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {invitaciones.map((s) => (
              <Link
                key={s.id}
                href="/dashboard/live"
                style={{
                  display: "flex", gap: 12, alignItems: "flex-start", textDecoration: "none",
                  background: "#fff", border: "1px solid var(--pink-line)",
                  borderLeft: "3px solid var(--pink-mid)", borderRadius: 16, padding: "14px 20px",
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8, background: "var(--pink-mid)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginTop: 1,
                }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M2 4.5h12v8H2v-8z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M2 5l6 4 6-4" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--pink-deep)", marginBottom: 3 }}>
                    Brunela te invitó a una clase en vivo
                  </p>
                  <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.5 }}>
                    <strong>{s.title_i18n?.es ?? s.slug}</strong>
                    {" — "}
                    <HoraSesion iso={s.starts_at} zonaEstudio={s.session_timezone} />
                  </p>
                  {/* Lo mas importante del cartel: sin reservar no entra. */}
                  <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4 }}>
                    Entrás aunque no tengas ese plan, pero tenés que reservar tu lugar.
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Announcements */}
        {announcements.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {announcements.map((ann) => (
              <div key={ann.id} style={{
                background: "linear-gradient(135deg, var(--pink-wash), var(--pink-soft))",
                border: "1px solid var(--pink-line)", borderRadius: 16,
                padding: "14px 20px", display: "flex", gap: 12, alignItems: "flex-start",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: "linear-gradient(135deg, var(--pink), var(--pink-mid))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginTop: 1,
                }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2v1M8 13v1M2 8H1M15 8h-1M4.2 4.2l-.7-.7M12.5 12.5l-.7-.7M4.2 11.8l-.7.7M12.5 3.5l-.7.7" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="8" cy="8" r="3" stroke="#fff" strokeWidth="1.5" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {ann.title && <p style={{ fontSize: 13, fontWeight: 700, color: "var(--pink-deep)", marginBottom: 3 }}>{ann.title}</p>}
                  <p style={{ fontSize: 13, color: "#44403c", lineHeight: 1.5 }}>{ann.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Saludo */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--pink)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
            {formatDate()}
          </p>
          <h2 style={{
            fontFamily: "var(--font-display), serif",
            fontSize: 36, fontWeight: 800, color: "var(--ink)",
            lineHeight: 1.1, letterSpacing: "-0.01em",
          }}>
            <Saludo />,{" "}
            <span style={{ color: "var(--pink)", fontStyle: "italic" }}>{firstName}.</span>
          </h2>
          <p style={{ marginTop: 6, fontSize: 13, color: "#78716c", lineHeight: 1.5 }}>
            Tu cuerpo te espera. Seguí donde lo dejaste.
          </p>
        </div>

        {/* Personal stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { value: classesWatched, label: classesWatched === 1 ? "Clase vista" : "Clases vistas",
              d: "M4.5 3.5L13 8l-8.5 4.5V3.5z" },
            { value: minutesPracticed, label: minutesPracticed === 1 ? "Minuto practicado" : "Minutos practicados",
              d: "M8 4v4l2.5 1.5", d2: "M8 14A6 6 0 108 2a6 6 0 000 12z" },
            { value: rachaSemanal, label: "Racha semanal",
              d: "M8 14c2.5 0 4.5-1.9 4.5-4.3 0-3-2.6-4.3-3.4-7.2-1.3 1-2.1 2.3-2 3.8-1-.3-1.5-1-1.7-1.9C4.2 5.6 3.5 7.2 3.5 9.7 3.5 12.1 5.5 14 8 14z" },
          ].map((s, i) => (
            <div key={i} style={{
              background: "#fff", border: "1px solid #f0eeec", borderRadius: 16,
              padding: "18px 20px", display: "flex", alignItems: "center", gap: 14,
            }}>
              <IcoCaja d={s.d} d2={s.d2} />
              <div>
                <p style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.02em", lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 5, fontWeight: 500 }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Continua viendo */}
        <div style={{ background: "#fff", border: "1px solid #f0eeec", borderRadius: 20, padding: "18px 20px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "var(--pink)", textTransform: "uppercase", marginBottom: 14 }}>
            Continua viendo
          </p>

          {resume && resumeTitle ? (
            <Link href={`/dashboard/library/${resume.videos!.slug}` as never} style={{
              textDecoration: "none", display: "flex", alignItems: "center", gap: 18,
            }}>
              <div style={{
                width: 180, height: 100, flexShrink: 0, borderRadius: 14, overflow: "hidden",
                background: "linear-gradient(145deg, var(--pink-wash), var(--pink-soft))",
              }}>
                {resume.videos!.thumbnail_url && (
                  <img src={resume.videos!.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>{resumeTitle}</p>
                <p style={{ fontSize: 13, color: "var(--pink)", marginBottom: 14 }}>
                  {(resume.videos!.category_slugs ?? []).map((c) => CAT_LABEL[c] ?? c).join(" · ") || "Clase"}
                </p>
                <div style={{ background: "var(--pink-wash)", borderRadius: 99, height: 5 }}>
                  <div style={{ background: "var(--pink)", height: "100%", width: `${resumeProgress}%`, borderRadius: 99 }} />
                </div>
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>{resumeProgress}% completado</p>
              </div>

              <div style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                background: "var(--pink-wash)", color: "var(--pink)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Ico d="M6 3.5L10.5 8 6 12.5" size={16} />
              </div>
            </Link>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <IcoCaja d="M4.5 3.5L13 8l-8.5 4.5V3.5z" />
              <p style={{ fontSize: 13, color: "var(--muted)" }}>
                Todavia no empezaste ninguna clase.{" "}
                <Link href="/dashboard/library" style={{ color: "var(--pink)", textDecoration: "none", fontWeight: 600 }}>
                  Elegi la primera →
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Proxima en vivo + accesos rapidos */}
        <div className="dash-2col" style={{ display: "grid", gridTemplateColumns: liveData ? "1fr 1fr" : "1fr", gap: 12 }}>
          {liveData && (
            <div style={{
              position: "relative", borderRadius: 20, overflow: "hidden",
              minHeight: 190, background: "var(--ink)",
              border: canAccessLive ? "none" : "1px solid #f0eeec",
            }}>
              {liveData.cover_image_url && (
                <img src={liveData.cover_image_url} alt="" style={{
                  position: "absolute", inset: 0, width: "100%", height: "100%",
                  objectFit: "cover", opacity: 0.55,
                }} />
              )}
              <div style={{
                position: "relative", height: "100%", padding: "22px 24px",
                display: "flex", flexDirection: "column", alignItems: "flex-start",
                background: "linear-gradient(100deg, rgba(28,25,23,0.94) 45%, rgba(28,25,23,0.35))",
              }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "var(--pink)", textTransform: "uppercase", marginBottom: 12 }}>
                  Proxima clase en vivo
                </p>
                <p style={{ fontSize: 19, fontWeight: 800, color: "#fff", lineHeight: 1.25, marginBottom: 12, maxWidth: 340 }}>
                  {resolveI18nText(liveData.title_i18n)}
                </p>
                <div style={{ display: "flex", gap: 16, marginBottom: 20, color: "rgba(255,255,255,0.78)", fontSize: 12 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Ico d="M3 4.5h10v9H3v-9z" d2="M3 7.2h10M5.6 2.6v3M10.4 2.6v3" size={14} />
                    {formatLiveDate(liveData.starts_at)}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Ico d="M8 4v4l2.5 1.5" d2="M8 14A6 6 0 108 2a6 6 0 000 12z" size={14} />
                    {formatTime(liveData.starts_at)}
                  </span>
                </div>
                {canAccessLive ? (
                  <Link href="/dashboard/live" style={{
                    display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none",
                    background: "var(--pink)", color: "#fff", borderRadius: 99,
                    padding: "11px 22px", fontSize: 13, fontWeight: 700,
                  }}>
                    Reservar lugar <Ico d="M6 3.5L10.5 8 6 12.5" size={13} />
                  </Link>
                ) : (
                  <Link href="/dashboard/plan" style={{
                    display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none",
                    background: "transparent", color: "#fff",
                    border: "1.5px solid rgba(255,255,255,0.4)", borderRadius: 99,
                    padding: "10px 20px", fontSize: 13, fontWeight: 700,
                  }}>
                    Actualizar plan <Ico d="M6 3.5L10.5 8 6 12.5" size={13} />
                  </Link>
                )}
              </div>
            </div>
          )}

          <div style={{ background: "#fff", border: "1px solid #f0eeec", borderRadius: 20, padding: "20px 22px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 14 }}>
              Accesos rapidos
            </p>
            <div className="quick-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {QUICK_LINKS.map((link) => (
                <Link key={link.href} href={link.href} style={{
                  display: "flex", alignItems: "center", gap: 12, textDecoration: "none",
                  padding: "12px 14px", borderRadius: 14, background: "#fff",
                  border: "1px solid #f0eeec",
                }}>
                  <IcoCaja d={link.d} d2={link.d2} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{link.label}</p>
                    <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{link.sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Para hoy: carrusel de clases reales */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "var(--muted)", textTransform: "uppercase" }}>
              Para hoy, {firstName}
            </p>
            <Link href="/dashboard/library" style={{
              display: "inline-flex", alignItems: "center", gap: 7, textDecoration: "none",
              fontSize: 12, fontWeight: 600, color: "var(--pink)",
            }}>
              Ver todas las clases <Ico d="M6 3.5L10.5 8 6 12.5" size={13} />
            </Link>
          </div>

          {sugeridas.length === 0 ? (
            <div style={{
              background: "#fff", border: "1px dashed #e7e5e4", borderRadius: 18,
              padding: "26px 22px", fontSize: 13, color: "var(--muted)",
            }}>
              Todavia no hay clases publicadas para tu plan.
            </div>
          ) : (
            <div className="hoy-fila" style={{
              display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6,
              scrollSnapType: "x mandatory",
            }}>
              {sugeridas.map((clase) => (
                <Link key={clase.id} href={`/dashboard/library/${clase.slug}` as never} style={{
                  position: "relative", flex: "0 0 auto", width: 190, aspectRatio: "3/4",
                  borderRadius: 18, overflow: "hidden", textDecoration: "none",
                  scrollSnapAlign: "start", background: "linear-gradient(145deg, var(--pink-wash), var(--pink-soft))",
                }}>
                  {clase.thumbnail_url && (
                    <img src={clase.thumbnail_url} alt="" style={{
                      position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
                    }} />
                  )}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(to top, rgba(28,25,23,0.82) 26%, rgba(28,25,23,0.05) 62%)",
                    display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 14,
                  }}>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.82)", marginBottom: 2 }}>
                      {(clase.category_slugs ?? []).map((c) => CAT_LABEL[c] ?? c)[0] ?? "Clase"}
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.25 }}>
                      {resolveI18nText(clase.title_i18n)}
                    </p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>
                      {formatDuracion(clase.duration_seconds)}
                    </p>
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
