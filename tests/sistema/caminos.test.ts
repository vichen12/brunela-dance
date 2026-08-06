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

// ── La direccion se genera sola, y SOLO al crear ────────────────────────────

describe("la dirección se completa sola desde el nombre", () => {
  /** Formularios de ALTA: tienen que autogenerar. */
  const altas: [string, string][] = [
    ["app/admin/packs/page.tsx", "nombreEs"],
    ["app/admin/categories/page.tsx", "nameEs"],
    ["components/admin-video-upload.tsx", "titleEs"],
  ];

  it.each(altas)("%s la genera desde %s", (archivo, campo) => {
    expect(leer(archivo)).toContain(`<AutoDireccion desde="${campo}"`);
  });

  const compartidos = ["components/admin-live-drawer.tsx", "components/admin-program-drawer.tsx"];

  it.each(compartidos)("%s la genera SOLO al crear", (archivo) => {
    const src = leer(archivo);
    // 🔴 Estos formularios sirven para crear Y para editar. Si el centinela
    //    quedara sin `activo`, corregir una tilde del titulo regeneraria la
    //    direccion de algo ya publicado y romperia los enlaces compartidos --
    //    sin ningun error: el enlace viejo simplemente deja de encontrar nada.
    const m = src.match(/<AutoDireccion[^/]*\/>/);
    expect(m, `${archivo} no monta AutoDireccion`).not.toBeNull();
    expect(m![0], "falta activo={...}: regeneraria la dirección al editar").toMatch(/activo=\{/);
  });

  it("ningún formulario de EDICIÓN la regenera", () => {
    // El del pack y el de categorías editan algo que ya existe y que puede estar
    // publicado: ahí no se toca nunca.
    for (const p of ["components/admin-pack-drawer.tsx"]) {
      expect(leer(p), `${p} regenera la dirección al editar`).not.toContain("<AutoDireccion");
    }
  });

  it("deja de pisarla en cuanto la tocan a mano", () => {
    const src = leer("components/auto-direccion.tsx");
    expect(src).toMatch(/sincronizado = false/);
    // Y no la toca si ya venía con algo (edición disfrazada, o autocompletado
    // del navegador).
    expect(src).toMatch(/destino\.value\.trim\(\) === ""/);
  });

  it("busca los campos dentro de SU formulario, no en todo el documento", () => {
    // En /admin conviven el alta y varios formularios de edición con los mismos
    // `name`. Sin acotar, cablearía el que no es.
    expect(leer("components/auto-direccion.tsx")).toMatch(/closest\("form"\)/);
  });
});

// ── El price id se carga donde se crea el pack ──────────────────────────────

describe("el identificador de Stripe se carga en el panel del pack", () => {
  it("el drawer tiene los tres campos de cobro", () => {
    const src = leer("components/admin-pack-drawer.tsx");
    for (const campo of ["precio", "priceTest", "priceLive"]) {
      expect(src, `falta el campo ${campo}`).toContain(`name="${campo}"`);
    }
  });

  it("muestra lo que dice Stripe al lado de cada uno", () => {
    const src = leer("components/admin-pack-drawer.tsx");
    expect(src).toMatch(/pack\.avisoTest && <Aviso/);
    expect(src).toMatch(/pack\.avisoLive && <Aviso/);
  });

  it("el aviso se resuelve en el SERVIDOR y baja como objeto plano", () => {
    // Por la frontera servidor->cliente no cruzan funciones: pasar
    // `verificarPrecio` en vez de su resultado es la trampa 6, que ya tiró un
    // 500 en producción con los iconos de lucide.
    const pagina = leer("app/admin/packs/page.tsx");
    // Se exigen LOS DOS modos. Comprobar solo que el nombre aparezca lo cumple
    // el `import`, aunque nadie lo llame: un control lo demostro.
    expect(pagina).toMatch(/verificarPrecio\(p\.stripe_price_id_test, "test"\)/);
    expect(pagina).toMatch(/verificarPrecio\(p\.stripe_price_id_live, "live"\)/);
    expect(pagina).toMatch(/avisoTest: test \? leerVerificacion\(/);
    expect(pagina).toMatch(/avisoLive: live \? leerVerificacion\(/);
    expect(leer("components/admin-pack-drawer.tsx")).not.toContain("verificar-precio");
  });

  it("las dos pantallas guardan con el MISMO intérprete", () => {
    // Dos formularios escribiendo price_cents es exactamente cómo terminan
    // mostrando números distintos. Una sola función decide qué significan.
    // Se exige la LLAMADA, no el nombre: el `import` solo tambien hacia pasar
    // esta prueba con la funcion sin usar. Lo delato un control.
    for (const p of ["src/features/admin/packs-actions.ts", "src/features/admin/precios-actions.ts"]) {
      expect(leer(p), `${p} interpreta el precio por su cuenta`).toMatch(/leerCamposDePrecio\(fd\)/);
    }
  });
});

// ── La biblioteca de quien pagó ─────────────────────────────────────────────

describe("quien compró un pack ve lo suyo, no un catálogo con candados", () => {
  const lib = () => leer("app/dashboard/library/page.tsx");

  it("el bloqueo NO se decide por membership_tier", () => {
    // 🔴 ESTE ERA EL BUG, y costó una venta: `sinPlan = tier === "none"`, y
    //    quien compra un pack SIGUE en 'none'. Se le mostraba el catálogo entero
    //    con candado -- incluida la clase que acababa de pagar -- y la tarjeta
    //    la mandaba a /dashboard/plan. Se cobró y no dio acceso.
    expect(lib(), "volvió el bloqueo global por tier").not.toMatch(/const sinPlan\s*=/);
    expect(lib()).toMatch(/const sinNada\s*=/);
  });

  it("las compras cuentan para decidir si tiene algo", () => {
    expect(lib()).toContain('.from("pack_purchases")');
    expect(lib()).toMatch(/comprasPropias \?\? 0\) === 0/);
  });

  it("el candado se decide POR CLASE y lo dice RLS", () => {
    const src = lib();
    // `accesibles` sale de consultar `videos` con el cliente de la alumna: la
    // misma regla que usa el reproductor. Calcularlo aparte en JavaScript
    // podría decir que sí donde el proxy dice que no.
    expect(src).toMatch(/const bloqueada = \(id: string\)/);
    expect(src).toMatch(/supabase\.from\("videos"\)\.select\("id"\)/);
    expect(src).toMatch(/href=\{\(bloqueada\(video\.id\) \? "\/dashboard\/plan"/);
  });

  it("existe la vista de catálogo completo, y sólo para quien tiene algo", () => {
    const src = lib();
    expect(src).toMatch(/params\.ver === "todo"/);
    expect(src).toMatch(/\{!sinNada && \(/);
    expect(src).toContain("Explorar todo");
    expect(src).toContain("Mis clases");
  });

  it("cambiar de filtro NO te saca de «Explorar todo»", () => {
    // El propio archivo ya documenta este fallo con los otros filtros: perder
    // el estado al navegar cambia la lista por dos motivos a la vez.
    const src = lib();
    const armadores = src.split('fEstado ? `estado=${fEstado}` : ""').length - 1;
    const conservan = src.split('modoTodo && !sinNada ? "ver=todo" : ""').length - 1;
    // Uno de los armadores es el del propio conmutador, que pone `ver` a mano.
    expect(conservan, `${armadores} armadores de URL, ${conservan} conservan la vista`)
      .toBe(armadores - 1);
  });

  it("el contador no miente en «Explorar todo»", () => {
    // Ahí el número grande es el catálogo, no lo que ella puede ver. Decir
    // "34 clases" a secas sería exactamente la sensación que esto viene a
    // arreglar.
    expect(lib()).toMatch(/modoTodo && !sinNada[\s\S]{0,120}!bloqueada\(v\.id\)/);
  });

  it("la vitrina sigue sin exponer nada reproducible", () => {
    expect(lib()).toMatch(/NUNCA agregar aca bunny_video_id/);
    expect(lib()).toMatch(/stream_playback_id: null/);
    expect(lib()).toMatch(/bunny_video_id: null/);
  });
});
