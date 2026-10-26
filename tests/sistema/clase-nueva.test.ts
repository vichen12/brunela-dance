import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  avisoDeClaseNueva, claves, desactivadosDesdeInterruptores, dioDeBajaClasesNuevas, enLotes, esColumnaAusente, esTipoNoPermitido,
  pasaAPublicada, publishedAtAlGuardar, recibeClaseNueva, tipoDesactivado, urlDeBaja, urlDeClaseGrabada,
  INTERRUPTORES_DE_CORREO, TIPOS_DESACTIVABLES, type PerfilParaClaseNueva,
} from "../../src/features/correos/reglas";
import { mandarClaseNueva, type ClaseNuevaPreparada, type DestinatariaClaseNueva } from "../../src/features/correos/clase-nueva";
import { claseNueva } from "../../src/lib/email/mensajes";
import type { CorreoAEnviar, ResultadoLote } from "../../src/lib/email/enviar";

/**
 * Aviso de clase nueva (20261012_clase_nueva.sql) y "Mis correos" de Mi perfil.
 *
 * La regla de destinatarias, la deteccion de "primera vez publicada", las
 * claves y los lotes se calculan. El envio por lotes se prueba con una base de
 * mentira que imita lo unico que importa: la primary key de correos_enviados
 * (on conflict do nothing devuelve solo las insertadas) y el CHECK de tipo
 * (23514 sin la migracion). Lo demas se lee del codigo.
 */

const leer = (p: string) => readFileSync(p, "utf8");
const sinComentariosSql = (s: string) => s.replace(/--[^\n]*/g, "");
const sinComentariosTs = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const VIDEO = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function alumna(over: Partial<PerfilParaClaseNueva> = {}): PerfilParaClaseNueva {
  return {
    id: "a1",
    email: "a@example.com",
    is_admin: false,
    membership_tier: "solista",
    marketing_opt_in: false,
    marketing_opt_out_at: null,
    ...over,
  };
}

describe("quien recibe el aviso: las que pueden VER la clase, menos admins y bajas explicitas", () => {
  const sinPacks = new Set<string>();

  it("su plan esta en planes_permitidos -> si; no esta -> no (combinacion libre, no rango)", () => {
    expect(recibeClaseNueva(alumna({ membership_tier: "solista" }), ["corps_de_ballet", "solista"], sinPacks)).toBe(true);
    // {corps, principal}: Solista NO la ve aunque este "en el medio".
    expect(recibeClaseNueva(alumna({ membership_tier: "solista" }), ["corps_de_ballet", "principal"], sinPacks)).toBe(false);
    expect(recibeClaseNueva(alumna({ membership_tier: "none" }), ["corps_de_ballet", "solista", "principal"], sinPacks)).toBe(false);
  });

  it("compro un pack que la incluye -> si, aunque su plan no la vea", () => {
    expect(recibeClaseNueva(alumna({ id: "p1", membership_tier: "none" }), ["principal"], new Set(["p1"]))).toBe(true);
  });

  it("nunca a una admin, ni a quien no tiene correo", () => {
    expect(recibeClaseNueva(alumna({ is_admin: true }), ["solista"], sinPacks)).toBe(false);
    expect(recibeClaseNueva(alumna({ email: null }), ["solista"], sinPacks)).toBe(false);
    expect(recibeClaseNueva(alumna({ email: "  " }), ["solista"], sinPacks)).toBe(false);
  });

  it("quien NUNCA marco la casilla del alta recibe igual (pedido de la dueña)", () => {
    expect(recibeClaseNueva(alumna({ marketing_opt_in: false, marketing_opt_out_at: null }), ["solista"], sinPacks)).toBe(true);
  });

  it("quien se dio de baja NO recibe, tampoco por pack; si lo volvio a encender, recibe", () => {
    const baja = { marketing_opt_in: false, marketing_opt_out_at: "2026-10-01T10:00:00Z" };
    expect(dioDeBajaClasesNuevas(baja)).toBe(true);
    expect(recibeClaseNueva(alumna(baja), ["solista"], sinPacks)).toBe(false);
    expect(recibeClaseNueva(alumna({ id: "p1", ...baja }), ["solista"], new Set(["p1"]))).toBe(false);
    const volvio = { marketing_opt_in: true, marketing_opt_out_at: "2026-10-01T10:00:00Z" };
    expect(dioDeBajaClasesNuevas(volvio)).toBe(false);
    expect(recibeClaseNueva(alumna(volvio), ["solista"], sinPacks)).toBe(true);
  });

  it("la consulta filtra lo mismo en SQL: admins, sin correo, bajas, y por plan o por pack", () => {
    const d = sinComentariosTs(leer("src/features/correos/clase-nueva.ts"));
    const inicio = d.indexOf("export async function prepararClaseNueva");
    const cuerpo = d.slice(inicio, d.indexOf("type DepsClaseNueva"));
    expect(cuerpo).toMatch(/\.in\("membership_tier", planes\)/);
    expect(cuerpo.match(/\.eq\("is_admin", false\)/g)?.length).toBe(2);
    expect(cuerpo.match(/\.not\("email", "is", null\)/g)?.length).toBe(2);
    expect(cuerpo.match(/\.or\(FILTRO_SIN_BAJA_CLASES_NUEVAS\)/g)?.length).toBe(2);
    expect(cuerpo).toContain('from("pack_videos")');
    expect(cuerpo).toContain('from("pack_purchases")');
    expect(cuerpo).toContain('video.status !== "published"');
    // Y la regla que prueban estos tests es la que decide al final.
    expect(cuerpo).toContain("recibeClaseNueva(p, planes, compradoras)");
  });
});

describe("cuando: solo la PRIMERA vez que pasa a publicada", () => {
  it("borrador/archivada/nueva -> publicada avisa; publicada -> publicada no", () => {
    expect(pasaAPublicada("draft", "published")).toBe(true);
    expect(pasaAPublicada("archived", "published")).toBe(true);
    expect(pasaAPublicada(undefined, "published")).toBe(true);
    expect(pasaAPublicada(null, "published")).toBe(true);
    expect(pasaAPublicada("published", "published")).toBe(false);
    expect(pasaAPublicada("draft", "draft")).toBe(false);
    expect(pasaAPublicada("published", "draft")).toBe(false);
  });

  it("volver a guardar una publicada CONSERVA published_at (si no, el cron la tomaria por nueva)", () => {
    const ahora = Date.parse("2026-10-12T10:00:00Z");
    expect(publishedAtAlGuardar({ status: "published", published_at: "2026-01-01T00:00:00Z" }, "published", ahora)).toBe(
      "2026-01-01T00:00:00Z"
    );
    expect(publishedAtAlGuardar({ status: "draft", published_at: null }, "published", ahora)).toBe("2026-10-12T10:00:00.000Z");
    expect(publishedAtAlGuardar(null, "published", ahora)).toBe("2026-10-12T10:00:00.000Z");
    expect(publishedAtAlGuardar({ status: "published", published_at: "2026-01-01T00:00:00Z" }, "draft", ahora)).toBeNull();
  });

  it("los tres caminos que publican avisan en after(), despues de escribir, y usan la regla", () => {
    const fin = sinComentariosTs(leer("app/api/admin/videos/finalize/route.ts"));
    expect(fin.indexOf("prepararAvisoDeClaseNueva(")).toBeGreaterThan(fin.indexOf('from("videos").insert(payload)'));
    expect(fin).toMatch(/data\.status === "published" \? await prepararAvisoDeClaseNueva/);
    expect(fin).toContain("after(avisoCorreo.mandar)");
    expect(fin).toMatch(/export const maxDuration = 60/);

    const acc = sinComentariosTs(leer("src/features/admin/actions.ts"));
    const upsert = acc.slice(acc.indexOf("export async function upsertVideoAction"), acc.indexOf("export async function agregarClaseAPlanAction"));
    expect(upsert).toContain("pasaAPublicada(antes?.status, parsed.data.status)");
    expect(upsert).toContain("publishedAtAlGuardar(antes, parsed.data.status)");
    expect(upsert).toContain("after(aviso.mandar)");
    expect(upsert.indexOf("after(aviso.mandar)")).toBeGreaterThan(upsert.indexOf('from("videos").update(payload)'));

    const pag = sinComentariosTs(leer("app/admin/videos/page.tsx"));
    const quick = pag.slice(pag.indexOf("async function quickStatusAction"), pag.indexOf("async function quickFeaturedAction"));
    expect(quick).toContain("requireAdmin()");
    expect(quick).toContain("pasaAPublicada(antes.status, status)");
    expect(quick).toContain("publishedAtAlGuardar(");
    expect(quick).toContain("after(aviso.mandar)");
    expect(pag).toMatch(/export const maxDuration = 60/);
  });

  it("el cron completa lo pendiente de las publicadas en los ultimos dias", () => {
    const d = sinComentariosTs(leer("src/features/correos/disparadores.ts"));
    const cron = d.slice(d.indexOf("export async function correosDelCron"), d.indexOf("async function correosIndividualesDelCron"));
    expect(cron).toContain("clasesNuevasDelCron(");
    const cn = sinComentariosTs(leer("src/features/correos/clase-nueva.ts"));
    const del = cn.slice(cn.indexOf("export async function clasesNuevasDelCron"));
    expect(del.length).toBeGreaterThan(100);
    // Solo completa avisos que la publicacion ya empezo: nunca arranca uno por su cuenta.
    expect(del).toContain('.like("clave", `clase-nueva:${v.id as string}:%`)');
    expect(del.indexOf("if (!empezado?.length) continue;")).toBeLessThan(del.indexOf("prepararClaseNueva("));
    expect(del).toContain('.eq("status", "published")');
    expect(del).toContain('.gte("published_at"');
  });
});

describe("claves y enlaces", () => {
  it("una por clase y alumna", () => {
    expect(claves.claseNueva(VIDEO, "a1")).toBe(`clase-nueva:${VIDEO}:a1`);
    expect(claves.claseNueva(VIDEO, "a1")).not.toBe(claves.claseNueva(VIDEO, "a2"));
  });

  it("la clase va a la biblioteca y la baja lleva el token", () => {
    expect(urlDeClaseGrabada("https://bruneladance.com/", "plie basico")).toBe("https://bruneladance.com/dashboard/library/plie%20basico");
    expect(urlDeBaja("https://bruneladance.com", "t-1")).toBe("https://bruneladance.com/baja?token=t-1");
  });

  it("el cartel del panel", () => {
    expect(avisoDeClaseNueva(0)).toBe("");
    expect(avisoDeClaseNueva(1)).toBe(" Se le va a avisar por mail a 1 alumna.");
    expect(avisoDeClaseNueva(12)).toBe(" Se les va a avisar por mail a 12 alumnas.");
  });
});

describe("el correo", () => {
  const c = claseNueva({
    nombre: "Lucía Pérez",
    titulo: "Pies <fuertes>",
    urlClase: "https://bruneladance.com/dashboard/library/pies",
    portada: "https://x.supabase.co/storage/v1/object/public/portadas/p.jpg",
    duracion: "35 min",
    urlBaja: "https://bruneladance.com/baja?token=t-1",
  });

  it("titulo, boton a la clase, portada, y la baja VISIBLE (html y texto)", () => {
    expect(c.asunto).toBe("Clase nueva: Pies <fuertes>");
    expect(c.html).toContain("Pies &lt;fuertes&gt;");
    expect(c.html).not.toContain("<fuertes>");
    expect(c.html).toContain('href="https://bruneladance.com/dashboard/library/pies"');
    expect(c.html).toContain('src="https://x.supabase.co/storage/v1/object/public/portadas/p.jpg"');
    expect(c.html).toContain('href="https://bruneladance.com/baja?token=t-1"');
    expect(c.texto).toContain("https://bruneladance.com/baja?token=t-1");
    expect(c.html).toContain("Hola, Lucía");
  });

  it("no promete que ya se reproduce (Bunny puede estar codificando)", () => {
    expect(c.texto).toContain("Ya está en tu biblioteca");
    expect(c.texto).toMatch(/todavía se está preparando/);
  });

  it("sin portada sale sin imagen; y nunca el cuadro firmado de Bunny", async () => {
    const sin = claseNueva({ titulo: "X", urlClase: "https://b/x", portada: null, urlBaja: "https://b/baja?token=t" });
    expect(sin.html).not.toMatch(/<img[^>]+width="508"/);
    const { portadaPublicaDeClase } = await import("../../src/lib/video/portada-publica");
    expect(portadaPublicaDeClase({ thumbnail_url: "https://vz-123.b-cdn.net/abc/thumbnail.jpg" })).toBeNull();
    expect(portadaPublicaDeClase({ thumbnail_url: "https://x.supabase.co/storage/v1/object/public/p.jpg" })).toBe(
      "https://x.supabase.co/storage/v1/object/public/p.jpg"
    );
    expect(portadaPublicaDeClase({ thumbnail_url: null })).toBeNull();
  });
});

describe("lotes", () => {
  it("de a 100 (tope de /emails/batch de Resend)", () => {
    const xs = Array.from({ length: 250 }, (_, i) => i);
    expect(enLotes(xs).map((l) => l.length)).toEqual([100, 100, 50]);
    expect(enLotes(xs.slice(0, 100)).map((l) => l.length)).toEqual([100]);
    expect(enLotes([])).toEqual([]);
    expect(() => enLotes(xs, 0)).toThrow();
  });
});

// ─── El envio por lotes, contra una base de mentira ──────────────────────────

type Fila = { clave: string; resend_id: string | null };

function baseFalsa(opciones: { tipoNoPermitido?: boolean; lecturaVieja?: boolean } = {}) {
  const filas = new Map<string, Fila>();
  const db = {
    from(tabla: string) {
      if (tabla !== "correos_enviados") throw new Error("tabla inesperada " + tabla);
      return {
        select: () => ({
          // lecturaVieja: dos ejecuciones a la vez, la otra todavia no habia reservado al leer.
          in: async (_c: string, lista: string[]) => ({
            data: opciones.lecturaVieja ? [] : lista.filter((k) => filas.has(k)).map((clave) => ({ clave })),
            error: null,
          }),
        }),
        upsert: (rows: { clave: string; resend_id?: string | null }[], opts: { ignoreDuplicates?: boolean }) => {
          const ejecutar = () => {
            if (opciones.tipoNoPermitido) {
              return { data: null, error: { code: "23514", message: 'violates check constraint "correos_enviados_tipo_valido"' } };
            }
            const insertadas: { clave: string }[] = [];
            for (const r of rows) {
              const ya = filas.get(r.clave);
              if (ya) {
                // Como PostgREST: con ignoreDuplicates la fila existente no vuelve;
                // sin el (merge) se actualiza y SI vuelve.
                if (opts.ignoreDuplicates) continue;
                if (r.resend_id !== undefined) ya.resend_id = r.resend_id;
                insertadas.push({ clave: r.clave });
                continue;
              }
              filas.set(r.clave, { clave: r.clave, resend_id: r.resend_id ?? null });
              insertadas.push({ clave: r.clave });
            }
            return { data: insertadas, error: null };
          };
          return {
            select: async () => ejecutar(),
            then: (ok: (v: unknown) => unknown) => Promise.resolve(ejecutar()).then(ok),
          };
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

function preparada(n: number): ClaseNuevaPreparada {
  const destinatarias: DestinatariaClaseNueva[] = Array.from({ length: n }, (_, i) => ({
    id: `u${i}`,
    email: `u${i}@example.com`,
    full_name: `Alumna ${i}`,
    is_admin: false,
    membership_tier: "solista",
    marketing_opt_in: false,
    marketing_opt_out_at: null,
    unsubscribe_token: `tok-${i}`,
  }));
  return {
    video: { id: VIDEO, slug: "pies", title_i18n: { es: "Pies" }, status: "published", planes_permitidos: ["solista"], thumbnail_url: null, duration_seconds: 1800 },
    destinatarias,
  };
}

const deps = { pausaMs: 0, appUrl: "https://bruneladance.com" };

describe("mandarClaseNueva: por lotes y nunca dos veces", () => {
  it("250 alumnas -> 3 llamadas (100, 100, 50), un destinatario por correo, con List-Unsubscribe", async () => {
    const { db, filas } = baseFalsa();
    const r = resendFalso();
    const res = await mandarClaseNueva(db, preparada(250), { ...deps, enviar: r.enviar });
    expect(r.lotes.map((l) => l.length)).toEqual([100, 100, 50]);
    expect(res).toMatchObject({ enviados: 250, yaEnviados: 0, fallos: 0, pendientes: 0 });
    const primero = r.lotes[0][0];
    expect(primero.para).toBe("u0@example.com");
    expect(primero.encabezados?.["List-Unsubscribe"]).toContain("https://bruneladance.com/baja?token=tok-0");
    expect(primero.html).toContain("https://bruneladance.com/dashboard/library/pies");
    expect(filas.get(claves.claseNueva(VIDEO, "u0"))?.resend_id).toBe("re_1_0");
    expect(filas.size).toBe(250);
  });

  it("la segunda corrida (cron, otro guardado) no manda nada", async () => {
    const { db } = baseFalsa();
    const r = resendFalso();
    await mandarClaseNueva(db, preparada(120), { ...deps, enviar: r.enviar });
    const res = await mandarClaseNueva(db, preparada(120), { ...deps, enviar: r.enviar });
    expect(r.lotes.length).toBe(2);
    expect(res).toMatchObject({ enviados: 0, yaEnviados: 120 });
  });

  it("dos ejecuciones a la vez (after() y cron): la reserva decide, no la lectura previa", async () => {
    const { db } = baseFalsa({ lecturaVieja: true });
    const r = resendFalso();
    await mandarClaseNueva(db, preparada(120), { ...deps, enviar: r.enviar });
    const res = await mandarClaseNueva(db, preparada(120), { ...deps, enviar: r.enviar });
    expect(r.lotes.length).toBe(2);
    expect(res).toMatchObject({ enviados: 0, yaEnviados: 120 });
  });

  it("una alumna nueva que gano acceso despues recibe solo ella", async () => {
    const { db } = baseFalsa();
    const r = resendFalso();
    await mandarClaseNueva(db, preparada(3), { ...deps, enviar: r.enviar });
    const res = await mandarClaseNueva(db, preparada(4), { ...deps, enviar: r.enviar });
    expect(r.lotes[1].map((c) => c.para)).toEqual(["u3@example.com"]);
    expect(res).toMatchObject({ enviados: 1, yaEnviados: 3 });
  });

  it("si Resend falla, libera las reservas de ese lote y la proxima vez se reintentan", async () => {
    const { db, filas } = baseFalsa();
    const r = resendFalso([{ ok: true, ids: Array.from({ length: 100 }, (_, i) => `x${i}`) }, { ok: false, error: "500" }]);
    const res = await mandarClaseNueva(db, preparada(150), { ...deps, enviar: r.enviar });
    expect(res).toMatchObject({ enviados: 100, fallos: 50 });
    expect(filas.size).toBe(100);
    const otra = await mandarClaseNueva(db, preparada(150), { ...deps, enviar: r.enviar });
    expect(otra).toMatchObject({ enviados: 50, yaEnviados: 100 });
  });

  it("sin la migracion (23514 por el CHECK de tipo) NO manda ninguno", async () => {
    const { db } = baseFalsa({ tipoNoPermitido: true });
    const r = resendFalso();
    const res = await mandarClaseNueva(db, preparada(10), { ...deps, enviar: r.enviar });
    expect(r.lotes.length).toBe(0);
    expect(res.omitido).toContain("20261012_clase_nueva.sql");
  });

  it("sin tiempo: corta y deja el resto como pendiente para el cron", async () => {
    const { db } = baseFalsa();
    const r = resendFalso();
    const res = await mandarClaseNueva(db, preparada(250), { ...deps, enviar: r.enviar, presupuestoMs: -1 });
    expect(r.lotes.length).toBe(0);
    expect(res.pendientes).toBe(250);
  });

  it("reconoce los errores de migracion faltante", () => {
    expect(esTipoNoPermitido({ code: "23514" })).toBe(true);
    expect(esTipoNoPermitido({ code: "23505" })).toBe(false);
    expect(esColumnaAusente({ code: "42703" })).toBe(true);
    expect(esColumnaAusente({ message: 'column profiles.correos_desactivados does not exist' })).toBe(true);
    expect(esColumnaAusente({ code: "PGRST205" })).toBe(false);
  });
});

// ─── Mis correos ─────────────────────────────────────────────────────────────

describe("Mis correos: lo que apago cada alumna", () => {
  it("los interruptores: clases nuevas va por marketing; acceso gratis apaga los dos avisos", () => {
    expect(INTERRUPTORES_DE_CORREO.map((i) => i.campo)).toEqual(["clase_nueva", "anuncio", "recordatorio_vivo", "invitacion_vivo", "acceso_gratis"]);
    expect(desactivadosDesdeInterruptores(new Set(["clase_nueva", "anuncio", "recordatorio_vivo", "invitacion_vivo", "acceso_gratis"]))).toEqual([]);
    expect(desactivadosDesdeInterruptores(new Set(["clase_nueva"]))).toEqual([
      "anuncio", "recordatorio_vivo", "invitacion_vivo", "gratis_por_vencer", "gratis_terminado",
    ]);
    expect(desactivadosDesdeInterruptores(new Set(["anuncio", "recordatorio_vivo", "invitacion_vivo"]))).toEqual(["gratis_por_vencer", "gratis_terminado"]);
    // clase_nueva NUNCA va a la lista.
    expect(desactivadosDesdeInterruptores(new Set())).not.toContain("clase_nueva");
  });

  it("columna sin migrar (undefined/null) = no apago nada", () => {
    expect(tipoDesactivado(undefined, "recordatorio_vivo")).toBe(false);
    expect(tipoDesactivado(null, "recordatorio_vivo")).toBe(false);
    expect(tipoDesactivado([], "recordatorio_vivo")).toBe(false);
    expect(tipoDesactivado(["recordatorio_vivo"], "recordatorio_vivo")).toBe(true);
    expect(tipoDesactivado(["recordatorio_vivo"], "invitacion_vivo")).toBe(false);
  });

  it("cada correo opcional se salta a quien lo apago, leyendo la lista en la MISMA consulta", () => {
    const d = sinComentariosTs(leer("src/features/correos/disparadores.ts"));
    expect(d).toContain('tipoDesactivado(p.correos_desactivados, "invitacion_vivo")');
    expect(d).toContain('tipoDesactivado(p.correos_desactivados, "recordatorio_vivo")');
    expect(d).toContain('tipoDesactivado(f.correos_desactivados, "gratis_por_vencer")');
    expect(d).toContain('tipoDesactivado(f.correos_desactivados, "gratis_terminado")');
    // Las tres lecturas de perfiles piden la columna (con respaldo si no existe).
    expect(d.match(/await conPreferencias</g)?.length).toBe(3);
    expect(d).toContain('consulta(", correos_desactivados")');
    expect(d).toMatch(/esColumnaAusente\(r\.error\)/);
  });

  it("la accion: requireUser, cliente DE ELLA, solo su fila y solo estas columnas", () => {
    const a = sinComentariosTs(leer("src/features/auth/correos-actions.ts"));
    expect(a).toMatch(/^"use server";/);
    expect(a).toContain("await requireUser()");
    expect(a).toContain("createSupabaseServerClient()");
    expect(a).not.toContain("createSupabaseAdminClient");
    const updates = [...a.matchAll(/\.update\((\{[^}]*\}|\w+)\)\s*\.eq\("id", user\.id\)/g)].map((m) => m[1]);
    expect(updates.length).toBe(2);
    // Lo que se escribe sale de `marketing` (solo opt_in / opt_out_at) y de correos_desactivados.
    for (const u of updates) expect(u.replace(/\.\.\.marketing|marketing|correos_desactivados: desactivadosDesdeInterruptores\(encendidos\)|[{},\s]/g, "")).toBe("");
    const claves = [...a.matchAll(/marketing\.(\w+) =/g)].map((m) => m[1]);
    expect(new Set(claves)).toEqual(new Set(["marketing_opt_in", "marketing_opt_out_at"]));
    for (const prohibida of ["membership_tier", "is_admin", "email:", "is_studio_owner", "acceso_gratis", "full_name"]) {
      expect(a).not.toContain(prohibida);
    }
  });

  it("la baja por enlace registra la fecha EXPLICITA (el trigger solo sella si cambia)", () => {
    const b = sinComentariosTs(leer("src/features/auth/baja.ts"));
    expect(b).toMatch(/\.update\(\{ marketing_opt_in: false, marketing_opt_out_at: new Date\(\)\.toISOString\(\) \}\)/);
    expect(b).toContain('.eq("unsubscribe_token", parsed.data.token)');
  });

  it("la pagina de perfil muestra los interruptores y la nota de los que siempre llegan", () => {
    const p = leer("app/dashboard/perfil/page.tsx");
    expect(p).toContain("<MisCorreos");
    const c = leer("components/mis-correos.tsx");
    expect(c).toContain("Siempre te llegan: confirmación de cuenta, cambio de contraseña, recibos de pago y la bienvenida.");
    expect(c).not.toMatch(/["']use client["']/);
  });
});

describe("guardas", () => {
  it("clase-nueva.ts no es un modulo de server actions (seria un endpoint publico con service_role)", () => {
    expect(sinComentariosTs(leer("src/features/correos/clase-nueva.ts"))).not.toMatch(/["']use server["']/);
  });
});

describe("la migracion", () => {
  const sql = sinComentariosSql(leer("supabase/migrations/20261012_clase_nueva.sql"));

  it("sin begin/commit propios (trampa 7) y con guarda", () => {
    expect(sql).not.toMatch(/^\s*(begin|commit)\s*;/im);
    expect(sql).toContain("to_regclass('public.correos_enviados') is null");
  });

  it("el CHECK de tipo conserva los cinco de antes y suma clase_nueva", () => {
    const viejo = sinComentariosSql(leer("supabase/migrations/20261009_3_correos_enviados.sql"));
    const lista = (s: string) => {
      const m = s.match(/tipo in \(([^)]*)\)/);
      return (m?.[1] ?? "").split(",").map((x) => x.trim().replace(/'/g, ""));
    };
    expect(lista(sql)).toEqual([...lista(viejo), "clase_nueva"]);
  });

  it("correos_desactivados: not null default vacio, y el CHECK admite solo los desactivables (sin clase_nueva)", () => {
    expect(sql).toMatch(/add column if not exists correos_desactivados text\[\] not null default '\{\}'/);
    const m = sql.match(/correos_desactivados <@ array\[([^\]]*)\]::text\[\]/);
    expect(m).not.toBeNull();
    const permitidos = m![1].split(",").map((x) => x.trim().replace(/'/g, ""));
    // 'anuncio' se sumo despues (20261026_2_anuncios_por_mail.sql): esta
    // migracion admite los de su epoca, y la ultima que redefine el CHECK
    // tiene que coincidir con TIPOS_DESACTIVABLES.
    expect(new Set([...permitidos, "anuncio"])).toEqual(new Set(TIPOS_DESACTIVABLES));
    const ultima = sinComentariosSql(leer("supabase/migrations/20261026_2_anuncios_por_mail.sql"))
      .match(/correos_desactivados <@ array\[([^\]]*)\]::text\[\]/)![1]
      .split(",").map((x) => x.trim().replace(/'/g, ""));
    expect(new Set(ultima)).toEqual(new Set(TIPOS_DESACTIVABLES));
    expect(permitidos).not.toContain("clase_nueva");
    expect(sql).not.toMatch(/array_length/);
  });

  it("no redefine funciones ni policies (trampa 8) y esta en SETUP.md", () => {
    expect(sql).not.toMatch(/create (or replace )?function/i);
    expect(sql).not.toMatch(/create policy/i);
    expect(leer("SETUP.md")).toContain("20261012_clase_nueva.sql");
  });
});
