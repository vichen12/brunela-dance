import Link from "next/link";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
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

const TIER_ORDER: Record<MembershipTier, number> = {
  none: 0, corps_de_ballet: 1, solista: 2, principal: 3,
};

const CAT_GRADIENTS: Record<string, string> = {
  ballet:     "linear-gradient(145deg, #fce7f3 0%, #f9a8d4 100%)",
  reformer:   "linear-gradient(145deg, #fdf2f8 0%, #f472b6 100%)",
  mat:        "linear-gradient(145deg, #fce7f3 0%, #ec4899 100%)",
  stretching: "linear-gradient(145deg, #fdf4ff 0%, #e879f9 100%)",
  pbt:        "linear-gradient(145deg, #fdf2f8 0%, #db2777 100%)",
  pct:        "linear-gradient(145deg, #fff1f2 0%, #be185d 100%)",
};

const CLASS_CATS = [
  { key: "ballet",     label: "Ballet",           sub: "Técnica clásica"   },
  { key: "reformer",   label: "Pilates Reformer",  sub: "Fuerza funcional"  },
  { key: "mat",        label: "Pilates Mat",       sub: "Control de centro" },
  { key: "stretching", label: "Stretching",        sub: "Movilidad activa"  },
  { key: "pbt",        label: "PBT",               sub: "PBT Certificado"   },
  { key: "pct",        label: "PCT",               sub: "PCT Certificado"   },
];

function formatDate() {
  return new Date().toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) + "h";
}

export default async function DashboardPage() {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [
    { data: profile },
    { data: resume },
    { data: liveData },
    { data: progressList },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, membership_tier, is_admin").eq("id", user.id)
      .single<{ full_name: string | null; membership_tier: MembershipTier; is_admin: boolean }>(),
    supabase.from("user_progress")
      .select("max_position_seconds, completion_percent, updated_at, videos(title_i18n, duration_seconds, slug)")
      .eq("user_id", user.id).gt("max_position_seconds", 0)
      .order("updated_at", { ascending: false }).limit(1).maybeSingle<ResumeVideo>(),
    supabase.from("live_sessions")
      .select("id, title_i18n, starts_at, membership_tier_required")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true }).limit(1).maybeSingle<LiveSession>(),
    supabase.from("user_progress").select("video_id, max_position_seconds")
      .eq("user_id", user.id).gt("max_position_seconds", 0),
  ]);

  const tier = profile?.membership_tier ?? "none";
  const isAdmin = profile?.is_admin ?? false;
  const firstName = isAdmin
    ? "Brunela"
    : (profile?.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "alumna");

  const classesWatched = progressList?.length ?? 0;
  const minutesPracticed = Math.floor(
    (progressList ?? []).reduce((acc, p) => acc + p.max_position_seconds, 0) / 60
  );

  const resumeTitle = resume?.videos ? resolveI18nText(resume.videos.title_i18n) : null;
  const resumeProgress = Math.max(8, Math.min(100, Number(resume?.completion_percent ?? 0)));
  const resumeElapsed = Math.floor((Number(resume?.completion_percent ?? 0) / 100) * (resume?.videos?.duration_seconds ?? 0));
  const resumeMin = Math.floor(resumeElapsed / 60);
  const resumeSec = resumeElapsed % 60;

  const canAccessLive = liveData
    ? TIER_ORDER[tier] >= TIER_ORDER[liveData.membership_tier_required]
    : false;

  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">

        {/* Hero */}
        <header className="hero-stage">
          <p className="eyebrow">{formatDate()}</p>
          <h1 className="display mt-5 text-5xl leading-none md:text-6xl">
            Bienvenida de vuelta,<br />
            <em>{firstName}.</em>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-[color:var(--ink-soft)]">
            Tu cuerpo te espera. Seguí donde lo dejaste.
          </p>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {[
            { value: classesWatched, label: "Clases vistas" },
            { value: minutesPracticed, label: "Minutos practicados" },
            { value: "—", label: "Racha semanal" },
          ].map((s, i) => (
            <div key={i} className="panel rounded-[2rem] p-6">
              <p className="display text-5xl leading-none">{s.value}</p>
              <p className="eyebrow mt-4">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Continue watching */}
        <div className="panel rounded-[2rem] p-7">
          <p className="eyebrow mb-5">Continuar viendo</p>
          {resume && resumeTitle ? (
            <Link
              href={`/dashboard/library/${resume.videos!.slug}`}
              className="feature-tile flex gap-0 overflow-hidden rounded-[1.5rem] p-0"
              style={{ textDecoration: "none" }}
            >
              <div
                className="flex-shrink-0"
                style={{
                  width: 180, height: 120,
                  background: "linear-gradient(145deg, #fce7f3, #f9a8d4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: "rgba(190,24,93,0.15)",
                  border: "2px solid rgba(190,24,93,0.6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ width: 0, height: 0, marginLeft: 3,
                    borderTop: "8px solid transparent", borderBottom: "8px solid transparent",
                    borderLeft: "14px solid #be185d" }}
                  />
                </div>
              </div>
              <div style={{ padding: "20px 24px", flex: 1 }}>
                <p className="eyebrow mb-2">
                  {resumeMin}:{String(resumeSec).padStart(2, "0")} visto
                </p>
                <p style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
                  {resumeTitle}
                </p>
                <div style={{ background: "#fce7f3", borderRadius: 99, height: 4 }}>
                  <div style={{
                    background: "linear-gradient(90deg, var(--pink-mid), var(--pink))",
                    height: "100%", width: `${resumeProgress}%`, borderRadius: 99,
                  }}/>
                </div>
                <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                  {resumeProgress}% completado
                </p>
              </div>
            </Link>
          ) : (
            <div style={{
              border: "1.5px dashed #fbcfe8", borderRadius: 20,
              padding: "28px 24px", fontSize: 13, color: "var(--muted)", textAlign: "center",
            }}>
              Todavía no hay progreso guardado. Comenzá con una clase de la biblioteca.
            </div>
          )}
        </div>

        {/* Live session */}
        {liveData && (
          <div className="panel rounded-[2rem] p-7">
            <p className="eyebrow mb-5">Próxima clase en vivo</p>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: canAccessLive ? "#1c1917" : "#fdf2f8",
              borderRadius: 20, padding: "20px 24px",
              border: canAccessLive ? "none" : "1.5px dashed #fbcfe8",
            }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: canAccessLive ? "#fdf2f8" : "var(--ink)" }}>
                  {resolveI18nText(liveData.title_i18n)}
                </p>
                <p style={{ fontSize: 12, marginTop: 4, color: canAccessLive ? "#f9a8d4" : "var(--muted)" }}>
                  {formatTime(liveData.starts_at)}
                </p>
              </div>
              {canAccessLive ? (
                <Link href="/dashboard/live" className="btn btn-pink" style={{ textDecoration: "none", fontSize: "0.7rem" }}>
                  Reservar
                </Link>
              ) : (
                <Link href="/dashboard/plan" className="btn btn-outline" style={{ textDecoration: "none", fontSize: "0.7rem" }}>
                  Actualizar plan
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Class grid */}
        <div>
          <p className="eyebrow mb-5">Tus clases</p>
          <style>{`@media(max-width:767px){.class-cat-grid{grid-template-columns:repeat(2,1fr)!important}}`}</style>
          <div className="class-cat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {CLASS_CATS.map((cat) => (
              <Link
                key={cat.key}
                href={`/dashboard/library?category=${cat.key}`}
                style={{
                  position: "relative", borderRadius: 20, overflow: "hidden",
                  aspectRatio: "4/3", textDecoration: "none", display: "block",
                  boxShadow: "0 4px 20px rgba(190,24,93,0.1)",
                }}
              >
                <div style={{ width: "100%", height: "100%", background: CAT_GRADIENTS[cat.key] }}/>
                <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(to top, rgba(28,25,23,0.7) 30%, transparent)",
                  display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 18,
                }}>
                  <p style={{ fontSize: 9, letterSpacing: "0.16em", color: "rgba(255,255,255,0.6)", marginBottom: 4, fontWeight: 700 }}>
                    {cat.sub.toUpperCase()}
                  </p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "0.02em" }}>
                    {cat.label}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </section>
    </main>
  );
}
