import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { upsertDocumentAction, deleteDocumentAction } from "@/src/features/admin/document-actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Doc = {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string;
  file_size_kb: number | null;
  membership_tier_required: string;
  category_slug: string | null;
  video_slug: string | null;
  is_published: boolean;
  sort_order: number;
};

function Flash({ message, tone }: { message: string | null; tone: "success" | "error" }) {
  if (!message) return null;
  return (
    <div style={{
      borderRadius: 14, padding: "13px 18px", fontSize: 13, fontWeight: 600,
      background: tone === "success" ? "#f0fdf4" : "#fef2f2",
      color: tone === "success" ? "#166534" : "#991b1b",
      border: `1px solid ${tone === "success" ? "#bbf7d0" : "#fecaca"}`,
    }}>{message}</div>
  );
}

const inp = "w-full rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm outline-none focus:border-pink-400 transition";
const lbl = "block text-xs font-bold uppercase tracking-widest text-[color:var(--muted)] mb-2";

const FILE_ICONS: Record<string, string> = {
  pdf: "📄", image: "🖼️", video: "🎬", audio: "🎵", doc: "📝", other: "📎",
};

export default async function AdminDocumentsPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;

  const { data } = await supabase
    .from("documents")
    .select("id, title, description, file_url, file_type, file_size_kb, membership_tier_required, category_slug, video_slug, is_published, sort_order")
    .order("sort_order")
    .order("created_at", { ascending: false });

  const docs = (data ?? []) as Doc[];

  return (
    <main className="space-y-6">
      <header className="hero-stage">
        <p className="eyebrow">Gestión de contenido</p>
        <h1 className="display mt-5 text-5xl leading-none md:text-6xl">Documentos.</h1>
        <p className="mt-5 max-w-xl text-base leading-8 text-[color:var(--ink-soft)]">
          Subí PDFs, imágenes o archivos y asocialos a videos o categorías. Las alumnas los verán según su suscripción.
        </p>
      </header>

      {(success || error) && (
        <div className="space-y-2">
          <Flash message={success} tone="success" />
          <Flash message={error} tone="error" />
        </div>
      )}

      {/* Create */}
      <section className="panel rounded-[2.4rem] p-7 md:p-9">
        <p className="eyebrow mb-6">Nuevo documento</p>
        <form action={upsertDocumentAction} className="grid gap-5 md:grid-cols-2">
          <input name="id" type="hidden" value="" />

          <div className="md:col-span-2">
            <label className={lbl}>Título</label>
            <input className={inp} name="title" required placeholder="Guía de alineación postural" />
          </div>

          <div className="md:col-span-2">
            <label className={lbl}>Descripción</label>
            <textarea className={inp} name="description" rows={2} placeholder="Descripción breve..." />
          </div>

          <div className="md:col-span-2">
            <label className={lbl}>URL del archivo</label>
            <input className={inp} name="fileUrl" required placeholder="https://... (PDF, imagen, etc.)" />
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Subí el archivo a Supabase Storage o cualquier CDN y pegá la URL acá.
            </p>
          </div>

          <div>
            <label className={lbl}>Tipo de archivo</label>
            <select className={inp} name="fileType" defaultValue="pdf">
              <option value="pdf">PDF</option>
              <option value="image">Imagen</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
              <option value="doc">Documento Word</option>
              <option value="other">Otro</option>
            </select>
          </div>

          <div>
            <label className={lbl}>Tamaño (KB)</label>
            <input className={inp} name="fileSizeKb" type="number" min={0} placeholder="1200" />
          </div>

          <div>
            <label className={lbl}>Tier requerido</label>
            <select className={inp} name="membershipTierRequired" defaultValue="none">
              <option value="none">Sin restricción</option>
              <option value="corps_de_ballet">Corps de Ballet</option>
              <option value="solista">Solista</option>
              <option value="principal">Principal</option>
            </select>
          </div>

          <div>
            <label className={lbl}>Orden</label>
            <input className={inp} name="sortOrder" type="number" defaultValue={0} min={0} />
          </div>

          <div>
            <label className={lbl}>Categoría (slug, opcional)</label>
            <input className={inp} name="categorySlug" placeholder="ballet, reformer..." />
          </div>

          <div>
            <label className={lbl}>Video asociado (slug, opcional)</label>
            <input className={inp} name="videoSlug" placeholder="ballet-centro-basico" />
          </div>

          <div className="flex items-center gap-3">
            <input name="isPublished" type="checkbox" style={{ accentColor: "var(--pink)", width: 15, height: 15 }} />
            <label className="text-sm font-semibold text-[color:var(--ink)]">Publicado (visible para alumnas)</label>
          </div>

          <div className="md:col-span-2">
            <button className="button-primary" type="submit">Guardar documento</button>
          </div>
        </form>
      </section>

      {/* List */}
      <section className="panel rounded-[2.4rem] p-7 md:p-9">
        <p className="eyebrow mb-6">Documentos — {docs.length}</p>

        {docs.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No hay documentos todavía.</p>
        ) : (
          <div className="space-y-3">
            {docs.map((doc) => (
              <div key={doc.id} style={{
                borderRadius: 18, border: "1px solid #fce7f3",
                background: "rgba(255,255,255,0.7)", overflow: "hidden",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 20px", borderBottom: "1px solid #fce7f3",
                  background: "rgba(253,242,248,0.4)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 20 }}>{FILE_ICONS[doc.file_type] ?? "📎"}</span>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{doc.title}</p>
                      <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                        <span style={{ fontSize: 9, color: "var(--muted)" }}>{doc.file_type.toUpperCase()}</span>
                        {doc.file_size_kb && <span style={{ fontSize: 9, color: "var(--muted)" }}>{doc.file_size_kb > 1000 ? `${(doc.file_size_kb/1000).toFixed(1)} MB` : `${doc.file_size_kb} KB`}</span>}
                        {doc.category_slug && <span style={{ fontSize: 9, color: "var(--pink)", fontWeight: 600 }}>{doc.category_slug}</span>}
                        {!doc.is_published && <span style={{ fontSize: 9, background: "#fef9c3", color: "#854d0e", padding: "1px 6px", borderRadius: 99, fontWeight: 700 }}>BORRADOR</span>}
                      </div>
                    </div>
                  </div>
                  <form action={deleteDocumentAction}>
                    <input name="id" type="hidden" value={doc.id} />
                    <button className="button-secondary" type="submit" style={{ padding: "6px 14px", fontSize: "0.7rem" }}>
                      Eliminar
                    </button>
                  </form>
                </div>

                <div style={{ padding: "16px 20px" }}>
                  <form action={upsertDocumentAction} className="grid gap-4 md:grid-cols-3">
                    <input name="id" type="hidden" value={doc.id} />
                    <div>
                      <label className={lbl}>Título</label>
                      <input className={inp} name="title" defaultValue={doc.title} required />
                    </div>
                    <div>
                      <label className={lbl}>URL</label>
                      <input className={inp} name="fileUrl" defaultValue={doc.file_url} required />
                    </div>
                    <div>
                      <label className={lbl}>Tier</label>
                      <select className={inp} name="membershipTierRequired" defaultValue={doc.membership_tier_required}>
                        <option value="none">Sin restricción</option>
                        <option value="corps_de_ballet">Corps de Ballet</option>
                        <option value="solista">Solista</option>
                        <option value="principal">Principal</option>
                      </select>
                    </div>
                    <input name="description" type="hidden" defaultValue={doc.description ?? ""} />
                    <input name="fileType" type="hidden" defaultValue={doc.file_type} />
                    <input name="fileSizeKb" type="hidden" defaultValue={doc.file_size_kb ?? ""} />
                    <input name="categorySlug" type="hidden" defaultValue={doc.category_slug ?? ""} />
                    <input name="videoSlug" type="hidden" defaultValue={doc.video_slug ?? ""} />
                    <input name="sortOrder" type="hidden" defaultValue={doc.sort_order} />
                    <div className="flex items-center gap-3">
                      <input name="isPublished" type="checkbox" defaultChecked={doc.is_published} style={{ accentColor: "var(--pink)", width: 15, height: 15 }} />
                      <span className="text-sm font-semibold text-[color:var(--ink)]">Publicado</span>
                    </div>
                    <div className="md:col-span-3">
                      <button className="button-primary" type="submit" style={{ fontSize: "0.7rem", padding: "0.65rem 1.1rem" }}>
                        Guardar cambios
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
