import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { agruparPorDia, claveDia, type EventoCalendario } from "../../src/features/admin/calendario";
import {
  eventoDeInvitacion, eventoDePrivada, eventoDeReserva, marcasDeCuenta, proximosDeLaAgenda,
  type SesionVivoAgenda,
} from "../../src/features/studio/agenda-reglas";
import type { SesionPrivada } from "../../src/features/studio/sesiones-privadas-reglas";

/**
 * "Mi agenda" de la alumna (/dashboard/agenda y la tarjeta del inicio).
 *
 * Reglas puras y lectura de codigo: NO prueban la base. Lo que importa
 * cuidar ademas de las fechas es que la agenda lea con el cliente DE ELLA.
 */

const leer = (p: string) => readFileSync(p, "utf8");
const AHORA = Date.parse("2026-10-09T10:00:00Z");

const vivo = (o: Partial<SesionVivoAgenda> = {}): SesionVivoAgenda => ({
  id: "s1", slug: "barre-jueves", titulo: "Barra del jueves",
  starts_at: "2026-10-15T17:00:00Z", ends_at: "2026-10-15T18:00:00Z", status: "scheduled", ...o,
});

const privada = (o: Partial<SesionPrivada> = {}): SesionPrivada => ({
  id: "p1", alumna_id: "a", starts_at: "2026-10-09T10:05:00Z", duracion_minutos: 60,
  enlace: "https://meet.google.com/abc-defg-hij", proveedor: "meet", nota: null, estado: "agendada", ...o,
});

describe("clases en vivo", () => {
  it("una reserva lleva a la ficha de la clase de la alumna", () => {
    const e = eventoDeReserva(vivo(), "reserved", AHORA);
    expect(e.tipo).toBe("vivo");
    expect(e.href).toBe("/dashboard/live/barre-jueves");
    expect(e.detalle).toBe("Tenés tu lugar");
    expect(e.estado).toBeNull();
  });

  it("lista de espera se marca", () => {
    const e = eventoDeReserva(vivo(), "waitlisted", AHORA);
    expect(e.detalle).toMatch(/lista de espera/);
    expect(e.alerta).toBe(true);
  });

  it("cancelada por Brunela y ya terminada se distinguen", () => {
    expect(eventoDeReserva(vivo({ status: "canceled" }), "reserved", AHORA).estado).toBe("cancelada");
    expect(eventoDeReserva(vivo({ starts_at: "2026-10-01T17:00:00Z", ends_at: "2026-10-01T18:00:00Z" }), "reserved", AHORA).estado).toBe("hecha");
  });

  it("una invitacion es su propio tipo e invita a reservar", () => {
    const e = eventoDeInvitacion(vivo(), AHORA);
    expect(e.tipo).toBe("invitacion");
    expect(e.detalle).toMatch(/reservá/);
  });
});

describe("sesiones privadas: el boton Unirse", () => {
  it("desde 15 min antes, con enlace: accion Unirse al enlace", () => {
    const e = eventoDePrivada(privada(), AHORA)!;
    expect(e.accion).toEqual({ href: "https://meet.google.com/abc-defg-hij", texto: "Unirse", externo: true });
    expect(e.href).toBe("/dashboard/sesiones-privadas");
  });

  it("antes de la ventana: sin boton, y lo dice", () => {
    const e = eventoDePrivada(privada({ starts_at: "2026-10-12T10:00:00Z" }), AHORA)!;
    expect(e.accion).toBeNull();
    expect(e.detalle).toMatch(/15 min antes/);
  });

  it("abierta pero sin enlace: sin boton", () => {
    const e = eventoDePrivada(privada({ enlace: null }), AHORA)!;
    expect(e.accion).toBeNull();
    expect(e.detalle).toMatch(/enlace/);
  });

  it("terminada: hecha y sin boton; cancelada: no aparece", () => {
    const hecha = eventoDePrivada(privada({ starts_at: "2026-10-08T10:00:00Z" }), AHORA)!;
    expect(hecha.estado).toBe("hecha");
    expect(hecha.accion).toBeNull();
    expect(eventoDePrivada(privada({ estado: "cancelada" }), AHORA)).toBeNull();
  });
});

describe("fechas de la cuenta", () => {
  it("fin del acceso gratis, de dia entero, con el plan", () => {
    const [m] = marcasDeCuenta({ gratisHasta: "2026-10-20T22:00:00Z", gratisPlan: "solista", suscripcion: null, packs: [] });
    expect(m.tipo).toBe("cuenta");
    expect(m.todoElDia).toBe(true);
    expect(m.titulo).toBe("Termina tu acceso gratis a Solista");
  });

  it("prueba: fin de la prueba (no la renovacion, que es la misma fecha)", () => {
    const m = marcasDeCuenta({
      gratisHasta: null, gratisPlan: null, packs: [],
      suscripcion: { status: "trialing", cancel_at_period_end: false, trial_ends_at: "2026-10-16T10:00:00Z", current_period_ends_at: "2026-10-16T10:00:00Z" },
    });
    expect(m).toHaveLength(1);
    expect(m[0].titulo).toBe("Termina tu prueba gratis");
    expect(m[0].inicio).toBe("2026-10-16T10:00:00Z");
  });

  it("activa: renovacion; si cancelo, fin del plan", () => {
    const base = { status: "active", trial_ends_at: null, current_period_ends_at: "2026-11-01T10:00:00Z" };
    expect(marcasDeCuenta({ gratisHasta: null, gratisPlan: null, packs: [], suscripcion: { ...base, cancel_at_period_end: false } })[0].titulo).toBe("Se renueva tu plan");
    expect(marcasDeCuenta({ gratisHasta: null, gratisPlan: null, packs: [], suscripcion: { ...base, cancel_at_period_end: true } })[0].titulo).toBe("Termina tu plan");
  });

  it("una suscripcion cancelada del todo no deja marca", () => {
    expect(marcasDeCuenta({
      gratisHasta: null, gratisPlan: null, packs: [],
      suscripcion: { status: "canceled", cancel_at_period_end: false, trial_ends_at: null, current_period_ends_at: "2026-11-01T10:00:00Z" },
    })).toHaveLength(0);
  });

  it("los packs son para siempre: sin fecha no se inventa ninguna", () => {
    expect(marcasDeCuenta({ gratisHasta: null, gratisPlan: null, suscripcion: null, packs: [{ id: "k", slug: "pies", nombre: "Pies", vence: "" }] })).toHaveLength(0);
    const [m] = marcasDeCuenta({ gratisHasta: null, gratisPlan: null, suscripcion: null, packs: [{ id: "k", slug: "pies", nombre: "Pies", vence: "2027-01-01T00:00:00Z" }] });
    expect(m.titulo).toBe("Vence tu pack «Pies»");
    expect(m.href).toBe("/dashboard/packs/pies");
  });
});

describe("reusa el calendario de la admin sin romperlo", () => {
  it("las marcas de dia entero van primero en su dia; sin ellas el orden sigue por hora", () => {
    const evs: EventoCalendario[] = [
      { id: "a", tipo: "vivo", inicio: "2026-10-16T07:00:00Z", titulo: "a", href: "/", detalle: "" },
      { id: "b", tipo: "cuenta", inicio: "2026-10-16T15:00:00Z", titulo: "b", href: "/", detalle: "", todoElDia: true },
      { id: "c", tipo: "vivo", inicio: "2026-10-16T06:00:00Z", titulo: "c", href: "/", detalle: "" },
    ];
    expect(agruparPorDia(evs).get("2026-10-16")!.map((e) => e.id)).toEqual(["b", "c", "a"]);
    expect(agruparPorDia(evs.filter((e) => !e.todoElDia)).get("2026-10-16")!.map((e) => e.id)).toEqual(["c", "a"]);
  });

  it("lo proximo: sin lo hecho, lo cancelado ni lo que solo se puede reservar", () => {
    const evs: EventoCalendario[] = [
      { id: "1", tipo: "vivo", inicio: "2026-10-12T17:00:00Z", titulo: "", href: "/", detalle: "" },
      { id: "2", tipo: "vivo", inicio: "2026-10-10T17:00:00Z", titulo: "", href: "/", detalle: "", estado: "cancelada" },
      { id: "3", tipo: "disponible", inicio: "2026-10-10T17:00:00Z", titulo: "", href: "/", detalle: "" },
      { id: "4", tipo: "cuenta", inicio: "2026-10-11T08:00:00Z", titulo: "", href: "/", detalle: "", todoElDia: true },
      { id: "5", tipo: "vivo", inicio: "2026-10-01T17:00:00Z", titulo: "", href: "/", detalle: "" },
    ];
    expect(proximosDeLaAgenda(evs, "2026-10-09", (i) => claveDia(i)).map((e) => e.id)).toEqual(["4", "1"]);
  });
});

describe("lee con el cliente de ELLA", () => {
  const src = leer("src/features/studio/agenda.ts");

  it("no importa ni usa el cliente de service_role", () => {
    expect(src).not.toMatch(/createSupabaseAdminClient|supabase\/admin/);
    expect(src).toMatch(/createSupabaseServerClient\(\)/);
  });

  it("filtra por ella lo que a la admin RLS le devuelve de todas", () => {
    expect(src).toMatch(/\.from\("live_session_bookings"\)[^;]*\.eq\("user_id", userId\)/);
    expect(src).toMatch(/\.from\("live_session_invitations"\)[^;]*\.eq\("user_id", userId\)/);
    expect(src).toMatch(/\.from\("subscriptions"\)[\s\S]*?\.eq\("user_id", userId\)/);
    expect(src).toMatch(/\.from\("pack_purchases"\)[^;]*\.eq\("user_id", userId\)/);
  });

  it("la pagina pide la sesion y no es de admin", () => {
    const pagina = leer("app/dashboard/agenda/page.tsx");
    expect(pagina).toMatch(/await requireUser\(\)/);
    expect(pagina).not.toMatch(/requireAdmin|createSupabaseAdminClient/);
  });

  it("esta en el menu de escritorio y en el del telefono", () => {
    expect(leer("components/studio-sidebar.tsx")).toContain("'/dashboard/agenda'");
    expect(leer("components/mobile-dashboard-nav.tsx")).toContain("'/dashboard/agenda'");
  });
});
