import { createSupabaseServerClient } from "@/src/lib/supabase/server";

/**
 * Capa de datos de las analiticas.
 *
 * POR QUE ESTA SEPARADA DE LA PANTALLA
 *   Cinco de las ocho metricas van a cambiar de FUENTE cuando activity_events
 *   acumule historia, pero no de FORMA. Con las consultas aca adentro, ese
 *   cambio no toca ni una linea de la pantalla. Es lo unico que evita
 *   construir el panel dos veces.
 *
 * COMO SE LLAMAN LAS COSAS
 *   Por lo que son, aunque quede feo. Hoy no existe el concepto de
 *   "reproduccion": lo unico que se puede contar es cuantas alumnas TIENEN una
 *   fila de progreso en esa clase. Eso es `alumnasQueLaEmpezaron`, y no
 *   `vistas`. Si se llamara "vistas", el numero cambiaria de significado solo
 *   el dia que lleguen los eventos y nadie lo notaria.
 *
 * RENDIMIENTO
 *   Seis consultas en paralelo y todo lo demas se deriva en memoria. La
 *   alternativa -- un `count exact` por metrica -- serian ~15 viajes a
 *   Frankfurt. Ver la deuda anotada en CLAUDE.md: por encima de ~500 alumnas
 *   esto hay que pasarlo a funciones SQL.
 */

// ── Umbrales de significancia ────────────────────────────────────────────────
// Ninguna metrica muestra un numero cuando la muestra es demasiado chica para
// que ese numero signifique algo. Un churn de "100%" sobre una alumna no es
// informacion, es ruido que puede llevar a una decision equivocada.

export const UMBRALES = {
  churn: 5,
  conversion: 10,
  programa: 3,
  segmentacion: 5,
  contenido: 5,
  inactividad: 3,
} as const;

export type Umbral = {
  suficiente: boolean;
  hoy: number;
  minimo: number;
  /** Que hace falta, en castellano, para el estado vacio. */
  que: string;
};

function umbral(hoy: number, minimo: number, que: string): Umbral {
  return { suficiente: hoy >= minimo, hoy, minimo, que };
}

// ── Tipos ────────────────────────────────────────────────────────────────────

export type Churn = {
  umbral: Umbral;
  activas: number;
  bajasEsteMes: number;
  avisaronQueSeVan: number;
  porcentaje: number | null;
};

export type Conversion = {
  umbral: Umbral;
  registradas: number;
  conPlan: number;
  deCada10: number | null;
  sinTerminarOnboarding: number;
};

export type FilaPrograma = {
  id: string;
  slug: string;
  titulo: string;
  dias: number;
  umbral: Umbral;
  laEmpezaron: number;
  laTerminaron: number;
  /** Dia en el que mas alumnas dejaron de avanzar. null si no hay abandono. */
  diaDeAbandono: number | null;
};

export type Segmentacion = {
  umbral: Umbral;
  porPlan: { clave: string; etiqueta: string; cantidad: number }[];
  porNivel: { clave: string; etiqueta: string; cantidad: number }[];
  activas: number;
  inactivas: number;
};

export type ClaseSinUso = {
  id: string;
  slug: string;
  titulo: string;
  /** NO es "vistas". Ver el encabezado del archivo. */
  alumnasQueLaEmpezaron: number;
  publicadaHace: number | null;
};

export type Inactiva = {
  id: string;
  nombre: string;
  email: string;
  plan: string;
  diasSinEntrar: number | null;
  ultimaActividad: string | null;
};

export type Analitica = {
  churn: Churn;
  conversion: Conversion;
  programas: FilaPrograma[];
  segmentacion: Segmentacion;
  sinUso: { umbral: Umbral; clases: ClaseSinUso[]; totalPublicadas: number };
  inactividad: { umbral: Umbral; alumnas: Inactiva[]; diasCorte: number };
  /** Para la franja de "todavia no hay datos" de arriba de todo. */
  estudioVacio: boolean;
};

// ── Etiquetas ────────────────────────────────────────────────────────────────

export const PLAN_ETIQUETA: Record<string, string> = {
  none: "Sin plan",
  corps_de_ballet: "Corps de ballet",
  solista: "Solista",
  principal: "Principal",
};

export const NIVEL_ETIQUETA: Record<string, string> = {
  principiante: "Principiante",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
  profesional: "Profesional",
  maestro: "Maestro",
};

/** Estados de Stripe en los que la alumna tiene acceso pago vigente. */
const ESTADOS_CON_ACCESO = ["active", "trialing", "past_due"];

/** Sin entrar en mas de esto, aparece en la lista de inactividad. */
const DIAS_INACTIVIDAD = 14;

function textoI18n(campo: unknown): string {
  if (campo && typeof campo === "object") {
    const m = campo as Record<string, string>;
    return m.es ?? m.en ?? Object.values(m)[0] ?? "";
  }
  return typeof campo === "string" ? campo : "";
}

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86_400_000);
}

// ── La consulta ──────────────────────────────────────────────────────────────

export async function getAnalitica(): Promise<Analitica> {
  const supabase = await createSupabaseServerClient();

  // RLS ya deja a las admin leer todo (policies *_select_own_or_admin), asi que
  // esto va con el cliente de SESION y no con service_role. Una pantalla de
  // lectura no necesita saltear RLS, y no hacerlo mantiene el modelo en un solo
  // lugar.
  const [
    { data: perfiles },
    { data: suscripciones },
    { data: progreso },
    { data: videos },
    { data: programas },
    { data: dias },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, membership_tier, technical_level, onboarding_completed, is_admin, created_at")
      .eq("is_admin", false),
    supabase
      .from("subscriptions")
      .select("user_id, status, membership_tier, canceled_at, ended_at, cancel_at_period_end, created_at"),
    supabase
      .from("user_progress")
      .select("user_id, video_id, program_id, program_day_number, completion_percent, is_completed, updated_at"),
    supabase.from("videos").select("id, slug, title_i18n, status, published_at"),
    supabase.from("programs").select("id, slug, title_i18n, duration_days, status"),
    supabase.from("program_days").select("program_id, day_number"),
  ]);

  const P = perfiles ?? [];
  const S = suscripciones ?? [];
  const G = progreso ?? [];
  const V = videos ?? [];
  const PR = programas ?? [];
  const PD = dias ?? [];

  const ultimaActividad = await getUltimaActividadPorAlumna(G);

  // ── Churn ──────────────────────────────────────────────────────────────────
  const inicioDeMes = new Date();
  inicioDeMes.setDate(1);
  inicioDeMes.setHours(0, 0, 0, 0);

  const activas = S.filter((s) => ESTADOS_CON_ACCESO.includes(s.status)).length;
  const bajasEsteMes = S.filter((s) => {
    const f = s.canceled_at ?? s.ended_at;
    return f !== null && new Date(f) >= inicioDeMes;
  }).length;
  const avisaronQueSeVan = S.filter(
    (s) => s.cancel_at_period_end && ESTADOS_CON_ACCESO.includes(s.status)
  ).length;

  // Denominador = las que estaban al empezar el mes, o sea las activas de hoy
  // mas las que se fueron durante el mes. Sin sumar las bajas, el porcentaje
  // sale inflado.
  const baseChurn = activas + bajasEsteMes;
  const churn: Churn = {
    umbral: umbral(baseChurn, UMBRALES.churn, "alumnas con plan"),
    activas,
    bajasEsteMes,
    avisaronQueSeVan,
    porcentaje: baseChurn > 0 ? Math.round((bajasEsteMes / baseChurn) * 100) : null,
  };

  // ── Conversion registro -> pago ────────────────────────────────────────────
  const conPlanIds = new Set(
    S.filter((s) => ESTADOS_CON_ACCESO.includes(s.status)).map((s) => s.user_id)
  );
  const registradas = P.length;
  const conPlan = P.filter((p) => conPlanIds.has(p.id)).length;

  const conversion: Conversion = {
    umbral: umbral(registradas, UMBRALES.conversion, "alumnas registradas"),
    registradas,
    conPlan,
    deCada10: registradas > 0 ? Math.round((conPlan / registradas) * 10) : null,
    sinTerminarOnboarding: P.filter((p) => !p.onboarding_completed).length,
  };

  // ── Programas ──────────────────────────────────────────────────────────────
  const diasPorPrograma = new Map<string, number>();
  for (const d of PD) {
    diasPorPrograma.set(d.program_id, Math.max(diasPorPrograma.get(d.program_id) ?? 0, d.day_number));
  }

  const filasPrograma: FilaPrograma[] = PR.map((prog) => {
    const total = diasPorPrograma.get(prog.id) ?? prog.duration_days ?? 0;
    const suyas = G.filter((g) => g.program_id === prog.id);

    // Hasta que dia llego cada alumna.
    const llegoHasta = new Map<string, number>();
    for (const g of suyas) {
      const dia = g.program_day_number ?? 0;
      llegoHasta.set(g.user_id, Math.max(llegoHasta.get(g.user_id) ?? 0, dia));
    }

    const laEmpezaron = llegoHasta.size;
    const laTerminaron = total > 0
      ? Array.from(llegoHasta.values()).filter((d) => d >= total).length
      : 0;

    // El dia donde mas alumnas se quedaron, sin contar a las que terminaron.
    const cortes = new Map<number, number>();
    for (const [, d] of llegoHasta) {
      if (total > 0 && d >= total) continue;
      cortes.set(d, (cortes.get(d) ?? 0) + 1);
    }
    let diaDeAbandono: number | null = null;
    let mayor = 0;
    for (const [dia, cuantas] of cortes) {
      if (cuantas > mayor) { mayor = cuantas; diaDeAbandono = dia; }
    }

    return {
      id: prog.id,
      slug: prog.slug,
      titulo: textoI18n(prog.title_i18n) || prog.slug,
      dias: total,
      umbral: umbral(laEmpezaron, UMBRALES.programa, "alumnas que lo empezaron"),
      laEmpezaron,
      laTerminaron,
      diaDeAbandono,
    };
  }).sort((a, b) => b.laEmpezaron - a.laEmpezaron);

  // ── Segmentacion ───────────────────────────────────────────────────────────
  const contarPor = (campo: "membership_tier" | "technical_level", etiquetas: Record<string, string>) => {
    const m = new Map<string, number>();
    for (const p of P) {
      const v = (p[campo] as string | null) ?? "sin_dato";
      m.set(v, (m.get(v) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .map(([clave, cantidad]) => ({ clave, etiqueta: etiquetas[clave] ?? "Sin dato", cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);
  };

  const activasPorUso = P.filter((p) => {
    const d = diasDesde(ultimaActividad.get(p.id) ?? null);
    return d !== null && d <= DIAS_INACTIVIDAD;
  }).length;

  const segmentacion: Segmentacion = {
    umbral: umbral(registradas, UMBRALES.segmentacion, "alumnas registradas"),
    porPlan: contarPor("membership_tier", PLAN_ETIQUETA),
    porNivel: contarPor("technical_level", NIVEL_ETIQUETA),
    activas: activasPorUso,
    inactivas: registradas - activasPorUso,
  };

  // ── Contenido sin uso ──────────────────────────────────────────────────────
  const empezaronPorVideo = new Map<string, Set<string>>();
  for (const g of G) {
    if (!empezaronPorVideo.has(g.video_id)) empezaronPorVideo.set(g.video_id, new Set());
    empezaronPorVideo.get(g.video_id)!.add(g.user_id);
  }

  const publicadas = V.filter((v) => v.status === "published");
  const clasesSinUso: ClaseSinUso[] = publicadas
    .map((v) => ({
      id: v.id,
      slug: v.slug,
      titulo: textoI18n(v.title_i18n) || v.slug,
      alumnasQueLaEmpezaron: empezaronPorVideo.get(v.id)?.size ?? 0,
      publicadaHace: diasDesde(v.published_at),
    }))
    .filter((c) => c.alumnasQueLaEmpezaron === 0)
    .sort((a, b) => (b.publicadaHace ?? 0) - (a.publicadaHace ?? 0));

  // ── Inactividad ────────────────────────────────────────────────────────────
  const inactivas: Inactiva[] = P.filter((p) => conPlanIds.has(p.id))
    .map((p) => {
      const ult = ultimaActividad.get(p.id) ?? null;
      return {
        id: p.id,
        nombre: p.full_name ?? "Sin nombre",
        email: p.email,
        plan: PLAN_ETIQUETA[p.membership_tier] ?? p.membership_tier,
        diasSinEntrar: diasDesde(ult),
        ultimaActividad: ult,
      };
    })
    .filter((a) => a.diasSinEntrar === null || a.diasSinEntrar > DIAS_INACTIVIDAD)
    .sort((a, b) => (b.diasSinEntrar ?? 9999) - (a.diasSinEntrar ?? 9999));

  return {
    churn,
    conversion,
    programas: filasPrograma,
    segmentacion,
    sinUso: {
      umbral: umbral(registradas, UMBRALES.contenido, "alumnas registradas"),
      clases: clasesSinUso,
      totalPublicadas: publicadas.length,
    },
    inactividad: {
      umbral: umbral(conPlanIds.size, UMBRALES.inactividad, "alumnas con plan"),
      alumnas: inactivas,
      diasCorte: DIAS_INACTIVIDAD,
    },
    estudioVacio: registradas === 0 || publicadas.length === 0,
  };
}

/**
 * Ultima vez que cada alumna hizo algo.
 *
 * HOY sale del maximo de `user_progress.updated_at`, que es una aproximacion:
 * ese campo se pisa en cada guardado, asi que solo sobrevive la ultima vez.
 * Alcanza para "hace cuanto que no entra", que es lo que se muestra.
 *
 * Y YA MIRA activity_events: se toma el mayor de los dos. Mientras esa tabla
 * este vacia el resultado es identico al de hoy, y en cuanto empiece a llenarse
 * la respuesta mejora sola, sin tocar esta funcion ni la pantalla. Por eso no
 * hay una version "vieja" y otra "nueva" que haya que reemplazar.
 */
async function getUltimaActividadPorAlumna(
  progreso: { user_id: string; updated_at: string }[]
): Promise<Map<string, string>> {
  const m = new Map<string, string>();

  for (const g of progreso) {
    const actual = m.get(g.user_id);
    if (!actual || g.updated_at > actual) m.set(g.user_id, g.updated_at);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("activity_events")
      .select("user_id, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(5000);

    for (const e of data ?? []) {
      const actual = m.get(e.user_id);
      if (!actual || e.occurred_at > actual) m.set(e.user_id, e.occurred_at);
    }
  } catch {
    // Si la tabla todavia no existe en este entorno, la aproximacion por
    // progreso sigue sirviendo. No es motivo para romper la pantalla entera.
  }

  return m;
}
