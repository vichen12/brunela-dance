"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { invalidarAjustes } from "@/src/lib/settings";
import {
  AJUSTE_MATERIALES,
  SIN_MATERIAL,
  limpiarMaterialEscrito,
  materialesDeAjuste,
  type AjusteMateriales,
} from "@/src/features/studio/catalogo-clases";

function volver(kind: "success" | "error", msg: string): never {
  redirect(`/admin/materiales?${kind}=${encodeURIComponent(msg)}` as never);
}

// Se lee SIN cache: se escribe encima de lo que hay ahora, no de lo de hace 5 minutos.
async function leer(): Promise<AjusteMateriales> {
  const { data } = await createSupabaseAdminClient()
    .from("site_settings")
    .select("value")
    .eq("setting_key", AJUSTE_MATERIALES)
    .maybeSingle<{ value: Partial<AjusteMateriales> }>();
  return materialesDeAjuste(data?.value);
}

async function guardar(valor: AjusteMateriales) {
  const { error } = await createSupabaseAdminClient()
    .from("site_settings")
    .upsert(
      {
        setting_key: AJUSTE_MATERIALES,
        category: "clases",
        value: valor,
        description: "Materiales que ofrece el formulario de clases. Se editan en /admin/materiales.",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "setting_key" }
    );
  if (error) volver("error", error.message);
  // Ver src/lib/settings.ts: toda escritura en site_settings invalida la cache.
  invalidarAjustes();
  revalidatePath("/admin/materiales");
  revalidatePath("/admin/videos");
}

export async function agregarMaterialAction(formData: FormData) {
  await requireAdmin();
  const nombre = limpiarMaterialEscrito(String(formData.get("nombre") ?? ""));
  if (!nombre) volver("error", "Escribí el nombre del material.");

  const actual = await leer();
  const clave = nombre.toLowerCase();
  if (actual.lista.some((m) => m.label.toLowerCase() === clave || m.slug.toLowerCase() === clave)) {
    volver("error", `«${nombre}» ya está en la lista.`);
  }
  // Se guarda como texto, igual que lo escrito con «Otro»: lo que se ve es lo que se guarda.
  await guardar({
    lista: [...actual.lista, { slug: nombre, label: nombre }],
    ocultos: actual.ocultos.filter((o) => o.toLowerCase() !== clave),
  });
  volver("success", `Listo, «${nombre}» ya aparece al subir una clase.`);
}

export async function borrarMaterialAction(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  if (!slug || slug === SIN_MATERIAL) volver("error", "«Sin material» no se puede borrar.");

  const actual = await leer();
  const material = actual.lista.find((m) => m.slug === slug);
  if (!material) volver("error", "Ese material ya no estaba en la lista.");

  // Las clases que ya lo tienen lo conservan: borrar de la lista no toca ninguna clase.
  await guardar({
    lista: actual.lista.filter((m) => m.slug !== slug),
    ocultos: [...new Set([...actual.ocultos, material.slug, material.label])],
  });
  volver("success", `Listo, «${material.label}» ya no aparece al subir una clase.`);
}
