import { leerAjuste } from "@/src/lib/settings";

export type MembershipTier = "none" | "corps_de_ballet" | "solista" | "principal";

export type DmAccessMap = Record<MembershipTier, boolean>;

export const DM_ACCESS_DEFAULT: DmAccessMap = {
  none: false,
  corps_de_ballet: false,
  solista: false,
  principal: true
};

export const DM_TIER_ORDER: MembershipTier[] = ["none", "corps_de_ballet", "solista", "principal"];

export const DM_TIER_LABEL: Record<MembershipTier, string> = {
  none: "Sin plan",
  corps_de_ballet: "Corps de Ballet",
  solista: "Solista",
  principal: "Principal"
};

/**
 * Reads the chat.dm_access setting (which tiers may START a DM with the admin),
 * falling back to the default if it is missing or malformed.
 */
export async function getDmAccess(): Promise<DmAccessMap> {
  const value = (await leerAjuste<Partial<DmAccessMap>>("chat.dm_access")) ?? {};
  return {
    none: value.none ?? DM_ACCESS_DEFAULT.none,
    corps_de_ballet: value.corps_de_ballet ?? DM_ACCESS_DEFAULT.corps_de_ballet,
    solista: value.solista ?? DM_ACCESS_DEFAULT.solista,
    principal: value.principal ?? DM_ACCESS_DEFAULT.principal
  };
}

export function tierCanStartDm(access: DmAccessMap, tier: MembershipTier): boolean {
  return access[tier] ?? false;
}
