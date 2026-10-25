import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buscarClases, normalizarBusqueda, urlParaEditarClase, type ClaseParaBuscar } from "../../src/features/admin/buscar-clases";

/**
 * Buscador de /admin/videos con sugerencias mientras se escribe.
 *
 * La regla de coincidencia se calcula; el cableado (que el servidor busque con
 * la MISMA regla, que ?editar=<id> abra el panel, que Enter siga enviando) se
 * lee del codigo.
 */

const leer = (p: string) => readFileSync(p, "utf8");

function clase(over: Partial<ClaseParaBuscar> = {}): ClaseParaBuscar {
  return {
    id: "id-" + (over.slug ?? "x"),
    slug: "x",
    titulo: "",
    tituloEn: "",
    categorias: "",
    descripcion: "",
    estado: "published",
    duracionMin: 30,
    portada: null,
    ...over,
  };
}

const CATALOGO: ClaseParaBuscar[] = [
  clase({ slug: "releve-en-barra", titulo: "Relevé en barra", tituloEn: "Barre relevés", categorias: "Pies", estado: "published" }),
  clase({ slug: "pies-fuertes", titulo: "Pies fuertes", categorias: "Pies, Fuerza", descripcion: "Trabajo de relevé lento y empeine.", estado: "draft" }),
  clase({ slug: "adagio-centro", titulo: "Adagio de centro", tituloEn: "Centre adagio", categorias: "Centro", estado: "archived" }),
  clase({ slug: "estiramiento", titulo: "Estiramiento suave", categorias: "Flexibilidad" }),
];

describe("normalizar: sin acentos, sin mayusculas, guiones como espacios", () => {
  it("«Relevé» y «RELEVE» quedan iguales a «releve»", () => {
    expect(normalizarBusqueda("Relevé")).toBe("releve");
    expect(normalizarBusqueda("  RELEVÉ  ")).toBe("releve");
    expect(normalizarBusqueda("Pliés y Fondús")).toBe("plies y fondus");
    expect(normalizarBusqueda("releve-en-barra")).toBe("releve en barra");
    expect(normalizarBusqueda(null)).toBe("");
  });
});

describe("buscarClases: la misma regla para las sugerencias y para el Enter", () => {
  it("«releve» sin acento encuentra «Relevé en barra»", () => {
    expect(buscarClases(CATALOGO, "releve").map((c) => c.slug)).toContain("releve-en-barra");
  });

  it("y al reves: «relevé» con acento tambien", () => {
    expect(buscarClases(CATALOGO, "RELEVÉ")[0].slug).toBe("releve-en-barra");
  });

  it("el titulo pesa mas que la descripcion: la que lo dice en el titulo va primero", () => {
    expect(buscarClases(CATALOGO, "releve").map((c) => c.slug)).toEqual(["releve-en-barra", "pies-fuertes"]);
  });

  it("encuentra por titulo en ingles, por direccion (slug) y por categoria", () => {
    expect(buscarClases(CATALOGO, "centre").map((c) => c.slug)).toEqual(["adagio-centro"]);
    expect(buscarClases(CATALOGO, "pies-fuertes").map((c) => c.slug)).toEqual(["pies-fuertes"]);
    expect(buscarClases(CATALOGO, "flexibilidad").map((c) => c.slug)).toEqual(["estiramiento"]);
  });

  it("varias palabras: tienen que estar TODAS (en cualquier campo)", () => {
    expect(buscarClases(CATALOGO, "releve barra").map((c) => c.slug)).toEqual(["releve-en-barra"]);
    expect(buscarClases(CATALOGO, "pies empeine").map((c) => c.slug)).toEqual(["pies-fuertes"]);
    expect(buscarClases(CATALOGO, "releve nada-que-ver")).toEqual([]);
  });

  it("respeta el tope y el minimo de caracteres", () => {
    expect(buscarClases(CATALOGO, "e", { max: 2 })).toHaveLength(2);
    expect(buscarClases(CATALOGO, "e", { minimo: 2 })).toEqual([]);
    expect(buscarClases(CATALOGO, "   ")).toEqual([]);
  });

  it("no inventa: lo que no esta, no aparece", () => {
    expect(buscarClases(CATALOGO, "tango")).toEqual([]);
  });
});

describe("cableado en /admin/videos", () => {
  const pagina = leer("app/admin/videos/page.tsx");
  const caja = leer("components/buscador-de-clases.tsx");

  it("el servidor busca con buscarClases (sin acentos), no solo con ilike", () => {
    expect(pagina).toContain("buscarClases(clasesParaBuscar, q)");
    expect(pagina).toMatch(/c\.in\("id", idsQueCoinciden\.length \? idsQueCoinciden : \[NINGUNA\]\)/);
  });

  it("?editar=<id> se valida, filtra la lista a esa clase y abre su panel", () => {
    expect(pagina).toMatch(/params\.editar/);
    expect(pagina).toContain('c.eq("id", editar)');
    expect(pagina).toContain("abrirAlInicio={video.id === editar}");
    expect(leer("components/admin-video-drawer.tsx")).toContain("useState(abrirAlInicio)");
    expect(urlParaEditarClase("abc")).toBe("/admin/videos?editar=abc");
  });

  it("la caja sigue siendo name=\"q\" dentro del formulario GET: Enter sin elegir manda la busqueda normal", () => {
    expect(caja).toContain('name="q"');
    expect(caja).toContain('role="combobox"');
    // Enter solo se intercepta con una sugerencia marcada.
    expect(caja).toMatch(/const c = visible && marcada >= 0 \? sugerencias\[marcada\] : null;\s*if \(c\) \{\s*e\.preventDefault\(\)/);
    expect(caja).toMatch(/e\.key === "Escape"/);
    expect(caja).toMatch(/e\.key === "ArrowDown"/);
  });

  it("la portada sale de portadaDeClase (servidor) y no de thumbnail_url crudo", () => {
    expect(pagina).toContain("portada: portadaDeClase(v)");
    expect(caja).not.toContain("thumbnail_url");
  });
});
