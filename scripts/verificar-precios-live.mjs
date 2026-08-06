#!/usr/bin/env node
/**
 * Verifica CONTRA LA API DE STRIPE los price ids de produccion del catalogo,
 * mas el de cada pack. Uno por uno.
 *
 * POR QUE EXISTE
 *   /admin/precios ya hace esto, pero solo se puede mirar con el panel abierto y
 *   con la clave del modo activo cargada en Vercel. El dia del pase a produccion
 *   hace falta poder responder "¿estan bien los seis?" ANTES de tocar nada, y
 *   desde una terminal.
 *
 * ⚠️ NO ESCRIBE NADA. Solo hace prices.retrieve y lee el catalogo de Supabase.
 *
 * USO
 *   STRIPE_SECRET_KEY_LIVE=sk_live_... node --env-file=.env.local scripts/verificar-precios-live.mjs
 *
 *   La clave se pasa POR DELANTE, no se guarda en .env.local: una clave de
 *   produccion en un archivo del disco es una clave que se filtra en el proximo
 *   volcado de logs o captura de pantalla. Se usa una vez y se va con la sesion
 *   de la terminal.
 *
 *   Para revisar los de PRUEBA en vez de los de produccion:
 *   MODO=test STRIPE_SECRET_KEY_TEST=sk_test_... node --env-file=.env.local scripts/...
 *
 * Sale con codigo 1 si algo no cuadra, asi sirve de compuerta.
 */

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const MODO = (process.env.MODO ?? "live").toLowerCase();
if (MODO !== "live" && MODO !== "test") {
  console.error("  MODO tiene que ser 'live' o 'test'.");
  process.exit(1);
}

const clave = MODO === "live" ? process.env.STRIPE_SECRET_KEY_LIVE : process.env.STRIPE_SECRET_KEY_TEST;

if (!clave) {
  console.error(`\n  Falta STRIPE_SECRET_KEY_${MODO.toUpperCase()}.\n`);
  console.error(`  Pasala por delante, sin guardarla en ningun archivo:\n`);
  console.error(`    STRIPE_SECRET_KEY_${MODO.toUpperCase()}=sk_${MODO}_... node --env-file=.env.local scripts/verificar-precios-live.mjs\n`);
  process.exit(1);
}

/**
 * ⚠️ SE COMPRUEBA EL PREFIJO, NO EL NOMBRE DE LA VARIABLE.
 *    Una sk_test_ pasada como si fuera la de produccion contestaria con total
 *    seguridad sobre el juego equivocado, y el informe diria "todo bien" sobre
 *    unos precios que no son los que van a cobrar. Un informe que miente es peor
 *    que no tener informe.
 */
const prefijoEsperado = new RegExp(`^(?:sk|rk)_${MODO}_`);
if (!prefijoEsperado.test(clave.trim())) {
  console.error(`\n  🔴 La clave que pasaste NO es de ${MODO}: empieza con "${clave.trim().slice(0, 8)}…".`);
  console.error(`     Verificar el juego de ${MODO} con la clave del otro modo daria un informe falso.\n`);
  process.exit(1);
}

const stripe = new Stripe(clave.trim());
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const euros = (c, m) => `${(c / 100).toFixed(2)} ${String(m).toUpperCase()}`;

let fallos = 0;
let avisos = 0;

/**
 * @param esperadoEuros lo que se ANUNCIA. Si no coincide con Stripe, la alumna
 *   ve un precio en la web y otro al pagar.
 * @param intervaloEsperado "month" | "year" | null (null = pago unico)
 */
async function revisar(etiqueta, priceId, esperadoEuros, monedaEsperada, intervaloEsperado) {
  if (!priceId) {
    console.log(`  ⚠️  ${etiqueta.padEnd(34)} SIN CARGAR`);
    avisos++;
    return;
  }

  let price;
  try {
    price = await stripe.prices.retrieve(priceId);
  } catch (e) {
    if (e?.code === "resource_missing" || e?.statusCode === 404) {
      console.log(`  🔴 ${etiqueta.padEnd(34)} NO EXISTE en ${MODO}  (${priceId})`);
      console.log(`     ${" ".repeat(34)} si lo copiaste del otro modo, es eso`);
    } else {
      console.log(`  🔴 ${etiqueta.padEnd(34)} ERROR: ${e?.message ?? e}`);
    }
    fallos++;
    return;
  }

  const problemas = [];

  if (!price.active) problemas.push("ARCHIVADO en Stripe: no puede cobrar");

  const centimosEsperados = Math.round(esperadoEuros * 100);
  if (price.unit_amount !== centimosEsperados) {
    problemas.push(`importe: Stripe dice ${euros(price.unit_amount ?? 0, price.currency)} y se anuncia ${euros(centimosEsperados, monedaEsperada)}`);
  }

  if (price.currency?.toLowerCase() !== String(monedaEsperada).toLowerCase()) {
    problemas.push(`moneda: Stripe ${price.currency?.toUpperCase()} vs catalogo ${String(monedaEsperada).toUpperCase()}`);
  }

  const intervaloReal = price.recurring?.interval ?? null;
  if (intervaloReal !== intervaloEsperado) {
    problemas.push(
      `intervalo: Stripe ${intervaloReal ?? "pago unico"} y se espera ${intervaloEsperado ?? "pago unico"}`
    );
  }

  if (problemas.length === 0) {
    const cada = intervaloReal ? `/${intervaloReal === "month" ? "mes" : "año"}` : " (pago unico)";
    console.log(`  ✅ ${etiqueta.padEnd(34)} ${euros(price.unit_amount ?? 0, price.currency)}${cada}`);
  } else {
    console.log(`  🔴 ${etiqueta.padEnd(34)} ${priceId}`);
    for (const p of problemas) console.log(`     ${" ".repeat(34)} ${p}`);
    fallos++;
  }
}

// ─── Planes ─────────────────────────────────────────────────────────────────

const { data: fila } = await supabase
  .from("site_settings")
  .select("value")
  .eq("setting_key", "subscriptions.catalog")
  .maybeSingle();

if (!fila?.value) {
  console.error("  No se encontro subscriptions.catalog en site_settings.");
  process.exit(1);
}

const catalogo = fila.value;
console.log(`\n  PLANES — juego "${MODO}"   (moneda del catalogo: ${catalogo.currency})\n`);

for (const t of catalogo.tiers) {
  await revisar(`${t.tier} · mensual`, t.prices?.[MODO]?.monthly, t.amount_monthly, catalogo.currency, "month");
  await revisar(`${t.tier} · anual`, t.prices?.[MODO]?.yearly, t.amount_yearly, catalogo.currency, "year");
}

// ─── Packs ──────────────────────────────────────────────────────────────────

const { data: packs } = await supabase
  .from("packs")
  .select("slug, name_i18n, price_cents, currency, is_published, show_on_landing, stripe_price_id_test, stripe_price_id_live")
  .order("display_order");

if ((packs ?? []).length > 0) {
  console.log(`\n  PACKS — juego "${MODO}"\n`);
  for (const p of packs) {
    const nombre = p.name_i18n?.es ?? p.slug;
    const id = MODO === "live" ? p.stripe_price_id_live : p.stripe_price_id_test;

    // ⚠️ Un pack PUBLICADO sin price del modo activo es una vitrina que no
    //    cobra: la alumna lo ve, lo toca y recibe un error.
    if (!id && p.is_published) {
      console.log(`  🔴 ${nombre.padEnd(34)} PUBLICADO y SIN price de ${MODO}`);
      console.log(`     ${" ".repeat(34)} se ve en la web y al comprarlo da error`);
      fallos++;
      continue;
    }
    await revisar(nombre, id, p.price_cents / 100, p.currency, null);
  }
}

// ─── Resultado ──────────────────────────────────────────────────────────────

console.log("");
if (fallos === 0 && avisos === 0) {
  console.log(`  ✅ Todo el juego "${MODO}" cuadra con Stripe.\n`);
  process.exit(0);
}
if (fallos === 0) {
  console.log(`  ${avisos} sin cargar, ningun error. Nada roto, pero falta completar.\n`);
  process.exit(0);
}
console.log(`  ❌ ${fallos} problema(s)${avisos ? ` y ${avisos} sin cargar` : ""}.\n`);
process.exit(1);
