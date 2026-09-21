"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { invalidarPortada } from "@/src/lib/portada";
import { campo, validar } from "./campos";

/**
 * Lo que Brunela edita de la portada: el tráiler, los certificados y el FAQ.
 *
 * ⚠️ CADA UNA DE ESTAS ES UN ENDPOINT POST PÚBLICO. Todas empiezan con
 *    `requireAdmin()` — es la trampa 4 de CLAUDE.md, y ya costó cuatro actions
 *    que dejaban borrar el catálogo a cualquiera. Lo comprueba
 *    `npm run verificar`.
 *
 * ⚠️ Y TODAS TERMINAN EN `invalidarPortada()`. La portada se lee cacheada a
 *    cinco minutos; sin invalidar, Brunela guarda, ve el cartel verde, y la
 *    página sigue mostrando lo viejo. Es el modo de fallo que ya pasó con los
 *    precios y está escrito en src/lib/settings.ts.
 */

function volver(kind: "success" | "error", msg: string): never {
  redirect(`/admin/portada?${kind}=${encodeURIComponent(msg)}` as never);
}

/** Después de tocar la portada hay que refrescar las dos pantallas. */
function refrescar() {
  invalidarPortada();
  revalidatePath("/admin/portada");
  revalidatePath("/");
}

// ─── Textos sueltos: tráiler y certificados ─────────────────────────────────

export async function guardarCamposDePortadaAction(formData: FormData) {
  await requireAdmin();

  const supabase = createSupabaseAdminClient();
  const pendientes: { key: string; value_i18n: Record<string, unknown> }[] = [];
  const aBorrar: string[] = [];

  for (const [nombre, crudo] of formData.entries()) {
    if (typeof crudo !== "string") continue;

    /**
     * 🔴 ACÁ ES DONDE SE FRENA UNA CLAVE INVENTADA.
     *
     *    Sin esto, un POST fabricado a mano podría escribir cualquier clave en
     *    `landing_texts` — incluidas las que el proveedor de textos SÍ lee. Que
     *    la interfaz no ofrezca el campo no alcanza.
     */
    const c = campo(nombre);
    if (!c) continue;

    const r = validar(c, crudo);
    if ("error" in r) volver("error", r.error);

    const vacio = Array.isArray(r.valor) ? r.valor.length === 0 : r.valor === "";
    if (vacio) {
      // Vaciar un campo BORRA la fila en vez de guardar un vacío. Así el valor
      // vuelve a ser el que trae el código, que es lo que espera quien borra.
      aBorrar.push(c.clave);
    } else {
      pendientes.push({ key: c.clave, value_i18n: { es: r.valor } });
    }
  }

  if (pendientes.length > 0) {
    const { error } = await supabase
      .from("landing_texts")
      .upsert(pendientes, { onConflict: "key" });
    if (error) volver("error", error.message);
  }

  if (aBorrar.length > 0) {
    const { error } = await supabase.from("landing_texts").delete().in("key", aBorrar);
    if (error) volver("error", error.message);
  }

  refrescar();
  volver("success", "Listo, se guardó la portada.");
}

// ─── El FAQ ─────────────────────────────────────────────────────────────────

function leerPregunta(formData: FormData) {
  return {
    pregunta: String(formData.get("pregunta") ?? "").trim(),
    respuesta: String(formData.get("respuesta") ?? "").trim(),
  };
}

export async function crearPreguntaAction(formData: FormData) {
  await requireAdmin();

  const { pregunta, respuesta } = leerPregunta(formData);
  if (pregunta === "" || respuesta === "") {
    volver("error", "La pregunta y la respuesta no pueden estar vacías.");
  }

  const supabase = createSupabaseAdminClient();

  /**
   * Al final de la lista. Se lee el máximo en vez de contar filas: contar da el
   * número equivocado en cuanto se borre una del medio, y dos preguntas con el
   * mismo orden quedan en un orden que decide Postgres.
   */
  const { data: ultima } = await supabase
    .from("landing_faq")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ display_order: number }>();

  const { error } = await supabase.from("landing_faq").insert({
    display_order: (ultima?.display_order ?? 0) + 1,
    // Nace SIN publicar: se escribe, se lee, y recién ahí se muestra.
    is_published: false,
    question_i18n: { es: pregunta },
    answer_i18n: { es: respuesta },
  });
  if (error) volver("error", error.message);

  refrescar();
  volver("success", "Pregunta creada. Publicala cuando esté lista.");
}

export async function editarPreguntaAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) volver("error", "Falta la pregunta a editar.");

  const { pregunta, respuesta } = leerPregunta(formData);
  if (pregunta === "" || respuesta === "") {
    volver("error", "La pregunta y la respuesta no pueden estar vacías.");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("landing_faq")
    .update({ question_i18n: { es: pregunta }, answer_i18n: { es: respuesta } })
    .eq("id", id);
  if (error) volver("error", error.message);

  refrescar();
  volver("success", "Listo, se guardó la pregunta.");
}

export async function publicarPreguntaAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const publicar = formData.get("publicar") === "1";
  if (!id) volver("error", "Falta la pregunta.");

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("landing_faq")
    .update({ is_published: publicar })
    .eq("id", id);

  /**
   * El check de la base impide publicar con el texto en blanco. Si muerde, el
   * error crudo de Postgres no le dice nada a Brunela: se traduce.
   */
  if (error) {
    volver(
      "error",
      error.message.includes("landing_faq_publicada_tiene_contenido")
        ? "Esa pregunta está vacía: escribile la pregunta y la respuesta antes de publicarla."
        : error.message
    );
  }

  refrescar();
  volver("success", publicar ? "Publicada: ya se ve en la portada." : "Despublicada.");
}

export async function borrarPreguntaAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) volver("error", "Falta la pregunta a borrar.");

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("landing_faq").delete().eq("id", id);
  if (error) volver("error", error.message);

  refrescar();
  volver("success", "Pregunta borrada.");
}

export async function moverPreguntaAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const direccion = String(formData.get("direccion") ?? "");
  if (!id || (direccion !== "arriba" && direccion !== "abajo")) {
    volver("error", "No se entendió el movimiento.");
  }

  const supabase = createSupabaseAdminClient();

  /**
   * Se INTERCAMBIAN los dos órdenes en vez de sumar o restar uno.
   *
   * Sumar y restar parece más simple y se rompe en cuanto los números no son
   * consecutivos — que pasa apenas se borra una pregunta del medio. Con el
   * intercambio, el orden puede ser 1, 4, 7 y mover sigue funcionando.
   */
  const { data: todas, error: errorLectura } = await supabase
    .from("landing_faq")
    .select("id, display_order")
    .order("display_order");

  if (errorLectura || !todas) volver("error", errorLectura?.message ?? "No se pudo leer el FAQ.");

  const lista = todas as { id: string; display_order: number }[];
  const i = lista.findIndex((f) => f.id === id);
  if (i === -1) volver("error", "Esa pregunta ya no existe.");

  const j = direccion === "arriba" ? i - 1 : i + 1;
  // En los extremos no hay nada que hacer, y no es un error.
  if (j < 0 || j >= lista.length) {
    refrescar();
    volver("success", "Ya estaba en la punta.");
  }

  const a = lista[i];
  const b = lista[j];
  const { error } = await supabase
    .from("landing_faq")
    .upsert([
      { id: a.id, display_order: b.display_order },
      { id: b.id, display_order: a.display_order },
    ]);
  if (error) volver("error", error.message);

  refrescar();
  volver("success", "Listo, se movió.");
}
