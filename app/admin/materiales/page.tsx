import { Dumbbell, Plus, X } from "lucide-react";
import { AdminAviso, AdminCabecera } from "@/components/admin-ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { agregarMaterialAction, borrarMaterialAction } from "@/src/features/admin/materiales-actions";
import {
  AJUSTE_MATERIALES,
  MATERIAL_OTRO_MAX,
  SIN_MATERIAL,
  materialesDeAjuste,
  type AjusteMateriales,
} from "@/src/features/studio/catalogo-clases";

export const dynamic = "force-dynamic";

/**
 * La lista de materiales que ofrece el formulario de clases. Brunela agrega y
 * borra; borrar no toca las clases que ya lo tienen.
 */
export default async function MaterialesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = (await searchParams) ?? {};

  // Sin cache: recien guardado, tiene que verse.
  const admin = createSupabaseAdminClient();
  const [{ data }, { data: clases }] = await Promise.all([
    admin.from("site_settings").select("value").eq("setting_key", AJUSTE_MATERIALES).maybeSingle<{ value: Partial<AjusteMateriales> }>(),
    admin.from("videos").select("equipment"),
  ]);
  const { lista } = materialesDeAjuste(data?.value);

  // En cuantas clases esta cada uno: ayuda a decidir antes de borrar.
  const usos = new Map<string, number>();
  for (const c of (clases ?? []) as { equipment: string[] | null }[]) {
    for (const m of c.equipment ?? []) usos.set(m, (usos.get(m) ?? 0) + 1);
  }

  return (
    <div className="amt">
      <style>{CSS}</style>
      <AdminAviso mensaje={typeof sp.success === "string" ? sp.success : null} tono="ok" />
      <AdminAviso mensaje={typeof sp.error === "string" ? sp.error : null} tono="error" />
      <AdminCabecera
        eyebrow="Gestión de contenido"
        titulo="Materiales"
        lede="Los que aparecen para tildar al subir o editar una clase. Borrar uno no se lo saca a las clases que ya lo tienen."
      />

      <section className="amt-caja">
        <p className="amt-caja-titulo">Agregar un material</p>
        <form action={agregarMaterialAction} className="amt-nuevo">
          <input name="nombre" required maxLength={MATERIAL_OTRO_MAX} placeholder="Por ejemplo «Banda larga»" aria-label="Nombre del material nuevo" />
          <BotonEnviar className="amt-agregar" pendingLabel="Agregando…">
            <Plus size={16} strokeWidth={2.4} aria-hidden="true" /> Agregar
          </BotonEnviar>
        </form>
      </section>

      <p className="amt-cuenta"><strong>{lista.length} materiales</strong> · aparecen en este orden al subir una clase</p>

      <ul className="amt-lista">
        {lista.map((m) => {
          const n = (usos.get(m.slug) ?? 0) + (m.slug !== m.label ? usos.get(m.label) ?? 0 : 0);
          return (
            <li key={m.slug} className={"amt-item" + (n === 0 ? " es-sin-uso" : "")}>
              <span className="amt-ico" aria-hidden="true"><Dumbbell size={16} strokeWidth={2.2} /></span>
              <span className="amt-txt">
                <span className="amt-nombre">{m.label}</span>
                <span className="amt-usos">{n === 0 ? "Todavía en ninguna clase" : n === 1 ? "En 1 clase" : `En ${n} clases`}</span>
              </span>
              {m.slug === SIN_MATERIAL ? (
                <span className="amt-fijo" title="Se necesita para marcar una clase sin material">Siempre está</span>
              ) : (
                <form action={borrarMaterialAction}>
                  <input type="hidden" name="slug" value={m.slug} />
                  <BotonEnviar className="amt-borrar" pendingLabel="…" confirmar={`¿Sacar «${m.label}» de la lista? Las clases que ya lo tienen lo conservan.`}>
                    <X size={15} strokeWidth={2.4} aria-label={`Borrar ${m.label}`} />
                  </BotonEnviar>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const CSS = `
.amt { display: flex; flex-direction: column; gap: 18px; }
.amt-caja { padding: 18px 20px; border-radius: 24px; background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra); }
.amt-caja-titulo { margin: 0 0 10px; font-size: 14px; font-weight: 900; color: var(--ink); }
.amt-nuevo { display: flex; gap: 10px; flex-wrap: wrap; }
.amt-nuevo input { flex: 1 1 260px; height: 48px; padding: 0 18px; border-radius: 99px; border: 1.5px solid var(--linea-fuerte); background: var(--crema, #FFFAF6); font: inherit; font-size: 15px; color: var(--ink); outline: 0; }
.amt-nuevo input:focus { border-color: var(--pink); background: #fff; box-shadow: 0 0 0 4px rgba(230,79,85,.12); }
.amt-agregar { display: inline-flex; align-items: center; gap: 7px; height: 48px; padding: 0 22px; border-radius: 99px; border: 0; cursor: pointer; background: var(--pink); color: #fff; font: inherit; font-size: 14.5px; font-weight: 800; box-shadow: 0 10px 20px -12px rgba(230,79,85,.9); }
.amt-agregar:hover { background: var(--pink-mid); }
.amt-cuenta { margin: 4px 2px -6px; font-size: 13px; color: var(--muted); }
.amt-cuenta strong { color: var(--ink); }
.amt-lista { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
.amt-item { display: flex; align-items: center; gap: 12px; padding: 12px 10px 12px 12px; border-radius: 20px; background: #fff; border: 1px solid var(--linea); transition: border-color .2s, box-shadow .2s, transform .2s; }
.amt-item:hover { border-color: var(--pink-line); box-shadow: 0 10px 22px -18px rgba(120,50,40,.6); transform: translateY(-1px); }
.amt-ico { width: 38px; height: 38px; flex-shrink: 0; border-radius: 13px; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); }
.amt-item.es-sin-uso .amt-ico { background: #F3EEEC; color: #A08C86; }
.amt-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.amt-nombre { font-size: 14.5px; font-weight: 800; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.amt-usos { font-size: 12px; font-weight: 600; color: var(--muted); }
.amt-fijo { flex-shrink: 0; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 99px; background: var(--rubor); color: var(--pink-deep); }
.amt-borrar { width: 36px; height: 36px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; border: 0; background: transparent; color: #B9A39D; cursor: pointer; transition: background .2s, color .2s; }
.amt-borrar:hover { background: #FDE8E8; color: var(--pink-deep); }
@media (prefers-reduced-motion: reduce) { .amt-item { transition: none; } .amt-item:hover { transform: none; } }
`;
