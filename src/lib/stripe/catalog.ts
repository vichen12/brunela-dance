import { leerAjuste } from "@/src/lib/settings";

export type BillingInterval = "monthly" | "yearly";

/** Stripe keeps test and production data in completely separate worlds. */
export type StripeMode = "test" | "live";

export type TierPriceIds = {
  monthly: string | null;
  yearly: string | null;
};

export type CatalogTier = {
  tier: "corps_de_ballet" | "solista" | "principal";
  display_order: number;
  amount_monthly: number;
  amount_yearly: number;
  /** One set of Stripe price ids per mode. See stripeMode() for why. */
  prices: Record<StripeMode, TierPriceIds>;
};

export type SubscriptionCatalog = {
  currency: string;
  trial_days: number;
  tiers: CatalogTier[];
};

/**
 * Single source of truth for plans/prices, stored in site_settings so the admin
 * can paste Stripe price ids without a redeploy.
 */
export async function getSubscriptionCatalog(): Promise<SubscriptionCatalog | null> {
  return (await leerAjuste<SubscriptionCatalog>("subscriptions.catalog")) ?? null;
}

/**
 * Which Stripe mode this deployment is in, derived from the secret key alone.
 *
 * That single derivation is the whole point of storing both sets of price ids.
 * Before it, going live took TWO actions -- swap STRIPE_SECRET_KEY and run a
 * SQL update -- and doing only one left the app pointing a live key at test
 * price ids, or a test key at live ones. The failure is quiet and involves real
 * money, so the switch is reduced to one environment variable.
 *
 * Anything that is not explicitly a live key counts as test. Failing towards
 * test is the safe direction: the worst outcome is a checkout that does not
 * charge, rather than one that charges a real card by accident.
 */
export function stripeMode(secretKey: string | undefined | null): StripeMode {
  return /^(?:sk|rk)_live_/.test((secretKey ?? "").trim()) ? "live" : "test";
}

/**
 * False while the catalog is still in the pre-2026-07-30 single-set shape.
 * Callers surface this as "run the migration" instead of a blank 500.
 */
export function catalogHasPerModePrices(catalog: SubscriptionCatalog): boolean {
  return catalog.tiers.every((tier) => tier.prices?.test !== undefined && tier.prices?.live !== undefined);
}

/** The price id to charge with, for the mode this deployment is running in. */
export function resolvePriceId(
  catalog: SubscriptionCatalog,
  tier: CatalogTier["tier"],
  interval: BillingInterval,
  mode: StripeMode
): string | null {
  const entry = catalog.tiers.find((t) => t.tier === tier);
  return entry?.prices?.[mode]?.[interval] ?? null;
}

/**
 * Maps a Stripe price id back to a tier, searching BOTH modes.
 *
 * Searching both is safe rather than sloppy: an event only reaches this point
 * after passing signature verification against STRIPE_WEBHOOK_SECRET, which is
 * itself mode-scoped, so an event from the other mode never gets here. What it
 * buys is that an in-flight event during a mode switch still resolves to the
 * right plan instead of failing -- the plan is the same plan either way.
 */
export function resolveTierFromPriceId(
  catalog: SubscriptionCatalog,
  priceId: string
): CatalogTier["tier"] | null {
  const modes: StripeMode[] = ["test", "live"];
  const entry = catalog.tiers.find((t) =>
    modes.some((mode) => t.prices?.[mode]?.monthly === priceId || t.prices?.[mode]?.yearly === priceId)
  );
  return entry?.tier ?? null;
}
