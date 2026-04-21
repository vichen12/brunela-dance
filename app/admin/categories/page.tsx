import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { upsertCategoryAction, deleteCategoryAction } from "@/src/features/admin/category-actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type CategoryRecord = {
  id: string;
  slug: string;
  name_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  membership_tier_required: string;
  cover_image_url: string | null;
  sort_order: number;
  is_active: boolean;
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

const inputCls = "w-full rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition";
const labelCls = "block text-xs font-bold uppercase tracking-widest text-[color:var(--muted)] mb-2";

export default async function AdminCategoriesPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;

  const { data } = await supabase
    .from("categories")
    .select("id, slug, name_i18n, description_i18n, membership_tier_required, cover_image_url, sort_order, is_active")
    .order("sort_order", { ascending: true });

  const categories = (data ?? []) as CategoryRecord[];

  return (
    <main className="space-y-6">
      <header className="hero-stage">
        <p className="eyebrow">Gestión de contenido</p>
        <h1 className="display mt-5 text-5xl leading-none md:text-6xl">Categorías.</h1>
        <p className="mt-5 max-w-xl text-base leading-8 text-[color:var(--ink-soft)]">
          Creá y configurá las categorías de clases. Cada una puede tener su propio tier de acceso, imagen y orden.
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
        <p className="eyebrow mb-6">Nueva categoría</p>
        <form action={upsertCategoryAction} className="grid gap-5 md:grid-cols-2">
          <input name="id" type="hidden" value="" />

          <div>
            <label className={labelCls}>Slug</label>
            <input className={inputCls} name="slug" required placeholder="ballet-clasico" />
          </div>

          <div>
            <label className={labelCls}>Nombre en Español</label>
            <input className={inputCls} name="nameEs" required placeholder="Ballet Clásico" />
          </div>

          <div>
            <label className={labelCls}>Nombre en Inglés</label>
            <input className={inputCls} name="nameEn" placeholder="Classical Ballet" />
          </div>

          <div>
            <label className={labelCls}>Tier requerido</label>
            <select className={inputCls} name="membershipTierRequired" defaultValue="none">
              <option value="none">Sin restricción (todas)</option>
              <option value="corps_de_ballet">Corps de Ballet</option>
              <option value="solista">Solista</option>
              <option value="principal">Principal</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className={labelCls}>Descripción en Español</label>
            <textarea className={inputCls} name="descriptionEs" rows={2} placeholder="Técnica clásica de ballet..." />
          </div>

          <div>
            <label className={labelCls}>Cover Image URL</label>
            <input className={inputCls} name="coverImageUrl" type="url" placeholder="https://..." />
          </div>

          <div>
            <label className={labelCls}>Orden (número)</label>
            <input className={inputCls} name="sortOrder" type="number" defaultValue={0} min={0} />
          </div>

          <div className="md:col-span-2">
            <button className="button-primary" type="submit">Crear categoría</button>
          </div>
        </form>
      </section>

      {/* List */}
      <section className="panel rounded-[2.4rem] p-7 md:p-9">
        <p className="eyebrow mb-6">Categorías existentes — {categories.length}</p>

        {categories.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">
            Todavía no hay categorías. Crea la primera arriba.
          </p>
        ) : (
          <div className="space-y-4">
            {categories.map((cat) => (
              <div key={cat.id} style={{
                borderRadius: 20, border: "1px solid #fce7f3",
                background: "rgba(255,255,255,0.7)", overflow: "hidden",
              }}>
                {/* Header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 22px", borderBottom: "1px solid #fce7f3",
                  background: "rgba(253,242,248,0.5)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
                      {cat.name_i18n.es ?? cat.slug}
                    </span>
                    <span style={{
                      fontSize: 8, letterSpacing: "0.12em", fontWeight: 700,
                      background: cat.membership_tier_required === "none" ? "#f5f5f4" : "#fdf2f8",
                      color: cat.membership_tier_required === "none" ? "var(--muted)" : "var(--pink)",
                      padding: "3px 9px", borderRadius: 99,
                    }}>
                      {cat.membership_tier_required === "none" ? "TODAS" : cat.membership_tier_required.toUpperCase().replace("_", " ")}
                    </span>
                    {!cat.is_active && (
                      <span style={{
                        fontSize: 8, letterSpacing: "0.12em", fontWeight: 700,
                        background: "#fef2f2", color: "#991b1b", padding: "3px 9px", borderRadius: 99,
                      }}>INACTIVA</span>
                    )}
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>/{cat.slug}</span>
                  </div>
                  <form action={deleteCategoryAction} style={{ display: "inline" }}>
                    <input name="id" type="hidden" value={cat.id} />
                    <button
                      type="submit"
                      className="button-secondary"
                      style={{ padding: "6px 14px", fontSize: "0.7rem" }}
                    >
                      Eliminar
                    </button>
                  </form>
                </div>

                {/* Edit form */}
                <div style={{ padding: "20px 22px" }}>
                  <form action={upsertCategoryAction} className="grid gap-4 md:grid-cols-2">
                    <input name="id" type="hidden" value={cat.id} />

                    <div>
                      <label className={labelCls}>Slug</label>
                      <input className={inputCls} name="slug" defaultValue={cat.slug} required />
                    </div>

                    <div>
                      <label className={labelCls}>Nombre ES</label>
                      <input className={inputCls} name="nameEs" defaultValue={cat.name_i18n.es ?? ""} required />
                    </div>

                    <div>
                      <label className={labelCls}>Nombre EN</label>
                      <input className={inputCls} name="nameEn" defaultValue={cat.name_i18n.en ?? ""} />
                    </div>

                    <div>
                      <label className={labelCls}>Tier requerido</label>
                      <select className={inputCls} name="membershipTierRequired" defaultValue={cat.membership_tier_required}>
                        <option value="none">Sin restricción</option>
                        <option value="corps_de_ballet">Corps de Ballet</option>
                        <option value="solista">Solista</option>
                        <option value="principal">Principal</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className={labelCls}>Descripción ES</label>
                      <textarea className={inputCls} name="descriptionEs" rows={2} defaultValue={cat.description_i18n.es ?? ""} />
                    </div>

                    <div>
                      <label className={labelCls}>Cover Image URL</label>
                      <input className={inputCls} name="coverImageUrl" defaultValue={cat.cover_image_url ?? ""} type="url" />
                    </div>

                    <div>
                      <label className={labelCls}>Orden</label>
                      <input className={inputCls} name="sortOrder" type="number" defaultValue={cat.sort_order} min={0} />
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        defaultChecked={cat.is_active}
                        name="isActive"
                        type="checkbox"
                        style={{ accentColor: "var(--pink)", width: 15, height: 15 }}
                      />
                      <label className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                        Categoría activa
                      </label>
                    </div>

                    <div className="md:col-span-2">
                      <button className="button-primary" type="submit" style={{ fontSize: "0.7rem", padding: "0.7rem 1.2rem" }}>
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
