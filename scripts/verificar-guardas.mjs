#!/usr/bin/env node
/**
 * Guardas del sistema: comprueba que nada quede abierto por olvido.
 *
 * POR QUE EXISTE
 *   Tres veces aparecio el mismo tipo de agujero: algo que se agrega y queda sin
 *   la proteccion que tienen sus vecinos. Las policies fantasma de `categories`,
 *   el chat que no comprobaba el plan, y cuatro server actions que dejaban
 *   borrar el catalogo a cualquiera. Ninguno dio error: fallaron en silencio.
 *
 *   Revisarlo a mano no escala y depende de acordarse. Esto corre solo.
 *
 * QUE COMPRUEBA
 *   1. Toda tabla creada en las migraciones tiene RLS activada.
 *   2. Toda tabla tiene al menos una policy.
 *   3. Toda tabla tiene un `grant` explicito -- los privilegios por defecto
 *      estan en cero desde 20260804_fix_default_privileges, asi que una tabla
 *      sin grant da 42501 al primer SELECT.
 *   4. Toda server action exportada llama a una guarda.
 *   5. Toda ruta de /api comprueba quien llama.
 *
 * LAS EXCEPCIONES SE DECLARAN, NO SE OMITEN
 *   Cada excepcion vive abajo CON SU MOTIVO. Agregar una es un acto deliberado y
 *   revisable; olvidarse de una guarda, no. Esa es toda la idea.
 *
 * ⚠️ ESTE ARCHIVO SE COMPRUEBA A SI MISMO
 *   Al final corre casos de control: si el detector no puede dar positivo, no
 *   esta detectando nada. Una verificacion que no puede fallar no es
 *   verificacion -- ya paso en este proyecto y por eso esta escrito aca.
 *
 * USO
 *   npm run verificar
 *   Sale con codigo 1 si algo falla, asi que sirve en CI o en un hook.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = process.cwd();

// ─── Excepciones declaradas ─────────────────────────────────────────────────

/** Actions que son puertas de entrada: por definicion las usa quien no entro. */
const ACTIONS_PUBLICAS = new Map([
  ["signInAction", "es el propio inicio de sesion"],
  ["signOutAction", "cerrar sesion no puede exigir sesion valida"],
  ["requestPasswordResetAction", "quien la usa perdio el acceso"],
  ["updatePasswordAction", "corre con el token del correo, no con sesion"],
  ["signUpAction", "es el alta"],
  ["darDeBajaAction", "baja de correos desde un enlace, sin iniciar sesion"],
]);

/** Rutas de API con otra forma de autenticar, explicada. */
const RUTAS_CON_OTRA_AUTH = new Map([
  ["app/api/stripe/webhooks/route.ts", "verifica la firma de Stripe (constructEvent), no una sesion"],
  [
    "app/api/cron/keepalive/route.ts",
    "la invoca el cron de Vercel, no una persona: exige Authorization: Bearer CRON_SECRET, " +
      "y si esa variable no esta configurada responde 503 en vez de quedar abierta",
  ],
]);

/** Tablas sin policy a proposito. Vacio hoy: si alguna aparece, va con motivo. */
const TABLAS_SIN_POLICY = new Map([]);

// ─── Utilidades ─────────────────────────────────────────────────────────────

function archivos(dir, filtro, acc = []) {
  let entradas;
  try { entradas = readdirSync(dir); } catch { return acc; }
  for (const e of entradas) {
    if (e === "node_modules" || e === ".next" || e === ".git") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) archivos(p, filtro, acc);
    else if (filtro(p)) acc.push(p);
  }
  return acc;
}

/**
 * El cuerpo de una funcion, desde la { que sigue al CIERRE de los parentesis.
 *
 * ⚠️ Buscar la primera { a secas agarra el tipo del parametro cuando la firma es
 *    `funcion(input: { ... })`, y entonces la guarda que esta en el cuerpo real
 *    no se ve. Ese error dio un falso positivo la primera vez que se escribio
 *    esto.
 */
export function cuerpoDeFuncion(src, desde) {
  const ap = src.indexOf("(", desde);
  if (ap === -1) return "";
  let d = 0, i = ap;
  for (; i < src.length; i++) {
    if (src[i] === "(") d++;
    else if (src[i] === ")") { d--; if (d === 0) break; }
  }
  const ini = src.indexOf("{", i);
  if (ini === -1) return "";
  d = 0;
  let j = ini;
  for (; j < src.length; j++) {
    if (src[j] === "{") d++;
    else if (src[j] === "}") { d--; if (d === 0) break; }
  }
  return src.slice(ini, j);
}

export function actionsSinGuarda(src) {
  const fuera = [];
  for (const m of src.matchAll(/export async function\s+(\w+)/g)) {
    const cuerpo = cuerpoDeFuncion(src, m.index + m[0].length);
    if (!/require(Admin|User|Member)\s*\(/.test(cuerpo)) fuera.push(m[1]);
  }
  return fuera;
}

// ─── Comprobaciones ─────────────────────────────────────────────────────────

const fallos = [];
const avisos = [];

// 1-3. La base
{
  /**
   * ⚠️ SE QUITAN LOS COMENTARIOS ANTES DE MIRAR NADA.
   *
   *    Estas migraciones estan llenas de comentarios que CITAN el SQL que
   *    explican. Sin quitarlos, una policy comentada -- o simplemente nombrada
   *    en una nota -- cuenta como si existiera, y el verificador daria verde
   *    sobre una tabla desprotegida. Se descubrio probando el propio
   *    verificador: el control de policies no daba rojo porque la version
   *    comentada seguia contando.
   */
  const sinComentarios = (s) => s.replace(/--[^\n]*/g, "");

  const rutasMigraciones = archivos(join(RAIZ, "supabase", "migrations"), (p) => p.endsWith(".sql")).sort();
  const migraciones = rutasMigraciones.map((p) => sinComentarios(readFileSync(p, "utf8")));
  const todo = migraciones.join("\n");

  /**
   * A partir de que migracion una tabla nueva necesita su propio `grant`.
   *
   * ⚠️ Las tablas viejas NO lo necesitan: la 20260801_data_api_grants hace
   *    `grant ... on all tables in schema public`, que las cubre a todas de una.
   *    La primera version de esta comprobacion no lo contemplaba y escupia 18
   *    avisos falsos -- y una herramienta que avisa de mas se deja de leer, que
   *    es peor que no tenerla.
   */
  const iGrantGlobal = migraciones.findIndex((s) =>
    /grant\s+[\w\s,]+\s+on all tables in schema public/i.test(s)
  );

  /** En que migracion nacio cada tabla. */
  const nacimiento = new Map();
  migraciones.forEach((s, i) => {
    for (const m of s.matchAll(/create table if not exists public\.(\w+)/g)) {
      if (!nacimiento.has(m[1])) nacimiento.set(m[1], i);
    }
  });

  const tablas = new Set(
    [...todo.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1])
  );
  const conRls = new Set(
    [...todo.matchAll(/alter table public\.(\w+)\s+enable row level security/g)].map((m) => m[1])
  );
  const conPolicy = new Set(
    [...todo.matchAll(/create policy\s+"[^"]+"\s+on\s+public\.(\w+)/g)].map((m) => m[1])
  );
  const conGrant = new Set(
    [...todo.matchAll(/grant\s+[\w\s,]+\s+on\s+public\.(\w+)\s+to/g)].map((m) => m[1])
  );

  for (const t of [...tablas].sort()) {
    if (!conRls.has(t)) fallos.push(`RLS sin activar en public.${t}`);
    if (!conPolicy.has(t) && !TABLAS_SIN_POLICY.has(t)) {
      fallos.push(`public.${t} no tiene NINGUNA policy: con RLS activa nadie la lee, y sin RLS la lee todo internet`);
    }
    // Solo se exige grant propio a las tablas nacidas DESPUES del grant global.
    const naceDespues = iGrantGlobal >= 0 && (nacimiento.get(t) ?? 0) > iGrantGlobal;
    if (naceDespues && !conGrant.has(t)) {
      fallos.push(
        `public.${t} nace despues del grant global y no tiene grant propio: ` +
          `los privilegios por defecto estan en cero, asi que dara 42501 al primer SELECT`
      );
    }
  }
  console.log(`  base: ${tablas.size} tablas, ${conPolicy.size} con policy, ${conRls.size} con RLS`);
}

// 4. Server actions
{
  const conUseServer = archivos(RAIZ, (p) => /\.tsx?$/.test(p))
    .filter((p) => {
      const s = readFileSync(p, "utf8");
      return /^\s*["']use server["']/m.test(s);
    });

  let total = 0;
  for (const p of conUseServer) {
    const src = readFileSync(p, "utf8");
    total += [...src.matchAll(/export async function\s+\w+/g)].length;
    for (const n of actionsSinGuarda(src)) {
      if (ACTIONS_PUBLICAS.has(n)) continue;
      const rel = relative(RAIZ, p).replace(/\\/g, "/");
      fallos.push(
        `${rel} -> ${n}() no llama a requireAdmin/requireUser. Una server action es un endpoint POST publico: ` +
          `esconder el formulario no protege nada`
      );
    }
  }
  console.log(`  actions: ${total} exportadas en ${conUseServer.length} archivos`);
}

// 5. Rutas de API
{
  const rutas = archivos(join(RAIZ, "app", "api"), (p) => p.endsWith("route.ts"));
  for (const p of rutas) {
    const rel = relative(RAIZ, p).replace(/\\/g, "/");
    if (RUTAS_CON_OTRA_AUTH.has(rel)) continue;
    const src = readFileSync(p, "utf8");
    if (!/requireAdmin|requireUser|auth\.getUser\s*\(/.test(src)) {
      fallos.push(`${rel} no comprueba quien llama`);
    }
    // Una ruta bajo /api/admin tiene que exigir admin, no solo sesion.
    if (rel.includes("/api/admin/") && !/requireAdmin/.test(src)) {
      fallos.push(`${rel} esta bajo /api/admin pero no llama a requireAdmin()`);
    }
  }
  console.log(`  rutas de api: ${rutas.length}`);
}

// ─── Autocomprobacion: el detector tiene que poder dar positivo ──────────────

{
  const casos = [
    ["firma simple con guarda", 'export async function a(fd: FormData) { await requireAdmin(); }', []],
    ["objeto en el parametro con guarda", 'export async function b(i: { x: string }) { await requireAdmin(); }', []],
    ["sin guarda", 'export async function c(fd: FormData) { await borrar(); }', ["c"]],
    ["una con guarda y otra sin", 'export async function d(f: FormData) { x(); }\nexport async function e(f: FormData) { await requireAdmin(); }', ["d"]],
  ];
  for (const [nombre, src, esperado] of casos) {
    const got = actionsSinGuarda(src);
    if (JSON.stringify(got) !== JSON.stringify(esperado)) {
      fallos.push(`🔴 EL PROPIO VERIFICADOR ESTA ROTO — caso "${nombre}": esperaba ${JSON.stringify(esperado)}, dio ${JSON.stringify(got)}`);
    }
  }
}

// ─── Resultado ──────────────────────────────────────────────────────────────

console.log("");
for (const a of avisos) console.log(`  aviso: ${a}`);
if (avisos.length) console.log("");

if (fallos.length === 0) {
  console.log("  ✅ Sin agujeros: todas las tablas protegidas y todas las guardas puestas.");
  process.exit(0);
}

console.log(`  ❌ ${fallos.length} problema(s):\n`);
for (const f of fallos) console.log(`     - ${f}`);
console.log("");
process.exit(1);
