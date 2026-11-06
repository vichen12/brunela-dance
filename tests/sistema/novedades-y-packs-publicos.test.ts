import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DIAS_DE_NOVEDAD, ordenarNovedades, PREFIJO_ANUNCIO_DE_PACK, type Novedad } from "../../src/features/studio/novedades-reglas";
import { rutaConPuerta } from "../../src/lib/acceso-anticipado";

const AHORA = Date.parse("2026-11-06T12:00:00Z");
const hace = (dias: number) => new Date(AHORA - dias * 86_400_000).toISOString();
const n = (clave: string, fecha: string, extra: Partial<Novedad> = {}): Novedad => ({
  clave, tipo: "clase", titulo: clave, detalle: null, href: null, imagen: null, fecha, gratis: false, ...extra,
});

describe("Novedades del inicio", () => {
  it("lo mas nuevo primero, con cualquier formato de fecha", () => {
    const r = ordenarNovedades([n("vieja", "2026-11-01T10:00:00.928+00:00"), n("nueva", "2026-11-05T10:00:00Z")], AHORA);
    expect(r.map((x) => x.clave)).toEqual(["nueva", "vieja"]);
  });

  it("lo que ya no es reciente no aparece", () => {
    const r = ordenarNovedades([n("adentro", hace(DIAS_DE_NOVEDAD - 1)), n("afuera", hace(DIAS_DE_NOVEDAD + 1))], AHORA);
    expect(r.map((x) => x.clave)).toEqual(["adentro"]);
  });

  it("como mucho seis", () => {
    const r = ordenarNovedades(Array.from({ length: 10 }, (_, i) => n("c" + i, hace(i))), AHORA);
    expect(r).toHaveLength(6);
  });

  it("una tanda de planes nuevos no tapa la clase", () => {
    const planes = Array.from({ length: 6 }, (_, i) => n("plan" + i, hace(1), { tipo: "plan" }));
    const r = ordenarNovedades([...planes, n("clase", hace(10))], AHORA);
    expect(r).toHaveLength(6);
    expect(r.map((x) => x.clave)).toContain("clase");
  });

  it("el aviso de un pack no se repite: el pack ya sale como pack", () => {
    const r = ordenarNovedades([
      n("pack", hace(1), { tipo: "pack", titulo: "Iniciación" }),
      n("aviso", hace(1), { tipo: "anuncio", titulo: PREFIJO_ANUNCIO_DE_PACK + "Iniciación" }),
      n("otro", hace(1), { tipo: "anuncio", titulo: "Clase gratis el sábado" }),
    ], AHORA);
    expect(r.map((x) => x.clave).sort()).toEqual(["otro", "pack"]);
  });
});

describe("Packs sin cuenta", () => {
  it("/packs se ve sin la contraseña de la puerta, y comprar sigue detras", () => {
    expect(rutaConPuerta("/packs")).toBe(false);
    expect(rutaConPuerta("/packs/iniciacion-al-ballet")).toBe(false);
    expect(rutaConPuerta("/registro")).toBe(true);
  });

  it("la pagina publica no le pide a la base con que reproducir ni cuanto cobra Stripe", () => {
    const fuente = readFileSync("src/features/studio/packs-en-venta.ts", "utf8");
    expect(fuente).not.toMatch(/bunny|stream_playback|pack_videos"\)\.select\("[^"]*video_id/);
    // Los price ids se piden para filtrar, pero no salen en lo que se devuelve.
    const devuelto = fuente.slice(fuente.indexOf(".map((p) => ({"));
    expect(devuelto).not.toMatch(/stripe_price_id/);
  });
});

describe("Stripe con tope de espera en el panel", () => {
  // Sin tope son 80 s y 2 reintentos: el boton "Creando…" quedo 4 minutos girando.
  it.each([
    ["src/lib/stripe/verificar-precio.ts"],
    ["src/lib/stripe/asegurar-precio.ts"],
    ["src/features/admin/analitica/facturacion.ts"],
  ])("%s no crea un cliente sin opciones", (archivo) => {
    expect(readFileSync(archivo, "utf8")).not.toMatch(/new Stripe\([^,()]*(\([^()]*\))?[^,()]*\)/);
  });
});
