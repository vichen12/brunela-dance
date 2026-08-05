import { NextResponse } from "next/server";
import { celda, BOM_UTF8 } from "@/src/lib/csv";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { NIVEL_ETIQUETA, PLAN_ETIQUETA } from "@/src/features/admin/analitica/queries";

export const dynamic = "force-dynamic";

/**
 * Exportacion de alumnas a CSV.
 *
 * Una sola, la que sirve para escribirle a alguien: plan, nivel, objetivos,
 * ultima actividad y estado de la suscripcion.
 *
 * ⚠️ ES UNA RUTA QUE DEVUELVE DATOS PERSONALES DE TODAS LAS ALUMNAS
 *   Por eso llama a requireAdmin() antes de tocar nada. Una ruta GET es tan
 *   publica como una server action: que el boton este dentro de /admin no
 *   protege el endpoint.
 */

const OBJETIVO_ETIQUETA: Record<string, string> = {
  movilidad: "Movilidad",
  fuerza_centro: "Fuerza y centro",
  flexibilidad: "Flexibilidad",
  recuperacion: "Recuperacion",
  resistencia: "Resistencia",
  alineacion_postural: "Alineacion postural",
  rendimiento_escenico: "Rendimiento escenico",
  bienestar_general: "Bienestar general",
};

const ESTADO_ETIQUETA: Record<string, string> = {
  active: "Al dia",
  trialing: "En prueba",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
  incomplete: "Sin completar",
  incomplete_expired: "Vencida",
  unpaid: "Impaga",
  paused: "En pausa",
};

export async function GET() {
  await requireAdmin();

  const supabase = await createSupabaseServerClient();

  const [{ data: perfiles }, { data: suscripciones }, { data: progreso }, { data: eventos }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, membership_tier, technical_level, training_goals, onboarding_completed, created_at")
        .eq("is_admin", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("subscriptions")
        .select("user_id, status, cancel_at_period_end, current_period_ends_at, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("user_progress").select("user_id, updated_at"),
      supabase.from("activity_events").select("user_id, occurred_at").order("occurred_at", { ascending: false }).limit(5000),
    ]);

  // Ultima actividad: el mayor entre progreso y eventos, igual que el panel.
  const ultima = new Map<string, string>();
  for (const g of progreso ?? []) {
    const a = ultima.get(g.user_id);
    if (!a || g.updated_at > a) ultima.set(g.user_id, g.updated_at);
  }
  for (const e of eventos ?? []) {
    const a = ultima.get(e.user_id);
    if (!a || e.occurred_at > a) ultima.set(e.user_id, e.occurred_at);
  }

  const subPorUsuario = new Map<string, (typeof suscripciones extends null ? never : NonNullable<typeof suscripciones>[number])>();
  for (const s of suscripciones ?? []) {
    if (!subPorUsuario.has(s.user_id)) subPorUsuario.set(s.user_id, s);
  }

  const cabecera = [
    "Nombre", "Email", "Plan", "Nivel", "Objetivos",
    "Estado de la suscripcion", "Pidio darse de baja", "Fin del periodo",
    "Ultima actividad", "Dias sin entrar", "Termino el registro", "Se registro el",
  ];

  const filas = (perfiles ?? []).map((p) => {
    const s = subPorUsuario.get(p.id);
    const ult = ultima.get(p.id) ?? null;
    const dias = ult ? Math.floor((Date.now() - new Date(ult).getTime()) / 86_400_000) : null;
    const iso = (v: string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 10) : "");

    return [
      p.full_name ?? "",
      p.email,
      PLAN_ETIQUETA[p.membership_tier] ?? p.membership_tier,
      NIVEL_ETIQUETA[p.technical_level ?? ""] ?? "",
      (p.training_goals ?? []).map((g: string) => OBJETIVO_ETIQUETA[g] ?? g).join(" / "),
      s ? (ESTADO_ETIQUETA[s.status] ?? s.status) : "Sin suscripcion",
      s?.cancel_at_period_end ? "Si" : "No",
      iso(s?.current_period_ends_at),
      iso(ult),
      dias === null ? "Nunca entro" : String(dias),
      p.onboarding_completed ? "Si" : "No",
      iso(p.created_at),
    ].map(celda).join(",");
  });

  // BOM al principio: sin el, Excel en Windows abre el archivo en ANSI y los
  // acentos salen rotos. Es la diferencia entre "Recuperacion" y "RecuperaciÃ³n".
  const csv = BOM_UTF8 + [cabecera.map(celda).join(","), ...filas].join("\r\n");

  const hoy = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="alumnas-${hoy}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
