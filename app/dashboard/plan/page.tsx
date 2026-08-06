import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { getSubscriptionCatalog } from "@/src/lib/stripe/catalog";
import { PlanClient } from "@/components/plan-client";

export const dynamic = "force-dynamic";

type MembershipTier = "none" | "corps_de_ballet" | "solista" | "principal";

export default async function PlanPage() {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [
    profile,
    { data: subscription },
    catalog,
    { data: packsData },
    { data: comprasData },
    { data: relaciones },
  ] =
    await Promise.all([
      getCurrentProfile(user.id),
      supabase.from("subscriptions").select("status, current_period_ends_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle<{ status: string; current_period_ends_at: string | null }>(),
      getSubscriptionCatalog(),
      // Los packs publicados. La policy ya filtra los que no lo estan, asi que
      // no hace falta condicionarlo aca -- y condicionarlo sugeriria que la
      // seguridad vive en la pantalla.
      supabase
        .from("packs")
        .select("id, slug, name_i18n, description_i18n, price_cents, currency, cover_image_url, is_featured, stripe_price_id_test, stripe_price_id_live")
        .order("display_order"),
      // Las suyas: `pack_purchases_select_own` no devuelve las de nadie mas.
      supabase.from("pack_purchases").select("pack_id, purchased_at"),
      // ⚠️ VA EN EL MISMO PARALELO. Estaba despues del Promise.all, en serie:
      //    un sexto viaje a Frankfurt (~30 ms) encadenado detras de los otros
      //    cinco, en una pantalla que ya hacia cinco. No depende de ninguno, asi
      //    que no habia motivo para esperarlos.
      supabase.from("pack_videos").select("pack_id"),
    ]);

  const compradosEl = new Map(
    ((comprasData ?? []) as { pack_id: string; purchased_at: string }[]).map((c) => [c.pack_id, c.purchased_at])
  );

  // Cuantas clases trae cada pack. Una sola consulta y se cuenta aca: una por
  // pack seria un N+1.
  const clasesPorPack = ((relaciones ?? []) as { pack_id: string }[]).reduce<Record<string, number>>(
    (acc, r) => { acc[r.pack_id] = (acc[r.pack_id] ?? 0) + 1; return acc; },
    {}
  );

  type PackFila = {
    id: string;
    slug: string;
    name_i18n: Record<string, string>;
    description_i18n: Record<string, string>;
    price_cents: number;
    currency: string;
    cover_image_url: string | null;
    is_featured: boolean;
    stripe_price_id_test: string | null;
    stripe_price_id_live: string | null;
  };

  /**
   * ⚠️ NO SE OFRECE LO QUE NO SE PUEDE COBRAR.
   *
   *    Publicar comprueba que exista el price del modo activo, pero eso corre
   *    UNA VEZ, al tocar Publicar. Al pasar a produccion, un pack publicado en
   *    prueba SIGUE publicado y sin price de live: la alumna lo ve, lo toca, y
   *    recibe un error. Una vitrina que no vende es peor que no tener vitrina.
   *
   *    El modo sale de la clave, igual que en el checkout: una sola fuente.
   */
  const modoEsLive = /^(?:sk|rk)_live_/.test((process.env.STRIPE_SECRET_KEY ?? "").trim());
  const sePuedeCobrar = (p: PackFila) =>
    (modoEsLive ? p.stripe_price_id_live : p.stripe_price_id_test) !== null;

  const packs = ((packsData ?? []) as PackFila[]).filter(sePuedeCobrar).map((p) => ({
    slug: p.slug,
    nombre: p.name_i18n?.es ?? p.slug,
    descripcion: p.description_i18n?.es ?? "",
    precioCentimos: p.price_cents,
    moneda: p.currency,
    portada: p.cover_image_url,
    destacado: p.is_featured,
    clases: clasesPorPack[p.id] ?? 0,
    compradoEl: compradosEl.get(p.id) ?? null,
  }));

  return (
    <PlanClient
      currentTier={profile?.membership_tier ?? "none"}
      subscriptionStatus={subscription?.status ?? null}
      renewsAt={subscription?.current_period_ends_at ?? null}
      catalog={catalog}
      packs={packs}
    />
  );
}
