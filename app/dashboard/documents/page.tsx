import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { firmarDescarga } from "@/src/lib/documents/storage";

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

  // Los documentos nuevos guardan la RUTA dentro del bucket privado, no una
  // URL. Se firma aca, del lado del servidor, DESPUES de que RLS ya filtro por
  // plan: firmar es entregar el acceso, asi que no puede pasar antes.
  //
  // Las filas viejas guardaban una URL completa; firmarDescarga() las devuelve
  // tal cual, para que las dos formas convivan.
  const allDocs = await Promise.all(
    ((docs ?? []) as Doc[]).map(async (d) => ({
      ...d,
      file_url: await firmarDescarga(d.file_url),
    }))
  );

  const categories = Array.from(new Set(allDocs.map((d) => d.category_slug).filter(Boolean))) as string[];

  const visible = activeCategory === "all"
    ? allDocs
    : allDocs.filter((d) => d.category_slug === activeCategory);

  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">

        <header className="hero-stage">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">Recursos del estudio</p>
              <h1 className="display mt-5 text-5xl leading-none md:text-7xl">
                Documentos<span style={{ color: "var(--pink)" }}>.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-[color:var(--ink-soft)]">
                Guías, PDFs y material de referencia disponibles según tu plan.
              </p>
            </div>

            <div className="soft-stat flex min-w-[15rem] items-center gap-4 p-5">
              <div style={{
                width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                background: "var(--pink-wash)", color: "var(--pink)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                  <path d="M1.8 4.2A1.2 1.2 0 013 3h3.2l1.4 1.6h4.4A1.2 1.2 0 0113.2 5.8v6A1.2 1.2 0 0112 13H3a1.2 1.2 0 01-1.2-1.2V4.2z"
                    stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="display text-3xl leading-none">{visible.length}</p>
                <p className="mt-1 text-sm text-[color:var(--ink-soft)]">archivos disponibles</p>
              </div>
            </div>
          </div>
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
                  background: activeCategory === f.key ? "var(--pink)" : "var(--pink-wash)",
                  color: activeCategory === f.key ? "#fff" : "var(--muted)",
                  border: activeCategory === f.key ? "none" : "1.5px solid var(--pink-soft)",
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
            border: "1.5px dashed var(--pink-soft)", borderRadius: 26,
            background: "#fff", padding: "52px 28px", textAlign: "center",
          }}>
            <div style={{
              width: 88, height: 88, borderRadius: "50%", margin: "0 auto 24px",
              background: "var(--pink-wash)", color: "var(--pink)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="38" height="38" viewBox="0 0 16 16" fill="none">
                <path d="M5 1.5h5.5L14 5V14H5V1.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                <path d="M10 1.5V5h4" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
              </svg>
            </div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: "var(--pink)", textTransform: "uppercase", marginBottom: 12 }}>
              Sin documentos
            </p>
            <h2 className="display" style={{ fontSize: 27, color: "var(--ink)", lineHeight: 1.3 }}>
              Todavía no hay <span style={{ color: "var(--pink)", fontStyle: "italic" }}>documentos</span> disponibles
            </h2>
            <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 12, lineHeight: 1.7 }}>
              Cuando Brunela suba nuevo material,<br />
              lo vas a encontrar acá listo para leer o descargar.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
              {/* Antes iba un "Avisarme cuando haya material": no existe ningun
                  sistema de avisos. Estas dos salidas si funcionan hoy. */}
              <a href="/dashboard/chat" style={{
                background: "var(--pink)", color: "#fff", textDecoration: "none",
                padding: "12px 24px", borderRadius: 999, fontSize: 13, fontWeight: 700,
              }}>Pedirle material a Brunela</a>
              <a href="/dashboard/plan" style={{
                background: "#fff", color: "var(--pink)", textDecoration: "none",
                border: "1px solid var(--pink-wash)",
                padding: "12px 24px", borderRadius: 999, fontSize: 13, fontWeight: 700,
              }}>Ver mi plan</a>
            </div>
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
                    background: "linear-gradient(135deg, var(--pink-wash), var(--pink-soft))",
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
                        background: "var(--pink-wash)", color: "var(--pink)",
                        padding: "3px 8px", borderRadius: 99, textTransform: "uppercase",
                      }}>{doc.file_type}</span>
                      {doc.membership_tier_required !== "none" && (
                        <span style={{
                          fontSize: 8, fontWeight: 700, letterSpacing: "0.1em",
                          background: "#1c1917", color: "var(--pink-wash)",
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
