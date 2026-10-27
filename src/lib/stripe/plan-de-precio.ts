import type { CatalogTier, SubscriptionCatalog } from "@/src/lib/stripe/catalog";

/*
 * Sin imports de ejecucion a proposito (solo tipos): lo usan el webhook, la
 * analitica y tests/sistema/precio-por-marca.test.ts, que no puede cargar
 * catalog.ts porque ese lee la base.
 */

const TIERS: CatalogTier["tier"][] = ["corps_de_ballet", "solista", "principal"];

/**
 * Como resolveTierFromPriceId, pero con red de seguridad: si el codigo ya no
 * esta en el catalogo, mira la marca `metadata.tier` del precio.
 *
 * POR QUE (2026-10-27)
 *   Desde que el panel crea los precios solo (src/lib/stripe/asegurar-precio.ts),
 *   cambiar un precio saca el codigo viejo del catalogo. Las alumnas que ya
 *   pagaban siguen con ese precio, y sin esto el siguiente aviso de Stripe sobre
 *   su suscripcion (renovacion, impago, baja) no encontraba su plan: el webhook
 *   tiraba error y su estado dejaba de actualizarse. asegurar-precio marca el
 *   precio viejo con su plan antes de reemplazarlo.
 *
 *   El catalogo va PRIMERO: es lo que decide hoy, y una marca vieja nunca le gana.
 */
export function resolveTierFromPrice(
  catalog: SubscriptionCatalog | null,
  price: { id: string; metadata?: Record<string, string> | null } | null | undefined
): CatalogTier["tier"] | null {
  if (!price?.id) return null;
  const porCatalogo =
    catalog?.tiers.find((t) =>
      (["test", "live"] as const).some((m) => t.prices?.[m]?.monthly === price.id || t.prices?.[m]?.yearly === price.id)
    )?.tier ?? null;
  if (porCatalogo) return porCatalogo;
  const marca = price.metadata?.tier;
  return TIERS.includes(marca as CatalogTier["tier"]) ? (marca as CatalogTier["tier"]) : null;
}
