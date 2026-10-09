/**
 * Calendario: reglas puras (sin base, sin servidor).
 *
 * Lo usan /admin/calendario, el bloque "Esta semana" de /admin, "Mi agenda" de
 * la alumna (/dashboard/agenda y la tarjeta del inicio) y las pruebas de
 * tests/sistema/calendario-admin.test.ts y mi-agenda.test.ts.
 *
 * Vive en features/admin porque nacio ahi; no tiene NADA de admin (ni base, ni
 * guardas): son fechas y cadenas. La alumna lo reusa en vez de tener una
 * tercera implementacion de "en que dia de Madrid cae esto".
 *
 * TODO SE CUENTA EN HORA DE MADRID, que es la del estudio. El servidor corre en
 * UTC (Vercel): una clase a las 00:30 de Madrid cae ese dia aunque en UTC
 * todavia sea el anterior. Por eso los dias son CLAVES "2026-10-10" calculadas
 * con Intl en la zona, y las cuentas de calendario (sumar dias, armar el mes)
 * se hacen sobre la clave, al mediodia UTC: sumarle 24 h a un instante falla
 * la noche del cambio de hora.
 */

export const ZONA_CALENDARIO = "Europe/Madrid";

/**
 * vivo / privada: los de la admin, y en la agenda de la alumna los SUYOS
 * (clase en vivo reservada, sesion privada 1 a 1).
 * Solo en la agenda de la alumna:
 *   invitacion -> clase en vivo a la que Brunela la invito (y no reservo aun)
 *   cuenta     -> fecha de su cuenta, de dia entero (fin del gratis, renovacion...)
 *   disponible -> clase en vivo que su plan le deja reservar (opcional, aparte)
 */
export type TipoEvento = "vivo" | "privada" | "invitacion" | "cuenta" | "disponible";

/**
 * Un evento del calendario, ya resuelto a cadenas: cruza a cualquier componente
 * sin llevar funciones ni iconos (trampa 6).
 */
export type EventoCalendario = {
  id: string;
  tipo: TipoEvento;
  /** ISO de inicio. */
  inicio: string;
  titulo: string;
  /** A donde lleva tocarlo. */
  href: string;
  /** "8/12 anotadas · 2 en espera", "con enlace", ... */
  detalle: string;
  /** Solo clases en vivo: "Todos los planes", "Solista y Principal"... */
  planes?: string;
  /** Borrador, cancelada, hecha: se dibujan distinto. */
  estado?: "borrador" | "cancelada" | "hecha" | null;
  /** Para resaltar un cupo lleno o un enlace que falta. */
  alerta?: boolean;
  /** Marca de dia entero (sin hora): va primero en su dia y no muestra hora. */
  todoElDia?: boolean;
  /**
   * Un boton aparte del enlace principal, ya resuelto ("Unirse" de una sesion
   * privada con la ventana abierta). Cadenas, no funciones (trampa 6).
   */
  accion?: { href: string; texto: string; externo?: boolean } | null;
};

/** "2026-10-10" en Madrid. en-CA da el formato ISO de fecha. */
export function claveDia(instante: string | number | Date, zona = ZONA_CALENDARIO) {
  const d = instante instanceof Date ? instante : new Date(instante);
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: zona }).format(d);
}

/** "19:00" en Madrid. */
export function horaMadrid(iso: string) {
  return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: ZONA_CALENDARIO }).format(new Date(iso));
}

/** Suma dias de CALENDARIO a una clave ("2026-10-31" + 1 = "2026-11-01"). */
export function sumarDiasClave(clave: string, dias: number) {
  const ms = Date.parse(clave + "T12:00:00Z") + dias * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** El ?mes= de la URL si es valido; si no, el mes de hoy. */
export function mesDeParametro(valor: string | null | undefined, hoy: string) {
  return valor && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor) ? valor : hoy.slice(0, 7);
}

/** "2026-10" -> "2026-11" con d = 1, "2025-12" con d = -10... */
export function mesVecino(mes: string, d: number) {
  const [a, m] = mes.split("-").map(Number);
  const x = new Date(Date.UTC(a, m - 1 + d, 1));
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Las celdas de la grilla del mes, de lunes a domingo. `null` = hueco antes del
 * dia 1 o despues del ultimo, para completar semanas enteras.
 */
export function celdasDelMes(mes: string): (string | null)[] {
  const [a, m] = mes.split("-").map(Number);
  const primerDia = (new Date(Date.UTC(a, m - 1, 1)).getUTCDay() + 6) % 7; // lunes = 0
  const diasDelMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const celdas: (string | null)[] = [
    ...Array.from({ length: primerDia }, () => null),
    ...Array.from({ length: diasDelMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (celdas.length % 7) celdas.push(null);
  return celdas;
}

/**
 * Rango de instantes para CONSULTAR un mes. Con un dia de margen a cada lado:
 * Madrid esta a +1/+2 de UTC, asi que el mes de Madrid empieza el ultimo dia
 * del anterior en UTC. Lo que sobra se descarta despues por clave de dia.
 */
export function rangoConsultaMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return {
    desde: new Date(Date.UTC(a, m - 1, 1) - 86400000).toISOString(),
    hasta: new Date(Date.UTC(a, m, 1) + 86400000).toISOString(),
  };
}

/** Las 7 claves de "esta semana": hoy y los seis dias siguientes. */
export function diasDeLaSemana(hoy: string) {
  return Array.from({ length: 7 }, (_, i) => sumarDiasClave(hoy, i));
}

/** Rango de instantes para consultar los proximos 7 dias, con el mismo margen. */
export function rangoConsultaSemana(hoy: string) {
  return {
    desde: new Date(Date.parse(hoy + "T00:00:00Z") - 86400000).toISOString(),
    hasta: new Date(Date.parse(sumarDiasClave(hoy, 7) + "T00:00:00Z") + 86400000).toISOString(),
  };
}

/**
 * Agrupa por dia de Madrid, ordenado por hora dentro de cada dia. Con
 * `soloDias`, descarta lo que cae fuera (el margen de la consulta).
 */
export function agruparPorDia(eventos: EventoCalendario[], soloDias?: (clave: string) => boolean) {
  const porDia = new Map<string, EventoCalendario[]>();
  const ordenados = [...eventos].sort((x, y) => Date.parse(x.inicio) - Date.parse(y.inicio));
  for (const e of ordenados) {
    const k = claveDia(e.inicio);
    if (soloDias && !soloDias(k)) continue;
    const lista = porDia.get(k);
    if (lista) lista.push(e);
    else porDia.set(k, [e]);
  }
  // Las de dia entero, primero (sort estable: entre ellas sigue el orden por
  // hora). Sin ninguna, como en el calendario de la admin, no cambia nada.
  for (const lista of porDia.values()) lista.sort((x, y) => Number(!!y.todoElDia) - Number(!!x.todoElDia));
  return new Map([...porDia.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** Lo que entra en una celda y cuantos quedan para el "+N más". */
export function recortarCelda<T>(eventos: T[], max = 3) {
  if (eventos.length <= max) return { visibles: eventos, resto: 0 };
  return { visibles: eventos.slice(0, max), resto: eventos.length - max };
}

/** "+2 más", o null si no hace falta. */
export function textoMas(resto: number) {
  return resto > 0 ? `+${resto} más` : null;
}

const NOMBRE_PLAN: Record<string, string> = {
  corps_de_ballet: "Corps de Ballet",
  solista: "Solista",
  principal: "Principal",
};

/**
 * Quien puede reservar una clase en vivo. live_sessions guarda el plan MINIMO
 * (membership_tier_required): la policy deja reservar de ese plan para arriba.
 */
export function textoPlanesVivo(tierMinimo: string | null | undefined) {
  switch (tierMinimo) {
    case "solista":
      return "Solista y Principal";
    case "principal":
      return "Solo Principal";
    case "corps_de_ballet":
    case "none":
    default:
      return "Todos los planes";
  }
}

export function nombrePlan(tier: string | null | undefined) {
  return (tier && NOMBRE_PLAN[tier]) || "Sin plan";
}

/** "8/12 anotadas", "12/12 · completa", con la lista de espera si hay. */
export function textoCupo(reservadas: number, capacidad: number | null | undefined, enEspera = 0) {
  const cap = capacidad && capacidad > 0 ? capacidad : null;
  let t = cap ? `${reservadas}/${cap} anotadas` : `${reservadas} ${reservadas === 1 ? "anotada" : "anotadas"}`;
  if (cap && reservadas >= cap) t += " · completa";
  if (enEspera > 0) t += ` · ${enEspera} en espera`;
  return t;
}

/** "Octubre de 2026" */
export function nombreMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const t = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 15)));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** "Sábado 10 de octubre" */
export function nombreDia(clave: string) {
  const t = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(clave + "T12:00:00Z"));
  return t.charAt(0).toUpperCase() + t.slice(1).replace(",", "");
}

/** "sáb 10" para filas compactas. */
export function nombreDiaCorto(clave: string) {
  return new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(clave + "T12:00:00Z")).replace(".", "").replace(",", "");
}

/**
 * La tabla no existe todavia (la migracion no se corrio). Postgres da 42P01;
 * PostgREST, antes de llegar a Postgres, da PGRST205 "Could not find the table".
 */
export function esTablaInexistente(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /could not find the table|does not exist/i.test(error.message ?? "");
}

export const AVISO_SIN_SESIONES_PRIVADAS =
  "Las sesiones privadas aparecen acá cuando se corra la migración 20261009_2_sesiones_privadas.sql";
