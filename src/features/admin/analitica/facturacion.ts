import Stripe from "stripe";
import { unstable_cache } from "next/cache";
import { requireAdmin } from "@/src/features/auth/guards";
import { getSubscriptionCatalog, resolveTierFromPriceId, stripeMode, type StripeMode } from "@/src/lib/stripe/catalog";

/**
 * Facturacion y KPIs del panel de analiticas, leidos de Stripe.
 *
 * ⚠️ ESTE MODULO SOLO LEE
 *   Hace cuatro listados -- balance transactions, suscripciones, sesiones de
 *   checkout -- y nada mas. No crea clientes, sesiones ni cobros. Usa
 *   STRIPE_SECRET_KEY y ninguna otra clave: las de verificacion de precios
 *   (`_TEST`/`_LIVE`) son de `src/lib/stripe/verificar-precio.ts` y de nadie
 *   mas.
 *
 * ⚠️ SOLO SERVIDOR, Y DETRAS DE requireAdmin
 *   Lo importa unicamente `app/admin/analiticas/page.tsx`, que es un server
 *   component. Y `getFacturacion()` llama a requireAdmin() por su cuenta, para
 *   que importarlo desde otra pantalla no pueda saltearse la guarda.
 *
 * POR QUE BALANCE TRANSACTIONS Y NO CHARGES
 *   Es lo que Stripe deposita: cada movimiento trae `net`, que ya descuenta la
 *   comision, y los reembolsos aparecen como movimientos negativos. Sumar `net`
 *   da exactamente "lo que me quedo", sin recalcular comisiones a mano -- que es
 *   justamente la forma de terminar con un numero distinto al de Stripe.
 *
 * CACHE
 *   Cinco minutos (`unstable_cache`). Sin esto cada carga del panel serian
 *   varios viajes a Stripe, y Stripe limita las llamadas por segundo. La clave
 *   de cache lleva el MODO: pasar de test a live no puede servir cifras de test.
 */

const MAXIMO_POR_LISTADO = 3000;
const CACHE_SEGUNDOS = 300;
const ZONA = "Europe/Madrid";

/** Movimientos que son plata de alumnas. Fuera quedan payouts, ajustes, etc. */
const TIPOS_INGRESO = new Set(["charge", "payment"]);
const TIPOS_REEMBOLSO = new Set(["refund", "payment_refund"]);

export type MesFacturado = {
  /** "2026-10" */
  clave: string;
  /** "oct" */
  corto: string;
  /** "octubre de 2026" */
  largo: string;
  netoCentimos: number;
};

export type PlanEnStripe = {
  tier: "corps_de_ballet" | "solista" | "principal" | "otro";
  activas: number;
  enPrueba: number;
  mrrCentimos: number;
};

export type Facturacion =
  | { estado: "sin_clave" }
  | { estado: "error" }
  | {
      estado: "ok";
      modo: StripeMode;
      calculadoEl: string;
      esteMes: { netoCentimos: number; brutoCentimos: number; comisionesCentimos: number; reembolsosCentimos: number };
      mesPasado: { netoCentimos: number };
      /** null cuando el mes pasado fue 0: un "+∞ %" no le dice nada a nadie. */
      variacionPct: number | null;
      meses: MesFacturado[];
      mrrCentimos: number;
      mrrDePruebaCentimos: number;
      planes: PlanEnStripe[];
      activasTotal: number;
      enPruebaTotal: number;
      canceladasEsteMes: number;
      avisaronQueSeVan: number;
      ticketPromedioCentimos: number | null;
      pagos12m: number;
      packs12m: { netoCentimos: number; cantidad: number };
      suscripciones12m: { netoCentimos: number };
      /** Movimientos en otra moneda que no se sumaron. Normalmente 0. */
      otrasMonedas: number;
    };

// ── Fechas ───────────────────────────────────────────────────────────────────

function claveMes(fecha: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit" }).formatToParts(fecha);
  return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}`;
}

/** Las 12 claves de mes terminando en la actual, de la mas vieja a la actual. */
function ultimosDoceMeses(ahora: Date): MesFacturado[] {
  const [a, m] = claveMes(ahora).split("-").map(Number);
  const meses: MesFacturado[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(a, m - 1 - i, 15));
    meses.push({
      clave: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      corto: new Intl.DateTimeFormat("es-ES", { month: "short", timeZone: "UTC" }).format(d).replace(".", ""),
      largo: new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(d),
      netoCentimos: 0,
    });
  }
  return meses;
}

/** Monto mensual equivalente de un price recurrente. Anual / 12, etc. */
function mensualizar(price: Stripe.Price, cantidad: number): number {
  const unidad = price.unit_amount ?? 0;
  const rec = price.recurring;
  if (!rec) return 0;
  const cada = rec.interval_count || 1;
  const total = unidad * cantidad;
  switch (rec.interval) {
    case "month": return total / cada;
    case "year": return total / (12 * cada);
    case "week": return (total * 52) / (12 * cada);
    case "day": return (total * 365) / (12 * cada);
    default: return 0;
  }
}

function paymentIntentDe(fuente: Stripe.BalanceTransaction["source"]): string | null {
  if (!fuente || typeof fuente === "string") return null;
  const pi = (fuente as { payment_intent?: string | { id: string } | null }).payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

// ── Lectura de Stripe (cacheada) ─────────────────────────────────────────────

type Crudo = {
  calculadoEl: string;
  meses: MesFacturado[];
  esteMes: { netoCentimos: number; brutoCentimos: number; comisionesCentimos: number; reembolsosCentimos: number };
  pagos12m: number;
  bruto12m: number;
  packsNeto: number;
  packsCantidad: number;
  otrasMonedas: number;
  porPrice: { priceId: string; activas: number; enPrueba: number; mrrActivas: number; mrrPrueba: number }[];
  canceladasEsteMes: number;
  avisaronQueSeVan: number;
};

async function leerDeStripe(clave: string): Promise<Crudo> {
  const stripe = new Stripe(clave);
  const ahora = new Date();
  const meses = ultimosDoceMeses(ahora);
  const claveActual = meses[11].clave;
  const clavesValidas = new Set(meses.map((m) => m.clave));
  // Un dia de margen hacia atras por la zona horaria; lo que caiga antes del
  // primer mes se descarta al agrupar.
  const [a0, m0] = meses[0].clave.split("-").map(Number);
  const desde = Math.floor(Date.UTC(a0, m0 - 1, 1) / 1000) - 86400;

  // Las tres lecturas en paralelo. Cada una pagina sola (auto-pagination de
  // 100 en 100) con un tope, para que un listado enorme no cuelgue el panel.
  const [movimientos, suscripciones, sesiones] = await Promise.all([
    stripe.balanceTransactions
      .list({ created: { gte: desde }, limit: 100, expand: ["data.source"] })
      .autoPagingToArray({ limit: MAXIMO_POR_LISTADO }),
    stripe.subscriptions
      .list({ status: "all", limit: 100 })
      .autoPagingToArray({ limit: MAXIMO_POR_LISTADO }),
    stripe.checkout.sessions
      .list({ created: { gte: desde }, status: "complete", limit: 100 })
      .autoPagingToArray({ limit: MAXIMO_POR_LISTADO }),
  ]);

  // Los pagos unicos (mode "payment") son packs: es el unico producto que se
  // vende asi. Se reconocen por su payment_intent.
  const intentsDePacks = new Set<string>();
  for (const s of sesiones) {
    if (s.mode !== "payment" || !s.payment_intent) continue;
    intentsDePacks.add(typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent.id);
  }

  const esteMes = { netoCentimos: 0, brutoCentimos: 0, comisionesCentimos: 0, reembolsosCentimos: 0 };
  const porMes = new Map(meses.map((m) => [m.clave, 0]));
  let pagos12m = 0, bruto12m = 0, packsNeto = 0, packsCantidad = 0, otrasMonedas = 0;

  for (const t of movimientos) {
    const esIngreso = TIPOS_INGRESO.has(t.type);
    const esReembolso = TIPOS_REEMBOLSO.has(t.type);
    if (!esIngreso && !esReembolso) continue;
    const mes = claveMes(new Date(t.created * 1000));
    if (!clavesValidas.has(mes)) continue;
    if (t.currency !== "eur") { otrasMonedas++; continue; }

    porMes.set(mes, (porMes.get(mes) ?? 0) + t.net);
    const pi = paymentIntentDe(t.source);
    if (pi && intentsDePacks.has(pi)) {
      packsNeto += t.net;
      if (esIngreso) packsCantidad++;
    }
    if (esIngreso) { pagos12m++; bruto12m += t.amount; }

    if (mes === claveActual) {
      esteMes.netoCentimos += t.net;
      esteMes.comisionesCentimos += t.fee;
      if (esIngreso) esteMes.brutoCentimos += t.amount;
      else esteMes.reembolsosCentimos += -t.amount;
    }
  }

  // Suscripciones: foto de HOY, no historia.
  const porPrice = new Map<string, Crudo["porPrice"][number]>();
  let canceladasEsteMes = 0, avisaronQueSeVan = 0;
  for (const s of suscripciones) {
    if (s.status === "canceled") {
      const fin = s.ended_at ?? s.canceled_at;
      if (fin && claveMes(new Date(fin * 1000)) === claveActual) canceladasEsteMes++;
      continue;
    }
    if (s.status !== "active" && s.status !== "trialing") continue;
    if (s.cancel_at_period_end || s.cancel_at) avisaronQueSeVan++;
    const enPrueba = s.status === "trialing";
    for (const item of s.items.data) {
      const p = porPrice.get(item.price.id) ?? { priceId: item.price.id, activas: 0, enPrueba: 0, mrrActivas: 0, mrrPrueba: 0 };
      const mrr = item.price.currency === "eur" ? mensualizar(item.price, item.quantity ?? 1) : 0;
      if (enPrueba) { p.enPrueba++; p.mrrPrueba += mrr; } else { p.activas++; p.mrrActivas += mrr; }
      porPrice.set(item.price.id, p);
    }
  }

  return {
    calculadoEl: ahora.toISOString(),
    meses: meses.map((m) => ({ ...m, netoCentimos: porMes.get(m.clave) ?? 0 })),
    esteMes,
    pagos12m,
    bruto12m,
    packsNeto,
    packsCantidad,
    otrasMonedas,
    porPrice: [...porPrice.values()],
    canceladasEsteMes,
    avisaronQueSeVan,
  };
}

// ── API de la pantalla ───────────────────────────────────────────────────────

export async function getFacturacion(): Promise<Facturacion> {
  await requireAdmin();

  const clave = process.env.STRIPE_SECRET_KEY?.trim();
  if (!clave) return { estado: "sin_clave" };
  const modo = stripeMode(clave);

  let crudo: Crudo;
  try {
    // El modo va en la clave de cache: cifras de test nunca se sirven en live.
    crudo = await unstable_cache(() => leerDeStripe(clave), ["admin-facturacion-stripe", modo], {
      revalidate: CACHE_SEGUNDOS,
      tags: ["admin-facturacion-stripe"],
    })();
  } catch (e) {
    // El detalle va al log del servidor, no a la pantalla.
    console.error("[analiticas] no se pudo leer Stripe:", e instanceof Error ? e.message : e);
    return { estado: "error" };
  }

  // De price id a plan, con el catalogo del estudio (los dos modos).
  const catalogo = await getSubscriptionCatalog().catch(() => null);
  const ORDEN: PlanEnStripe["tier"][] = ["corps_de_ballet", "solista", "principal", "otro"];
  const planes = new Map<PlanEnStripe["tier"], PlanEnStripe>(
    ORDEN.map((tier) => [tier, { tier, activas: 0, enPrueba: 0, mrrCentimos: 0 }])
  );
  let mrr = 0, mrrPrueba = 0;
  for (const p of crudo.porPrice) {
    const tier = (catalogo && resolveTierFromPriceId(catalogo, p.priceId)) || "otro";
    const fila = planes.get(tier)!;
    fila.activas += p.activas;
    fila.enPrueba += p.enPrueba;
    fila.mrrCentimos += p.mrrActivas + p.mrrPrueba;
    mrr += p.mrrActivas + p.mrrPrueba;
    mrrPrueba += p.mrrPrueba;
  }

  const actual = crudo.meses[11].netoCentimos;
  const anterior = crudo.meses[10].netoCentimos;
  const filasPlanes = ORDEN.map((t) => planes.get(t)!).filter((p) => p.tier !== "otro" || p.activas + p.enPrueba > 0);

  return {
    estado: "ok",
    modo,
    calculadoEl: crudo.calculadoEl,
    esteMes: crudo.esteMes,
    mesPasado: { netoCentimos: anterior },
    variacionPct: anterior > 0 ? Math.round(((actual - anterior) / anterior) * 100) : null,
    meses: crudo.meses,
    mrrCentimos: Math.round(mrr),
    mrrDePruebaCentimos: Math.round(mrrPrueba),
    planes: filasPlanes,
    activasTotal: filasPlanes.reduce((s, p) => s + p.activas, 0),
    enPruebaTotal: filasPlanes.reduce((s, p) => s + p.enPrueba, 0),
    canceladasEsteMes: crudo.canceladasEsteMes,
    avisaronQueSeVan: crudo.avisaronQueSeVan,
    ticketPromedioCentimos: crudo.pagos12m > 0 ? Math.round(crudo.bruto12m / crudo.pagos12m) : null,
    pagos12m: crudo.pagos12m,
    packs12m: { netoCentimos: crudo.packsNeto, cantidad: crudo.packsCantidad },
    suscripciones12m: { netoCentimos: crudo.meses.reduce((s, m) => s + m.netoCentimos, 0) - crudo.packsNeto },
    otrasMonedas: crudo.otrasMonedas,
  };
}
