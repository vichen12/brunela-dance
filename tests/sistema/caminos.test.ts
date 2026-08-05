import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Segundo banco de pruebas: interfaz, rutas y cache.
 *
 * POR QUE EXISTE
 *   Las 51 de tests/aislamiento/ prueban RLS y NADA MAS. Los cinco hallazgos
 *   rojos de la auditoria del 2026-08-05 -- una alumna con sesion que no podia
 *   comprar un pack, una compra sin confirmacion, un recuadro vacio, la portada
 *   que dejo de ser estatica -- eran todos de esta otra clase, y por eso ninguna
 *   de las 51 los vio. No es que estuvieran mal escritas: no habia donde poner
 *   una prueba que no fuera de policies.
 *
 * ⚠️ NO NECESITA BASE NI CREDENCIALES
 *   Corre sobre el codigo fuente, en menos de un segundo. `npm run test:sistema`.
 *   Las de aislamiento siguen aparte porque necesitan Supabase real y tardan
 *   minuto y medio: mezclarlas haria que estas dejen de correrse.
 *
 * ⚠️ COMO SE ESCRIBEN LAS DE ACA
 *   Cada una comprueba una CADENA COMPLETA, no la existencia de un archivo. La
 *   pregunta no es "¿existe el componente de packs?" sino "¿puede una alumna
 *   con sesion llegar a pagar?". Un test que solo mira que algo exista pasa
 *   igual con la cadena rota en el medio.
 */

const leer = (p: string) => readFileSync(p, "utf8");

// ── F1 · Comprar un pack teniendo sesion ────────────────────────────────────

describe("una alumna CON sesion puede comprar un pack", () => {
  it("la pantalla de planes recibe los packs desde el servidor", () => {
    const pagina = leer("app/dashboard/plan/page.tsx");
    expect(pagina).toContain('.from("packs")');
    expect(pagina).toMatch(/packs=\{|packs=\{packs\}/);
  });

  it("la pantalla de planes tiene un boton que dispara el pago", () => {
    const cliente = leer("components/plan-client.tsx");
    // No alcanza con que exista startPackCheckout: tiene que haber algo que la
    // llame. Antes existia la funcion y NADIE la invocaba desde la interfaz.
    expect(cliente).toContain("async function startPackCheckout");
    expect(cliente).toMatch(/onClick=\{\(\)\s*=>\s*void startPackCheckout\(/);
  });

  it("/registro NO tira el pack cuando ya hay sesion", () => {
    const registro = leer("app/registro/page.tsx");
    // Este es EL bug: `redirect("/dashboard")` a secas perdia el pack y dejaba
    // la funcionalidad inexistente para quien ya tenia cuenta.
    expect(registro).toMatch(/q\.set\("pack"/);
    expect(registro).toMatch(/redirect\(`\/dashboard\/plan\?\$\{q\.toString\(\)\}`/);
  });

  it("el arranque automatico atiende el pack ANTES que el plan", () => {
    const cliente = leer("components/plan-client.tsx");
    const iPack = cliente.indexOf("q.get('pack')");
    const iPlan = cliente.indexOf("q.get('plan')");
    expect(iPack).toBeGreaterThan(-1);
    expect(iPlan).toBeGreaterThan(-1);
    // Si el plan se resolviera primero, alguien que vino por un pack terminaria
    // pagando una suscripcion que no pidio.
    expect(iPack).toBeLessThan(iPlan);
  });

  it("el precio NO viaja desde el navegador", () => {
    const ruta = leer("app/api/stripe/checkout-pack/route.ts");

    // Se mira SOLO la linea del esquema. La primera version de esta prueba usaba
    // /schema.*priceId/s sobre el archivo entero, y con el flag `s` el punto
    // cruza saltos de linea: matcheaba `const schema` con el `priceId` que
    // aparece 60 lineas mas abajo y daba rojo siempre. Un regex demasiado
    // goloso es una prueba que no mide lo que dice medir.
    const esquema = ruta.match(/const schema = z\.object\(\{[^}]*\}\)/)?.[0] ?? "";
    expect(esquema, "no se encontro el esquema de la request").not.toBe("");
    expect(esquema).toContain("pack:");
    for (const prohibido of ["price", "amount", "importe", "cents"]) {
      expect(esquema.toLowerCase(), `el esquema acepta "${prohibido}" del navegador`).not.toContain(prohibido);
    }
  });
});

// ── F2 · Ver que compro ──────────────────────────────────────────────────────

describe("la alumna ve que compro", () => {
  it("la pantalla de planes lee sus compras y marca las que ya tiene", () => {
    const pagina = leer("app/dashboard/plan/page.tsx");
    expect(pagina).toContain('.from("pack_purchases")');
    expect(leer("components/plan-client.tsx")).toContain("YA ES TUYO");
  });

  it("la biblioteca DIBUJA el mensaje con el que vuelve del pago", () => {
    const lib = leer("app/dashboard/library/page.tsx");
    // El bug era exactamente este: el checkout mandaba ?success=... y la
    // pantalla no lo leia. Pagaba y no pasaba nada visible.
    expect(lib).toContain("params.success");
    expect(lib).toMatch(/\{avisoCompra\}/);
  });

  it("el destino de vuelta apunta a una pantalla que SI muestra el aviso", () => {
    const ruta = leer("app/api/stripe/checkout-pack/route.ts");
    const destino = ruta.match(/success_url:[^`]*`\$\{appUrl\}(\/[^?]+)\?success=/);
    expect(destino, "no se pudo leer el success_url").not.toBeNull();

    const pantalla = `app${destino![1]}/page.tsx`;
    expect(existsSync(pantalla), `${pantalla} no existe`).toBe(true);
    expect(leer(pantalla)).toContain("params.success");
  });

  it("el mensaje no promete que las clases ya esten desbloqueadas", () => {
    // Stripe redirige al instante y el webhook puede tardar. Prometer de mas y
    // que no aparezcan es peor que avisar de la demora.
    const ruta = leer("app/api/stripe/checkout-pack/route.ts");
    const msg = ruta.match(/success_url[\s\S]{0,300}?"([^"]+)"/)?.[1] ?? "";
    expect(msg.length).toBeGreaterThan(0);
    expect(msg.toLowerCase()).toMatch(/segundos|recarg/);
  });
});

// ── R2 · Nada vacio en los formularios ──────────────────────────────────────

describe("los formularios del panel no tienen bloques vacios", () => {
  const drawers = [
    "components/admin-live-drawer.tsx",
    "components/admin-pack-drawer.tsx",
    "components/admin-video-drawer.tsx",
    "components/admin-program-drawer.tsx",
  ];

  it.each(drawers)("%s no deja contenedores sin nada adentro", (p) => {
    const src = leer(p).replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    // Un <div ...> seguido de </div> sin nada en el medio: es lo que quedo al
    // mudar los campos de Zoom a un bloque plegable y dejar el encabezado.
    const vacios = src.match(/<div[^>]*>\s*<\/div>/g) ?? [];
    expect(vacios, `contenedores vacios: ${vacios.join(" | ")}`).toHaveLength(0);
  });

  it.each(drawers)("%s no anida un <form> dentro de otro", (p) => {
    const src = leer(p)
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    let d = 0, max = 0;
    for (const t of src.match(/<\/?form\b/g) ?? []) {
      if (t === "<form") { d++; max = Math.max(max, d); } else d--;
    }
    // Anidado, el parser de HTML descarta el interno: en admin-live-drawer eso
    // hizo que ELIMINAR llamara a la accion de guardar.
    expect(max, "hay un <form> dentro de otro").toBeLessThanOrEqual(1);
    expect(d, "quedan <form> sin cerrar").toBe(0);
  });
});

// ── R1 · La portada sigue siendo cacheable ──────────────────────────────────

describe("la portada publica no se renderiza en cada visita", () => {
  it("declara revalidate", () => {
    const src = leer("app/page.tsx");
    // Lee la base desde el 2026-08-05. Sin esto la ruta pasa a dinamica sin que
    // nada lo diga, y cada visitante paga un viaje a Frankfurt.
    expect(src).toMatch(/export const revalidate\s*=\s*\d+/);
  });

  it("no se declara dinamica", () => {
    expect(leer("app/page.tsx")).not.toMatch(/export const dynamic\s*=\s*["']force-dynamic["']/);
  });

  it("quien cambia precios o packs revalida la portada", () => {
    // El revalidate es la red de seguridad; esto es lo que hace que el cambio se
    // vea al instante. Sin esto, Brunela cambia un precio y espera 5 minutos.
    for (const p of ["src/features/admin/precios-actions.ts", "src/features/admin/packs-actions.ts"]) {
      expect(leer(p), `${p} no revalida la portada`).toContain('revalidatePath("/")');
    }
  });

  it("si la base no contesta, la portada no se cae", () => {
    const src = leer("app/page.tsx");
    // Las dos lecturas van envueltas: una portada con un precio viejo es un
    // problema, una portada caida es peor.
    expect(src).toMatch(/async function preciosDeLaBase[\s\S]*?try\s*\{/);
    expect(src).toMatch(/async function packsDeLaPortada[\s\S]*?try\s*\{/);
  });
});

// ── Esqueletos de carga ─────────────────────────────────────────────────────

describe("las pantallas lentas tienen esqueleto de carga", () => {
  // ⚠️ PENDIENTES A PROPOSITO, no olvidados.
  //
  //    Son parte del hallazgo R3 de la auditoria (cinco rutas sin loading.tsx),
  //    que quedo para despues de los cinco rojos. Van como `todo` y no como
  //    prueba en rojo: un banco que arranca en rojo se deja de mirar, y ahi
  //    dejan de servir tambien las que si pasan.
  //
  //    Al hacer R3 se convierten en `it(...)` con el existsSync de siempre.
  it.todo("/admin/precios tiene esqueleto — es la mas lenta del panel: ~12 consultas a Stripe");
  it.todo("/admin/packs tiene esqueleto");
  it.todo("/admin/chat, /dashboard/chat y /dashboard/community tienen esqueleto (SkChat ya existe sin usar)");
});
