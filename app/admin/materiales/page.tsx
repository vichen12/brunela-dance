import { Plus, X } from "lucide-react";
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

      <form action={agregarMaterialAction} className="amt-nuevo">
        <input name="nombre" required maxLength={MATERIAL_OTRO_MAX} placeholder="Nuevo material, por ejemplo «Banda larga»" aria-label="Nombre del material nuevo" />
        <BotonEnviar className="amt-agregar" pendingLabel="Agregando…">
          <Plus size={16} strokeWidth={2.4} aria-hidden="true" /> Agregar
        </BotonEnviar>
      </form>

      <p className="amt-cuenta">{lista.length} materiales, en el orden en que aparecen: «Sin material» primero y el resto alfabético.</p>

      <ul className="amt-lista">
        {lista.map((m) => {
          const n = (usos.get(m.slug) ?? 0) + (m.slug !== m.label ? usos.get(m.label) ?? 0 : 0);
          return (
            <li key={m.slug} className="amt-item">
              <span className="amt-nombre">{m.label}</span>
              <span className="amt-usos">{n === 0 ? "sin usar" : n === 1 ? "1 clase" : `${n} clases`}</span>
              {m.slug === SIN_MATERIAL ? (
                <span className="amt-fijo" title="Se necesita para marcar una clase sin material">fijo</span>
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
.amt { display: flex; flex-direction: column; gap: 16px; max-width: 880px; }
.amt-nuevo { display: flex; gap: 10px; flex-wrap: wrap; }
.amt-nuevo input { flex: 1 1 260px; height: 46px; padding: 0 16px; border-radius: 99px; border: 1.5px solid var(--linea-fuerte); background: #fff; font: inherit; font-size: 15px; color: var(--ink); outline: 0; }
.amt-nuevo input:focus { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.12); }
.amt-agregar { display: inline-flex; align-items: center; gap: 7px; height: 46px; padding: 0 20px; border-radius: 99px; border: 0; cursor: pointer; background: var(--pink); color: #fff; font: inherit; font-size: 14.5px; font-weight: 800; }
.amt-agregar:hover { background: var(--pink-mid); }
.amt-cuenta { margin: 0; font-size: 13px; color: var(--muted); }
.amt-lista { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 8px; }
.amt-item { display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 16px; min-height: 50px; border-radius: 16px; background: #fff; border: 1px solid var(--linea); }
.amt-nombre { flex: 1; min-width: 0; font-size: 14.5px; font-weight: 800; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.amt-usos { font-size: 12px; font-weight: 700; color: var(--muted); white-space: nowrap; }
.amt-fijo { font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 99px; background: var(--rubor); color: var(--pink-deep); }
.amt-borrar { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; border: 0; background: transparent; color: var(--muted); cursor: pointer; }
.amt-borrar:hover { background: #FDE8E8; color: var(--pink-deep); }
`;
