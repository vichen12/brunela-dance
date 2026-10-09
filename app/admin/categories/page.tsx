import { Check, ChevronDown, Info, Pencil, Plus, Search, Shapes, Trash2 } from "lucide-react";
import { AdminAviso, AdminBoton, AdminCabecera, AdminNueva, AdminVacio } from "@/components/admin-ui";
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

      <AdminCabecera
        eyebrow="Gestión de contenido"
        titulo="Categorías"
        lede="Ordenan los canales de la comunidad: cada categoría puede tener su sala de chat, y decidís qué plan entra."
        acciones={<AdminBoton href="/admin/categories?nueva=1#nueva" lleno><Plus size={16} strokeWidth={2.2} aria-hidden="true" /> Nueva categoría</AdminBoton>}
      />

      {/* ⚠️ Lo que esta pantalla NO hace, dicho donde se ve.
          Las categorias del formulario de clases son una lista fija en el
          codigo (src/features/studio/catalogo-clases.ts). Crear una aca no la
          agrega ahi: sin este aviso, se crea una esperando verla al subir una
          clase, no aparece, y se vuelve a crear. */}
      <div className="cat-nota">
        <span className="cat-nota-ico" aria-hidden="true"><Info size={18} strokeWidth={2.2} /></span>
        <p>
          <strong>Las categorías de las clases son fijas</strong> (Ballet, Técnica, Giros y las demás que aparecen al subir una clase).
          Lo que cambies acá afecta a los canales de la comunidad, no a esa lista. Si necesitás una categoría nueva para clases, pedísela a Vincenzo.
        </p>
      </div>

      <AdminAviso mensaje={success} tono="ok" />
      <AdminAviso mensaje={error} tono="error" />

      <AdminNueva abierto={abrirNueva} titulo="Crear una categoría" sub="Nombre, quién la ve, portada y orden">
        <form action={upsertCategoryAction} className="cat-form">
          <input name="id" type="hidden" value="" />
          <Campos />
          <div className="cat-form-pie">
            <BotonEnviar className="cat-btn cat-btn--lleno" pendingLabel="Creando…"><Plus size={16} strokeWidth={2.2} aria-hidden="true" /> Crear categoría</BotonEnviar>
          </div>
        </form>
      </AdminNueva>

      <AdminBuscador
        action="/admin/categories"
        q={q}
        placeholder="Buscar categoría"
        total={totalCategorias ?? categories.length}
        mostrando={categories.length}
      />

      {categories.length === 0 ? (
        <AdminVacio titulo={q ? "Ninguna categoría coincide." : "Todavía no hay categorías."}>
          <span className="cat-vacio-ico" aria-hidden="true">{q ? <Search size={22} strokeWidth={2} /> : <Shapes size={22} strokeWidth={2} />}</span>
          {q ? <AdminBoton href="/admin/categories">Ver todas</AdminBoton> : <p>Creá la primera con «Nueva categoría».</p>}
        </AdminVacio>
      ) : (
        <>
          <p className="cat-cuenta">
            <span className="cat-cuenta-chip es-on">{activas} {activas === 1 ? "activa" : "activas"}</span>
            <span className="cat-cuenta-chip">{categories.length - activas} {categories.length - activas === 1 ? "inactiva" : "inactivas"}</span>
          </p>
          <ul className="cat-grilla">
            {categories.map((cat) => (
              <li key={cat.id} className={"cat-card" + (cat.is_active ? "" : " es-inactiva")}>
                <div className="cat-portada">
                  {cat.cover_image_url ? <img src={cat.cover_image_url} alt="" /> : <span className="cat-inicial" aria-hidden="true">{(cat.name_i18n.es ?? cat.slug)[0]?.toUpperCase()}</span>}
                  <span className="cat-orden" title="Orden">{cat.sort_order}</span>
                </div>
                <div className="cat-cuerpo">
                  <div className="cat-chips">
                    <span className={"cat-chip cat-chip--" + cat.membership_tier_required}>
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
                      <BotonEnviar className="cat-btn cat-btn--lleno" pendingLabel="Guardando…"><Check size={16} strokeWidth={2.4} aria-hidden="true" /> Guardar</BotonEnviar>
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
.cat .ad-vacio .cat-vacio-ico { order: -1; }
.cat-vacio-ico { width: 54px; height: 54px; border-radius: 18px; display: grid; place-items: center; background: #fff; color: var(--pink-deep); box-shadow: var(--sombra); }

.cat-btn {
  display: inline-flex; align-items: center; gap: 8px; height: 46px; padding: 0 20px; border-radius: 99px; cursor: pointer;
  border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); text-decoration: none;
  font: inherit; font-size: 14px; font-weight: 800; white-space: nowrap; transition: border-color .2s, transform .3s var(--curva), background .2s, color .2s;
}
.cat-btn:hover { border-color: var(--pink-line); background: var(--rubor); transform: translateY(-2px); }
.cat-btn--lleno { background: var(--pink); border-color: var(--pink); color: #fff; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); }
.cat-btn--lleno:hover { background: var(--pink-mid); border-color: var(--pink-mid); }
.cat-btn--borrar { margin-left: auto; color: var(--pink-deep); border-color: var(--pink-line); }
.cat-btn--borrar:hover { background: var(--pink-wash); border-color: var(--pink); }

.cat-nota {
  display: flex; gap: 14px; align-items: flex-start; padding: 16px 20px; margin-bottom: 18px; border-radius: 24px;
  background: linear-gradient(140deg, #FFF4E8, #FFFAF6 70%); border: 1px solid #FFE2D3; font-size: 14px; line-height: 1.6; color: #6E5550;
}
.cat-nota-ico { width: 38px; height: 38px; border-radius: 13px; flex-shrink: 0; display: grid; place-items: center; background: #FFE2D3; color: var(--melocoton-deep); }
.cat-nota p { padding-top: 6px; }
.cat-nota strong { color: var(--ink); font-weight: 800; }

.cat-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 18px; padding: 16px 0 0; }
.cat-form--chico { padding: 4px 0 4px; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.cat-campo { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.cat-campo--ancho { grid-column: 1 / -1; }
.cat-etq { font-size: 12.5px; font-weight: 800; color: var(--ink); }
.cat-etq small { margin-left: 6px; font-size: 11.5px; font-weight: 800; color: var(--muted); background: var(--rubor); padding: 2px 9px; border-radius: 99px; }
.cat-campo input, .cat-campo textarea { border-radius: 16px; border: 1.5px solid var(--linea-fuerte); padding: 0.75rem 0.95rem; font-size: 14px; background: #fff; }
.cat-campo input:focus, .cat-campo textarea:focus { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.1); }
.cat-form-pie { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding-top: 4px; }
.cat-activa { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 16px; background: #fff; border: 1px solid var(--linea); font-size: 14px; font-weight: 800; color: var(--ink); cursor: pointer; }
.cat-activa input { width: 18px; height: 18px; margin-top: 2px; accent-color: var(--pink); padding: 0; }
.cat-activa small { display: block; font-size: 12.5px; font-weight: 500; color: var(--muted); }

.cat-cuenta { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
.cat-cuenta-chip { font-size: 12.5px; font-weight: 800; color: var(--muted); background: #F6EEEA; padding: 5px 12px; border-radius: 99px; }
.cat-cuenta-chip.es-on { color: var(--salvia-deep); background: var(--salvia); }
.cat-grilla { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 18px; align-items: start; }
.cat-card {
  border: 1px solid var(--linea); border-radius: 28px; background: #fff; overflow: hidden; box-shadow: var(--sombra);
  transition: transform .35s var(--curva), box-shadow .35s, border-color .25s;
}
.cat-card:hover { transform: translateY(-3px); border-color: var(--linea-fuerte); box-shadow: var(--sombra-alta); }
.cat-card:has(.cat-editar[open]) { transform: none; }
.cat-card.es-inactiva { opacity: 0.62; }
.cat-portada {
  position: relative; aspect-ratio: 16 / 7; display: flex; align-items: center; justify-content: center; overflow: hidden;
  margin: 10px 10px 0; border-radius: 20px;
  background: radial-gradient(140px 100px at 85% 10%, rgba(255,205,185,.9), transparent 70%), linear-gradient(140deg, #FFF1EC 0%, #FDE3E0 100%);
}
.cat-card:nth-child(4n+2) .cat-portada { background: radial-gradient(140px 100px at 85% 10%, rgba(255,226,211,.95), transparent 70%), linear-gradient(140deg, #FFF4E8 0%, #FFE6D6 100%); }
.cat-card:nth-child(4n+3) .cat-portada { background: radial-gradient(140px 100px at 85% 10%, rgba(220,235,214,.95), transparent 70%), linear-gradient(140deg, #F6FAF3 0%, #E7F1E4 100%); }
.cat-card:nth-child(4n+4) .cat-portada { background: radial-gradient(140px 100px at 85% 10%, rgba(234,220,240,.95), transparent 70%), linear-gradient(140deg, #FBF6FC 0%, #F1E6F5 100%); }
.cat-portada img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.cat-inicial {
  width: 58px; height: 58px; border-radius: 20px; display: grid; place-items: center;
  font-weight: 900; font-size: 28px; color: var(--pink-deep); background: rgba(255,255,255,.85); box-shadow: 0 12px 24px -16px rgba(176,70,70,.6);
  transition: transform .45s var(--curva);
}
.cat-card:hover .cat-inicial { transform: rotate(-6deg) scale(1.06); }
.cat-orden {
  position: absolute; top: 10px; left: 10px; min-width: 28px; height: 28px; padding: 0 9px; border-radius: 99px;
  display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900;
  background: rgba(255,255,255,0.92); color: var(--ink);
}
.cat-cuerpo { padding: 14px 18px 10px; }
.cat-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.cat-chip { padding: 4px 11px; border-radius: 99px; font-size: 12px; font-weight: 800; background: var(--crema); color: #6E5550; border: 1px solid var(--linea); }
.cat-chip--corps_de_ballet { background: #fff; color: var(--pink-deep); border-color: var(--pink-line); }
.cat-chip--solista { background: var(--rubor); color: var(--pink-deep); border-color: var(--pink-line); }
.cat-chip--principal { background: var(--pink); color: #fff; border-color: var(--pink); }
.cat-chip--off { background: #F6EEEA; color: var(--muted); border-color: transparent; }
.cat-nombre { font-weight: 900; font-size: 19px; line-height: 1.2; letter-spacing: -0.02em; color: var(--ink); }
.cat-slug { font-size: 12.5px; font-weight: 600; color: #B39189; margin-top: 2px; }
.cat-desc { margin-top: 8px; font-size: 13.5px; line-height: 1.55; color: #6E5550; }
.cat-editar { margin: 6px 12px 12px; border-radius: 18px; background: var(--crema); border: 1px solid var(--linea); }
.cat-editar[open] { background: #fff; padding: 0 12px 12px; }
.cat-editar > summary {
  list-style: none; cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 0 14px; min-height: 46px; border-radius: 18px;
  font-size: 14px; font-weight: 800; color: var(--ink); user-select: none; transition: background .2s;
}
.cat-editar[open] > summary { padding: 0 2px; }
.cat-editar > summary:hover { background: var(--rubor); }
.cat-editar > summary::-webkit-details-marker { display: none; }
.cat-editar > summary svg:first-child { color: var(--pink-deep); }
.cat-flecha { color: #B39189; transition: transform .3s; }
details[open] > summary .cat-flecha { transform: rotate(180deg); }
.cat-editar > summary .cat-flecha { margin-left: auto; }

@media (max-width: 640px) {
  .cat-form { grid-template-columns: minmax(0, 1fr); }
  .cat-nota { padding: 14px 16px; }
}
@media (prefers-reduced-motion: reduce) { .cat-card:hover { transform: none; } }
`;
