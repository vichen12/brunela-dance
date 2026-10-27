"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { invalidarAjustes } from "@/src/lib/settings";
import { stripeMode, type SubscriptionCatalog } from "@/src/lib/stripe/catalog";
import { asegurarPrecio, errorDeStripe } from "@/src/lib/stripe/asegurar-precio";
import { leerCamposDePrecio } from "@/src/features/admin/precio-de-pack";
import { asegurarPrecioDePack } from "@/src/features/admin/precio-de-pack-stripe";

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
 *
 * DESDE EL 2026-10-27 LOS CODIGOS DE STRIPE LOS PONE EL SISTEMA
 *   Brunela escribe el importe y guarda. Para cada precio, asegurarPrecio()
 *   mira si el codigo actual ya cobra eso; si no, crea uno nuevo en Stripe y
 *   archiva el viejo. Se escribe solo el juego del modo que cobra.
 */

const NOMBRE_PLAN: Record<string, string> = {
  corps_de_ballet: "Corps de Ballet",
  solista: "Solista",
  principal: "Principal",
};

/** Los importes se muestran en euros y se guardan en euros, como ya venia el catalogo. */
function aNumero(fd: FormData, campo: string): number | null {
  const crudo = ((fd.get(campo) as string) ?? "").trim().replace(",", ".");
  if (!crudo) return null;
  const n = Number(crudo);
  return Number.isFinite(n) && n >= 0 ? n : null;
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
  //
  // Stripe va ANTES de guardar: si falla, no se guarda nada y la web no
  // anuncia un importe que Stripe no cobra.
  const modo = stripeMode(process.env.STRIPE_SECRET_KEY);
  const moneda = catalogo.currency ?? "eur";
  let tiers: SubscriptionCatalog["tiers"];
  try {
    tiers = await Promise.all(
      catalogo.tiers.map(async (t) => {
        const mensual = aNumero(fd, `${t.tier}_mensual`) ?? t.amount_monthly;
        const anual = aNumero(fd, `${t.tier}_anual`) ?? t.amount_yearly;
        const actuales = t.prices?.[modo] ?? { monthly: null, yearly: null };
        const [m, a] = await Promise.all([
          asegurarPrecio({
            actual: actuales.monthly,
            centimos: Math.round(mensual * 100),
            moneda,
            intervalo: "month",
            producto: `Plan ${NOMBRE_PLAN[t.tier] ?? t.tier}`,
            metadata: { tier: t.tier },
          }),
          asegurarPrecio({
            actual: actuales.yearly,
            centimos: Math.round(anual * 100),
            moneda,
            intervalo: "year",
            producto: `Plan ${NOMBRE_PLAN[t.tier] ?? t.tier}`,
            metadata: { tier: t.tier },
          }),
        ]);
        return {
          ...t,
          amount_monthly: mensual,
          amount_yearly: anual,
          prices: { ...t.prices, [modo]: { monthly: m.id, yearly: a.id } },
        };
      })
    );
  } catch (e) {
    redirect(`/admin/precios?error=${encodeURIComponent(errorDeStripe(e))}` as never);
  }

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
  redirect("/admin/precios?listo=planes" as never);
}

export async function guardarPrecioDePackAction(fd: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();

  // ⚠️ MISMO interprete que el panel del pack. Dos formularios escriben estas
  //    tres columnas; una sola funcion decide que significan.
  const precio = leerCamposDePrecio(fd);
  if ("fallo" in precio) {
    redirect(`/admin/precios?error=${encodeURIComponent(precio.fallo)}` as never);
  }

  const id = fd.get("id") as string;
  const { error } = await supabase.from("packs").update(precio).eq("id", id);

  if (error) {
    redirect(`/admin/precios?error=${encodeURIComponent(error.message)}` as never);
  }

  const cobro = await asegurarPrecioDePack(supabase, id);
  if ("fallo" in cobro) {
    revalidatePath("/admin/precios");
    redirect(`/admin/precios?error=${encodeURIComponent(cobro.fallo)}` as never);
  }

  revalidatePath("/admin/precios");
  revalidatePath("/admin/packs");
  revalidatePath("/");
  redirect("/admin/precios?listo=pack" as never);
}

