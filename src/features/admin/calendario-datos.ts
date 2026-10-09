import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { resolveI18nText } from "@/src/features/studio/helpers";
import {
  esTablaInexistente, textoCupo, textoPlanesVivo, type EventoCalendario,
} from "@/src/features/admin/calendario";

/**
 * Lee todo lo que va en el calendario de la admin entre dos instantes:
 * clases en vivo (grupales) y sesiones privadas 1 a 1.
 *
 * - Clases en vivo: con el cliente DE LA SESION. La admin pasa RLS por
 *   is_admin(); no hay nada que saltear.
 * - Sesiones privadas: con service_role, porque la tabla es de la admin y su
 *   policy puede no estar pensada para leerse desde aca. Por eso este modulo
 *   llama a requireAdmin() el mismo (trampa 4): no puede depender de que la
 *   pantalla lo haya hecho.
 *
 * `sesiones_privadas` la crea 20261009_2_sesiones_privadas.sql. Si todavia no
 * se corrio, el calendario sale igual, sin privadas y con `faltaMigracion`.
 * Nunca se cae por eso.
 *
 * Devuelve solo cadenas y numeros (trampa 6).
 */
export type DatosCalendario = {
  eventos: EventoCalendario[];
  faltaMigracionPrivadas: boolean;
};

type FilaVivo = {
  id: string;
  slug: string;
  title_i18n: Record<string, string> | null;
  status: string;
  membership_tier_required: string | null;
  starts_at: string;
  capacity: number | null;
};

type FilaPrivada = {
  id: string;
  alumna_id: string;
  starts_at: string;
  duracion_minutos: number | null;
  enlace: string | null;
  estado: string;
};

const ESTADO_VIVO: Record<string, EventoCalendario["estado"]> = {
  draft: "borrador",
  canceled: "cancelada",
  completed: "hecha",
};

export async function cargarCalendarioAdmin(desdeIso: string, hastaIso: string): Promise<DatosCalendario> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const [{ data: vivas }, privadas] = await Promise.all([
    supabase
      .from("live_sessions")
      .select("id, slug, title_i18n, status, membership_tier_required, starts_at, capacity")
      .gte("starts_at", desdeIso)
      .lt("starts_at", hastaIso)
      .order("starts_at", { ascending: true }),
    admin
      .from("sesiones_privadas")
      .select("id, alumna_id, starts_at, duracion_minutos, enlace, estado")
      .gte("starts_at", desdeIso)
      .lt("starts_at", hastaIso)
      .neq("estado", "cancelada")
      .order("starts_at", { ascending: true }),
  ]);

  const filasVivo = (vivas ?? []) as FilaVivo[];
  const ids = filasVivo.map((s) => s.id);

  let faltaMigracionPrivadas = false;
  let filasPrivadas: FilaPrivada[] = [];
  if (privadas.error) {
    // Cualquier otro error tampoco tira la pagina abajo: sin privadas, y el
    // aviso solo si de verdad es que falta la tabla.
    faltaMigracionPrivadas = esTablaInexistente(privadas.error);
  } else {
    filasPrivadas = ((privadas.data ?? []) as FilaPrivada[]).filter((p) => p.estado !== "cancelada");
  }
  const alumnaIds = [...new Set(filasPrivadas.map((p) => p.alumna_id))];

  // Dos consultas y no un embed: no dependemos de como quede la FK.
  const [{ data: reservas }, { data: perfiles }] = await Promise.all([
    ids.length
      ? supabase.from("live_session_bookings").select("live_session_id, status").in("live_session_id", ids).in("status", ["reserved", "waitlisted"])
      : Promise.resolve({ data: [] as { live_session_id: string; status: string }[] }),
    alumnaIds.length
      ? admin.from("profiles").select("id, full_name, email").in("id", alumnaIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
  ]);

  const anotadas = new Map<string, number>();
  const enEspera = new Map<string, number>();
  for (const r of (reservas ?? []) as { live_session_id: string; status: string }[]) {
    const m = r.status === "waitlisted" ? enEspera : anotadas;
    m.set(r.live_session_id, (m.get(r.live_session_id) ?? 0) + 1);
  }
  const nombreDe = new Map(
    ((perfiles ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [
      p.id,
      p.full_name?.trim() || p.email?.split("@")[0] || "Alumna",
    ])
  );

  const eventos: EventoCalendario[] = [
    ...filasVivo.map((s): EventoCalendario => {
      const n = anotadas.get(s.id) ?? 0;
      return {
        id: s.id,
        tipo: "vivo",
        inicio: s.starts_at,
        titulo: resolveI18nText(s.title_i18n) || s.slug,
        href: `/admin/live/${s.id}`,
        detalle: textoCupo(n, s.capacity, enEspera.get(s.id) ?? 0),
        planes: textoPlanesVivo(s.membership_tier_required),
        estado: ESTADO_VIVO[s.status] ?? null,
        alerta: !!s.capacity && n >= s.capacity && s.status === "scheduled",
      };
    }),
    ...filasPrivadas.map((p): EventoCalendario => ({
      id: p.id,
      tipo: "privada",
      inicio: p.starts_at,
      titulo: `Sesión privada · ${nombreDe.get(p.alumna_id) ?? "Alumna"}`,
      href: `/admin/users/${p.alumna_id}`,
      detalle: (p.duracion_minutos ? `${p.duracion_minutos} min · ` : "") + (p.enlace?.trim() ? "con enlace" : "sin enlace todavía"),
      estado: p.estado === "hecha" ? "hecha" : null,
      alerta: !p.enlace?.trim() && p.estado === "agendada",
    })),
  ];

  return { eventos, faltaMigracionPrivadas };
}
