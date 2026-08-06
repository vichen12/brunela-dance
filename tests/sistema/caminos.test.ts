import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
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
  /**
   * ⚠️ NO SE ENUMERAN LAS RUTAS: SE DESCUBREN.
   *
   *    La primera version listaba a mano las cinco que faltaban. Esa prueba
   *    habria quedado en verde para siempre mientras alguien agregaba una sexta
   *    pantalla sin esqueleto -- que es exactamente como aparecieron estas
   *    cinco. Recorriendo app/ la prueba cubre tambien lo que todavia no existe.
   */
  const rutasConPagina = (dir: string, acc: string[] = []): string[] => {
    for (const e of readdirSync(dir)) {
      if (e.startsWith("_") || e === "node_modules") continue;
      const p = join(dir, e);
      if (!statSync(p).isDirectory()) continue;
      if (existsSync(join(p, "page.tsx"))) acc.push(p);
      rutasConPagina(p, acc);
    }
    return acc;
  };

  it("TODA pantalla de /dashboard y /admin tiene esqueleto de carga", () => {
    const sinEsqueleto = [...rutasConPagina("app/dashboard"), ...rutasConPagina("app/admin")]
      .filter((d) => !existsSync(join(d, "loading.tsx")))
      .map((d) => d.split("\\").join("/"));

    expect(sinEsqueleto, `sin loading.tsx: ${sinEsqueleto.join(", ")}`).toHaveLength(0);
  });

  it("la mas lenta del panel es la que mas lo necesita", () => {
    // /admin/precios hace hasta 12 consultas a Stripe. Se comprueba aparte
    // porque si algun dia se saca, el mensaje tiene que decir POR QUE importa.
    expect(
      existsSync("app/admin/precios/loading.tsx"),
      "/admin/precios consulta Stripe por cada identificador: sin esqueleto se ve colgada"
    ).toBe(true);
  });

  it("el esqueleto del chat se usa de verdad", () => {
    // SkChat existia sin que nadie lo importara: escrito y nunca conectado.
    const usos = ["app/admin/chat/loading.tsx", "app/dashboard/chat/loading.tsx", "app/dashboard/community/loading.tsx"]
      .filter((p) => existsSync(p) && leer(p).includes("SkChat"));
    expect(usos).toHaveLength(3);
  });
});

// ── Documentos: la segunda barrera, la que no depende de la migracion ────────

describe("los documentos pagos no se firman para quien no los pago", () => {
  const pagina = () => leer("app/dashboard/documents/page.tsx");

  it("la pantalla FILTRA por plan antes de firmar", () => {
    const src = pagina();
    // Firmar es entregar el acceso: la firma usa service_role y saltea el
    // bucket privado. Si se firma antes de filtrar, una alumna gratuita recibe
    // un enlace de descarga que funciona. Fue asi hasta el 2026-08-06.
    const iFiltro = src.indexOf("const accesibles");
    const iFirma = src.indexOf("firmarDescarga(d.file_url)");
    expect(iFiltro, "no hay filtro por plan antes de firmar").toBeGreaterThan(-1);
    expect(iFirma).toBeGreaterThan(-1);
    expect(iFiltro, "se firma ANTES de filtrar por plan").toBeLessThan(iFirma);
  });

  it("solo se firma lo que paso el filtro, no la consulta cruda", () => {
    // El bug era `docs.map(firmar)`. Tiene que ser `accesibles.map(firmar)`.
    expect(pagina()).toMatch(/accesibles\.map\(async \(d\) => \(\{[\s\S]{0,120}firmarDescarga/);
    expect(pagina()).not.toMatch(/\(\(docs \?\? \[\]\) as Doc\[\]\)\.map\(async[\s\S]{0,120}firmarDescarga/);
  });

  it("un plan desconocido OCULTA el documento, no lo abre", () => {
    // La columna es texto libre. Un typo tiene que fallar hacia el lado seguro.
    expect(pagina()).toMatch(/if \(pedido === undefined\) return false;/);
  });
});

// ── Los errores tienen que ser legibles ─────────────────────────────────────

describe("cuando algo revienta, se entiende", () => {
  it("hay limite de error en /admin, en /dashboard y en la raiz", () => {
    // Sin error.tsx, Next muestra "Application error: a client-side exception
    // has occurred" y NADA mas: ni que paso, ni si reintentar. El 2026-08-06
    // costo dos rondas de diagnostico averiguar que era una pestaña vieja.
    for (const p of ["app/admin/error.tsx", "app/dashboard/error.tsx", "app/global-error.tsx"]) {
      expect(existsSync(p), `falta ${p}: los errores saldrian genericos`).toBe(true);
    }
  });

  it("el caso de la pestaña vieja tiene texto propio", () => {
    const src = leer("components/pantalla-error.tsx");
    // Es el que mas va a pasar: despues de cada despliegue, una pestaña abierta
    // manda ids de acciones que el servidor nuevo ya no conoce. No es una falla
    // y se arregla recargando, asi que no puede decir "algo se rompio".
    expect(src).toMatch(/UnrecognizedActionError/);
    expect(src).toMatch(/Server Action .\*? was not found|Server Action .* was not found/);
    expect(src).toMatch(/ChunkLoadError/);
    expect(src).toContain("Recargá la página");
  });

  it("el detalle tecnico llega a la consola aunque en pantalla se vea amable", () => {
    // En produccion Next oculta el mensaje real. Si no se registra, se pierde.
    expect(leer("components/pantalla-error.tsx")).toMatch(/console\.error\(/);
  });

  it("global-error trae su propio <html> y <body>", () => {
    // Reemplaza al layout raiz entero: sin eso no dibuja nada y el fallo del
    // fallo queda invisible.
    const src = leer("app/global-error.tsx");
    expect(src).toMatch(/<html/);
    expect(src).toMatch(/<body/);
  });
});
