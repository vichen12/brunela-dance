import type { SupabaseClient } from "@supabase/supabase-js";
import { aDireccion } from "@/src/lib/slug";

/**
 * La direccion (slug) de algo nuevo, armada del titulo y sin chocar con otra.
 *
 * POR QUE (2026-11-09)
 *   El campo "Direccion" se le mostraba a Brunela al crear packs, sesiones en
 *   vivo, clases, categorias y planes de trabajo, y no tenia por que saber que es. Ahora no lo ve: sale del
 *   titulo, y si ya existe una igual se le agrega -2, -3...
 *
 * Solo para CREAR. Al editar se conserva la que habia: cambiarla romperia los
 * enlaces ya compartidos.
 */
type Tabla = "packs" | "live_sessions" | "categories" | "videos" | "programs";
const DE_RESPALDO: Record<Tabla, string> = { packs: "pack", live_sessions: "clase-en-vivo", categories: "categoria", videos: "clase", programs: "plan" };

export async function direccionLibre(db: SupabaseClient, tabla: Tabla, titulo: string): Promise<string> {
  const base = aDireccion(titulo) || DE_RESPALDO[tabla];
  const { data } = await db.from(tabla).select("slug").like("slug", `${base}%`);
  const usadas = new Set(((data ?? []) as { slug: string }[]).map((f) => f.slug));
  if (!usadas.has(base)) return base;
  for (let n = 2; ; n += 1) if (!usadas.has(`${base}-${n}`)) return `${base}-${n}`;
}
