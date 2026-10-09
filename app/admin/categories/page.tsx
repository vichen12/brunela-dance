import Link from "next/link";
import { ChevronDown, Info, Pencil, Plus, Trash2 } from "lucide-react";
import { Desplegable } from "@/components/desplegable";
import { AutoDireccion } from "@/components/auto-direccion";
import { AdminBuscador } from "@/components/admin-buscador";
import { requireAdmin } from "@/src/features/auth/guards";
import { BotonEnviar } from "@/components/boton-enviar";
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

const PLANES = [
  { value: "none", label: "Todas las alumnas" },
  { value: "corps_de_ballet", label: "Desde Corps de Ballet" },
  { value: "solista", label: "Desde Solista" },
  { value: "principal", label: "Solo Principal" },
];
const PLAN_CORTO: Record<string, string> = {
  none: "Todas", corps_de_ballet: "Corps", solista: "Solista", principal: "Principal",
};

function Flash({ message, tone }: { message: string | null; tone: "success" | "error" }) {
  if (!message) return null;
  return <div role="status" className={"cat-aviso " + (tone === "success" ? "cat-aviso--ok" : "cat-aviso--error")}>{message}</div>;
}

/** Los campos de una categoria: los mismos para crear y para editar. */
function Campos({ cat }: { cat?: CategoryRecord }) {
  return (
    <>
      <label className="cat-campo">
        <span className="cat-etq">Nombre en español</span>
        <input name="nameEs" defaultValue={cat?.name_i18n.es ?? ""} required placeholder="Ballet clásico" />
      </label>
      <label className="cat-campo">
        <span className="cat-etq">Nombre en inglés</span>
        <input name="nameEn" defaultValue={cat?.name_i18n.en ?? ""} placeholder="Classical ballet" />
      </label>
      <label className="cat-campo">
        <span className="cat-etq">Identificador <small>se completa solo</small></span>
        <input name="slug" defaultValue={cat?.slug ?? ""} required placeholder="ballet-clasico" />
        {!cat && <AutoDireccion desde="nameEs" />}
      </label>
      <label className="cat-campo">
        <span className="cat-etq">Quién la ve</span>
        <Desplegable name="membershipTierRequired" defaultValue={cat?.membership_tier_required ?? "none"} opciones={PLANES} />
      </label>
      <label className="cat-campo cat-campo--ancho">
        <span className="cat-etq">Descripción</span>
        <textarea name="descriptionEs" rows={2} defaultValue={cat?.description_i18n.es ?? ""} placeholder="Para qué sirve esta categoría…" />
      </label>
      <label className="cat-campo">
        <span className="cat-etq">Imagen de portada <small>dirección web</small></span>
        <input name="coverImageUrl" type="url" defaultValue={cat?.cover_image_url ?? ""} placeholder="https://…" />
      </label>
      <label className="cat-campo">
        <span className="cat-etq">Orden <small>la más baja va primero</small></span>
        <input name="sortOrder" type="number" min={0} defaultValue={cat?.sort_order ?? 0} />
      </label>
    </>
  );
}

export default async function AdminCategoriesPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;
  const abrirNueva = params.nueva === "1";

  // Buscador. Sin filtros: son pocas categorias y agregar selectores por
  // agregar seria ruido.
  const q = (typeof params.q === "string" ? params.q : "").trim();

  const { count: totalCategorias } = await supabase
    .from("categories").select("*", { count: "exact", head: true });

  const { data } = await supabase
    .from("categories")
    .select("id, slug, name_i18n, description_i18n, membership_tier_required, cover_image_url, sort_order, is_active")
    .or(q ? `slug.ilike.%${q}%,name_i18n->>es.ilike.%${q}%` : "id.not.is.null")
    .order("sort_order", { ascending: true });

  // Las activas primero: las inactivas son las viejas que la migracion
  // 20260921 apago (pilates, mat, pbt, pct) y mezcladas confunden.
  const categories = ((data ?? []) as CategoryRecord[])
    .sort((x, y) => Number(y.is_active) - Number(x.is_active) || x.sort_order - y.sort_order);
  const activas = categories.filter((c) => c.is_active).length;

  return (
    <main className="cat">
      <style>{CSS}</style>

      <header className="cat-mast">
        <div style={{ minWidth: 0 }}>
          <p className="cat-eyebrow"><span className="cat-raya" />Gestión de contenido</p>
          <h1 className="cat-titulo">Categorías<em>.</em></h1>
          <p className="cat-lede">
            Ordenan los canales de la comunidad: cada categoría puede tener su sala de chat, y decidís qué plan entra.
          </p>
        </div>
        <Link href="/admin/categories?nueva=1#nueva" className="cat-btn cat-btn--lleno">
          <Plus size={16} strokeWidth={2.2} aria-hidden="true" /> Nueva categoría
        </Link>
      </header>

      {/* ⚠️ Lo que esta pantalla NO hace, dicho donde se ve.
          Las categorias del formulario de clases son una lista fija en el
          codigo (src/features/studio/catalogo-clases.ts). Crear una aca no la
          agrega ahi: sin este aviso, se crea una esperando verla al subir una
          clase, no aparece, y se vuelve a crear. */}
      <div className="cat-nota">
        <Info size={17} strokeWidth={2} aria-hidden="true" />
        <p>
          <strong>Las categorías de las clases son fijas</strong> (Ballet, Técnica, Giros y las demás que aparecen al subir una clase).
          Lo que cambies acá afecta a los canales de la comunidad, no a esa lista. Si necesitás una categoría nueva para clases, pedísela a Vincenzo.
        </p>
      </div>

      <Flash message={success} tone="success" />
      <Flash message={error} tone="error" />

      <details className="cat-nueva" id="nueva" open={abrirNueva}>
        <summary>
          <span className="cat-nueva-ico" aria-hidden="true"><Plus size={18} strokeWidth={2.2} /></span>
          <span className="cat-nueva-txt">
            <span className="cat-nueva-titulo">Crear una categoría</span>
            <span className="cat-nueva-sub">Nombre, quién la ve, portada y orden</span>
          </span>
          <ChevronDown size={18} strokeWidth={2} className="cat-flecha" aria-hidden="true" />
        </summary>
        <form action={upsertCategoryAction} className="cat-form">
          <input name="id" type="hidden" value="" />
          <Campos />
          <div className="cat-form-pie">
            <BotonEnviar className="cat-btn cat-btn--lleno" pendingLabel="Creando…">Crear categoría</BotonEnviar>
          </div>
        </form>
      </details>

      <AdminBuscador
        action="/admin/categories"
        q={q}
        placeholder="Buscar categoría"
        total={totalCategorias ?? categories.length}
        mostrando={categories.length}
      />

      {categories.length === 0 ? (
        <div className="cat-vacio">
          <p className="cat-vacio-titulo">{q ? "Ninguna categoría coincide." : "Todavía no hay categorías."}</p>
          {q && <Link href="/admin/categories" className="cat-btn">Ver todas</Link>}
        </div>
      ) : (
        <>
          <p className="cat-cuenta">{activas} {activas === 1 ? "activa" : "activas"} · {categories.length - activas} {categories.length - activas === 1 ? "inactiva" : "inactivas"}</p>
          <ul className="cat-grilla">
            {categories.map((cat) => (
              <li key={cat.id} className={"cat-card" + (cat.is_active ? "" : " es-inactiva")}>
                <div className="cat-portada">
                  {cat.cover_image_url ? <img src={cat.cover_image_url} alt="" /> : <span className="cat-inicial" aria-hidden="true">{(cat.name_i18n.es ?? cat.slug)[0]?.toUpperCase()}</span>}
                  <span className="cat-orden" title="Orden">{cat.sort_order}</span>
                </div>
                <div className="cat-cuerpo">
                  <div className="cat-chips">
                    <span className={"cat-chip" + (cat.membership_tier_required === "none" ? "" : " cat-chip--plan")}>
                      {PLAN_CORTO[cat.membership_tier_required] ?? cat.membership_tier_required}
                    </span>
                    {!cat.is_active && <span className="cat-chip cat-chip--off">Inactiva</span>}
                  </div>
                  <h2 className="cat-nombre">{cat.name_i18n.es ?? cat.slug}</h2>
                  <p className="cat-slug">/{cat.slug}</p>
                  {cat.description_i18n.es && <p className="cat-desc">{cat.description_i18n.es}</p>}
                </div>

                {/* Edicion plegada: antes las 7 categorias mostraban sus 8
                    campos a la vez, 56 campos en pantalla. */}
                <details className="cat-editar">
                  <summary>
                    <Pencil size={14} strokeWidth={2} aria-hidden="true" /> Editar
                    <ChevronDown size={15} strokeWidth={2} className="cat-flecha" aria-hidden="true" />
                  </summary>
                  <form action={upsertCategoryAction} className="cat-form cat-form--chico">
                    <input name="id" type="hidden" value={cat.id} />
                    <Campos cat={cat} />
                    <label className="cat-activa">
                      <input defaultChecked={cat.is_active} name="isActive" type="checkbox" />
                      <span>Activa <small>si la apagás, deja de aparecer pero no se borra</small></span>
                    </label>
                    <div className="cat-form-pie">
                      <BotonEnviar className="cat-btn cat-btn--lleno" pendingLabel="Guardando…">Guardar</BotonEnviar>
                      <BotonEnviar
                        className="cat-btn cat-btn--borrar"
                        pendingLabel="Borrando…"
                        formAction={deleteCategoryAction}
                        confirmar={`¿Borrar la categoría «${cat.name_i18n.es ?? cat.slug}»? Si tiene sala de chat, mejor apagala. No se puede deshacer.`}
                      >
                        <Trash2 size={14} strokeWidth={2} aria-hidden="true" /> Borrar
                      </BotonEnviar>
                    </div>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

const CSS = `
.cat { display: flex; flex-direction: column; }
.cat-mast { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px 28px; flex-wrap: wrap; padding-bottom: clamp(20px, 3vw, 28px); }
.cat-eyebrow { display: inline-flex; align-items: center; gap: 12px; margin-bottom: 14px; font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--pink-deep); }
.cat-raya { display: inline-block; width: 28px; height: 1.5px; background: var(--pink); }
.cat-titulo { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: clamp(40px, 5vw, 68px); line-height: 1; letter-spacing: -0.045em; color: var(--ink); }
.cat-titulo em { font-style: normal; color: var(--pink); }
.cat-lede { margin-top: 14px; max-width: 56ch; font-size: 15px; line-height: 1.7; color: #57534e; }

.cat-btn {
  display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 20px; border-radius: 99px; cursor: pointer;
  border: 1.5px solid #d6d3d1; background: #fff; color: var(--ink); text-decoration: none;
  font: inherit; font-size: 13px; font-weight: 700; white-space: nowrap; transition: border-color .2s, transform .2s, background .2s, color .2s;
}
.cat-btn:hover { border-color: var(--ink); transform: translateY(-1px); }
.cat-btn--lleno { background: var(--pink); border-color: var(--pink); color: #fff; box-shadow: 0 8px 22px -10px rgba(230,79,85,0.7); }
.cat-btn--lleno:hover { background: var(--pink-mid); border-color: var(--pink-mid); }
.cat-btn--borrar { margin-left: auto; color: var(--pink-deep); border-color: var(--pink-line); }
.cat-btn--borrar:hover { background: var(--pink-wash); border-color: var(--pink); }

.cat-nota {
  display: flex; gap: 12px; align-items: flex-start; padding: 14px 18px; margin-bottom: 18px; border-radius: 16px;
  background: #fafaf9; border: 1px solid #e7e5e4; font-size: 13.5px; line-height: 1.6; color: #57534e;
}
.cat-nota svg { flex-shrink: 0; margin-top: 2px; color: var(--pink-mid); }
.cat-nota strong { color: var(--ink); }
.cat-aviso { border-radius: 14px; padding: 12px 16px; margin-bottom: 16px; font-size: 13.5px; font-weight: 600; }
.cat-aviso--ok { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
.cat-aviso--error { background: var(--pink-wash); color: var(--pink-deep); border: 1px solid var(--pink-line); }

.cat-nueva { margin-bottom: 8px; border: 1.5px dashed #e7e5e4; border-radius: 20px; transition: border-color .2s; }
.cat-nueva:hover { border-color: var(--pink-line); }
.cat-nueva[open] { border-style: solid; border-color: var(--pink-line); }
.cat-nueva > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 14px; padding: 16px 20px; user-select: none; }
.cat-nueva > summary::-webkit-details-marker, .cat-editar > summary::-webkit-details-marker { display: none; }
.cat-nueva-ico { width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: var(--pink); color: #fff; transition: transform .35s cubic-bezier(.16,1,.3,1); }
.cat-nueva[open] .cat-nueva-ico { transform: rotate(45deg); }
.cat-nueva-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.cat-nueva-titulo { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 16px; letter-spacing: -0.02em; color: var(--ink); }
.cat-nueva-sub { font-size: 12.5px; color: #78716c; }
.cat-flecha { color: #a8a29e; transition: transform .3s; }
details[open] > summary .cat-flecha { transform: rotate(180deg); }

.cat-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 18px; padding: 6px 22px 22px; }
.cat-form--chico { padding: 14px 0 4px; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.cat-campo { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.cat-campo--ancho { grid-column: 1 / -1; }
.cat-etq { font-size: 10.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #78716c; }
.cat-etq small { margin-left: 6px; font-size: 11px; font-weight: 500; letter-spacing: 0; text-transform: none; color: #a8a29e; }
.cat-campo input, .cat-campo textarea { border-radius: 12px; border: 1.5px solid #e7e5e4; padding: 0.75rem 0.95rem; font-size: 14px; }
.cat-campo input:focus, .cat-campo textarea:focus { border-color: var(--pink); }
.cat-form-pie { grid-column: 1 / -1; display: flex; gap: 10px; align-items: center; padding-top: 4px; }
.cat-activa { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; font-weight: 600; color: var(--ink); cursor: pointer; }
.cat-activa input { width: 17px; height: 17px; margin-top: 2px; accent-color: var(--pink); padding: 0; }
.cat-activa small { display: block; font-size: 12px; font-weight: 400; color: #a8a29e; }

.cat-cuenta { font-size: 12.5px; color: #78716c; margin-bottom: 14px; }
.cat-grilla { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; align-items: start; }
.cat-card {
  border: 1px solid #e7e5e4; border-radius: 20px; background: #fff; overflow: hidden;
  transition: transform .35s cubic-bezier(.16,1,.3,1), box-shadow .35s, border-color .25s;
}
.cat-card:hover { transform: translateY(-3px); border-color: var(--pink-line); box-shadow: 0 20px 36px -22px rgba(176,58,62,0.45); }
.cat-card.es-inactiva { opacity: 0.6; }
.cat-portada {
  position: relative; aspect-ratio: 16 / 7; display: flex; align-items: center; justify-content: center; overflow: hidden;
  background: linear-gradient(145deg, var(--pink-wash), var(--pink-soft));
}
.cat-portada img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.cat-inicial { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 44px; letter-spacing: -0.04em; color: rgba(176,58,62,0.55); }
.cat-orden {
  position: absolute; top: 10px; left: 10px; min-width: 26px; height: 26px; padding: 0 8px; border-radius: 99px;
  display: inline-flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 800;
  background: rgba(255,255,255,0.92); color: var(--ink);
}
.cat-cuerpo { padding: 16px 18px 10px; }
.cat-chips { display: flex; gap: 6px; margin-bottom: 8px; }
.cat-chip { padding: 3px 9px; border-radius: 99px; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; background: #f5f5f4; color: #57534e; }
.cat-chip--plan { background: var(--pink-wash); color: var(--pink-deep); border: 1px solid var(--pink-line); }
.cat-chip--off { background: #fff; color: #78716c; border: 1px solid #e7e5e4; }
.cat-nombre { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 19px; letter-spacing: -0.025em; color: var(--ink); }
.cat-slug { font-size: 12px; color: #a8a29e; margin-top: 2px; }
.cat-desc { margin-top: 8px; font-size: 13px; line-height: 1.55; color: #57534e; }
.cat-editar { border-top: 1px solid #f0eeec; margin: 6px 18px 0; }
.cat-editar > summary {
  list-style: none; cursor: pointer; display: flex; align-items: center; gap: 7px; padding: 12px 0 14px;
  font-size: 13px; font-weight: 700; color: var(--ink); user-select: none;
}
.cat-editar > summary .cat-flecha { margin-left: auto; }
.cat-editar[open] { padding-bottom: 16px; }

.cat-vacio { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 52px 24px; text-align: center; border: 1.5px dashed #e7e5e4; border-radius: 22px; }
.cat-vacio-titulo { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 22px; letter-spacing: -0.025em; color: var(--ink); }

@media (max-width: 640px) {
  .cat-form { grid-template-columns: minmax(0, 1fr); padding: 6px 16px 18px; }
}
`;
