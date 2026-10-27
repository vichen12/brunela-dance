import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { getSubscriptionCatalog } from "@/src/lib/stripe/catalog";
import { codigoDesdeNombre, normalizarCodigo, puedeSerReferida } from "./reglas";

/**
 * Programa de referidos, del lado del servidor (20261026_4_referidos.sql).
 *
 * ⚠️ SIN "use server": todas reciben un cliente con service_role. Las llaman
 *    paginas que ya comprobaron la sesion (requireUser / requireAdmin) y el
 *    webhook de Stripe (firma verificada). NUNCA el navegador directo.
 *
 * Todas TOLERAN que falte la migracion: devuelven vacio o no hacen nada.
 */

function faltaTabla(e: { code?: string; message?: string } | null | undefined) {
  return !!e && (e.code === "42P01" || e.code === "PGRST205" || /could not find the table/i.test(e.message ?? ""));
}

/** El codigo de la alumna; lo crea la primera vez. null si falta la migracion. */
export async function obtenerMiCodigo(db: SupabaseClient, userId: string, nombre: string | null): Promise<string | null> {
  const { data, error } = await db.from("referidos_codigos").select("codigo").eq("user_id", userId).maybeSingle<{ codigo: string }>();
  if (error) return null;
  if (data) return data.codigo;
  // Unico: si choca con otro, se prueba de nuevo con otros numeros.
  for (let i = 0; i < 5; i++) {
    const codigo = codigoDesdeNombre(nombre);
    const { error: e } = await db.from("referidos_codigos").insert({ user_id: userId, codigo });
    if (!e) return codigo;
    if (e.code === "23505") {
      // ¿Choco con su propia fila (dos pestañas a la vez)? Entonces ya tiene.
      const { data: ya } = await db.from("referidos_codigos").select("codigo").eq("user_id", userId).maybeSingle<{ codigo: string }>();
      if (ya) return ya.codigo;
      continue;
    }
    return null;
  }
  return null;
}

/**
 * Si llego con un enlace de invitacion (cookie), la anota como referida.
 * Se llama al entrar al onboarding, que es por donde pasa toda cuenta nueva.
 * Solo cuentas nuevas, nunca a si misma, y una sola vez (clave primaria).
 */
export async function anotarReferidaSiCorresponde(db: SupabaseClient, userId: string, codigoCrudo: string | null | undefined) {
  try {
    const codigo = normalizarCodigo(codigoCrudo);
    if (!codigo) return;
    const [{ data: dueña }, { data: perfil }] = await Promise.all([
      db.from("referidos_codigos").select("user_id").eq("codigo", codigo).maybeSingle<{ user_id: string }>(),
      db.from("profiles").select("created_at, is_admin").eq("id", userId).maybeSingle<{ created_at: string; is_admin: boolean }>(),
    ]);
    if (!perfil || perfil.is_admin) return;
    if (!puedeSerReferida({ referidaId: userId, referenteId: dueña?.user_id ?? null, creadaEl: perfil.created_at })) return;
    const { error } = await db.from("referidos").insert({ referida_id: userId, referente_id: dueña!.user_id });
    if (error && error.code !== "23505" && !faltaTabla(error)) console.error("[referidos] no se pudo anotar:", error.message);
  } catch (e) {
    console.error("[referidos] anotar:", e instanceof Error ? e.message : String(e));
  }
}

export type MiReferida = { nombre: string; desde: string; estado: "pendiente" | "otorgado" | "error"; premiadoEl: string | null };

/** Las amigas que trajo, para su pantalla. Nombre de pila solamente. */
export async function leerMisReferidas(db: SupabaseClient, userId: string): Promise<MiReferida[] | null> {
  const { data, error } = await db
    .from("referidos")
    .select("referida_id, created_at, estado, premiado_at")
    .eq("referente_id", userId)
    .order("created_at", { ascending: false });
  if (error) return faltaTabla(error) ? null : [];
  const filas = (data ?? []) as { referida_id: string; created_at: string; estado: MiReferida["estado"]; premiado_at: string | null }[];
  if (!filas.length) return [];
  const { data: perfiles } = await db.from("profiles").select("id, full_name, email").in("id", filas.map((f) => f.referida_id));
  const nombreDe = new Map(((perfiles ?? []) as { id: string; full_name: string | null; email: string }[])
    .map((p) => [p.id, p.full_name?.trim().split(/\s+/)[0] || p.email.split("@")[0]]));
  return filas.map((f) => ({
    nombre: nombreDe.get(f.referida_id) ?? "Una amiga",
    desde: f.created_at,
    estado: f.estado,
    premiadoEl: f.premiado_at,
  }));
}

/**
 * EL PREMIO: la referida pago por primera vez -> un mes gratis para la que la
 * invito. Lo llama el webhook, en after(). Nunca lanza.
 *
 * Un mes = el precio MENSUAL del plan de la que invito (si no tiene plan, el
 * del plan mas barato), como credito en su cliente de Stripe: Stripe lo
 * descuenta solo de su proximo cobro.
 *
 * UNA VEZ: primero se RECLAMA la fila (update ... where premiado_at is null).
 * Si dos eventos llegan juntos, uno solo la consigue. Si el credito falla, se
 * libera para reintentar con el proximo evento de pago.
 */
export async function premiarReferente(db: SupabaseClient, stripe: Stripe, amigaId: string) {
  try {
    const ahora = new Date().toISOString();
    const { data: reclamada, error } = await db
      .from("referidos")
      .update({ premiado_at: ahora, estado: "pendiente" })
      .eq("referida_id", amigaId)
      .is("premiado_at", null)
      .select("referente_id")
      .maybeSingle<{ referente_id: string }>();
    if (error || !reclamada) return; // no es referida, ya se premio, o falta la migracion

    const liberar = (detalle: string) =>
      db.from("referidos").update({ premiado_at: null, estado: "error", detalle }).eq("referida_id", amigaId);

    const [{ data: ref }, { data: sub }, catalogo] = await Promise.all([
      db.from("profiles").select("id, email, full_name, membership_tier").eq("id", reclamada.referente_id).maybeSingle<{ id: string; email: string; full_name: string | null; membership_tier: string }>(),
      db.from("subscriptions").select("provider_customer_id").eq("user_id", reclamada.referente_id).not("provider_customer_id", "is", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle<{ provider_customer_id: string }>(),
      getSubscriptionCatalog(),
    ]);
    if (!ref) { await liberar("la que invito ya no existe"); return; }

    const tiers = catalogo?.tiers ?? [];
    const suyo = tiers.find((t) => t.tier === ref.membership_tier) ?? [...tiers].sort((a, b) => a.amount_monthly - b.amount_monthly)[0];
    const cents = suyo ? Math.round(suyo.amount_monthly * 100) : 0;
    if (cents <= 0) { await liberar("no hay precio mensual en el catalogo"); return; }

    let customerId = sub?.provider_customer_id ?? null;
    if (!customerId) {
      // Todavia no pago nunca: se le crea el cliente para que el credito la
      // espere. Se usa cuando se suscriba.
      const c = await stripe.customers.create({ email: ref.email ?? undefined, metadata: { user_id: ref.id } });
      customerId = c.id;
    }
    const txn = await stripe.customers.createBalanceTransaction(customerId, {
      amount: -cents,
      currency: (catalogo?.currency ?? "eur").toLowerCase(),
      description: "Un mes gratis por invitar a una amiga (referidos)",
      metadata: { referida_id: amigaId, referente_id: ref.id },
    }, { idempotencyKey: `referido-${amigaId}` });

    await db.from("referidos").update({ estado: "otorgado", premio_cents: cents, stripe_balance_txn: txn.id, detalle: null }).eq("referida_id", amigaId);
    console.log(`[referidos] premio para ${ref.id}: ${cents} centimos (amiga ${amigaId})`);
  } catch (e) {
    console.error("[referidos] premiar:", e instanceof Error ? e.message : String(e));
    await db.from("referidos").update({ premiado_at: null, estado: "error", detalle: e instanceof Error ? e.message.slice(0, 300) : "error" }).eq("referida_id", amigaId);
  }
}

/** ¿Este evento es un pago real de alguien? Devuelve su id, o null. */
export function quienPagoEnEvento(event: Stripe.Event): string | null {
  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const s = event.data.object as Stripe.Subscription;
    // "active" = ya se le cobro (o no tenia prueba). "trialing" todavia no pago.
    return s.status === "active" ? s.metadata?.user_id ?? null : null;
  }
  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    return s.mode === "payment" && s.payment_status === "paid" ? s.metadata?.user_id ?? null : null;
  }
  return null;
}
