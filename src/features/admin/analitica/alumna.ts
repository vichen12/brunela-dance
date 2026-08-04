import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { NIVEL_ETIQUETA, PLAN_ETIQUETA } from "./queries";

/**
 * Todo lo que hay que saber de UNA alumna, para la ficha individual.
 *
 * POR QUE ESTA PANTALLA EXISTE
 *   Las otras metricas dicen "hay un problema"; esta da con que actuar. Es la
 *   que Brunela abre cuando una alumna le escribe, o cuando quiere entender
 *   por que alguien dejo de entrenar.
 *
 * Una sola ronda de consultas en paralelo, igual que el panel.
 */

export type ClaseDeLaAlumna = {
  videoId: string;
  slug: string;
  titulo: string;
  porcentaje: number;
  terminada: boolean;
  cuando: string;
};

export type FichaAlumna = {
  perfil: {
    id: string;
    nombre: string;
    email: string;
    plan: string;
    planClave: string;
    nivel: string;
    objetivos: string[];
    onboardingCompleto: boolean;
    registradaEl: string;
  };
  suscripcion: {
    estado: string;
    etiquetaEstado: string;
    plan: string;
    seDaDeBaja: boolean;
    finDePeriodo: string | null;
    canceladaEl: string | null;
  } | null;
  actividad: {
    ultima: string | null;
    diasSinEntrar: number | null;
    clasesEmpezadas: number;
    clasesTerminadas: number;
  };
  clases: ClaseDeLaAlumna[];
  reservas: { total: number; asistio: number; cancelo: number };
  mensajes: number;
};

const OBJETIVO_ETIQUETA: Record<string, string> = {
  movilidad: "Movilidad",
  fuerza_centro: "Fuerza y centro",
  flexibilidad: "Flexibilidad",
  recuperacion: "Recuperación",
  resistencia: "Resistencia",
  alineacion_postural: "Alineación postural",
  rendimiento_escenico: "Rendimiento escénico",
  bienestar_general: "Bienestar general",
};

/** Los estados crudos de Stripe no le dicen nada a nadie fuera del equipo. */
const ESTADO_ETIQUETA: Record<string, string> = {
  active: "Al día",
  trialing: "En período de prueba",
  past_due: "Con un pago pendiente",
  canceled: "Cancelada",
  incomplete: "Sin completar el pago",
  incomplete_expired: "Pago vencido sin completar",
  unpaid: "Impaga",
  paused: "En pausa",
};

function textoI18n(campo: unknown): string {
  if (campo && typeof campo === "object") {
    const m = campo as Record<string, string>;
    return m.es ?? m.en ?? Object.values(m)[0] ?? "";
  }
  return typeof campo === "string" ? campo : "";
}

export async function getFichaAlumna(userId: string): Promise<FichaAlumna | null> {
  const supabase = await createSupabaseServerClient();

  const [
    { data: perfil },
    { data: suscripciones },
    { data: progreso },
    { data: reservas },
    { count: mensajes },
    { data: eventos },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, membership_tier, technical_level, training_goals, onboarding_completed, created_at")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("status, membership_tier, cancel_at_period_end, current_period_ends_at, canceled_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_progress")
      .select("video_id, completion_percent, is_completed, updated_at, videos(slug, title_i18n)")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("live_session_bookings")
      .select("status, attended_at")
      .eq("user_id", userId),
    supabase
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("activity_events")
      .select("occurred_at")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(1),
  ]);

  if (!perfil) return null;

  const G = progreso ?? [];
  const R = reservas ?? [];

  // Misma logica que el panel: el mayor entre el progreso y los eventos. Hoy
  // manda el progreso porque activity_events esta vacia; en cuanto se llene,
  // esto se vuelve exacto solo.
  const ultimaPorProgreso = G[0]?.updated_at ?? null;
  const ultimaPorEvento = eventos?.[0]?.occurred_at ?? null;
  const ultima =
    ultimaPorEvento && (!ultimaPorProgreso || ultimaPorEvento > ultimaPorProgreso)
      ? ultimaPorEvento
      : ultimaPorProgreso;

  const sub = (suscripciones ?? [])[0] ?? null;

  return {
    perfil: {
      id: perfil.id,
      nombre: perfil.full_name ?? "Sin nombre",
      email: perfil.email,
      plan: PLAN_ETIQUETA[perfil.membership_tier] ?? perfil.membership_tier,
      planClave: perfil.membership_tier,
      nivel: NIVEL_ETIQUETA[perfil.technical_level ?? ""] ?? "Sin definir",
      objetivos: (perfil.training_goals ?? []).map(
        (g: string) => OBJETIVO_ETIQUETA[g] ?? g
      ),
      onboardingCompleto: perfil.onboarding_completed,
      registradaEl: perfil.created_at,
    },
    suscripcion: sub
      ? {
          estado: sub.status,
          etiquetaEstado: ESTADO_ETIQUETA[sub.status] ?? sub.status,
          plan: PLAN_ETIQUETA[sub.membership_tier] ?? sub.membership_tier,
          seDaDeBaja: sub.cancel_at_period_end,
          finDePeriodo: sub.current_period_ends_at,
          canceladaEl: sub.canceled_at,
        }
      : null,
    actividad: {
      ultima,
      diasSinEntrar: ultima
        ? Math.floor((Date.now() - new Date(ultima).getTime()) / 86_400_000)
        : null,
      clasesEmpezadas: G.length,
      clasesTerminadas: G.filter((g) => g.is_completed).length,
    },
    clases: G.slice(0, 20).map((g) => {
      const v = g.videos as unknown as { slug: string; title_i18n: unknown } | null;
      return {
        videoId: g.video_id,
        slug: v?.slug ?? "",
        titulo: textoI18n(v?.title_i18n) || v?.slug || "Clase eliminada",
        porcentaje: g.completion_percent,
        terminada: g.is_completed,
        cuando: g.updated_at,
      };
    }),
    reservas: {
      total: R.length,
      asistio: R.filter((r) => r.attended_at !== null).length,
      cancelo: R.filter((r) => r.status === "canceled").length,
    },
    mensajes: mensajes ?? 0,
  };
}
