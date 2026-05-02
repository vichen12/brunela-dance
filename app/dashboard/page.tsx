import Link from "next/link";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { resolveI18nText } from "@/src/features/studio/helpers";

export const dynamic = "force-dynamic";

type MembershipTier = "none" | "corps_de_ballet" | "solista" | "principal";

type ResumeVideo = {
  max_position_seconds: number;
  completion_percent: number;
  updated_at: string;
  videos: { title_i18n: Record<string, string>; duration_seconds: number; slug: string } | null;
};

type LiveSession = {
  id: string;
  title_i18n: Record<string, string>;
  starts_at: string;
  membership_tier_required: MembershipTier;
};

type Announcement = { id: string; title: string; content: string; tier_target: string };

type RecentUser = {
  id: string;
  full_name: string | null;
  membership_tier: MembershipTier;
  created_at: string;
};

const TIER_ORDER: Record<MembershipTier, number> = {
  none: 0, corps_de_ballet: 1, solista: 2, principal: 3,
};

const TIER_LABEL: Record<MembershipTier, string> = {
  none: "Sin plan", corps_de_ballet: "Corps", solista: "Solista", principal: "Principal",
};

const TIER_COLOR: Record<MembershipTier, { bg: string; color: string }> = {
  none:            { bg: "#f1f5f9", color: "#64748b" },
  corps_de_ballet: { bg: "#fdf2f8", color: "#9d174d" },
  solista:         { bg: "#fce7f3", color: "#be185d" },
  principal:       { bg: "#1c1917", color: "#fdf2f8" },
};

const CLASS_CATS = [
  { key: "ballet",     label: "Ballet",           sub: "Tecnica clasica",   grad: "linear-gradient(145deg, #fce7f3, #db2777)" },
  { key: "reformer",   label: "Pilates Reformer",  sub: "Fuerza funcional",  grad: "linear-gradient(145deg, #fdf2f8, #be185d)" },
  { key: "mat",        label: "Pilates Mat",       sub: "Control de centro", grad: "linear-gradient(145deg, #fce7f3, #ec4899)" },
  { key: "stretching", label: "Stretching",        sub: "Movilidad activa",  grad: "linear-gradient(145deg, #fdf4ff, #a855f7)" },
  { key: "pbt",        label: "PBT",               sub: "PBT Certificado",   grad: "linear-gradient(145deg, #fdf2f8, #9d174d)" },
  { key: "pct",        label: "PCT",               sub: "PCT Certificado",   grad: "linear-gradient(145deg, #fff1f2, #be185d)" },
];

const QUICK_LINKS = [
  { href: "/dashboard/library"   as const, label: "Biblioteca",     sub: "Clases a demanda" },
  { href: "/dashboard/programs"  as const, label: "Programas",      sub: "Secuencias dia a dia" },
  { href: "/dashboard/live"      as const, label: "Clases en vivo", sub: "Reservar proxima sesion" },
  { href: "/dashboard/documents" as const, label: "Documentos",     sub: "PDFs y archivos" },
];

function formatDate() {
  return new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) + "h";
}

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days}d`;
  if (days < 30) return `hace ${Math.floor(days / 7)}sem`;
  return `hace ${Math.floor(days / 30)}m`;
}

export default async function DashboardPage() {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, membership_tier, is_admin")
    .eq("id", user.id)
    .single<{ full_name: string | null; membership_tier: MembershipTier; is_admin: boolean }>();

  const isAdmin = profile?.is_admin ?? false;
  const tier = profile?.membership_tier ?? "none";
  const firstName = isAdmin
    ? "Brunela"
    : (profile?.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "alumna");

  const now = new Date().toISOString();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const supabaseAdmin = createSupabaseAdminClient();

  const [
    { data: resume },
    { data: liveData },
    { data: progressList },
    { data: announcementsData },
    { count: totalUsers },
    { count: corpsCount },
    { count: solistaCount },
    { count: principalCount },
    { count: noPlanCount },
    { count: totalVideos },
    { count: publishedVideos },
    { count: draftVideos },
    { count: scheduledLive },
    { count: totalBookings },
    { count: newUsersMonth },
    { count: activeAnnouncements },
    { data: recentUsersRaw },
  ] = await Promise.all([
    supabase.from("user_progress")
      .select("max_position_seconds, completion_percent, updated_at, videos(title_i18n, duration_seconds, slug)")
      .eq("user_id", user.id).gt("max_position_seconds", 0)
      .order("updated_at", { ascending: false }).limit(1).maybeSingle<ResumeVideo>(),
    supabase.from("live_sessions")
      .select("id, title_i18n, starts_at, membership_tier_required")
      .in("status", ["scheduled"]).gte("starts_at", now)
      .order("starts_at", { ascending: true }).limit(1).maybeSingle<LiveSession>(),
    supabase.from("user_progress").select("video_id, max_position_seconds")
      .eq("user_id", user.id).gt("max_position_seconds", 0),
    supabase.from("studio_announcements")
      .select("id, title, content, tier_target").eq("is_active", true)
      .or("expires_at.is.null,expires_at.gt." + now)
      .order("published_at", { ascending: false }).limit(3),
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
  ]);

  const classesWatched = progressList?.length ?? 0;
  const minutesPracticed = Math.floor(
    (progressList ?? []).reduce((acc, p) => acc + p.max_position_seconds, 0) / 60
  );
  const resumeTitle = resume?.videos ? resolveI18nText(resume.videos.title_i18n) : null;
  const resumeProgress = Math.max(8, Math.min(100, Number(resume?.completion_percent ?? 0)));
  const resumeElapsed = Math.floor((Number(resume?.completion_percent ?? 0) / 100) * (resume?.videos?.duration_seconds ?? 0));
  const resumeMin = Math.floor(resumeElapsed / 60);
  const resumeSec = resumeElapsed % 60;
  const canAccessLive = liveData ? TIER_ORDER[tier] >= TIER_ORDER[liveData.membership_tier_required] : false;
  const tierStyle = TIER_COLOR[tier];
  const announcements = (announcementsData ?? []) as Announcement[];
  const recentUsers = (recentUsersRaw ?? []) as RecentUser[];
  const paidUsers = (corpsCount ?? 0) + (solistaCount ?? 0) + (principalCount ?? 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos dias" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  type TierRow = { label: string; count: number; bg: string; color: string; border?: string; barBg: string };
  const TIER_ROWS: TierRow[] = [
    { label: "Principal",       count: principalCount ?? 0, bg: "#1c1917", color: "#fdf2f8", barBg: "#1c1917" },
    { label: "Solista",         count: solistaCount ?? 0,   bg: "#9d174d", color: "#fff",    barBg: "#9d174d" },
    { label: "Corps de Ballet", count: corpsCount ?? 0,     bg: "#fdf2f8", color: "#be185d", border: "1px solid #fbcfe8", barBg: "#f9a8d4" },
    { label: "Sin plan",        count: noPlanCount ?? 0,    bg: "#f5f5f4", color: "#78716c", barBg: "#d4d4d4" },
  ];

  return (
    <main className="pb-20 md:pb-10" style={{ minHeight: "100vh" }}>
      <section style={{ maxWidth: 980, margin: "0 auto", padding: "32px 28px", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── ADMIN SYSTEM OVERVIEW ── */}
        {isAdmin && (
          <>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#be185d", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>
                  {formatDate()}
                </p>
                <h1 style={{ fontFamily: "var(--font-display), serif", fontSize: 32, fontWeight: 800, color: "#1c1917", lineHeight: 1.1, letterSpacing: "-0.01em" }}>
                  Panel de control
                </h1>
              </div>
              <Link href="/admin" style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 20px", borderRadius: 99, textDecoration: "none",
                background: "#1c1917", color: "#fdf2f8",
                fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
              }}>
                Admin completo →
              </Link>
            </div>

            {/* KPI row 1: users */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {([
                { value: totalUsers ?? 0,    label: "Alumnas totales",   accent: "#1c1917", sub: `+${newUsersMonth ?? 0} este mes`,      href: "/admin/users" },
                { value: paidUsers,           label: "Con plan activo",   accent: "#be185d", sub: `${principalCount ?? 0} principal`,     href: "/admin/users" },
                { value: noPlanCount ?? 0,    label: "Sin plan",          accent: "#78716c", sub: "Sin suscripcion activa",               href: "/admin/users" },
                { value: totalBookings ?? 0,  label: "Reservas activas",  accent: "#be185d", sub: `${scheduledLive ?? 0} sesiones prog.`, href: "/admin/live" },
              ] as const).map((s, i) => (
                <Link key={i} href={s.href as never} style={{ textDecoration: "none" }}>
                  <div style={{ background: "#fff", border: "1.5px solid #f0eeec", borderRadius: 16, padding: "18px 20px", height: "100%" }}>
                    <p style={{ fontSize: 32, fontWeight: 800, color: s.accent, letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</p>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#1c1917", marginTop: 7 }}>{s.label}</p>
                    <p style={{ fontSize: 11, color: "#a8a29e", marginTop: 3 }}>{s.sub}</p>
                  </div>
                </Link>
              ))}
            </div>

            {/* KPI row 2: content */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {([
                { value: publishedVideos ?? 0,    label: "Videos publicados",  sub: `${draftVideos ?? 0} borradores`,        href: "/admin/videos" },
                { value: totalVideos ?? 0,        label: "Videos totales",     sub: "En la biblioteca",                      href: "/admin/videos" },
                { value: scheduledLive ?? 0,      label: "Sesiones proximas",  sub: "Programadas y activas",                 href: "/admin/live" },
                { value: activeAnnouncements ?? 0,label: "Anuncios activos",   sub: "Visibles para alumnas",                 href: "/admin/announcements" },
              ] as const).map((s, i) => (
                <Link key={i} href={s.href as never} style={{ textDecoration: "none" }}>
                  <div style={{ background: "#fff", border: "1.5px solid #f0eeec", borderRadius: 16, padding: "18px 20px", height: "100%" }}>
                    <p style={{ fontSize: 32, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</p>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#1c1917", marginTop: 7 }}>{s.label}</p>
                    <p style={{ fontSize: 11, color: "#a8a29e", marginTop: 3 }}>{s.sub}</p>
                  </div>
                </Link>
              ))}
            </div>

            {/* Tier breakdown + Recent signups */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

              {/* Tier breakdown */}
              <div style={{ background: "#fff", border: "1.5px solid #f0eeec", borderRadius: 20, padding: "22px 24px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#a8a29e", textTransform: "uppercase", marginBottom: 18 }}>
                  Distribucion por plan
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {TIER_ROWS.map((row) => {
                    const pct = (totalUsers ?? 0) > 0 ? Math.round((row.count / (totalUsers ?? 1)) * 100) : 0;
                    return (
                      <div key={row.label}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                            background: row.bg, color: row.color, border: row.border,
                            padding: "3px 9px", borderRadius: 99,
                          }}>{row.label.toUpperCase()}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#1c1917" }}>{row.count}</span>
                        </div>
                        <div style={{ height: 4, background: "#f5f5f4", borderRadius: 99 }}>
                          <div style={{ height: "100%", width: `${Math.max(pct, pct > 0 ? 4 : 0)}%`, borderRadius: 99, background: row.barBg }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent signups */}
              <div style={{ background: "#fff", border: "1.5px solid #f0eeec", borderRadius: 20, padding: "22px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#a8a29e", textTransform: "uppercase" }}>
                    Ultimas alumnas
                  </p>
                  <Link href="/admin/users" style={{ fontSize: 11, color: "#be185d", fontWeight: 600, textDecoration: "none" }}>
                    Ver todas →
                  </Link>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {recentUsers.length === 0 ? (
                    <p style={{ fontSize: 12, color: "#a8a29e" }}>No hay alumnas todavia.</p>
                  ) : recentUsers.map((u) => {
                    const badge = TIER_COLOR[u.membership_tier] ?? TIER_COLOR.none;
                    const initial = (u.full_name?.trim()[0] ?? "?").toUpperCase();
                    return (
                      <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                          background: "linear-gradient(135deg, #fdf2f8, #fce7f3)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, color: "#be185d",
                        }}>{initial}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: "#1c1917", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {u.full_name ?? "Sin nombre"}
                          </p>
                          <p style={{ fontSize: 10, color: "#a8a29e" }}>{timeAgo(u.created_at)}</p>
                        </div>
                        <span style={{
                          fontSize: 8, fontWeight: 700, letterSpacing: "0.08em",
                          background: badge.bg, color: badge.color,
                          padding: "2px 7px", borderRadius: 99, flexShrink: 0,
                          border: u.membership_tier === "corps_de_ballet" ? "1px solid #fbcfe8" : undefined,
                        }}>{TIER_LABEL[u.membership_tier].toUpperCase()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Admin quick actions */}
            <div style={{ background: "#fff", border: "1.5px solid #f0eeec", borderRadius: 20, padding: "20px 24px" }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#a8a29e", textTransform: "uppercase", marginBottom: 14 }}>
                Acciones rapidas
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {([
                  { href: "/admin/users",         label: "Gestionar alumnas", icon: "👥" },
                  { href: "/admin/videos",         label: "Subir video",       icon: "🎬" },
                  { href: "/admin/live",           label: "Nueva sesion",      icon: "📡" },
                  { href: "/admin/announcements",  label: "Nuevo anuncio",     icon: "📢" },
                ] as const).map((a) => (
                  <Link key={a.href} href={a.href} style={{
                    display: "flex", flexDirection: "column", gap: 8, textDecoration: "none",
                    padding: "16px 18px", borderRadius: 14, background: "#fafaf9", border: "1.5px solid #f0eeec",
                  }}>
                    <span style={{ fontSize: 20 }}>{a.icon}</span>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#1c1917" }}>{a.label}</p>
                  </Link>
                ))}
              </div>
            </div>

            {/* Section divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "4px 0" }}>
              <div style={{ flex: 1, height: 1, background: "#f0eeec" }} />
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", color: "#c4b5af", textTransform: "uppercase" }}>Tu actividad</p>
              <div style={{ flex: 1, height: 1, background: "#f0eeec" }} />
            </div>
          </>
        )}

        {/* ── PERSONAL SECTION ── */}

        {/* Announcements */}
        {announcements.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {announcements.map((ann) => (
              <div key={ann.id} style={{
                background: "linear-gradient(135deg, #fdf2f8, #fce7f3)",
                border: "1px solid #fbcfe8", borderRadius: 16,
                padding: "14px 20px", display: "flex", gap: 12, alignItems: "flex-start",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: "linear-gradient(135deg, #db2777, #be185d)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginTop: 1,
                }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2v1M8 13v1M2 8H1M15 8h-1M4.2 4.2l-.7-.7M12.5 12.5l-.7-.7M4.2 11.8l-.7.7M12.5 3.5l-.7.7" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="8" cy="8" r="3" stroke="#fff" strokeWidth="1.5" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {ann.title && <p style={{ fontSize: 13, fontWeight: 700, color: "#9d174d", marginBottom: 3 }}>{ann.title}</p>}
                  <p style={{ fontSize: 13, color: "#44403c", lineHeight: 1.5 }}>{ann.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Greeting */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            {!isAdmin && (
              <p style={{ fontSize: 11, fontWeight: 700, color: "#be185d", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
                {formatDate()}
              </p>
            )}
            <h2 style={{
              fontFamily: "var(--font-display), serif",
              fontSize: isAdmin ? 22 : 36, fontWeight: 800, color: "#1c1917",
              lineHeight: 1.1, letterSpacing: "-0.01em",
            }}>
              {greeting}, {firstName}.
            </h2>
            <p style={{ marginTop: 6, fontSize: 13, color: "#78716c", lineHeight: 1.5 }}>
              Tu cuerpo te espera. Segui donde lo dejaste.
            </p>
          </div>
          {!isAdmin && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "6px 16px", borderRadius: 99,
              background: tierStyle.bg, color: tierStyle.color, alignSelf: "flex-start", marginTop: 4,
            }}>{TIER_LABEL[tier]}</span>
          )}
        </div>

        {/* Personal stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { value: classesWatched,   label: "Clases vistas" },
            { value: minutesPracticed, label: "Minutos practicados" },
            { value: "—",             label: "Racha semanal" },
          ].map((s, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid #f0eeec", borderRadius: 16, padding: "20px 22px" }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.02em", lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 12, color: "#78716c", marginTop: 6, fontWeight: 600 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Continue watching */}
        <div style={{ background: "#fff", border: "1px solid #f0eeec", borderRadius: 20, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f9f7f6" }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#a8a29e", textTransform: "uppercase" }}>
              Continuar viendo
            </p>
          </div>
          {resume && resumeTitle ? (
            <Link href={`/dashboard/library/${resume.videos!.slug}` as never} style={{ textDecoration: "none", display: "flex" }}>
              <div style={{
                width: 140, flexShrink: 0, minHeight: 88,
                background: "linear-gradient(145deg, #fce7f3, #f9a8d4)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "rgba(190,24,93,0.15)", border: "2px solid rgba(190,24,93,0.6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ width: 0, height: 0, marginLeft: 3,
                    borderTop: "6px solid transparent", borderBottom: "6px solid transparent",
                    borderLeft: "10px solid #be185d" }} />
                </div>
              </div>
              <div style={{ padding: "18px 20px", flex: 1 }}>
                <p style={{ fontSize: 10, color: "#a8a29e", fontWeight: 600, letterSpacing: "0.08em", marginBottom: 4 }}>
                  {resumeMin}:{String(resumeSec).padStart(2, "0")} visto
                </p>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#1c1917", marginBottom: 12 }}>{resumeTitle}</p>
                <div style={{ background: "#fce7f3", borderRadius: 99, height: 4 }}>
                  <div style={{ background: "linear-gradient(90deg, #db2777, #be185d)", height: "100%", width: `${resumeProgress}%`, borderRadius: 99 }} />
                </div>
                <p style={{ fontSize: 11, color: "#a8a29e", marginTop: 5 }}>{resumeProgress}% completado</p>
              </div>
            </Link>
          ) : (
            <div style={{ padding: "24px 20px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#a8a29e" }}>
                Todavia no hay progreso guardado.{" "}
                <Link href="/dashboard/library" style={{ color: "#be185d", textDecoration: "none", fontWeight: 600 }}>
                  Empeza con una clase →
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Live + Quick links */}
        <div style={{ display: "grid", gridTemplateColumns: liveData ? "1fr 1fr" : "1fr", gap: 12 }}>
          {liveData && (
            <div style={{
              background: canAccessLive ? "#1c1917" : "#fff",
              border: `1px solid ${canAccessLive ? "transparent" : "#f0eeec"}`,
              borderRadius: 20, padding: "20px 22px",
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: canAccessLive ? "#f9a8d4" : "#a8a29e", textTransform: "uppercase", marginBottom: 12 }}>
                Proxima clase en vivo
              </p>
              <p style={{ fontSize: 15, fontWeight: 700, color: canAccessLive ? "#fdf2f8" : "#1c1917", marginBottom: 6 }}>
                {resolveI18nText(liveData.title_i18n)}
              </p>
              <p style={{ fontSize: 12, color: canAccessLive ? "#f9a8d4" : "#78716c", marginBottom: 18 }}>
                {formatTime(liveData.starts_at)}
              </p>
              {canAccessLive ? (
                <Link href="/dashboard/live" style={{
                  display: "inline-block", textDecoration: "none",
                  background: "linear-gradient(135deg, #db2777, #be185d)",
                  color: "#fff", borderRadius: 99, padding: "8px 20px",
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                }}>Reservar lugar</Link>
              ) : (
                <Link href="/dashboard/plan" style={{
                  display: "inline-block", textDecoration: "none",
                  background: "transparent", color: "#be185d",
                  border: "1.5px solid #fce7f3", borderRadius: 99,
                  padding: "7px 18px", fontSize: 11, fontWeight: 700,
                }}>Actualizar plan</Link>
              )}
            </div>
          )}

          <div style={{ background: "#fff", border: "1px solid #f0eeec", borderRadius: 20, padding: "20px 22px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#a8a29e", textTransform: "uppercase", marginBottom: 14 }}>
              Accesos rapidos
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {QUICK_LINKS.map((link) => (
                <Link key={link.href} href={link.href} style={{
                  display: "flex", flexDirection: "column", gap: 2, textDecoration: "none",
                  padding: "10px 12px", borderRadius: 12, background: "#fafaf9", border: "1px solid #f0eeec",
                }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#1c1917" }}>{link.label}</p>
                  <p style={{ fontSize: 11, color: "#a8a29e" }}>{link.sub}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Class categories */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "#a8a29e", textTransform: "uppercase", marginBottom: 14 }}>
            Tus clases
          </p>
          <style>{`@media(max-width:600px){.cat-grid{grid-template-columns:repeat(2,1fr)!important}}`}</style>
          <div className="cat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {CLASS_CATS.map((cat) => (
              <Link key={cat.key} href={`/dashboard/library?category=${cat.key}` as never} style={{
                position: "relative", borderRadius: 18, overflow: "hidden",
                aspectRatio: "4/3", textDecoration: "none", display: "block",
              }}>
                <div style={{ width: "100%", height: "100%", background: cat.grad }} />
                <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(to top, rgba(28,25,23,0.65) 30%, transparent)",
                  display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 14,
                }}>
                  <p style={{ fontSize: 9, letterSpacing: "0.14em", color: "rgba(255,255,255,0.65)", marginBottom: 3, fontWeight: 700 }}>
                    {cat.sub.toUpperCase()}
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{cat.label}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </section>
    </main>
  );
}
