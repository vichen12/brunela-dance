import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

/**
 * Inscriptas de UNA sesion en vivo, como CSV (abre en Excel y en Sheets).
 *
 * requireAdmin() va PRIMERO: la consulta usa service_role y devuelve nombres y
 * correos de alumnas. Sin la guarda, cualquiera con el id de una sesion se
 * llevaria la lista.
 */

const ESTADO: Record<string, string> = {
  reserved: "Reservó", waitlisted: "En espera", attended: "Asistió", missed: "Faltó", canceled: "Canceló",
};
const PLAN: Record<string, string> = {
  none: "Sin plan", corps_de_ballet: "Corps de Ballet", solista: "Solista", principal: "Principal",
};

/** Una celda segura: comillas escapadas y sin formulas (=, +, -, @) que Excel ejecute. */
function celda(v: string | null | undefined) {
  let t = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return `"${t.replace(/"/g, '""')}"`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Sesión inválida.", { status: 400 });

  const supabase = createSupabaseAdminClient();
  const [{ data: sesion }, { data: filas, error }] = await Promise.all([
    supabase.from("live_sessions").select("slug, session_timezone").eq("id", id).maybeSingle<{ slug: string; session_timezone: string }>(),
    supabase
      .from("live_session_bookings")
      .select("status, reserved_at, canceled_at, profiles(full_name, email, membership_tier)")
      .eq("live_session_id", id)
      .order("reserved_at", { ascending: true }),
  ]);
  if (!sesion) return new Response("No existe esa sesión.", { status: 404 });
  if (error) return new Response(error.message, { status: 500 });

  // En la zona del estudio, que es la que Brunela tiene en la cabeza.
  const zona = sesion.session_timezone || "Europe/Madrid";
  const cuando = (iso: string | null) => {
    if (!iso) return "";
    try {
      return new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: zona }).format(new Date(iso));
    } catch {
      return iso.slice(0, 16).replace("T", " ");
    }
  };
  type P = { full_name: string | null; email: string; membership_tier: string };
  const lineas = [
    ["Nombre", "Correo", "Plan", "Estado", `Reservó el (${zona})`, `Canceló el (${zona})`].map(celda).join(","),
    ...((filas ?? []) as unknown as { status: string; reserved_at: string; canceled_at: string | null; profiles: P | P[] | null }[]).map((f) => {
      const p = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles;
      return [
        p?.full_name ?? "",
        p?.email ?? "",
        PLAN[p?.membership_tier ?? "none"] ?? "",
        ESTADO[f.status] ?? f.status,
        cuando(f.reserved_at),
        cuando(f.canceled_at),
      ].map(celda).join(",");
    }),
  ];

  // BOM: sin el, Excel abre el CSV en Windows-1252 y los acentos salen rotos.
  return new Response("﻿" + lineas.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="inscriptas-${sesion.slug.replace(/[^a-z0-9-]/gi, "")}.csv"`,
      "cache-control": "no-store",
    },
  });
}
