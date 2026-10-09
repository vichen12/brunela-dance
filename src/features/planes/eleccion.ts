import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getSubscriptionCatalog, stripeMode } from "@/src/lib/stripe/catalog";
import {
  esFaltaDeColumnaPlanes,
  normalizarPlanesDeCompra,
  puedeComprarPack,
  planesDeCompraEnTexto,
} from "@/src/features/studio/packs-reglas";
import {
  diasDePrueba,
  intervaloInicial,
  planInicial,
  tarjetasDePlanes,
  type Intervalo,
  type PlanPago,
  type TarjetaPlan,
} from "@/src/features/planes/planes";

export type PackResumen = {
  slug: string;
  nombre: string;
  descripcion: string;
  precio: string;
  clases: number;
};

export type EleccionDePlan = {
  tarjetas: TarjetaPlan[];
  diasPrueba: number;
  tier: PlanPago | null;
  intervalo: Intervalo;
  pack: PackResumen | null;
  /**
   * Venia por un pack que es SOLO PARA ALGUNOS PLANES y su plan no esta: no se
   * le ofrece (no lo podria pagar: crearCheckoutDePack lo frena con 403) y se
   * le explica por que ve los planes en vez del pack.
   */
  avisoPack: string | null;
};

function precioDePack(centimos: number, moneda: string) {
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: (moneda || "eur").toUpperCase(),
      minimumFractionDigits: centimos % 100 === 0 ? 0 : 2,
    }).format(centimos / 100);
  } catch {
    return `${(centimos / 100).toFixed(2)} €`;
  }
}

/**
 * Lo que necesita el selector de plan (onboarding y /registro/plan).
 *
 * Si venia por un PACK, se busca con el cliente de la alumna (la policy solo
 * devuelve los publicados) y solo se ofrece si se puede cobrar en el modo de
 * la clave: un pack publicado en prueba y sin price de produccion no se vende.
 * Si el pack no sirve, se cae al selector de planes en vez de a un error.
 */
export async function cargarEleccionDePlan(pedido: {
  plan: string | null;
  interval: string | null;
  pack: string | null;
  /** Su plan HOY, para los packs restringidos. Quien llega aca casi siempre no tiene ('none'). */
  tierActual?: string | null;
}): Promise<EleccionDePlan> {
  const catalogo = await getSubscriptionCatalog().catch(() => null);
  const tarjetas = tarjetasDePlanes(catalogo);

  let pack: PackResumen | null = null;
  let avisoPack: string | null = null;
  if (pedido.pack && pedido.pack.length <= 120) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("packs")
      .select("id, slug, name_i18n, description_i18n, price_cents, currency, stripe_price_id_test, stripe_price_id_live")
      .eq("slug", pedido.pack)
      .maybeSingle<{
        id: string;
        slug: string;
        name_i18n: Record<string, string> | null;
        description_i18n: Record<string, string> | null;
        price_cents: number;
        currency: string;
        stripe_price_id_test: string | null;
        stripe_price_id_live: string | null;
      }>();
    const live = stripeMode(process.env.STRIPE_SECRET_KEY) === "live";
    // ¿Solo para algunos planes? Consulta APARTE y tolerante: sin la migracion
    // 20261009_4 la columna no existe (42703) y el pack se ofrece como siempre.
    let soloPara: string[] | null = null;
    if (data) {
      const { data: r, error } = await supabase
        .from("packs")
        .select("planes_que_pueden_comprar")
        .eq("id", data.id)
        .maybeSingle<{ planes_que_pueden_comprar: string[] | null }>();
      if (error && !esFaltaDeColumnaPlanes(error)) console.error("[eleccion] planes del pack:", error.message);
      soloPara = error ? null : normalizarPlanesDeCompra(r?.planes_que_pueden_comprar);
    }
    if (data && soloPara && !puedeComprarPack(pedido.tierActual ?? "none", soloPara)) {
      avisoPack = `«${data.name_i18n?.es ?? data.slug}» es solo para alumnas de ${planesDeCompraEnTexto(soloPara)}. Elegí tu plan para entrar: con uno de esos, después lo sumás desde Packs de clases.`;
    } else if (data && (live ? data.stripe_price_id_live : data.stripe_price_id_test)) {
      const { count } = await supabase
        .from("pack_videos")
        .select("pack_id", { count: "exact", head: true })
        .eq("pack_id", data.id);
      pack = {
        slug: data.slug,
        nombre: data.name_i18n?.es ?? data.slug,
        descripcion: data.description_i18n?.es ?? "",
        precio: precioDePack(data.price_cents, data.currency),
        clases: count ?? 0,
      };
    }
  }

  return {
    tarjetas,
    diasPrueba: diasDePrueba(catalogo),
    tier: planInicial(pedido.plan, tarjetas),
    intervalo: intervaloInicial(pedido.interval),
    pack,
    avisoPack,
  };
}
