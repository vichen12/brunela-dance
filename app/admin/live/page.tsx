import { revalidatePath } from "next/cache";
import { BotonEnviar } from "@/components/boton-enviar";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/features/auth/guards";
import {
  createLiveSessionAction,
  deleteLiveSessionAction,
  updateLiveSessionAction,
  updateStatusAction,
} from "@/src/features/admin/live-actions";
import { HoraSesion } from "@/components/hora-sesion";
import { EditarSesion, LiveForm, type LiveSession } from "@/components/admin-live-drawer";
import { AdminBuscador } from "@/components/admin-buscador";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

const ESTADOS_LIVE = [
  { key: "", label: "Cualquier estado" },
  { key: "scheduled", label: "Programadas" },
  { key: "draft", label: "Borradores" },
  { key: "completed", label: "Terminadas" },
  { key: "canceled", label: "Canceladas" },
];

// ── Types ──────────────────────────────────────────────────────────────────────

// El tipo vive en el drawer y se importa: estaba copiado aca palabra por
// palabra, y una copia es una divergencia esperando. Si el formulario suma un
// campo, esta pagina se entera al compilar en vez de dentro de unos meses.

// ── Server actions ─────────────────────────────────────────────────────────────





// ── UI helpers ─────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: "#fef9c3", color: "#854d0e", label: "Borrador" },
  scheduled: { bg: "#dcfce7", color: "#166534", label: "Publicada" },
  completed: { bg: "#f1f5f9", color: "#475569", label: "Completada" },
  canceled:  { bg: "#fee2e2", color: "#991b1b", label: "Cancelada" },
};

const TIER_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  corps_de_ballet: { bg: "var(--pink-wash)", color: "var(--pink-deep)", label: "Corps de Ballet" },
  solista:         { bg: "var(--pink-soft)", color: "var(--pink-deep)", label: "Solista" },
  principal:       { bg: "#1c1917", color: "var(--pink-wash)", label: "Principal" },
};

const inp: React.CSSProperties = {
  width: "100%", borderRadius: 10, border: "1px solid #e7e5e4",
  background: "#fff", color: "#1c1917", padding: "9px 13px",
  fontSize: 13, outline: "none", fontFamily: "inherit",
};

const sel: React.CSSProperties = {
  ...inp, appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23a8a29e' strokeWidth='1.5' strokeLinecap='round' fill='none'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 34,
};

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", color: "#78716c", textTransform: "uppercase", marginBottom: 5 }}>
      {children}
    </span>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column" }}>
      <Lbl>{label}</Lbl>
      {children}
    </label>
  );
}

function Flash({ msg, tone }: { msg: string | null; tone: "ok" | "err" }) {
  if (!msg) return null;
  return (
    <div style={{
      borderRadius: 12, padding: "11px 16px", fontSize: 13, fontWeight: 600,
      background: tone === "ok" ? "#f0fdf4" : "#fef2f2",
      color: tone === "ok" ? "#166534" : "#991b1b",
      border: `1px solid ${tone === "ok" ? "#bbf7d0" : "#fecaca"}`,
      marginBottom: 20,
    }}>{msg}</div>
  );
}

function toLocalDatetime(iso: string | null) {
  if (!iso) return "";
  return iso.slice(0, 16);
}


// ── Page ───────────────────────────────────────────────────────────────────────

export default async function AdminLivePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? decodeURIComponent(params.success) : null;
  const error = typeof params.error === "string" ? decodeURIComponent(params.error) : null;

  // Las tres son independientes: encadenadas costaban tres viajes seguidos a
  // Supabase (~250 ms cada uno). En paralelo cuestan uno.
  // Buscador y filtro, del lado del SERVIDOR. Filtrar en memoria mentiria en el
  // contador -- diria "2 programadas" contando solo las de la pagina -- y con
  // paginacion seria directamente incorrecto.
  const q = (typeof params.q === "string" ? params.q : "").trim();
  const fEstado = ESTADOS_LIVE.some((e) => e.key === params.estado) ? (params.estado as string) : "";

  let consultaSesiones = supabase
    .from("live_sessions")
    .select("id, slug, title_i18n, description_i18n, status, membership_tier_required, starts_at, ends_at, session_timezone, capacity, cover_image_url, booking_opens_at, booking_closes_at");
  if (fEstado) consultaSesiones = consultaSesiones.eq("status", fEstado);
  if (q) {
    const t = q.replace(/[,()]/g, " ");
    consultaSesiones = consultaSesiones.or(`slug.ilike.%${t}%,title_i18n->>es.ilike.%${t}%`);
  }

  const { count: totalSesiones } = await supabase
    .from("live_sessions").select("*", { count: "exact", head: true });

  const [
    { data: sessionsData },
    { data: bookingsData },
    { data: accessLinksData },
    { data: invitationsData },
  ] = await Promise.all([
    consultaSesiones.order("starts_at", { ascending: false }),
    supabase
      .from("live_session_bookings")
      .select("live_session_id, status")
      .in("status", ["reserved", "attended"]),
    supabase
      .from("live_session_access_links")
      .select("live_session_id, join_url, passcode"),
    // Va en el mismo paralelo por el mismo motivo que las otras: un viaje mas a
    // Frankfurt en serie son ~30 ms que se notan. El join trae el nombre para no
    // tener que resolver los UUID despues, que seria un N+1.
    supabase
      .from("live_session_invitations")
      .select("live_session_id, user_id, profiles(full_name, email)"),
  ]);

  const bookingsBySession = (bookingsData ?? []).reduce<Record<string, number>>((acc, b) => {
    acc[b.live_session_id] = (acc[b.live_session_id] ?? 0) + 1;
    return acc;
  }, {});

  const accessLinksBySession = (accessLinksData ?? []).reduce<Record<string, { join_url: string; passcode: string | null }>>((acc, a) => {
    acc[a.live_session_id] = { join_url: a.join_url, passcode: a.passcode };
    return acc;
  }, {});

  type FilaInvitacion = {
    live_session_id: string;
    user_id: string;
    // PostgREST devuelve el join como objeto cuando la relacion es de a uno,
    // pero lo tipa como array. Se normaliza aca, una vez.
    profiles: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
  };

  const invitationsBySession = ((invitationsData ?? []) as FilaInvitacion[]).reduce<
    Record<string, LiveSession["invitations"]>
  >((acc, i) => {
    const p = Array.isArray(i.profiles) ? i.profiles[0] : i.profiles;
    // Sin perfil no hay a quien mostrar. No deberia pasar (hay FK), pero
    // dibujar "undefined" en el panel de Brunela seria peor que omitirla.
    if (!p) return acc;
    (acc[i.live_session_id] ??= []).push({
      user_id: i.user_id,
      full_name: p.full_name,
      email: p.email,
      note: null,
    });
    return acc;
  }, {});

  const sessions = ((sessionsData ?? []) as Omit<LiveSession, "bookings_count" | "access_link" | "invitations">[]).map((s) => ({
    ...s,
    bookings_count: bookingsBySession[s.id] ?? 0,
    access_link: accessLinksBySession[s.id] ?? null,
    invitations: invitationsBySession[s.id] ?? [],
  }));

  const scheduled = sessions.filter((s) => s.status === "scheduled").length;
  const upcoming = sessions.filter((s) => s.status === "scheduled" && new Date(s.starts_at) > new Date()).length;
  const total = sessions.length;

  return (
    <main style={{ fontFamily: "inherit" }}>
      <header className="hero-stage">
        <p className="eyebrow">Gestión de contenido</p>
        <h1 className="display mt-5 text-5xl leading-none md:text-6xl">Sesiones en vivo.</h1>
        <p className="mt-5 max-w-xl text-base leading-8 text-[color:var(--ink-soft)]">
          Programá las clases en directo, definí el cupo y controlá quién puede reservar según su plan.
        </p>
      </header>

      <Flash msg={success} tone="ok" />
      <Flash msg={error} tone="err" />

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { value: total,     label: "Sesiones totales", sub: "en el sistema" },
          { value: scheduled, label: "Publicadas",        sub: "visibles a alumnas" },
          { value: upcoming,  label: "Próximas",          sub: "pendientes de dar" },
        ].map((s) => (
          <div key={s.label} style={{
            background: "#fff", border: "1px solid #f0eeec", borderRadius: 16,
            padding: "20px 22px",
          }}>
            <p style={{ fontSize: 30, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.02em", lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#44403c", marginTop: 6 }}>{s.label}</p>
            <p style={{ fontSize: 11, color: "#a8a29e", marginTop: 2 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Create new session */}
      <details style={{ marginBottom: 16 }}>
        <summary style={{
          listStyle: "none", cursor: "pointer",
          background: "#fff", border: "1px solid #f0eeec", borderRadius: 14,
          padding: "14px 20px", display: "flex", alignItems: "center", gap: 10,
          fontSize: 13, fontWeight: 700, color: "#1c1917",
          userSelect: "none",
        }}>
          <span style={{
            width: 24, height: 24, borderRadius: 8,
            background: "linear-gradient(135deg, var(--pink), var(--pink-mid))",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 16, fontWeight: 800, lineHeight: 1, flexShrink: 0,
          }}>+</span>
          Nueva sesion en vivo
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#a8a29e", fontWeight: 500 }}>Clic para desplegar formulario</span>
        </summary>
        <div style={{
          background: "#fff", border: "1px solid #f0eeec", borderTop: "none",
          borderRadius: "0 0 14px 14px", padding: "24px 22px",
        }}>
          <LiveForm />
        </div>
      </details>

      {/* Session list */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "#a8a29e", textTransform: "uppercase", marginBottom: 12 }}>
          Sesiones — {total}
        </p>
        <AdminBuscador
          action="/admin/live"
          q={q}
          placeholder="Buscar por título o dirección…"
          filtros={[{ name: "estado", valor: fEstado, etiqueta: "Estado", opciones: ESTADOS_LIVE }]}
          total={totalSesiones ?? sessions.length}
          mostrando={sessions.length}
        />
        {sessions.length === 0 ? (
          <div style={{
            background: "#fff", border: "1.5px dashed #f0eeec", borderRadius: 16,
            padding: "40px 24px", textAlign: "center", color: "#a8a29e", fontSize: 13,
          }}>
            {q || fEstado
              ? "Ninguna sesión coincide con la búsqueda."
              : "No hay sesiones todavía. Creá la primera arriba."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sessions.map((session) => {
              const st = STATUS_STYLE[session.status] ?? STATUS_STYLE.draft;
              const tier = TIER_STYLE[session.membership_tier_required] ?? TIER_STYLE.corps_de_ballet;
              const startDate = new Date(session.starts_at);
              const isPast = startDate < new Date();

              return (
                <div key={session.id} style={{ background: "#fff", border: "1px solid #f0eeec", borderRadius: 16, overflow: "hidden" }}>
                  {/* Header row */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "16px 20px",
                    borderBottom: "1px solid #f9f7f6",
                  }}>
                    {/* Cover */}
                    <div style={{
                      width: 64, height: 42, borderRadius: 10, flexShrink: 0, overflow: "hidden",
                      background: "linear-gradient(145deg, var(--pink-soft), var(--rose))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {session.cover_image_url ? (
                        <img src={session.cover_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                          <circle cx="10" cy="10" r="8" stroke="rgba(230, 79, 85,0.5)" strokeWidth="1.5" />
                          <polygon points="8,7 14,10 8,13" fill="rgba(230, 79, 85,0.6)" />
                        </svg>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#1c1917" }}>
                          {session.title_i18n.es ?? session.slug}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 99,
                          background: st.bg, color: st.color,
                        }}>{st.label}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 99,
                          background: tier.bg, color: tier.color,
                        }}>{tier.label}</span>
                      </div>
                      <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#a8a29e", flexWrap: "wrap" }}>
                        <span style={{ color: isPast ? "#a8a29e" : "#1c1917", fontWeight: isPast ? 400 : 600 }}>
                          {/* perspectiva="admin": Brunela ve primero la hora de
                              la zona en la que programo la clase, que es la que
                              tiene en la cabeza. */}
                          <HoraSesion iso={session.starts_at} zonaEstudio={session.session_timezone} perspectiva="admin" />
                        </span>
                        <span>{session.bookings_count} / {session.capacity} reservas</span>
                        {session.invitations.length > 0 && (
                          <span style={{ color: "var(--pink-mid)", fontWeight: 600 }}>
                            {session.invitations.length === 1
                              ? "1 invitada"
                              : `${session.invitations.length} invitadas`}
                          </span>
                        )}
                        {session.access_link && (
                          <span style={{ color: "#059669", fontWeight: 600 }}>Zoom OK</span>
                        )}
                      </div>
                    </div>

                    {/* Quick status change */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {session.status === "draft" && (
                        <form action={updateStatusAction}>
                          <input type="hidden" name="id" value={session.id} />
                          <input type="hidden" name="status" value="scheduled" />
                          <BotonEnviar style={{
                            fontSize: 10, fontWeight: 700, padding: "5px 13px", borderRadius: 99,
                            background: "#dcfce7", color: "#166534", border: "none", cursor: "pointer",
                          }}>Publicar</BotonEnviar>
                        </form>
                      )}
                      {session.status === "scheduled" && (
                        <form action={updateStatusAction}>
                          <input type="hidden" name="id" value={session.id} />
                          <input type="hidden" name="status" value="completed" />
                          <BotonEnviar style={{
                            fontSize: 10, fontWeight: 700, padding: "5px 13px", borderRadius: 99,
                            background: "#f1f5f9", color: "#475569", border: "none", cursor: "pointer",
                          }}>Completar</BotonEnviar>
                        </form>
                      )}
                      {(session.status === "draft" || session.status === "scheduled") && (
                        <form action={updateStatusAction}>
                          <input type="hidden" name="id" value={session.id} />
                          <input type="hidden" name="status" value="canceled" />
                          <BotonEnviar style={{
                            fontSize: 10, fontWeight: 700, padding: "5px 13px", borderRadius: 99,
                            background: "#fee2e2", color: "#991b1b", border: "none", cursor: "pointer",
                          }}>Cancelar</BotonEnviar>
                        </form>
                      )}
                    </div>
                  </div>

                  {/* Collapsible edit form */}
                  {/* Edicion en panel lateral. Antes el formulario de 17
                      campos de CADA sesion vivia aca dentro de un <details>:
                      oculto, pero renderizado igual. */}
                  <div style={{
                    padding: "10px 20px", borderTop: "1px solid #f9f7f6",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <EditarSesion session={session} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
