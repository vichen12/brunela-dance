/**
 * "Mi agenda" de la alumna: reglas puras (sin base, sin servidor).
 *
 * Convierte filas ya leidas (con el cliente DE ELLA, en agenda.ts) en eventos
 * del MISMO tipo que usa el calendario de la admin (EventoCalendario), para
 * reusar sus reglas de dias, meses y grilla en vez de escribir otra.
 *
 * Imports RELATIVOS a proposito: lo cargan las pruebas
 * (tests/sistema/mi-agenda.test.ts), que no resuelven el alias "@/".
 */
import type { EventoCalendario } from "../admin/calendario";
import { estadoVisible, ventanaUnirse, type SesionPrivada } from "./sesiones-privadas-reglas";

const NOMBRE_PLAN: Record<string, string> = {
  corps_de_ballet: "Corps de Ballet",
  solista: "Solista",
  principal: "Principal",
};

export type SesionVivoAgenda = {
  id: string;
  slug: string;
  titulo: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
};

export type SuscripcionAgenda = {
  status: string;
  cancel_at_period_end: boolean | null;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
};

export type PackConVencimiento = { id: string; slug: string; nombre: string; vence: string };

/** Estados de suscripcion que siguen vivos: los que dan acceso. */
const SUSCRIPCION_VIVA = new Set(["trialing", "active", "past_due"]);

function estadoVivo(s: SesionVivoAgenda, ahora: number): EventoCalendario["estado"] {
  if (s.status === "canceled") return "cancelada";
  const fin = s.ends_at ? Date.parse(s.ends_at) : Date.parse(s.starts_at) + 60 * 60000;
  if (s.status === "completed" || fin <= ahora) return "hecha";
  return null;
}

/** Una clase en vivo que reservo (o en la que esta en lista de espera). */
export function eventoDeReserva(s: SesionVivoAgenda, reserva: "reserved" | "waitlisted", ahora = Date.now()): EventoCalendario {
  const estado = estadoVivo(s, ahora);
  return {
    id: s.id,
    tipo: "vivo",
    inicio: s.starts_at,
    titulo: s.titulo,
    href: `/dashboard/live/${s.slug}`,
    detalle: estado === "cancelada"
      ? "Brunela canceló esta clase"
      : reserva === "waitlisted" ? "Estás en lista de espera" : "Tenés tu lugar",
    estado,
    alerta: reserva === "waitlisted" && estado === null,
  };
}

/** Una clase en vivo a la que la invitaron y todavia no reservo. */
export function eventoDeInvitacion(s: SesionVivoAgenda, ahora = Date.now()): EventoCalendario {
  const estado = estadoVivo(s, ahora);
  return {
    id: s.id,
    tipo: "invitacion",
    inicio: s.starts_at,
    titulo: s.titulo,
    href: `/dashboard/live/${s.slug}`,
    detalle: estado === null ? "Brunela te invitó · reservá tu lugar" : "Te invitó Brunela",
    estado,
  };
}

/** Una clase en vivo que su plan le deja reservar (la seccion opcional). */
export function eventoDisponible(s: SesionVivoAgenda): EventoCalendario {
  return {
    id: s.id,
    tipo: "disponible",
    inicio: s.starts_at,
    titulo: s.titulo,
    href: `/dashboard/live/${s.slug}`,
    detalle: "Podés reservarla",
  };
}

/**
 * Su sesion privada 1 a 1, con el estado del boton "Unirse" de
 * sesiones-privadas-reglas (desde 15 min antes hasta que termina).
 * Las canceladas no van: igual que en el calendario de la admin.
 */
export function eventoDePrivada(s: SesionPrivada, ahora = Date.now()): EventoCalendario | null {
  if (s.estado === "cancelada") return null;
  const visible = estadoVisible(s, ahora);
  const ventana = ventanaUnirse(s, ahora);
  const conEnlace = !!s.enlace?.trim();
  const duracion = `${s.duracion_minutos} min`;

  let detalle: string;
  if (visible === "hecha") detalle = duracion;
  else if (ventana === "abierta") detalle = conEnlace ? "Ya podés unirte" : "Brunela te pasa el enlace en un momento";
  else detalle = `${duracion} · ` + (conEnlace ? "el botón para unirte se abre 15 min antes" : "Brunela te pasa el enlace antes de empezar");

  return {
    id: s.id,
    tipo: "privada",
    inicio: s.starts_at,
    titulo: "Sesión privada con Brunela",
    href: "/dashboard/sesiones-privadas",
    detalle,
    estado: visible === "hecha" ? "hecha" : null,
    alerta: ventana === "abierta",
    accion: visible !== "hecha" && ventana === "abierta" && conEnlace ? { href: s.enlace!.trim(), texto: "Unirse", externo: true } : null,
  };
}

/**
 * Las fechas de su cuenta, como marcas de dia entero:
 *   · fin del acceso gratis (profiles.acceso_gratis_hasta)
 *   · fin de la prueba / proxima renovacion / fin del plan si cancelo
 *     (subscriptions: trial_ends_at, current_period_ends_at, cancel_at_period_end)
 *   · vencimiento de un pack, SOLO si la compra tiene expires_at. Los packs son
 *     para siempre (expires_at = null): no se inventa ninguna fecha.
 */
export function marcasDeCuenta(a: {
  gratisHasta: string | null;
  gratisPlan: string | null;
  suscripcion: SuscripcionAgenda | null;
  packs: PackConVencimiento[];
}): EventoCalendario[] {
  const marcas: EventoCalendario[] = [];
  const cuenta = (id: string, inicio: string, titulo: string, detalle: string, href: string, alerta = false): EventoCalendario => ({
    id, tipo: "cuenta", inicio, titulo, detalle, href, todoElDia: true, alerta,
  });

  if (a.gratisHasta) {
    const plan = a.gratisPlan ? NOMBRE_PLAN[a.gratisPlan] : null;
    marcas.push(cuenta("gratis", a.gratisHasta,
      plan ? `Termina tu acceso gratis a ${plan}` : "Termina tu acceso gratis",
      "Elegí tu plan para seguir sin cortes", "/dashboard/plan", true));
  }

  const sub = a.suscripcion;
  if (sub && SUSCRIPCION_VIVA.has(sub.status)) {
    const cancela = !!sub.cancel_at_period_end;
    if (sub.status === "trialing" && sub.trial_ends_at) {
      marcas.push(cancela
        ? cuenta("suscripcion", sub.trial_ends_at, "Termina tu prueba y tu plan", "Cancelaste: no se cobra nada", "/dashboard/plan", true)
        : cuenta("suscripcion", sub.trial_ends_at, "Termina tu prueba gratis", "Se cobra el primer pago de tu plan", "/dashboard/plan"));
    } else if (sub.current_period_ends_at) {
      marcas.push(cancela
        ? cuenta("suscripcion", sub.current_period_ends_at, "Termina tu plan", "Cancelaste la renovación: hasta ese día seguís con todo", "/dashboard/plan", true)
        : cuenta("suscripcion", sub.current_period_ends_at, "Se renueva tu plan", "Cobro automático", "/dashboard/plan"));
    }
  }

  for (const p of a.packs) {
    if (!p.vence) continue;
    marcas.push(cuenta("pack-" + p.id, p.vence, `Vence tu pack «${p.nombre}»`, "Hasta ese día tenés sus clases", p.slug ? `/dashboard/packs/${p.slug}` : "/dashboard/packs"));
  }
  return marcas;
}

/**
 * Lo proximo de su agenda, para la tarjeta del inicio: lo que no termino ni
 * se cancelo, en orden. Las marcas de cuenta cuentan desde su dia (Madrid).
 */
export function proximosDeLaAgenda(eventos: EventoCalendario[], hoy: string, claveDia: (iso: string) => string, max = 3): EventoCalendario[] {
  return eventos
    .filter((e) => e.estado !== "hecha" && e.estado !== "cancelada" && e.tipo !== "disponible")
    .filter((e) => claveDia(e.inicio) >= hoy)
    .sort((x, y) => Date.parse(x.inicio) - Date.parse(y.inicio))
    .slice(0, max);
}
