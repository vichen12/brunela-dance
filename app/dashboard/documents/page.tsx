import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

type MembershipTier = "none" | "corps_de_ballet" | "solista" | "principal";

type Doc = {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string;
  file_size_kb: number | null;
  membership_tier_required: MembershipTier;
  category_slug: string | null;
  video_slug: string | null;
};

const FILE_ICONS: Record<string, string> = {
  pdf: "📄", image: "🖼️", video: "🎬", audio: "🎵", doc: "📝", other: "📎",
};

const TIER_LABELS: Record<string, string> = {
  none: "Todas", corps_de_ballet: "Corps", solista: "Solista", principal: "Principal",
};

export default async function DocumentsPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const activeCategory = typeof params.cat === "string" ? params.cat : "all";

  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, description, file_url, file_type, file_size_kb, membership_tier_required, category_slug, video_slug")
    .eq("is_published", true)
    .order("sort_order")
    .order("created_at", { ascending: false });

  const allDocs = (docs ?? []) as Doc[];

  const categories = Array.from(new Set(allDocs.map((d) => d.category_slug).filter(Boolean))) as string[];

  const visible = activeCategory === "all"
    ? allDocs
    : allDocs.filter((d) => d.category_slug === activeCategory);

  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">

        <header className="hero-stage">
          <p className="eyebrow">Recursos del estudio</p>
          <h1 className="display mt-5 text-5xl leading-none md:text-7xl">Documentos.</h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-[color:var(--ink-soft)]">
            Guías, PDFs y material de referencia disponibles según tu plan.
          </p>
        </header>

        {/* Filters */}
        {categories.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[{ key: "all", label: "Todos" }, ...categories.map((c) => ({ key: c, label: c }))].map((f) => (
              <a
                key={f.key}
                href={f.key === "all" ? "/dashboard/documents" : `/dashboard/documents?cat=${f.key}`}
                style={{
                  padding: "7px 18px", borderRadius: 99, textDecoration: "none",
                  fontSize: 12, fontWeight: 700,
                  background: activeCategory === f.key ? "var(--pink)" : "#fdf2f8",
                  color: activeCategory === f.key ? "#fff" : "var(--muted)",
                  border: activeCategory === f.key ? "none" : "1.5px solid #fce7f3",
                  boxShadow: activeCategory === f.key ? "0 4px 12px rgba(190,24,93,0.25)" : "none",
                }}
              >{f.label}</a>
            ))}
          </div>
        )}

        {/* Count */}
        <p className="eyebrow">{visible.length} documentos</p>

        {visible.length === 0 ? (
          <div style={{
            border: "1.5px dashed #fbcfe8", borderRadius: 20, padding: "40px 24px",
            textAlign: "center", color: "var(--muted)", fontSize: 13,
          }}>
            No hay documentos disponibles para tu plan todavía.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {visible.map((doc) => (
              <a
                key={doc.id}
                href={doc.file_url}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: "none" }}
              >
                <div className="feature-tile" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                  {/* Icon area */}
                  <div style={{
                    height: 80, borderRadius: 14, marginBottom: 14,
                    background: "linear-gradient(135deg, #fdf2f8, #fce7f3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 32,
                  }}>
                    {FILE_ICONS[doc.file_type] ?? "📎"}
                  </div>

                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3, marginBottom: 6 }}>
                    {doc.title}
                  </p>
                  {doc.description && (
                    <p style={{
                      fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6, flex: 1,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>{doc.description}</p>
                  )}

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{
                        fontSize: 8, fontWeight: 700, letterSpacing: "0.1em",
                        background: "#fdf2f8", color: "var(--pink)",
                        padding: "3px 8px", borderRadius: 99, textTransform: "uppercase",
                      }}>{doc.file_type}</span>
                      {doc.membership_tier_required !== "none" && (
                        <span style={{
                          fontSize: 8, fontWeight: 700, letterSpacing: "0.1em",
                          background: "#1c1917", color: "#fdf2f8",
                          padding: "3px 8px", borderRadius: 99,
                        }}>{TIER_LABELS[doc.membership_tier_required]}</span>
                      )}
                    </div>
                    {doc.file_size_kb && (
                      <span style={{ fontSize: 10, color: "var(--muted)" }}>
                        {doc.file_size_kb > 1000
                          ? `${(doc.file_size_kb / 1000).toFixed(1)} MB`
                          : `${doc.file_size_kb} KB`}
                      </span>
                    )}
                  </div>

                  <div style={{
                    marginTop: 12, display: "flex", alignItems: "center", gap: 6,
                    color: "var(--pink)", fontSize: 11, fontWeight: 700,
                  }}>
                    <span>Abrir</span>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 10L10 2M10 2H4M10 2v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
