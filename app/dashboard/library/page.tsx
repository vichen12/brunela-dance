import Link from "next/link";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  formatDurationLabel,
  resolveI18nText,
  safePercent,
  type MembershipTier,
  type VideoStatus,
} from "@/src/features/studio/helpers";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type VideoRecord = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  membership_tier_required: MembershipTier;
  duration_seconds: number;
  category_slugs: string[];
  thumbnail_url: string | null;
  is_featured: boolean;
  status: VideoStatus;
};

type ProgressRecord = { video_id: string; completion_percent: number };

// ── Admin inline actions ──────────────────────────────────────────────────────

async function quickPublishToggleAction(formData: FormData) {
  "use server";
  const supabase = createSupabaseAdminClient();
  const id = String(formData.get("id") ?? "");
  const current = formData.get("status") as string;
  const next = current === "published" ? "draft" : "published";
  await supabase.from("videos").update({ status: next }).eq("id", id);
  revalidatePath("/dashboard/library");
  revalidatePath("/admin/videos");
}

async function quickDeleteVideoAction(formData: FormData) {
  "use server";
  const supabase = createSupabaseAdminClient();
  const id = String(formData.get("id") ?? "");
  await supabase.from("videos").delete().eq("id", id);
  revalidatePath("/dashboard/library");
  revalidatePath("/admin/videos");
  redirect("/dashboard/library" as never);
}

// ── Styles ───────────────────────────────────────────────────────────────────

const TIER_META: Record<string, { bg: string; color: string; label: string }> = {
  none:            { bg: "#f5f5f4", color: "#78716c", label: "Básico" },
  corps_de_ballet: { bg: "#fdf2f8", color: "#be185d", label: "Corps" },
  solista:         { bg: "#fce7f3", color: "#9d174d", label: "Solista" },
  principal:       { bg: "#1c1917", color: "#fdf2f8", label: "Principal" },
};

const CAT_GRADIENTS: Record<string, string> = {
  ballet:     "linear-gradient(145deg, #fce7f3 0%, #f9a8d4 100%)",
  reformer:   "linear-gradient(145deg, #fdf2f8 0%, #f472b6 100%)",
  mat:        "linear-gradient(145deg, #fce7f3 0%, #ec4899 100%)",
  stretching: "linear-gradient(145deg, #fdf4ff 0%, #e879f9 100%)",
  pbt:        "linear-gradient(145deg, #fdf2f8 0%, #db2777 100%)",
  pct:        "linear-gradient(145deg, #fff1f2 0%, #be185d 100%)",
};

function catGradient(slugs: string[]): string {
  for (const s of slugs) if (CAT_GRADIENTS[s]) return CAT_GRADIENTS[s];
  return "linear-gradient(145deg, #fdf2f8 0%, #fbcfe8 100%)";
}

const FIXED_FILTERS = [
  { key: "all",        label: "Todas"        },
  { key: "ballet",     label: "Ballet"       },
  { key: "reformer",   label: "P. Reformer"  },
  { key: "mat",        label: "Pilates Mat"  },
  { key: "stretching", label: "Stretching"   },
  { key: "pbt",        label: "PBT"          },
  { key: "pct",        label: "PCT"          },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardLibraryPage({ searchParams }: { searchParams?: SearchParams }) {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const activeCategory = typeof params.category === "string" ? params.category : "all";

  const { data: profileData } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single<{ is_admin: boolean }>();

  const isAdmin = profileData?.is_admin ?? false;

  const [{ data: videosData }, { data: progressData }] = await Promise.all([
    supabase.from("videos")
      .select("id, slug, title_i18n, description_i18n, membership_tier_required, duration_seconds, category_slugs, thumbnail_url, is_featured, status")
      .order("is_featured", { ascending: false })
      .order("published_at", { ascending: false }),
    supabase.from("user_progress").select("video_id, completion_percent").eq("user_id", user.id),
  ]);

  const videos = (videosData ?? []) as VideoRecord[];
  const progressMap = new Map(((progressData ?? []) as ProgressRecord[]).map((p) => [p.video_id, p]));

  const dbCats = Array.from(new Set(videos.flatMap((v) => v.category_slugs).filter(Boolean))).sort();
  const filters = [
    FIXED_FILTERS[0],
    ...FIXED_FILTERS.slice(1).filter((f) => dbCats.includes(f.key)),
    ...dbCats.filter((c) => !FIXED_FILTERS.some((f) => f.key === c)).map((c) => ({ key: c, label: c })),
  ];

  const visible = activeCategory === "all" ? videos : videos.filter((v) => v.category_slugs.includes(activeCategory));

  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">

        {/* Header */}
        <header className="hero-stage" style={{ position: "relative" }}>
          <p className="eyebrow">Biblioteca de clases</p>
          <h1 className="display mt-5 text-5xl leading-none md:text-7xl">
            {isAdmin ? "Gestión de clases." : "Tus clases."}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-[color:var(--ink-soft)]">
            {isAdmin
              ? "Publicá, editá y organizá todas las clases del estudio."
              : "Todo el contenido disponible según tu plan, con progreso guardado clase por clase."}
          </p>
          {isAdmin && (
            <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              <a
                href="/admin/videos"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 20px", borderRadius: 99,
                  background: "var(--pink)", color: "#fff",
                  fontSize: 12, fontWeight: 700, textDecoration: "none",
                  boxShadow: "0 4px 14px rgba(190,24,93,0.35)",
                }}
              >
                <span style={{ fontSize: 15 }}>+</span> Nueva clase
              </a>
              <a
                href="/admin/categories"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 20px", borderRadius: 99,
                  background: "#fdf2f8", color: "var(--pink)",
                  border: "1.5px solid #fce7f3",
                  fontSize: 12, fontWeight: 700, textDecoration: "none",
                }}
              >
                🗂️ Categorías
              </a>
            </div>
          )}
        </header>

        {/* Admin bar — visible to admin only */}
        {isAdmin && (
          <div style={{
            borderRadius: 18, padding: "14px 20px",
            background: "linear-gradient(135deg, #1c1917, #292524)",
            border: "1px solid #44403c",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>🎬</span>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#fdf2f8" }}>Modo administración</p>
                <p style={{ fontSize: 10, color: "#a8a29e", marginTop: 1 }}>Ves todas las clases incluidas borradores. Los botones de edición aparecen en cada tarjeta.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <a href="/admin/videos" style={{
                padding: "6px 14px", borderRadius: 99, fontSize: 10, fontWeight: 700,
                background: "var(--pink)", color: "#fff", textDecoration: "none",
              }}>Panel completo</a>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {filters.map((f) => (
            <Link
              key={f.key}
              href={f.key === "all" ? "/dashboard/library" : `/dashboard/library?category=${encodeURIComponent(f.key)}`}
              style={{
                padding: "7px 18px", textDecoration: "none", borderRadius: 99,
                fontSize: 12, fontWeight: 700, letterSpacing: "0.02em",
                background: activeCategory === f.key ? "var(--pink)" : "#fdf2f8",
                color: activeCategory === f.key ? "#fff" : "var(--muted)",
                border: activeCategory === f.key ? "none" : "1.5px solid #fce7f3",
                boxShadow: activeCategory === f.key ? "0 4px 12px rgba(190,24,93,0.25)" : "none",
              }}
            >{f.label}</Link>
          ))}
        </div>

        {/* Count */}
        <p className="eyebrow">{visible.length} clases{isAdmin ? ` (${visible.filter(v => v.status !== "published").length} borradores)` : ""}</p>

        {/* Grid */}
        {visible.length === 0 ? (
          <div style={{
            border: "1.5px dashed #fbcfe8", borderRadius: 20, padding: "40px 24px",
            fontSize: 13, color: "var(--muted)", textAlign: "center",
          }}>
            {isAdmin
              ? <>No hay clases todavía. <a href="/admin/videos" style={{ color: "var(--pink)", fontWeight: 700 }}>Subí la primera.</a></>
              : "No hay clases para este filtro todavía."
            }
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
            {visible.map((video) => {
              const pct = safePercent(progressMap.get(video.id)?.completion_percent);
              const title = resolveI18nText(video.title_i18n);
              const desc = resolveI18nText(video.description_i18n);
              const tier = TIER_META[video.membership_tier_required] ?? TIER_META.none;
              const isDraft = video.status !== "published";

              return (
                <div key={video.id} style={{ position: "relative" }}>
                  {/* Draft overlay badge */}
                  {isDraft && isAdmin && (
                    <div style={{
                      position: "absolute", top: 10, left: 10, zIndex: 10,
                      fontSize: 8, fontWeight: 700, letterSpacing: "0.12em",
                      background: "#fef9c3", color: "#854d0e",
                      padding: "3px 8px", borderRadius: 99, textTransform: "uppercase",
                    }}>BORRADOR</div>
                  )}

                  {/* Admin action buttons */}
                  {isAdmin && (
                    <div style={{
                      position: "absolute", top: 10, right: 10, zIndex: 10,
                      display: "flex", gap: 5,
                    }}>
                      <a
                        href={`/admin/videos`}
                        title="Editar en panel"
                        style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: "rgba(255,255,255,0.92)", backdropFilter: "blur(4px)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, textDecoration: "none",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                          border: "1px solid rgba(0,0,0,0.06)",
                        }}
                      >✏️</a>
                      <form action={quickPublishToggleAction} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={video.id}/>
                        <input type="hidden" name="status" value={video.status}/>
                        <button
                          type="submit"
                          title={isDraft ? "Publicar" : "Volver a borrador"}
                          style={{
                            width: 28, height: 28, borderRadius: 8, cursor: "pointer",
                            background: isDraft ? "rgba(190,24,93,0.9)" : "rgba(255,255,255,0.92)",
                            backdropFilter: "blur(4px)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, border: "1px solid rgba(0,0,0,0.06)",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                          }}
                        >{isDraft ? "🚀" : "📥"}</button>
                      </form>
                    </div>
                  )}

                  <Link href={`/dashboard/library/${video.slug}`} style={{ textDecoration: "none", display: "block", height: "100%" }}>
                    <div className="feature-tile" style={{
                      padding: 0, overflow: "hidden", height: "100%", display: "flex", flexDirection: "column",
                      opacity: isDraft && !isAdmin ? 0.5 : 1,
                    }}>
                      {/* Thumbnail */}
                      <div style={{ position: "relative", height: 166, flexShrink: 0 }}>
                        {video.thumbnail_url ? (
                          <img src={video.thumbnail_url} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
                        ) : (
                          <div style={{ width: "100%", height: "100%", background: catGradient(video.category_slugs) }}/>
                        )}
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(28,25,23,0.5) 0%, transparent 55%)" }}/>
                        {video.is_featured && (
                          <div style={{
                            position: "absolute", top: 12, left: 12,
                            fontSize: 8, letterSpacing: "0.15em", fontWeight: 700,
                            background: "var(--pink)", color: "#fff",
                            padding: "4px 10px", borderRadius: 99,
                          }}>DESTACADA</div>
                        )}
                        <div style={{
                          position: "absolute", bottom: 10, right: 12,
                          fontSize: 8, letterSpacing: "0.1em", fontWeight: 700,
                          background: "rgba(28,25,23,0.6)", color: "#fff",
                          padding: "3px 9px", borderRadius: 99,
                        }}>{formatDurationLabel(video.duration_seconds)}</div>
                      </div>

                      {/* Info */}
                      <div style={{ padding: "16px 18px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
                        <p style={{ fontSize: 8, letterSpacing: "0.18em", color: "var(--pink)", marginBottom: 6, fontWeight: 700 }}>
                          {video.category_slugs.slice(0, 2).join(" · ").toUpperCase()}
                        </p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 8, lineHeight: 1.3 }}>
                          {title}
                        </p>
                        {desc && (
                          <p style={{
                            fontSize: 11, color: "var(--muted)", marginBottom: 12, lineHeight: 1.6, flex: 1,
                            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                          }}>{desc}</p>
                        )}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                          <span style={{
                            fontSize: 8, letterSpacing: "0.1em", fontWeight: 700,
                            background: tier.bg, color: tier.color, padding: "4px 10px", borderRadius: 99,
                          }}>{tier.label}</span>
                          {pct > 0 && <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{pct}%</span>}
                        </div>
                        {pct > 0 && (
                          <div style={{ background: "#fce7f3", borderRadius: 99, height: 3, marginTop: 10 }}>
                            <div style={{ background: "linear-gradient(90deg, var(--pink-mid), var(--pink))", height: "100%", width: `${pct}%`, borderRadius: 99 }}/>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}

            {/* Add new card — admin only */}
            {isAdmin && (
              <a href="/admin/videos" style={{ textDecoration: "none" }}>
                <div style={{
                  height: "100%", minHeight: 280, borderRadius: "2rem",
                  border: "2px dashed #fbcfe8", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 12,
                  background: "rgba(253,242,248,0.4)",
                  transition: "background 0.2s, border-color 0.2s",
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: "linear-gradient(135deg, var(--pink), #9d174d)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, color: "#fff", boxShadow: "0 4px 12px rgba(190,24,93,0.3)",
                  }}>+</div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--pink)" }}>Nueva clase</p>
                  <p style={{ fontSize: 11, color: "var(--muted)" }}>Subir video al catálogo</p>
                </div>
              </a>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
