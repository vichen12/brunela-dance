import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  alumnaParaBienvenida, claves, diasParaAvisoPorVencer, esFaltaDeTablaCorreos, fechaYHoraDeClase, rangoDeHoyEnMadrid,
  tocaAvisoTerminado, tocaRecordatorio, urlDeClase,
} from "../../src/features/correos/reglas";
import { enviarUnaVez, type PedidoDeCorreo } from "../../src/features/correos/enviar-una-vez";
import type { CorreoAEnviar, ResultadoEnvio } from "../../src/lib/email/enviar";

/**
 * Correos del estudio (migracion 20261009_3_correos_enviados.sql).
 *
 * Fechas y claves se calculan; la logica de "una sola vez" se prueba con una
 * base de mentira que imita lo unico que importa de la real: la primary key
 * (23505) y la tabla ausente (PGRST205). Lo demas se lee del codigo, como en
 * plata-y-acceso.test.ts.
 */

const leer = (p: string) => readFileSync(p, "utf8");
const sinComentariosSql = (s: string) => s.replace(/--[^\n]*/g, "");
const sinComentariosTs = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const ALUMNA = "11111111-1111-1111-1111-111111111111";

describe("las claves", () => {
  it("una por motivo, y la del acceso gratis lleva el dia de fin en Madrid", () => {
    expect(claves.bienvenida(ALUMNA)).toBe(`bienvenida:${ALUMNA}`);
    expect(claves.recordatorio("r1")).toBe("recordatorio:r1");
    expect(claves.invitacion("s1", ALUMNA)).toBe(`invitacion:s1:${ALUMNA}`);
    // 23:30 UTC del 20 es 01:30 del 21 en Madrid: el dia es el 21.
    expect(claves.gratisPorVencer(ALUMNA, "2026-10-20T23:30:00Z")).toBe(`gratis-por-vencer:${ALUMNA}:2026-10-21`);
    expect(claves.gratisTerminado(ALUMNA, "2026-10-20T10:00:00Z")).toBe(`gratis-terminado:${ALUMNA}:2026-10-20`);
  });

  it("un regalo nuevo (otra fecha de fin) vuelve a avisar; el mismo no", () => {
    expect(claves.gratisPorVencer(ALUMNA, "2026-10-20T10:00:00Z")).toBe(claves.gratisPorVencer(ALUMNA, "2026-10-20T18:00:00Z"));
    expect(claves.gratisPorVencer(ALUMNA, "2026-10-20T10:00:00Z")).not.toBe(claves.gratisPorVencer(ALUMNA, "2026-11-20T10:00:00Z"));
  });
});

describe("acceso gratis por vencer: de 1 a 3 dias calendario en Madrid", () => {
  // El cron corre a las 07:00 UTC (09:00 en Madrid en octubre).
  const cron = Date.parse("2026-10-09T07:00:00Z");

  it("3, 2 y 1 dias avisan; 4 todavia no", () => {
    expect(diasParaAvisoPorVencer("2026-10-12T10:00:00Z", cron)).toBe(3);
    expect(diasParaAvisoPorVencer("2026-10-11T10:00:00Z", cron)).toBe(2);
    expect(diasParaAvisoPorVencer("2026-10-10T10:00:00Z", cron)).toBe(1);
    expect(diasParaAvisoPorVencer("2026-10-13T10:00:00Z", cron)).toBeNull();
  });

  it("el dia del fin no avisa: el texto diria 'mañana' y seria falso", () => {
    expect(diasParaAvisoPorVencer("2026-10-09T20:00:00Z", cron)).toBeNull();
  });

  it("cuenta dias de Madrid, no horas: vence el 13 a las 00:30 de Madrid -> 4 dias, no 3", () => {
    // 2026-10-12T22:30Z = 13 oct 00:30 en Madrid. Faltan 3 dias y 15 h, pero
    // en calendario es el 13: 4 dias.
    expect(diasParaAvisoPorVencer("2026-10-12T22:30:00Z", cron)).toBeNull();
  });

  it("ya vencido no es 'por vencer'", () => {
    expect(diasParaAvisoPorVencer("2026-10-08T10:00:00Z", cron)).toBeNull();
  });
});

describe("acceso gratis terminado: vencido y hace menos de 7 dias", () => {
  const cron = Date.parse("2026-10-09T07:00:00Z");
  it("ventana", () => {
    expect(tocaAvisoTerminado("2026-10-09T06:59:00Z", cron)).toBe(true);
    expect(tocaAvisoTerminado("2026-10-03T07:01:00Z", cron)).toBe(true);
    expect(tocaAvisoTerminado("2026-10-02T06:00:00Z", cron)).toBe(false); // hace mas de 7 dias
    expect(tocaAvisoTerminado("2026-10-09T07:01:00Z", cron)).toBe(false); // todavia no vencio
  });
});

describe("recordatorio: clases de HOY en Madrid que no empezaron", () => {
  it("el dia de Madrid, en verano (UTC+2) y en invierno (UTC+1)", () => {
    expect(rangoDeHoyEnMadrid(Date.parse("2026-10-09T07:00:00Z"))).toEqual({
      desde: "2026-10-08T22:00:00.000Z",
      hasta: "2026-10-09T22:00:00.000Z",
    });
    expect(rangoDeHoyEnMadrid(Date.parse("2026-12-09T07:00:00Z"))).toEqual({
      desde: "2026-12-08T23:00:00.000Z",
      hasta: "2026-12-09T23:00:00.000Z",
    });
  });

  it("el dia del cambio de hora dura 25 horas", () => {
    const { desde, hasta } = rangoDeHoyEnMadrid(Date.parse("2026-10-25T07:00:00Z"));
    expect((Date.parse(hasta) - Date.parse(desde)) / 3600000).toBe(25);
  });

  it("hoy mas tarde si; ya empezada, mañana o 'hoy en UTC pero mañana en Madrid' no", () => {
    const cron = Date.parse("2026-10-09T07:00:00Z");
    expect(tocaRecordatorio("2026-10-09T17:00:00Z", cron)).toBe(true); // 19:00 Madrid
    expect(tocaRecordatorio("2026-10-09T06:30:00Z", cron)).toBe(false); // ya empezo
    expect(tocaRecordatorio("2026-10-10T17:00:00Z", cron)).toBe(false); // mañana
    expect(tocaRecordatorio("2026-10-09T22:30:00Z", cron)).toBe(false); // 00:30 del 10 en Madrid
  });

  it("fecha y hora como las lee la alumna, y el enlace a la pagina real de la clase", () => {
    expect(fechaYHoraDeClase("2026-10-16T17:00:00Z")).toEqual({ fecha: "Viernes 16 de octubre", hora: "19:00 (hora de Madrid)" });
    expect(urlDeClase("https://bruneladance.com/", "barre-viernes")).toBe("https://bruneladance.com/dashboard/live/barre-viernes");
    // La ruta existe y es por slug.
    expect(leer("app/dashboard/live/[slug]/page.tsx")).toMatch(/\.eq\("slug", slug\)/);
  });
});

describe("bienvenida desde el webhook: solo la primera entrada", () => {
  const ev = (type: string, status: string | null, previo?: string) => ({
    type,
    data: { object: { status, metadata: { user_id: ALUMNA } }, previous_attributes: previo ? { status: previo } : undefined },
  });
  const aplicada = { suscripcionAplicada: true, packAplicado: false };

  it("suscripcion nueva en prueba o activa", () => {
    expect(alumnaParaBienvenida(ev("customer.subscription.created", "trialing"), aplicada)).toBe(ALUMNA);
    expect(alumnaParaBienvenida(ev("customer.subscription.created", "active"), aplicada)).toBe(ALUMNA);
  });

  it("la que esperaba la tarjeta (incomplete -> active) entra ahora", () => {
    expect(alumnaParaBienvenida(ev("customer.subscription.updated", "active", "incomplete"), aplicada)).toBe(ALUMNA);
  });

  it("una renovacion o un cambio de plan NO es bienvenida", () => {
    expect(alumnaParaBienvenida(ev("customer.subscription.updated", "active"), aplicada)).toBeNull();
    expect(alumnaParaBienvenida(ev("customer.subscription.updated", "active", "trialing"), aplicada)).toBeNull();
    expect(alumnaParaBienvenida(ev("customer.subscription.updated", "active", "past_due"), aplicada)).toBeNull();
  });

  it("nada si el evento no se aplico, si no da acceso, o si no trae alumna", () => {
    expect(alumnaParaBienvenida(ev("customer.subscription.created", "active"), { suscripcionAplicada: false, packAplicado: false })).toBeNull();
    expect(alumnaParaBienvenida(ev("customer.subscription.created", "incomplete"), aplicada)).toBeNull();
    expect(alumnaParaBienvenida(ev("customer.subscription.deleted", "canceled"), aplicada)).toBeNull();
    expect(alumnaParaBienvenida({ type: "customer.subscription.created", data: { object: { status: "active", metadata: {} } } }, aplicada)).toBeNull();
  });

  it("un pack registrado si; uno repetido (23505, no aplicado) no", () => {
    const pago = { type: "checkout.session.completed", data: { object: { status: "complete", metadata: { user_id: ALUMNA, pack_id: "p" } } } };
    expect(alumnaParaBienvenida(pago, { suscripcionAplicada: false, packAplicado: true })).toBe(ALUMNA);
    expect(alumnaParaBienvenida(pago, { suscripcionAplicada: false, packAplicado: false })).toBeNull();
  });
});

// ─── Nunca dos veces ──────────────────────────────────────────────────────

type Fila = { clave: string; resend_id: string | null };

/** Una base de mentira con lo unico que importa: la primary key de `clave`. */
function baseFalsa(opciones: { sinTabla?: boolean; errorAlReservar?: string } = {}) {
  const filas = new Map<string, Fila>();
  const db = {
    from(tabla: string) {
      if (tabla !== "correos_enviados") throw new Error("tabla inesperada " + tabla);
      const sinTabla = { data: null, error: { code: "PGRST205", message: "Could not find the table 'public.correos_enviados' in the schema cache" } };
      return {
        insert: async (f: Fila) => {
          if (opciones.sinTabla) return sinTabla;
          if (opciones.errorAlReservar) return { data: null, error: { code: "08006", message: opciones.errorAlReservar } };
          if (filas.has(f.clave)) return { data: null, error: { code: "23505", message: "duplicate key" } };
          filas.set(f.clave, { clave: f.clave, resend_id: null });
          return { data: null, error: null };
        },
        delete: () => {
          const filtros: Record<string, unknown> = {};
          const q = {
            eq: (c: string, v: unknown) => ((filtros[c] = v), q),
            is: (c: string, v: unknown) => {
              filtros[c] = v;
              const f = filas.get(filtros.clave as string);
              if (f && f.resend_id === v) filas.delete(f.clave);
              return Promise.resolve({ data: null, error: null });
            },
          };
          return q;
        },
        update: (valores: { resend_id: string }) => ({
          eq: async (_c: string, clave: string) => {
            const f = filas.get(clave);
            if (f) f.resend_id = valores.resend_id;
            return { data: null, error: null };
          },
        }),
      };
    },
  };
  return { db: db as unknown as SupabaseClient, filas };
}

function resendFalso(respuestas: ResultadoEnvio[]) {
  const enviados: CorreoAEnviar[] = [];
  const enviar = async (c: CorreoAEnviar) => {
    enviados.push(c);
    return respuestas.shift() ?? { ok: true as const, id: "re_" + enviados.length };
  };
  return { enviar, enviados };
}

const pedido: PedidoDeCorreo = {
  clave: claves.bienvenida(ALUMNA),
  tipo: "bienvenida",
  alumnaId: ALUMNA,
  para: "alumna@example.com",
  correo: { asunto: "Hola", html: "<p>Hola</p>", texto: "Hola" },
};

describe("enviarUnaVez: nunca dos veces", () => {
  it("reserva, manda con la clave como Idempotency-Key y guarda el id", async () => {
    const { db, filas } = baseFalsa();
    const r = resendFalso([{ ok: true, id: "re_1" }]);
    expect(await enviarUnaVez(pedido, { db, enviar: r.enviar })).toEqual({ estado: "enviado", id: "re_1" });
    expect(r.enviados).toHaveLength(1);
    expect(r.enviados[0].claveIdempotencia).toBe(pedido.clave);
    expect(filas.get(pedido.clave)?.resend_id).toBe("re_1");
  });

  it("la segunda vez (reintento de Stripe, otro cron) no manda nada", async () => {
    const { db } = baseFalsa();
    const r = resendFalso([]);
    await enviarUnaVez(pedido, { db, enviar: r.enviar });
    expect(await enviarUnaVez(pedido, { db, enviar: r.enviar })).toEqual({ estado: "ya_enviado" });
    expect(await enviarUnaVez(pedido, { db, enviar: r.enviar })).toEqual({ estado: "ya_enviado" });
    expect(r.enviados).toHaveLength(1);
  });

  it("dos ejecuciones a la vez: sale uno solo", async () => {
    const { db } = baseFalsa();
    const r = resendFalso([]);
    const res = await Promise.all([enviarUnaVez(pedido, { db, enviar: r.enviar }), enviarUnaVez(pedido, { db, enviar: r.enviar })]);
    expect(res.map((x) => x.estado).sort()).toEqual(["enviado", "ya_enviado"]);
    expect(r.enviados).toHaveLength(1);
  });

  it("si Resend falla, libera la reserva y la proxima vez se reintenta", async () => {
    const { db, filas } = baseFalsa();
    const r = resendFalso([{ ok: false, error: "Resend respondio 500" }, { ok: true, id: "re_2" }]);
    expect(await enviarUnaVez(pedido, { db, enviar: r.enviar })).toEqual({ estado: "fallo", error: "Resend respondio 500" });
    expect(filas.has(pedido.clave)).toBe(false);
    expect(await enviarUnaVez(pedido, { db, enviar: r.enviar })).toEqual({ estado: "enviado", id: "re_2" });
    expect(r.enviados).toHaveLength(2);
  });

  it("sin la migracion NO manda (mejor perder un aviso que mandarlo todos los dias)", async () => {
    const { db } = baseFalsa({ sinTabla: true });
    const r = resendFalso([]);
    expect(await enviarUnaVez(pedido, { db, enviar: r.enviar })).toEqual({ estado: "sin_migracion" });
    expect(r.enviados).toHaveLength(0);
  });

  it("si no se puede reservar por otro motivo, tampoco manda", async () => {
    const { db } = baseFalsa({ errorAlReservar: "conexion cortada" });
    const r = resendFalso([]);
    expect((await enviarUnaVez(pedido, { db, enviar: r.enviar })).estado).toBe("fallo");
    expect(r.enviados).toHaveLength(0);
  });

  it("nunca lanza, aunque la base explote", async () => {
    const db = { from: () => { throw new Error("boom"); } } as unknown as SupabaseClient;
    expect(await enviarUnaVez(pedido, { db, enviar: async () => ({ ok: true, id: "x" }) })).toEqual({ estado: "fallo", error: "boom" });
  });

  it("reconoce la tabla ausente por codigo y por mensaje", () => {
    expect(esFaltaDeTablaCorreos({ code: "42P01" })).toBe(true);
    expect(esFaltaDeTablaCorreos({ code: "PGRST205" })).toBe(true);
    expect(esFaltaDeTablaCorreos({ message: "Could not find the table 'public.correos_enviados'" })).toBe(true);
    expect(esFaltaDeTablaCorreos({ code: "23505" })).toBe(false);
    expect(esFaltaDeTablaCorreos(null)).toBe(false);
  });
});

// ─── El codigo que no puede cambiar ───────────────────────────────────────

describe("el webhook responde igual que antes", () => {
  const src = leer("app/api/stripe/webhooks/route.ts");
  const codigo = sinComentariosTs(src);

  it("las tres respuestas siguen siendo las mismas", () => {
    expect(codigo).toContain('outcome.applied ? { received: true } : { received: true, skipped: outcome.reason }');
    expect(codigo).toContain('return NextResponse.json({ error: message }, { status: 500 });');
    expect(codigo).toContain('return NextResponse.json({ error: "Missing stripe signature" }, { status: 400 });');
  });

  it("la bienvenida va DESPUES de auditar y DENTRO de after(), nunca en la respuesta", () => {
    const auditoria = codigo.indexOf("await persistWebhookAudit(event, null);");
    const correo = codigo.indexOf("enviarBienvenida(");
    expect(auditoria).toBeGreaterThan(0);
    expect(correo).toBeGreaterThan(auditoria);
    expect(codigo).toMatch(/after\(async \(\) => \{\s*await enviarBienvenida\(/);
    // Un solo llamado: no hay un segundo camino que mande sin after().
    expect(codigo.match(/enviarBienvenida\(/g)).toHaveLength(1);
  });

  it("el onboarding tambien la manda por after(), con el id de la sesion", () => {
    const reg = sinComentariosTs(leer("src/features/auth/registro.ts"));
    expect(reg).toMatch(/after\(async \(\) => \{\s*await enviarBienvenida\(createSupabaseAdminClient\(\), user\.id\);/);
  });
});

describe("guardas", () => {
  it("los modulos de correo NO son server actions (serian endpoints publicos)", () => {
    for (const f of ["src/features/correos/enviar-una-vez.ts", "src/features/correos/disparadores.ts", "src/features/correos/reglas.ts"]) {
      expect(sinComentariosTs(leer(f))).not.toMatch(/["']use server["']/);
    }
  });

  it("el cron conserva la guarda de CRON_SECRET y corre los correos despues de las bajas", () => {
    const cron = sinComentariosTs(leer("app/api/cron/keepalive/route.ts"));
    expect(cron).toContain("process.env.CRON_SECRET");
    expect(cron).toMatch(/status: 503/);
    expect(cron).toContain('request.headers.get("authorization") !== `Bearer ${esperado}`');
    expect(cron.indexOf("correosDelCron(")).toBeGreaterThan(cron.indexOf("aplicarBajasVencidas("));
    expect(cron.indexOf("correosDelCron(")).toBeGreaterThan(cron.indexOf("if (request.headers.get"));
  });

  it("vercel.json: un solo cron, diario", () => {
    const v = JSON.parse(leer("vercel.json"));
    expect(v.crons).toEqual([{ path: "/api/cron/keepalive", schedule: "0 7 * * *" }]);
  });

  it("toda invitacion manda su correo despues de insertar", () => {
    for (const f of ["src/features/admin/ficha-actions.ts", "src/features/admin/live-actions.ts"]) {
      const s = sinComentariosTs(leer(f));
      const insert = s.indexOf('from("live_session_invitations").insert(');
      expect(insert).toBeGreaterThan(0);
      expect(s.indexOf("enviarInvitacion(", insert)).toBeGreaterThan(insert);
    }
  });

  it("la migracion: sin begin/commit, con RLS, solo lectura de admin y escritura solo por service_role", () => {
    const sql = sinComentariosSql(leer("supabase/migrations/20261009_3_correos_enviados.sql"));
    expect(sql).not.toMatch(/^\s*(begin|commit)\s*;/im);
    expect(sql).toMatch(/clave text primary key/);
    expect(sql).toMatch(/alter table public\.correos_enviados enable row level security/);
    expect(sql).toMatch(/for select\s+to authenticated\s+using \(\(select public\.is_admin\(\)\)\)/);
    expect(sql).not.toMatch(/for (insert|update|delete|all)/i);
    expect(sql).toMatch(/revoke all on public\.correos_enviados from anon, authenticated;/);
    expect(sql).toMatch(/grant select on public\.correos_enviados to authenticated;/);
    expect(leer("SETUP.md")).toContain("20261009_3_correos_enviados.sql");
  });
});
