import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { MetricCard, QuickLinksGrid } from "@/components/admin-overview-client";

export const dynamic = "force-dynamic";

function TierBlock({ count, label, pct, bg, color, borderColor }: {
  count: number; label: string; pct: number; bg: string; color: string; borderColor?: string;
}) {
  return (
    <div style={{
      borderRadius: 18, padding: "22px 24px",
      background: bg, border: borderColor ? `1px solid ${borderColor}` : "none",
    }}>
      <p style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1, fontFamily: "var(--font-display), serif" }}>{count}</p>
      <p style={{ marginTop: 8, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color, opacity: 0.75, textTransform: "uppercase" }}>{label}</p>
      <div style={{ marginTop: 12, background: "rgba(0,0,0,0.08)", borderRadius: 99, height: 4 }}>
        <div style={{ height: "100%", width: `${Math.max(pct, 3)}%`, background: color, borderRadius: 99, opacity: 0.7 }} />
      </div>
      <p style={{ marginTop: 5, fontSize: 10, color, opacity: 0.55 }}>{pct}% del total</p>
    </div>
  );
}

export default async function AdminOverviewPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { count: totalUsers },
    { count: newUsersMonth },
    { count: publishedVideos },
    { count: totalVideos },
    { count: completedClasses },
    { count: liveSessions },
    { count: activeBookings },
    { count: totalDocs },
    { count: totalPrograms },
    { data: tierBreakdown },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_admin", false),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_admin", false).gte("created_at", monthStart),
    supabase.from("videos").select("*", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("videos").select("*", { count: "exact", head: true }),
    supabase.from("user_progress").select("*", { count: "exact", head: true }).eq("completion_percent", 100),
    supabase.from("live_sessions").select("*", { count: "exact", head: true }).gte("starts_at", now.toISOString()),
    supabase.from("live_session_bookings").select("*", { count: "exact", head: true }).eq("status", "reserved"),
    supabase.from("documents").select("*", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("programs").select("*", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("profiles").select("membership_tier").eq("is_admin", false),
  ]);

  const tiers = (tierBreakdown ?? []) as { membership_tier: string }[];
  const total = tiers.length || 1;
  const tierCount = tiers.reduce<Record<string, number>>((acc, p) => {
    acc[p.membership_tier] = (acc[p.membership_tier] ?? 0) + 1;
    return acc;
  }, {});

  const hour = now.getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const dateLabel = now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const row1 = [
    {
      label: "Alumnas totales", sub: "perfiles registrados", value: totalUsers ?? 0,
      sparkPoints: "0,24 10,20 20,22 30,16 40,18 50,13 60,10 70,8 80,5",
      trend: `+${newUsersMonth ?? 0} este mes`, trendUp: true, href: "/admin/users",
    },
    {
      label: "Videos publicados", sub: `${totalVideos ?? 0} totales en catálogo`, value: publishedVideos ?? 0,
      sparkPoints: "0,28 10,22 20,26 30,18 40,20 50,14 60,16 70,10 80,8",
      trend: undefined, trendUp: true, href: "/admin/videos",
    },
    {
      label: "Clases completadas", sub: "por todas las alumnas", value: completedClasses ?? 0,
      sparkPoints: "0,26 10,22 20,20 30,18 40,20 50,15 60,14 70,11 80,9",
      trend: undefined, trendUp: true,
    },
    {
      label: "Programas activos", sub: "secuencias publicadas", value: totalPrograms ?? 0,
      sparkPoints: "0,20 10,18 20,20 30,16 40,18 50,16 60,14 70,14 80,12",
      trend: undefined, trendUp: true, href: "/admin/programs",
    },
  ];

  const row2 = [
    {
      label: "Sesiones en vivo", sub: "próximas reservables", value: liveSessions ?? 0,
      sparkPoints: "0,16 10,18 20,14 30,20 40,12 50,18 60,14 70,10 80,12",
      trend: undefined, trendUp: true,
    },
    {
      label: "Reservas activas", sub: "en clases en vivo", value: activeBookings ?? 0,
      sparkPoints: "0,20 10,16 20,18 30,14 40,16 50,12 60,14 70,10 80,8",
      trend: undefined, trendUp: true,
    },
    {
      label: "Documentos", sub: "publicados y accesibles", value: totalDocs ?? 0,
      sparkPoints: "0,24 10,22 20,20 30,22 40,18 50,20 60,16 70,14 80,12",
      trend: undefined, trendUp: true, href: "/admin/documents",
    },
    {
      label: "Nuevas alumnas", sub: "ingresaron este mes", value: newUsersMonth ?? 0,
      sparkPoints: "0,26 10,24 20,22 30,18 40,20 50,14 60,12 70,8 80,6",
      trend: newUsersMonth ? "+100%" : "sin cambios", trendUp: (newUsersMonth ?? 0) > 0,
    },
  ];

  const quickLinks = [
    { href: "/admin/videos",     icon: "🎬", label: "Videos",       desc: "Subir y publicar clases" },
    { href: "/admin/categories", icon: "🗂️", label: "Categorías",   desc: "Crear y configurar" },
    { href: "/admin/programs",   icon: "📋", label: "Programas",    desc: "Secuencias día a día" },
    { href: "/admin/users",      icon: "👥", label: "Alumnas",      desc: "Tiers y permisos" },
    { href: "/admin/documents",  icon: "📄", label: "Documentos",   desc: "PDFs y archivos" },
    { href: "/admin/chat",       icon: "💬", label: "Chat",         desc: "Salas y moderación" },
    { href: "/admin/settings",   icon: "⚙️", label: "Settings",     desc: "Configuración global" },
    { href: "/dashboard",        icon: "🌸", label: "Vista alumna", desc: "Ver como estudiante" },
  ];

  return (
    <main className="space-y-8">

      {/* Greeting header */}
      <div style={{
        borderRadius: 24, padding: "28px 32px",
        background: "linear-gradient(135deg, #fdf2f8 0%, #fff 50%, #fce7f3 100%)",
        border: "1px solid #fce7f3",
        boxShadow: "0 4px 24px rgba(190,24,93,0.06)",
      }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", color: "var(--pink)", textTransform: "uppercase" }}>
          {dateLabel}
        </p>
        <h1 style={{
          fontFamily: "var(--font-display), serif",
          fontSize: 42, fontWeight: 700, lineHeight: 1.1,
          color: "#1c1917", marginTop: 8, letterSpacing: "-0.01em",
        }}>
          {greeting}, Brunela.<span style={{ color: "var(--pink)" }}>✦</span>
        </h1>
        <p style={{ marginTop: 8, fontSize: 13, color: "#78716c", lineHeight: 1.6 }}>
          Aquí está el resumen del estudio. Todo listo para gestionar.
        </p>
      </div>

      {/* Row 1 metrics */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", color: "#a8a29e", textTransform: "uppercase", marginBottom: 14 }}>
          Resumen del estudio
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {row1.map((m) => <MetricCard key={m.label} {...m} />)}
        </div>
      </div>

      {/* Row 2 metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        {row2.map((m) => <MetricCard key={m.label} {...m} />)}
      </div>

      {/* Tier breakdown */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", color: "#a8a29e", textTransform: "uppercase", marginBottom: 14 }}>
          Alumnas por suscripción
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          <TierBlock count={tierCount["principal"] ?? 0}       label="Principal"       pct={Math.round(((tierCount["principal"] ?? 0) / total) * 100)}       bg="#1c1917" color="#fdf2f8" />
          <TierBlock count={tierCount["solista"] ?? 0}         label="Solista"         pct={Math.round(((tierCount["solista"] ?? 0) / total) * 100)}         bg="linear-gradient(135deg,#fdf2f8,#fce7f3)" color="#9d174d" />
          <TierBlock count={tierCount["corps_de_ballet"] ?? 0} label="Corps de Ballet" pct={Math.round(((tierCount["corps_de_ballet"] ?? 0) / total) * 100)} bg="linear-gradient(135deg,#fff0f9,#fce7f3)" color="#be185d" borderColor="#fce7f3" />
          <TierBlock count={tierCount["none"] ?? 0}            label="Sin plan"        pct={Math.round(((tierCount["none"] ?? 0) / total) * 100)}            bg="#f5f5f4" color="#78716c" borderColor="#e7e5e4" />
        </div>
      </div>

      {/* Quick access */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", color: "#a8a29e", textTransform: "uppercase", marginBottom: 14 }}>
          Accesos rápidos
        </p>
        <QuickLinksGrid links={quickLinks} />
      </div>
    </main>
  );
}
