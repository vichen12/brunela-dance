"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { leerCamposDePrecio } from "@/src/features/admin/precio-de-pack";
import { asegurarPrecioDePack } from "@/src/features/admin/precio-de-pack-stripe";
import { destinatariasDelAnuncio, mandarAnuncio } from "@/src/features/correos/anuncio";
import { PREFIJO_ANUNCIO_DE_PACK } from "@/src/features/studio/novedades-reglas";
import { getAppUrl } from "@/src/lib/env";
import {
  AVISO_FALTA_MIGRACION_PACKS_POR_PLAN,
  esFaltaDeColumnaPlanes,
  leerPlanesDeCompra,
} from "@/src/features/studio/packs-reglas";

/**
 * Packs de clases.
 *
 * ⚠️ Cada una es un endpoint POST publico: todas empiezan con requireAdmin().
 *
 * ⚠️ EL PRECIO SE EDITA DESDE DOS LUGARES, y por eso lo interpreta UNO SOLO.
 *    Se carga en el panel del pack -- donde se crea, para no obligar a un ida y
 *    vuelta -- y se revisa en /admin/precios junto a los planes. Las dos
 *    acciones usan `leerCamposDePrecio`, asi que no pueden divergir.
 *
 * ⚠️ EL PRECIO EN STRIPE LO CREA EL SISTEMA (2026-10-27). Crear, editar y
 *    publicar llaman a asegurarPrecioDePack(): Brunela escribe el importe y
 *    nunca ve un codigo de Stripe.
 */

/** Revalida todo lo que muestra packs. La landing entra porque es su vitrina. */
function refrescarPacks() {
  revalidatePath("/admin/packs");
  revalidatePath("/admin/precios");
  revalidatePath("/dashboard/plan");
  revalidatePath("/");
  revalidatePath("/packs");
  revalidatePath("/packs/[slug]", "page");
  revalidatePath("/dashboard");
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

  const { data: creado, error } = await supabase.from("packs").insert({
    slug,
    name_i18n: { es: nombre },
    description_i18n: { es: texto(fd, "descripcionEs") },
    price_cents: Math.round(precio * 100),
    // Nace sin publicar SIEMPRE. Un pack recien creado no tiene clases adentro
    // ni identificador de Stripe: publicado seria una vitrina que no cobra.
    is_published: false,
    show_on_landing: false,
    created_by: user.id,
  }).select("id").single<{ id: string }>();

  if (error) {
    if (error.code === "23505") {
      fallar(`Ya existe un pack con la dirección "${slug}". Elegí otra.`);
    }
    fallar(error.message);
  }

  const cobro = await asegurarPrecioDePack(supabase, creado.id);
  refrescarPacks();
  if ("fallo" in cobro) fallar(cobro.fallo);
  // Vuelve sin ?nueva=1: el alta se cierra y el aviso dice que sigue.
  redirect(`/admin/packs?success=${encodeURIComponent(`"${nombre}" quedó creado. Ahora tocá «Editar y clases» para elegirle las clases.`)}` as never);
}

export async function updatePackAction(fd: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const id = texto(fd, "id");
  const nombre = texto(fd, "nombreEs");
  if (!nombre) fallar("El pack necesita un nombre.");

  const precio = leerCamposDePrecio(fd);
  if ("fallo" in precio) fallar(precio.fallo);

  // "Quien lo puede comprar" (20261009_4). Solo se escribe si el formulario
  // lo mando: sin la migracion el panel lo muestra apagado y no manda nada, y
  // escribir una columna que no existe tiraria el guardado ENTERO (42703).
  const planes = fd.has("quienCompra")
    ? leerPlanesDeCompra(texto(fd, "quienCompra"), fd.getAll("planesCompra"))
    : null;
  if (planes && "fallo" in planes) fallar(planes.fallo);

  const { error } = await supabase
    .from("packs")
    .update({
      slug: texto(fd, "slug"),
      name_i18n: { es: nombre, en: texto(fd, "nombreEn") || undefined },
      description_i18n: { es: texto(fd, "descripcionEs"), en: texto(fd, "descripcionEn") },
      cover_image_url: texto(fd, "portada") || null,
      display_order: Number(texto(fd, "orden")) || 0,
      ...precio,
      ...(planes && "ok" in planes ? { planes_que_pueden_comprar: planes.ok } : {}),
    })
    .eq("id", id);

  if (error) {
    if (esFaltaDeColumnaPlanes(error)) fallar(AVISO_FALTA_MIGRACION_PACKS_POR_PLAN);
    // El trigger packs_price_id_unico levanta un 23505 cuyo mensaje YA nombra al
    // otro pack. Se pasa tal cual: es mejor que cualquier cosa que pudieramos
    // escribir aca.
    fallar(error.message);
  }
  const cobro = await asegurarPrecioDePack(supabase, id);
  refrescarPacks();
  if ("fallo" in cobro) fallar(cobro.fallo);
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

    // Sin precio en Stripe nadie podria pagarlo. Antes se frenaba y habia que
    // ir a pegar un codigo; ahora se crea en el momento.
    if (!priceDelModo) {
      const cobro = await asegurarPrecioDePack(supabase, id);
      if ("fallo" in cobro) fallar(`"${nombre}" no se publicó: ${cobro.fallo}`);
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
 * "Avisar a las alumnas": un anuncio con el nombre y el precio del pack, que
 * sale por el mismo camino que los anuncios del panel (campanita y mail, con su
 * registro de enviados y la baja de cada una).
 *
 * ⚠️ UNA SOLA VEZ POR PACK. Cada anuncio es nuevo para el registro de enviados:
 *    apretar dos veces mandaria dos mails. Por eso se busca antes uno con ese
 *    mismo titulo.
 */
export async function avisarLanzamientoDePackAction(fd: FormData) {
  const { user } = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const { data: pack } = await supabase
    .from("packs")
    .select("slug, name_i18n, description_i18n, price_cents, currency, is_published")
    .eq("id", texto(fd, "id"))
    .maybeSingle<{ slug: string; name_i18n: Record<string, string> | null; description_i18n: Record<string, string> | null; price_cents: number; currency: string; is_published: boolean }>();
  if (!pack) fallar("Ese pack ya no existe.");
  if (!pack.is_published) fallar("Primero publicá el pack: el aviso lleva a comprarlo.");

  const nombre = pack.name_i18n?.es ?? pack.slug;
  const titulo = `${PREFIJO_ANUNCIO_DE_PACK}${nombre}`;
  const { count } = await supabase.from("studio_announcements").select("id", { count: "exact", head: true }).eq("title", titulo);
  if (count) fallar(`Ya avisaste de "${nombre}". El mail sale una sola vez por pack.`);

  const euros = (pack.price_cents / 100).toLocaleString("es-ES", { minimumFractionDigits: pack.price_cents % 100 ? 2 : 0 });
  const descripcion = pack.description_i18n?.es?.trim();
  const contenido = [
    `Ya está a la venta "${nombre}" por ${euros} ${pack.currency.toUpperCase()}, con un solo pago y tuyo para siempre.`,
    descripcion,
    `Miralo acá: ${getAppUrl().replace(/\/$/, "")}/packs/${pack.slug}`,
  ].filter(Boolean).join("\n\n");

  const { data: creado, error } = await supabase.from("studio_announcements").insert({
    title: titulo,
    content: contenido,
    tier_target: "all",
    is_active: true,
    expires_at: null,
    created_by: user.id,
  }).select("id, title, content, tier_target").single<{ id: string; title: string; content: string; tier_target: string }>();
  if (error || !creado) fallar(error?.message ?? "No se pudo crear el aviso.");

  // La lista se arma ahora (para decir a cuantas) y el envio corre en after():
  // Brunela no espera. Un fallo del mail no deshace el anuncio.
  let mensaje = `Avisado: "${nombre}" ya está en las novedades.`;
  try {
    const destinatarias = await destinatariasDelAnuncio(supabase, creado, { incluirSinPlan: true });
    if (destinatarias.length > 0) {
      after(() => mandarAnuncio(supabase, creado, destinatarias).then(() => undefined));
      mensaje += ` Le llega por mail a ${destinatarias.length === 1 ? "1 alumna" : `${destinatarias.length} alumnas`}.`;
    } else {
      mensaje += " Todavía no hay alumnas para mandarle el mail.";
    }
  } catch (e) {
    console.error("[pack] no se pudo armar la lista:", e instanceof Error ? e.message : String(e));
    mensaje += " El mail no salió: no se pudo armar la lista.";
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/announcements");
  redirect(`/admin/packs?success=${encodeURIComponent(mensaje)}` as never);
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
