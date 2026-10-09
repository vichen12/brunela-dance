import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { resolveI18nText } from "@/src/features/studio/helpers";
import type { DatosPanel, TierClave } from "@/components/panel-control-admin";

/**
 * Los datos del panel del estudio. Los usan /dashboard (cuenta admin) y
 * /admin: antes cada una tenia su propio resumen, y el de /admin dibujaba
 * graficos de tendencia escritos a mano que subian aunque la cifra fuera 0.
 *
 * ⚠️ Lee con service_role, que saltea RLS. Por eso llama a requireAdmin() aca
 *    mismo y no confia en que la pagina lo haya hecho (trampa 4).
 */
export async function cargarPanelEstudio(): Promise<Omit<DatosPanel, "nombre" | "fecha">> {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  const ahora = new Date().toISOString();
  const inicioDeMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const contar = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
  const perfiles = () => db.from("profiles").select("*", { count: "exact", head: true });

  const [
    alumnas, corps, solista, principal, sinPlan,
    totales, publicadas, borradores,
    sesiones, reservas, altasDelMes, anuncios,
    { data: ultimas }, { data: clases }, { data: enVivo },
  ] = await Promise.all([
    contar(perfiles()),
    contar(perfiles().eq("membership_tier", "corps_de_ballet")),
    contar(perfiles().eq("membership_tier", "solista")),
    contar(perfiles().eq("membership_tier", "principal")),
    contar(perfiles().eq("membership_tier", "none")),
    contar(db.from("videos").select("*", { count: "exact", head: true })),
    contar(db.from("videos").select("*", { count: "exact", head: true }).eq("status", "published")),
    contar(db.from("videos").select("*", { count: "exact", head: true }).eq("status", "draft")),
    contar(db.from("live_sessions").select("*", { count: "exact", head: true }).eq("status", "scheduled").gte("starts_at", ahora)),
    contar(db.from("live_session_bookings").select("*", { count: "exact", head: true }).eq("status", "reserved")),
    contar(perfiles().gte("created_at", inicioDeMes)),
    contar(db.from("studio_announcements").select("*", { count: "exact", head: true })
      .eq("is_active", true).or("expires_at.is.null,expires_at.gt." + ahora)),
    db.from("profiles").select("id, full_name, membership_tier, created_at")
      .order("created_at", { ascending: false }).limit(6),
    // Lo ultimo que se subio, en cualquier estado: un borrador olvidado es
    // justo lo que la admin tiene que ver al entrar.
    db.from("videos").select("id, title_i18n, status, thumbnail_url, duration_seconds")
      .order("created_at", { ascending: false }).limit(4),
    db.from("live_sessions")
      .select("id, title_i18n, starts_at, session_timezone, live_session_bookings(count)")
      .eq("status", "scheduled").gte("starts_at", ahora)
      .eq("live_session_bookings.status", "reserved")
      .order("starts_at", { ascending: true }).limit(3),
  ]);

  return {
    metricas: {
      alumnas, altasDelMes, principal, sinPlan, reservas, sesiones, publicadas, borradores, totales, anuncios,
      conPlan: corps + solista + principal,
    },
    porPlan: [
      { tier: "principal", cantidad: principal },
      { tier: "solista", cantidad: solista },
      { tier: "corps_de_ballet", cantidad: corps },
      { tier: "none", cantidad: sinPlan },
    ],
    ultimas: ((ultimas ?? []) as { id: string; full_name: string | null; membership_tier: TierClave; created_at: string }[])
      .map((u) => ({ id: u.id, nombre: u.full_name?.trim() || null, tier: u.membership_tier, cuando: haceCuanto(u.created_at) })),
    clases: ((clases ?? []) as { id: string; title_i18n: Record<string, string>; status: string; thumbnail_url: string | null; duration_seconds: number | null }[])
      .map((v) => ({
        id: v.id,
        titulo: resolveI18nText(v.title_i18n) || "Sin título",
        estado: v.status,
        portada: v.thumbnail_url,
        minutos: v.duration_seconds ? Math.round(v.duration_seconds / 60) : null,
      })),
    enVivo: ((enVivo ?? []) as { id: string; title_i18n: Record<string, string>; starts_at: string; session_timezone: string; live_session_bookings: { count: number }[] | null }[])
      .map((s) => ({
        id: s.id,
        titulo: resolveI18nText(s.title_i18n) || "Clase en vivo",
        iso: s.starts_at,
        zona: s.session_timezone,
        reservas: s.live_session_bookings?.[0]?.count ?? 0,
      })),
  };
}

/** "hace 5 meses". Con "hace 5m" se leia como cinco minutos. */
function haceCuanto(iso: string) {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  if (dias < 30) return `hace ${Math.floor(dias / 7)} sem`;
  if (dias < 365) { const m = Math.floor(dias / 30); return `hace ${m} ${m === 1 ? "mes" : "meses"}`; }
  const a = Math.floor(dias / 365);
  return `hace ${a} ${a === 1 ? "año" : "años"}`;
}

/** "Jueves, 8 de octubre", para la cabecera del panel. */
export function fechaDelPanel() {
  const t = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
