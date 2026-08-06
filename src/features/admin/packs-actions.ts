"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { leerCamposDePrecio } from "@/src/features/admin/precio-de-pack";

/**
 * Packs de clases.
 *
 * ⚠️ Cada una es un endpoint POST publico: todas empiezan con requireAdmin().
 *
 * ⚠️ EL PRECIO SE EDITA DESDE DOS LUGARES, y por eso lo interpreta UNO SOLO.
 *    Se carga en el panel del pack -- donde se crea, para no obligar a un ida y
 *    vuelta -- y se revisa en /admin/precios junto a los planes. Las dos
 *    acciones usan `leerCamposDePrecio`, asi que no pueden divergir.
 */

/** Revalida todo lo que muestra packs. La landing entra porque es su vitrina. */
function refrescarPacks() {
  revalidatePath("/admin/packs");
  revalidatePath("/admin/precios");
  revalidatePath("/dashboard/plan");
  revalidatePath("/");
}

function texto(fd: FormData, campo: string): string {
  return ((fd.get(campo) as string) ?? "").trim();
}

function fallar(mensaje: string): never {
  redirect(`/admin/packs?error=${encodeURIComponent(mensaje)}` as never);
}

export async function createPackAction(fd: FormData) {
  const { user } = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const slug = texto(fd, "slug");
  const nombre = texto(fd, "nombreEs");
  const precio = Number(texto(fd, "precio").replace(",", "."));

  if (!slug) fallar("El pack necesita una dirección (por ejemplo: pack-iniciacion).");
  if (!nombre) fallar("El pack necesita un nombre.");
  if (!Number.isFinite(precio) || precio <= 0) {
    fallar("El precio tiene que ser un número mayor que cero, por ejemplo 24,90.");
  }

  const { error } = await supabase.from("packs").insert({
    slug,
    name_i18n: { es: nombre },
    description_i18n: { es: texto(fd, "descripcionEs") },
    price_cents: Math.round(precio * 100),
    // Nace sin publicar SIEMPRE. Un pack recien creado no tiene clases adentro
    // ni identificador de Stripe: publicado seria una vitrina que no cobra.
    is_published: false,
    show_on_landing: false,
    created_by: user.id,
  });

  if (error) {
    if (error.code === "23505") {
      fallar(`Ya existe un pack con la dirección "${slug}". Elegí otra.`);
    }
    fallar(error.message);
  }

  refrescarPacks();
}

export async function updatePackAction(fd: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const id = texto(fd, "id");
  const nombre = texto(fd, "nombreEs");
  if (!nombre) fallar("El pack necesita un nombre.");

  const precio = leerCamposDePrecio(fd);
  if ("fallo" in precio) fallar(precio.fallo);

  const { error } = await supabase
    .from("packs")
    .update({
      slug: texto(fd, "slug"),
      name_i18n: { es: nombre, en: texto(fd, "nombreEn") || undefined },
      description_i18n: { es: texto(fd, "descripcionEs"), en: texto(fd, "descripcionEn") },
      cover_image_url: texto(fd, "portada") || null,
      display_order: Number(texto(fd, "orden")) || 0,
      ...precio,
    })
    .eq("id", id);

  if (error) {
    // El trigger packs_price_id_unico levanta un 23505 cuyo mensaje YA nombra al
    // otro pack. Se pasa tal cual: es mejor que cualquier cosa que pudieramos
    // escribir aca.
    fallar(error.message);
  }
  refrescarPacks();
}

/**
 * Publicar / despublicar y mostrar / ocultar en la landing.
 *
 * ⚠️ NO SE PUEDE PUBLICAR UN PACK QUE NO PUEDE COBRAR. Sin identificador de
 *    Stripe del modo activo, la alumna llega al checkout y recibe un error. Es
 *    la unica validacion que bloquea, y es porque el fallo lo sufre ella.
 */
export async function togglePackAction(fd: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const id = texto(fd, "id");
  const campo = texto(fd, "campo"); // is_published | show_on_landing | is_featured
  if (!["is_published", "show_on_landing", "is_featured"].includes(campo)) {
    fallar("Acción no reconocida.");
  }
  const valor = texto(fd, "valor") === "true";

  if (valor && (campo === "is_published" || campo === "show_on_landing")) {
    const { data: pack } = await supabase
      .from("packs")
      .select("name_i18n, slug, stripe_price_id_test, stripe_price_id_live, is_published")
      .eq("id", id)
      .maybeSingle<{
        name_i18n: Record<string, string>;
        slug: string;
        stripe_price_id_test: string | null;
        stripe_price_id_live: string | null;
        is_published: boolean;
      }>();

    if (!pack) fallar("Ese pack ya no existe.");

    const modoEsLive = /^(?:sk|rk)_live_/.test((process.env.STRIPE_SECRET_KEY ?? "").trim());
    const priceDelModo = modoEsLive ? pack.stripe_price_id_live : pack.stripe_price_id_test;
    const nombre = pack.name_i18n?.es ?? pack.slug;

    if (!priceDelModo) {
      fallar(
        `"${nombre}" todavía no tiene identificador de Stripe de ${modoEsLive ? "producción" : "prueba"}, ` +
          `así que nadie podría pagarlo. Cargalo en Precios y volvé a intentar.`
      );
    }

    const { count } = await supabase
      .from("pack_videos")
      .select("video_id", { count: "exact", head: true })
      .eq("pack_id", id);

    if (!count) {
      fallar(`"${nombre}" no tiene ninguna clase adentro. Agregale al menos una antes de publicarlo.`);
    }

    if (campo === "show_on_landing" && !pack.is_published) {
      fallar(`"${nombre}" está sin publicar: publicalo primero y después mostralo en la portada.`);
    }
  }

  const { error } = await supabase.from("packs").update({ [campo]: valor }).eq("id", id);
  if (error) fallar(error.message);
  refrescarPacks();
}

/**
 * ⚠️ Un pack VENDIDO no se borra. `pack_purchases.pack_id` es `on delete
 *    restrict`, asi que Postgres lo frena solo -- pero el mensaje que devuelve
 *    es ilegible para Brunela, y sin esta comprobacion previa veria un error de
 *    clave foranea en crudo. Para sacarlo de circulacion se despublica.
 */
export async function deletePackAction(fd: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = texto(fd, "id");

  const { count } = await supabase
    .from("pack_purchases")
    .select("id", { count: "exact", head: true })
    .eq("pack_id", id);

  if (count && count > 0) {
    fallar(
      `Este pack no se puede borrar porque ${count === 1 ? "una alumna lo compró" : `${count} alumnas lo compraron`}. ` +
        `Despublicalo: deja de venderse y quien lo compró conserva sus clases.`
    );
  }

  const { error } = await supabase.from("packs").delete().eq("id", id);
  if (error) fallar(error.message);
  refrescarPacks();
}

export async function addVideoToPackAction(fd: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const packId = texto(fd, "packId");
  const videoId = texto(fd, "videoId");
  if (!videoId) fallar("Elegí una clase para agregar.");

  const { error } = await supabase
    .from("pack_videos")
    .insert({ pack_id: packId, video_id: videoId, display_order: Number(texto(fd, "orden")) || 0 });

  // 23505 = ya estaba en el pack. No es un fallo: el estado deseado ya esta.
  if (error && error.code !== "23505") fallar(error.message);
  refrescarPacks();
}

export async function removeVideoFromPackAction(fd: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();

  // ⚠️ Sacar una clase de un pack se la saca TAMBIEN a quien ya lo compro: el
  //    acceso se calcula en vivo contra pack_videos, no se congela al comprar.
  //    Es lo correcto para corregir un error de armado, pero conviene saberlo.
  const { error } = await supabase
    .from("pack_videos")
    .delete()
    .eq("pack_id", texto(fd, "packId"))
    .eq("video_id", texto(fd, "videoId"));

  if (error) fallar(error.message);
  refrescarPacks();
}
