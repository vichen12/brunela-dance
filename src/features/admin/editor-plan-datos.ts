import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { portadaDeClase } from "@/src/lib/video/portada";
import { formatDurationLabel } from "@/src/features/studio/helpers";
import { esFaltaDeColumnaDescanso } from "@/src/features/studio/dias-de-plan";

/**
 * Lo que necesita el editor de plan a pantalla completa (/admin/programs/[id]
 * y /nuevo). Solo servidor: la portada de cada clase se FIRMA (Bunny).
 *
 * Lee con el cliente de la sesion: la pagina ya paso por requireAdmin() y las
 * policies de admin devuelven todo.
 */

/** Una clase ofrecible en el buscador del dia. Ya viene lista para mostrar. */
export type ClaseElegible = {
  id: string;
  titulo: string;
  duracion: string;
  portada: string | null;
  estado: string;
};

export type PlanEditable = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  membership_tier_required: string;
  status: string;
  duration_days: number;
  cover_image_url: string | null;
  is_featured: boolean;
};

export type DiaGuardado = {
  day_number: number;
  video_id: string | null;
  es_descanso?: boolean;
  nota?: string | null;
};

type VideoCrudo = {
  id: string;
  slug: string;
  title_i18n: Record<string, string> | null;
  duration_seconds: number | null;
  status: string;
  thumbnail_url: string | null;
  bunny_video_id: string | null;
  stream_playback_id: string | null;
};

export async function cargarClasesElegibles(): Promise<ClaseElegible[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("videos")
    .select("id, slug, title_i18n, duration_seconds, status, thumbnail_url, bunny_video_id, stream_playback_id")
    .order("title_i18n->>es", { ascending: true });
  return ((data ?? []) as VideoCrudo[]).map((v) => ({
    id: v.id,
    titulo: v.title_i18n?.es ?? v.title_i18n?.en ?? v.slug,
    duracion: v.duration_seconds ? formatDurationLabel(v.duration_seconds) : "",
    portada: portadaDeClase(v),
    estado: v.status,
  }));
}

/**
 * Los dias guardados de un plan. Sin la migracion 20261025_dia_de_descanso.sql
 * el select da 42703: se repite sin las columnas nuevas y se avisa.
 */
export async function cargarDiasDelPlan(programId: string): Promise<{ dias: DiaGuardado[]; faltaMigracion: boolean }> {
  const supabase = await createSupabaseServerClient();
  const nuevo = await supabase
    .from("program_days")
    .select("day_number, video_id, es_descanso, nota")
    .eq("program_id", programId)
    .order("day_number", { ascending: true });
  if (!nuevo.error) return { dias: (nuevo.data ?? []) as DiaGuardado[], faltaMigracion: false };
  if (!esFaltaDeColumnaDescanso(nuevo.error)) {
    console.error("[editor de plan] program_days:", nuevo.error.message);
    return { dias: [], faltaMigracion: false };
  }
  const viejo = await supabase
    .from("program_days")
    .select("day_number, video_id")
    .eq("program_id", programId)
    .order("day_number", { ascending: true });
  return { dias: (viejo.data ?? []) as DiaGuardado[], faltaMigracion: true };
}

/** Sin plan cargado no se sabe si la migracion corrio: se pregunta con un select vacio. */
export async function hayColumnasDeDescanso(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("program_days").select("es_descanso, nota").limit(1);
  return !esFaltaDeColumnaDescanso(error);
}

export async function cargarPlan(id: string): Promise<PlanEditable | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("programs")
    .select("id, slug, title_i18n, description_i18n, membership_tier_required, status, duration_days, cover_image_url, is_featured")
    .eq("id", id)
    .maybeSingle<PlanEditable>();
  return data ?? null;
}
