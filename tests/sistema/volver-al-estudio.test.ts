import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  claves, motivoNoRecibeVolver, proximoVolverPosible, textoSalteadas, textoSeMando, urlDeVolver,
  DIAS_ENTRE_VOLVER, TEXTO_NO_RECIBE_VOLVER, type PerfilParaVolver,
} from "../../src/features/correos/reglas";
import { leerCandidatasVolver, mandarVolverAlEstudio, type CandidataVolver } from "../../src/features/correos/volver-al-estudio";
import { volverAlEstudio } from "../../src/lib/email/mensajes";
import type { CorreoAEnviar, ResultadoLote } from "../../src/lib/email/enviar";

/**
 * "Volver al estudio" (20261025_2_volver_al_estudio.sql): invitar por mail a
 * las alumnas sin acceso, desde /admin/users y desde la ficha.
 *
 * Se calcula: a quien le llega (baja explicita, 14 dias, acceso), la clave, el
 * texto del correo (nunca habla de pagar) y el envio por lotes contra una base
 * de mentira. Se lee del codigo: la guarda de la accion y la migracion.
 */

const leer = (p: string) => readFileSync(p, "utf8");
const sinComentariosSql = (s: string) => s.replace(/--[^\n]*/g, "");
const DIA = 86400000;
const AHORA = Date.parse("2026-10-25T10:00:00Z");

function perfil(over: Partial<PerfilParaVolver> = {}): PerfilParaVolver {
  return { is_admin: false, email: "a@example.com", marketing_opt_in: false, marketing_opt_out_at: null, tieneAcceso: false, ultimoVolver: null, ...over };
}

// ─── A quien ────────────────────────────────────────────────────────────────

describe("a quien le llega: sin acceso, con correo, sin baja y nada en 14 dias", () => {
  it("la candidata comun: sin plan, con correo, nunca invitada -> si", () => {
    expect(motivoNoRecibeVolver(perfil(), AHORA)).toBeNull();
  });

  it("nunca a una admin, ni a quien ya entra al estudio, ni a quien no tiene correo", () => {
    expect(motivoNoRecibeVolver(perfil({ is_admin: true }), AHORA)).toBe("admin");
    expect(motivoNoRecibeVolver(perfil({ tieneAcceso: true }), AHORA)).toBe("con_acceso");
    expect(motivoNoRecibeVolver(perfil({ email: null }), AHORA)).toBe("sin_correo");
    expect(motivoNoRecibeVolver(perfil({ email: "  " }), AHORA)).toBe("sin_correo");
  });

  it("baja EXPLICITA (marketing_opt_out_at y opt_in false) -> no, y se muestra como «no recibe correos»", () => {
    expect(motivoNoRecibeVolver(perfil({ marketing_opt_out_at: "2026-10-01T00:00:00Z", marketing_opt_in: false }), AHORA)).toBe("baja");
    expect(TEXTO_NO_RECIBE_VOLVER.baja).toBe("no recibe correos");
  });

  it("se dio de baja y despues volvio a aceptar -> si; nunca marco la casilla -> si", () => {
    expect(motivoNoRecibeVolver(perfil({ marketing_opt_out_at: "2026-10-01T00:00:00Z", marketing_opt_in: true }), AHORA)).toBeNull();
    expect(motivoNoRecibeVolver(perfil({ marketing_opt_in: null, marketing_opt_out_at: null }), AHORA)).toBeNull();
  });

  it("la regla de los 14 dias: hace 13 no, hace 15 si (y el borde exacto ya se puede)", () => {
    expect(DIAS_ENTRE_VOLVER).toBe(14);
    expect(motivoNoRecibeVolver(perfil({ ultimoVolver: new Date(AHORA - 13 * DIA).toISOString() }), AHORA)).toBe("reciente");
    expect(motivoNoRecibeVolver(perfil({ ultimoVolver: new Date(AHORA - 1000).toISOString() }), AHORA)).toBe("reciente");
    expect(motivoNoRecibeVolver(perfil({ ultimoVolver: new Date(AHORA - 15 * DIA).toISOString() }), AHORA)).toBeNull();
    expect(motivoNoRecibeVolver(perfil({ ultimoVolver: new Date(AHORA - 14 * DIA).toISOString() }), AHORA)).toBeNull();
  });

  it("dice desde cuando se puede volver a mandar", () => {
    const hace3 = new Date(AHORA - 3 * DIA).toISOString();
    expect(proximoVolverPosible(hace3, AHORA)).toBe(new Date(AHORA + 11 * DIA).toISOString());
    expect(proximoVolverPosible(new Date(AHORA - 20 * DIA).toISOString(), AHORA)).toBeNull();
    expect(proximoVolverPosible(null, AHORA)).toBeNull();
  });

  it("la clave es por alumna y DIA en Madrid: volver:<alumna>:<yyyy-mm-dd>", () => {
    expect(claves.volver("u1", "2026-10-25T10:00:00Z")).toBe("volver:u1:2026-10-25");
    // 23:30 UTC del 25 ya es 26 en Madrid.
    expect(claves.volver("u1", "2026-10-25T23:30:00Z")).toBe("volver:u1:2026-10-26");
  });

  it("los textos del resultado", () => {
    expect(textoSeMando(0)).toBe("No se mandó a nadie.");
    expect(textoSeMando(1)).toBe("Se mandó a 1 alumna.");
    expect(textoSeMando(5)).toBe("Se mandó a 5 alumnas.");
    expect(textoSalteadas([])).toBe("");
    expect(textoSalteadas([{ nombre: "Ana", motivo: "no recibe correos" }, { nombre: "Lu", motivo: "no recibe correos" }]))
      .toBe(" No se mandó a: Ana, Lu (no recibe correos).");
    const muchas = Array.from({ length: 9 }, (_, i) => ({ nombre: `A${i}`, motivo: "x" }));
    expect(textoSalteadas(muchas, 6)).toContain("y 3 más (x)");
  });
});

// ─── El correo ──────────────────────────────────────────────────────────────

describe("el correo: invitacion, nunca una cuenta por cobrar", () => {
  const URL_VOLVER = urlDeVolver("https://bruneladance.com/");
  const BAJA = "https://bruneladance.com/baja?token=11111111-2222-3333-4444-555555555555";
  const variantes = [
    volverAlEstudio({ nombre: "Lucía Pérez", clasesNuevas: 0, novedades: [], urlVolver: URL_VOLVER, urlBaja: BAJA }),
    volverAlEstudio({ nombre: null, clasesNuevas: 1, novedades: [{ titulo: "Relevé en barra", portada: null }], urlVolver: URL_VOLVER, urlBaja: BAJA }),
    volverAlEstudio({
      nombre: "Ana",
      clasesNuevas: 7,
      novedades: [
        { titulo: "Relevé en barra", portada: "https://fotos.example.com/releve.jpg" },
        { titulo: "Adagio de centro", portada: null },
        { titulo: "Pies fuertes", portada: "https://fotos.example.com/pies.jpg" },
        { titulo: "Una cuarta que no entra", portada: null },
      ],
      urlVolver: URL_VOLVER,
      urlBaja: BAJA,
    }),
  ];

  it("🔴 nunca dice «pag…», «precio» ni «€» (ni en el HTML, ni en el texto, ni en el asunto)", () => {
    for (const c of variantes) {
      for (const parte of [c.asunto, c.html, c.texto]) {
        const t = parte.toLowerCase();
        expect(t).not.toContain("pag");
        expect(t).not.toContain("precio");
        expect(t).not.toContain("€");
        expect(t).not.toContain("&euro;");
      }
    }
  });

  it("el boton «Volver al estudio» lleva a /registro/plan", () => {
    expect(URL_VOLVER).toBe("https://bruneladance.com/registro/plan");
    for (const c of variantes) {
      expect(c.html).toContain("Volver al estudio");
      expect(c.html).toContain(`href="${URL_VOLVER}"`);
      expect(c.texto).toContain(URL_VOLVER);
    }
  });

  it("lleva el enlace de baja visible, en el HTML y en el texto", () => {
    for (const c of variantes) {
      expect(c.html).toContain(BAJA);
      expect(c.texto).toContain(BAJA);
    }
  });

  it("cuenta lo nuevo del mes y muestra hasta 3, con foto solo si hay foto", () => {
    const [sinNada, una, siete] = variantes;
    expect(sinNada.html).not.toContain("clases nuevas");
    expect(sinNada.html).toContain("Hola, Lucía");
    expect(una.texto).toContain("una clase nueva");
    expect(siete.texto).toContain("7 clases nuevas");
    expect(siete.texto).toContain("· Relevé en barra");
    expect(siete.texto).toContain("· Pies fuertes");
    expect(siete.texto).not.toContain("Una cuarta que no entra");
    expect(siete.html).toContain("https://fotos.example.com/releve.jpg");
    expect(siete.html).toContain("https://fotos.example.com/pies.jpg");
  });

  it("escapa lo que viene de la base (titulos de clases)", () => {
    const c = volverAlEstudio({ nombre: "<b>x</b>", clasesNuevas: 2, novedades: [{ titulo: "<script>alert(1)</script>" }], urlVolver: URL_VOLVER, urlBaja: BAJA });
    expect(c.html).not.toContain("<script>alert(1)</script>");
    expect(c.html).toContain("&lt;script&gt;");
  });
});

// ─── Quienes salen de la base: una base de mentira con filtros de verdad ─────

type Filas = Record<string, Record<string, unknown>[]>;

/** Imita lo que usa leerCandidatasVolver: eq, in, gt, gte, not in, order/range/limit (ignorados). */
function baseDeLectura(tablas: Filas, opciones: { sinRegistro?: boolean } = {}) {
  return {
    from(tabla: string) {
      let filas = [...(tablas[tabla] ?? [])];
      const q = {
        select: () => q,
        eq: (c: string, v: unknown) => ((filas = filas.filter((f) => f[c] === v)), q),
        in: (c: string, l: unknown[]) => ((filas = filas.filter((f) => l.includes(f[c]))), q),
        gt: (c: string, v: string) => ((filas = filas.filter((f) => typeof f[c] === "string" && (f[c] as string) > v)), q),
        gte: (c: string, v: string) => ((filas = filas.filter((f) => typeof f[c] === "string" && (f[c] as string) >= v)), q),
        order: () => q,
        range: () => q,
        limit: () => q,
        returns: () => q,
        then: (ok: (v: unknown) => unknown) => {
          if (tabla === "correos_enviados" && opciones.sinRegistro) {
            return Promise.resolve({ data: null, error: { code: "PGRST205", message: "Could not find the table" } }).then(ok);
          }
          return Promise.resolve({ data: filas, error: null }).then(ok);
        },
      };
      return q;
    },
  } as unknown as SupabaseClient;
}

function fila(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    email: `${id}@example.com`,
    full_name: `Alumna ${id}`,
    created_at: "2026-09-01T00:00:00Z",
    membership_tier: "none",
    is_admin: false,
    marketing_opt_in: false,
    marketing_opt_out_at: null,
    unsubscribe_token: `tok-${id}`,
    acceso_gratis_hasta: null,
    ...over,
  };
}

describe("leerCandidatasVolver: la lista que ve Brunela y la que relee la accion", () => {
  const tablas: Filas = {
    profiles: [
      fila("comun"),
      fila("baja", { marketing_opt_out_at: "2026-10-01T00:00:00Z" }),
      fila("reciente"),
      fila("vieja"),
      fila("conpack"),
      fila("regalo", { acceso_gratis_hasta: "2026-11-30T00:00:00Z" }),
      fila("regalo-vencido", { acceso_gratis_hasta: "2026-10-01T00:00:00Z" }),
      fila("admin", { is_admin: true }),
      fila("solista", { membership_tier: "solista" }),
    ],
    pack_purchases: [{ user_id: "conpack" }],
    correos_enviados: [
      { alumna_id: "reciente", tipo: "volver_al_estudio", enviado_at: new Date(AHORA - 3 * DIA).toISOString() },
      { alumna_id: "vieja", tipo: "volver_al_estudio", enviado_at: new Date(AHORA - 30 * DIA).toISOString() },
      { alumna_id: "comun", tipo: "clase_nueva", enviado_at: new Date(AHORA - DIA).toISOString() },
    ],
  };

  it("solo las SIN ACCESO: fuera admins, planes, packs y regalos vigentes; el regalo vencido entra", async () => {
    const { candidatas, registro } = await leerCandidatasVolver(baseDeLectura(tablas), { ahora: AHORA });
    expect(registro).toBe(true);
    expect(candidatas.map((c) => c.id).sort()).toEqual(["baja", "comun", "regalo-vencido", "reciente", "vieja"].sort());
  });

  it("cada una con su motivo: baja y 14 dias se marcan; otro tipo de correo no cuenta", async () => {
    const { candidatas } = await leerCandidatasVolver(baseDeLectura(tablas), { ahora: AHORA });
    const motivo = Object.fromEntries(candidatas.map((c) => [c.id, c.motivo]));
    expect(motivo).toEqual({ comun: null, baja: "baja", reciente: "reciente", vieja: null, "regalo-vencido": null });
    expect(candidatas.find((c) => c.id === "reciente")!.proximo).toBe(new Date(AHORA + 11 * DIA).toISOString());
  });

  it("soloIds: relee solo las elegidas (y una que ya tiene plan no vuelve)", async () => {
    const { candidatas } = await leerCandidatasVolver(baseDeLectura(tablas), { ahora: AHORA, soloIds: ["comun", "solista", "conpack"] });
    expect(candidatas.map((c) => c.id)).toEqual(["comun"]);
  });

  it("sin la tabla correos_enviados: registro=false (y la accion no manda)", async () => {
    const { registro } = await leerCandidatasVolver(baseDeLectura(tablas, { sinRegistro: true }), { ahora: AHORA });
    expect(registro).toBe(false);
  });
});

// ─── El envio por lotes ──────────────────────────────────────────────────────

type Reserva = { clave: string; tipo: string; resend_id: string | null };

function baseDeEnvio(opciones: { tipoNoPermitido?: boolean } = {}) {
  const filas = new Map<string, Reserva>();
  const db = {
    from(tabla: string) {
      if (tabla !== "correos_enviados") throw new Error("tabla inesperada " + tabla);
      return {
        upsert: (rows: { clave: string; tipo: string; resend_id?: string | null }[], opts: { ignoreDuplicates?: boolean }) => {
          const ejecutar = () => {
            if (opciones.tipoNoPermitido) {
              return { data: null, error: { code: "23514", message: 'violates check constraint "correos_enviados_tipo_valido"' } };
            }
            const insertadas: { clave: string }[] = [];
            for (const r of rows) {
              const ya = filas.get(r.clave);
              if (ya) {
                if (opts.ignoreDuplicates) continue;
                if (r.resend_id !== undefined) ya.resend_id = r.resend_id;
                insertadas.push({ clave: r.clave });
                continue;
              }
              filas.set(r.clave, { clave: r.clave, tipo: r.tipo, resend_id: r.resend_id ?? null });
              insertadas.push({ clave: r.clave });
            }
            return { data: insertadas, error: null };
          };
          return { select: async () => ejecutar(), then: (ok: (v: unknown) => unknown) => Promise.resolve(ejecutar()).then(ok) };
        },
        delete: () => {
          let lista: string[] = [];
          const q = {
            in: (_c: string, l: string[]) => ((lista = l), q),
            is: async (_c: string, v: unknown) => {
              for (const k of lista) if (filas.get(k)?.resend_id === v) filas.delete(k);
              return { data: null, error: null };
            },
          };
          return q;
        },
      };
    },
  };
  return { db: db as unknown as SupabaseClient, filas };
}

function resendFalso(respuestas: ResultadoLote[] = []) {
  const lotes: CorreoAEnviar[][] = [];
  const enviar = async (cs: CorreoAEnviar[]) => {
    lotes.push(cs);
    return respuestas.shift() ?? { ok: true as const, ids: cs.map((_, i) => `re_${lotes.length}_${i}`) };
  };
  return { enviar, lotes };
}

function candidata(id: string, over: Partial<CandidataVolver> = {}): CandidataVolver {
  return {
    id, email: `${id}@example.com`, nombre: `Alumna ${id}`, full_name: `Alumna ${id}`, creadaEl: "2026-09-01T00:00:00Z",
    unsubscribe_token: `tok-${id}`, ultimoVolver: null, motivo: null, proximo: null, ...over,
  };
}

const NOVEDADES = { clasesNuevas: 2, novedades: [{ titulo: "Relevé en barra", portada: null }] };
const DEPS = { pausaMs: 0, appUrl: "https://bruneladance.com", ahora: AHORA };

describe("mandarVolverAlEstudio: reserva, manda, y nunca dos veces", () => {
  it("manda a las que pueden, saltea las que no con su motivo, y cada mail lleva List-Unsubscribe", async () => {
    const { db, filas } = baseDeEnvio();
    const r = resendFalso();
    const res = await mandarVolverAlEstudio(db, [candidata("a"), candidata("b", { motivo: "baja" }), candidata("c", { motivo: "reciente" })], NOVEDADES, { ...DEPS, enviar: r.enviar });
    expect(res.enviadas).toEqual(["a"]);
    expect(res.salteadas.map((s) => [s.id, s.motivo])).toEqual([["b", "no recibe correos"], ["c", TEXTO_NO_RECIBE_VOLVER.reciente]]);
    expect(r.lotes).toHaveLength(1);
    expect(r.lotes[0]).toHaveLength(1);
    expect(r.lotes[0][0].para).toBe("a@example.com");
    expect(r.lotes[0][0].encabezados?.["List-Unsubscribe"]).toContain("/baja?token=tok-a");
    expect(r.lotes[0][0].html).toContain("/registro/plan");
    const reserva = filas.get("volver:a:2026-10-25")!;
    expect(reserva.tipo).toBe("volver_al_estudio");
    expect(reserva.resend_id).toBe("re_1_0");
  });

  it("el mismo dia otra vez: la reserva la frena («ya le llegó hoy») y Resend no se entera", async () => {
    const { db } = baseDeEnvio();
    const r = resendFalso();
    await mandarVolverAlEstudio(db, [candidata("a")], NOVEDADES, { ...DEPS, enviar: r.enviar });
    const segunda = await mandarVolverAlEstudio(db, [candidata("a")], NOVEDADES, { ...DEPS, enviar: r.enviar });
    expect(segunda.enviadas).toEqual([]);
    expect(segunda.salteadas).toEqual([{ id: "a", nombre: "Alumna a", motivo: "ya le llegó hoy" }]);
    expect(r.lotes).toHaveLength(1);
  });

  it("sin la migracion (CHECK 23514): no manda nada y lo dice", async () => {
    const { db } = baseDeEnvio({ tipoNoPermitido: true });
    const r = resendFalso();
    const res = await mandarVolverAlEstudio(db, [candidata("a")], NOVEDADES, { ...DEPS, enviar: r.enviar });
    expect(res.omitido).toContain("20261025_2_volver_al_estudio.sql");
    expect(r.lotes).toHaveLength(0);
  });

  it("si Resend falla, libera las reservas para poder reintentar", async () => {
    const { db, filas } = baseDeEnvio();
    const r = resendFalso([{ ok: false, error: "500" }]);
    const res = await mandarVolverAlEstudio(db, [candidata("a"), candidata("b")], NOVEDADES, { ...DEPS, enviar: r.enviar });
    expect(res.fallos).toBe(2);
    expect(res.enviadas).toEqual([]);
    expect(filas.size).toBe(0);
  });

  it("de a 100 por lote", async () => {
    const { db } = baseDeEnvio();
    const r = resendFalso();
    const res = await mandarVolverAlEstudio(db, Array.from({ length: 230 }, (_, i) => candidata(`u${i}`)), NOVEDADES, { ...DEPS, enviar: r.enviar });
    expect(r.lotes.map((l) => l.length)).toEqual([100, 100, 30]);
    expect(res.enviadas).toHaveLength(230);
  });
});

// ─── Lo que se lee del codigo ────────────────────────────────────────────────

describe("la accion y la migracion", () => {
  it("la accion llama a requireAdmin() ANTES que nada y relee las elegidas en la base (trampa 4)", () => {
    const acc = leer("src/features/admin/volver-actions.ts");
    expect(acc.startsWith('"use server"')).toBe(true);
    const cuerpo = acc.slice(acc.indexOf("export async function mandarVolverAlEstudioAction"));
    expect(cuerpo.indexOf("await requireAdmin()")).toBeGreaterThan(-1);
    expect(cuerpo.indexOf("await requireAdmin()")).toBeLessThan(cuerpo.indexOf("createSupabaseAdminClient()"));
    expect(cuerpo).toContain("leerCandidatasVolver(db, { soloIds: ids })");
    expect(cuerpo).toContain("registroVolverDisponible(db)");
  });

  it("el modulo que manda NO es \"use server\" (recibe service_role)", () => {
    expect(leer("src/features/correos/volver-al-estudio.ts")).not.toMatch(/^\s*["']use server["']/m);
  });

  it("el token de baja no viaja al navegador", () => {
    for (const p of ["components/invitar-a-volver.tsx", "app/admin/users/page.tsx", "app/admin/users/[id]/page.tsx"]) {
      expect(leer(p)).not.toContain("unsubscribe_token");
    }
  });

  it("la migracion copia EXACTA la lista de 20261012 y agrega solo 'volver_al_estudio'", () => {
    const listaDe = (sql: string) => {
      const m = sinComentariosSql(sql).match(/add constraint correos_enviados_tipo_valido check \(\s*tipo in \(([^)]*)\)/);
      return m ? m[1].split(",").map((x) => x.trim().replace(/'/g, "")) : null;
    };
    const anterior = listaDe(leer("supabase/migrations/20261012_clase_nueva.sql"))!;
    const nueva = listaDe(leer("supabase/migrations/20261025_2_volver_al_estudio.sql"))!;
    expect(anterior).not.toBeNull();
    expect(nueva).toEqual([...anterior, "volver_al_estudio"]);
  });

  it("sin begin/commit (trampa 7), con guarda, la funcion solo para service_role, y en SETUP.md", () => {
    const sql = sinComentariosSql(leer("supabase/migrations/20261025_2_volver_al_estudio.sql"));
    expect(sql).not.toMatch(/^\s*(begin|commit)\s*;/im);
    expect(sql).toContain("raise exception 'Falta 20261012_clase_nueva.sql");
    expect(sql).toMatch(/revoke all on function public\.correo_volver_al_estudio_disponible\(\) from public;/);
    expect(sql).toMatch(/revoke all on function public\.correo_volver_al_estudio_disponible\(\) from anon, authenticated;/);
    expect(sql).toMatch(/grant execute on function public\.correo_volver_al_estudio_disponible\(\) to service_role;/);
    expect(sql).not.toMatch(/create (or replace )?policy/i);
    expect(leer("SETUP.md")).toContain("20261025_2_volver_al_estudio.sql");
  });
});
