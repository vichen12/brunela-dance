"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { invalidarAjustes } from "@/src/lib/settings";
import type { SubscriptionCatalog } from "@/src/lib/stripe/catalog";

/**
 * Precios: los tres planes y los packs.
 *
 * ⚠️ Cada una es un endpoint POST publico: todas empiezan con requireAdmin().
 *
 * POR QUE ESTO NO VALIDA CONTRA STRIPE ANTES DE GUARDAR
 *   Es deliberado. Brunela pidio ver el aviso, no que le bloqueen el guardado, y
 *   tiene razon: hay un momento legitimo en el que el importe y el price id NO
 *   coinciden -- justo cuando esta migrando de precio y todavia no toco Stripe.
 *   Bloquear ahi la dejaria trabada sin salida.
 *
 *   La comprobacion vive en la pantalla (src/lib/stripe/verificar-precio.ts) y
 *   es informativa. Lo que SI se valida aca es lo que puede romper el sistema
 *   solo: numeros que no son numeros, y precios negativos.
 */

/** Los importes se muestran en euros y se guardan en euros, como ya venia el catalogo. */
function aNumero(fd: FormData, campo: string): number | null {
  const crudo = ((fd.get(campo) as string) ?? "").trim().replace(",", ".");
  if (!crudo) return null;
  const n = Number(crudo);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function aTexto(fd: FormData, campo: string): string | null {
  const v = ((fd.get(campo) as string) ?? "").trim();
  return v.length > 0 ? v : null;
}

export async function guardarPreciosDePlanesAction(fd: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const { data: fila } = await supabase
    .from("site_settings")
    .select("value")
    .eq("setting_key", "subscriptions.catalog")
    .maybeSingle<{ value: SubscriptionCatalog }>();

  const catalogo = fila?.value;
  if (!catalogo) {
    redirect(
      `/admin/precios?error=${encodeURIComponent(
        "No se encontró el catálogo de planes en la configuración. Avisale a Vincenzo antes de tocar nada más."
      )}` as never
    );
  }

  // ⚠️ Se parte del catalogo EXISTENTE y se pisan solo los campos del
  //    formulario. Reconstruirlo desde cero perderia trial_days, currency y
  //    cualquier cosa que se agregue mas adelante -- en silencio, porque un
  //    JSON al que le falta una clave no da ningun error hasta que algo la
  //    busca.
  const tiers = catalogo.tiers.map((t) => {
    const mensual = aNumero(fd, `${t.tier}_mensual`);
    const anual = aNumero(fd, `${t.tier}_anual`);

    return {
      ...t,
      amount_monthly: mensual ?? t.amount_monthly,
      amount_yearly: anual ?? t.amount_yearly,
      prices: {
        test: {
          monthly: aTexto(fd, `${t.tier}_test_mensual`),
          yearly: aTexto(fd, `${t.tier}_test_anual`),
        },
        live: {
          monthly: aTexto(fd, `${t.tier}_live_mensual`),
          yearly: aTexto(fd, `${t.tier}_live_anual`),
        },
      },
    };
  });

  const nuevo: SubscriptionCatalog = { ...catalogo, tiers };

  const { error } = await supabase
    .from("site_settings")
    .update({ value: nuevo, updated_at: new Date().toISOString() })
    .eq("setting_key", "subscriptions.catalog");

  if (error) {
    redirect(`/admin/precios?error=${encodeURIComponent(error.message)}` as never);
  }

  // El catalogo esta memoizado por request Y cacheado entre requests: sin esto,
  // Brunela guarda, ve el cartel verde, y la landing sigue mostrando el precio
  // viejo hasta que algo desaloje la cache. Que es exactamente el fallo que
  // este panel viene a evitar.
  invalidarAjustes();

  revalidatePath("/admin/precios");
  revalidatePath("/dashboard/plan");
  revalidatePath("/"); // la landing muestra estos precios
}

export async function guardarPrecioDePackAction(fd: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const id = fd.get("id") as string;
  const euros = aNumero(fd, "precio");

  if (euros === null) {
    redirect(
      `/admin/precios?error=${encodeURIComponent("El precio del pack tiene que ser un número, por ejemplo 24,90.")}` as never
    );
  }

  const { error } = await supabase
    .from("packs")
    .update({
      // En centimos, como Stripe. La pantalla trabaja en euros porque es lo que
      // Brunela tiene en la cabeza.
      price_cents: Math.round(euros * 100),
      stripe_price_id_test: aTexto(fd, "priceTest"),
      stripe_price_id_live: aTexto(fd, "priceLive"),
    })
    .eq("id", id);

  if (error) {
    // El trigger packs_price_id_unico levanta un 23505 con un mensaje que ya
    // nombra al otro pack. Se pasa tal cual: es mejor que cualquier cosa que
    // pudieramos escribir aca.
    redirect(`/admin/precios?error=${encodeURIComponent(error.message)}` as never);
  }

  revalidatePath("/admin/precios");
  revalidatePath("/");
}
