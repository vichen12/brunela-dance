import {
  bookingStatusLabel,
  formatDateTimeLabel,
  liveSessionStatusLabel,
  membershipTierLabel,
  resolveI18nText,
  type LiveBookingStatus,
  type LiveSessionStatus,
  type MembershipTier
} from "@/src/features/studio/helpers";
import {
  cancelLiveSessionBookingAction,
  reserveLiveSessionAction
} from "@/src/features/studio/actions";
import { requireUser } from "@/src/features/auth/guards";
import { HoraSesion } from "@/components/hora-sesion";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type LiveSessionRecord = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  status: LiveSessionStatus;
  membership_tier_required: MembershipTier;
  starts_at: string;
  ends_at: string;
  /** Zona en la que Brunela programo la clase. Sin esto la hora se mostraba en
      la del servidor (UTC en Vercel) sin aclarar cual era. */
  session_timezone: string;
  booking_opens_at: string | null;
  booking_closes_at: string | null;
  capacity: number;
  cover_image_url: string | null;
};

type BookingRecord = {
  live_session_id: string;
  status: LiveBookingStatus;
};

type AccessLinkRecord = {
  live_session_id: string;
  join_url: string;
  passcode: string | null;
};

/** Fila de detalle de una sesion: icono en cuadradito, etiqueta y valor. */
function Detalle({ d, d2, titulo, valor }: { d: string; d2?: string; titulo: string; valor: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        background: "var(--pink-wash)", color: "var(--pink)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d={d} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          {d2 && <path d={d2} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
      </div>
      <div>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>{titulo}</p>
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{valor}</p>
      </div>
    </div>
  );
}

function Flash({ message, tone }: { message: string | null; tone: "success" | "error" }) {
  if (!message) return null;

  return (
    <div
      className={`rounded-[1.5rem] border px-4 py-4 text-sm font-semibold ${
        tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-[rgba(217,105,119,0.18)] bg-[rgba(255,238,242,0.88)] text-[color:var(--rose-deep)]"
      }`}
    >
      {message}
    </div>
  );
}

export default async function DashboardLivePage({ searchParams }: { searchParams?: SearchParams }) {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;
  const redirectTo = "/dashboard/live";

  const [
    { data: sessionsData },
    { data: bookingsData },
    { data: linksData },
    { data: invitationsData },
  ] = await Promise.all([
    supabase
      .from("live_sessions")
      .select(
        "id, slug, title_i18n, description_i18n, status, membership_tier_required, starts_at, ends_at, session_timezone, booking_opens_at, booking_closes_at, capacity, cover_image_url"
      )
      .order("starts_at", { ascending: true }),
    supabase
      .from("live_session_bookings")
      .select("live_session_id, status")
      .eq("user_id", user.id),
    supabase.from("live_session_access_links").select("live_session_id, join_url, passcode"),
    // Sus invitaciones. La policy ya la deja ver solo las propias, asi que no
    // hace falta filtrar por user_id: filtrarlo igual seria sugerir que la
    // seguridad esta aca, y esta en la base.
    supabase.from("live_session_invitations").select("live_session_id")
  ]);

  const sessions = (sessionsData ?? []) as LiveSessionRecord[];
  const invitadaA = new Set(
    ((invitationsData ?? []) as { live_session_id: string }[]).map((i) => i.live_session_id)
  );
  const bookings = new Map(
    ((bookingsData ?? []) as BookingRecord[]).map((booking) => [booking.live_session_id, booking])
  );
  const links = new Map(
    ((linksData ?? []) as AccessLinkRecord[]).map((link) => [link.live_session_id, link])
  );

  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">

        <header className="hero-stage">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="studio-chip">Clases en vivo</span>
              <h1 className="display mt-8 text-5xl leading-none md:text-7xl">
                Clases en vivo y{" "}
                <span style={{ color: "var(--pink)", fontStyle: "italic" }}>reservas.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[color:var(--ink-soft)] md:text-lg">
                Reservá tu lugar en las próximas clases con Brunela. Cuando se acerque el horario vas a
                ver acá el enlace para entrar, y podés cancelar si te surge algo.
              </p>
            </div>

            <div className="soft-stat min-w-[16rem] p-5">
              <p className="eyebrow">Tus reservas</p>
              <p className="display mt-4 text-4xl leading-none">
                {Array.from(bookings.values()).filter((booking) => booking.status !== "canceled").length}
              </p>
              <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                Reservas activas o en lista de espera.
              </p>
            </div>
          </div>
        </header>

        <Flash message={success} tone="success" />
        <Flash message={error} tone="error" />

        <section className="panel rounded-[2.4rem] p-7 md:p-9">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Agenda</p>
              <h2 className="display mt-4 text-4xl">Reserva desde tu estudio</h2>
            </div>
            <span className="studio-chip">{sessions.length} sesiones</span>
          </div>

          <div className="mt-10 grid gap-4">
            {sessions.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-[rgba(118,92,113,0.14)] bg-[rgba(255,255,255,0.52)] p-6 text-sm leading-7 text-[color:var(--ink-soft)]">
                Todavia no hay clases en vivo programadas.
              </div>
            ) : null}

            {sessions.map((session, indice) => {
              const booking = bookings.get(session.id);
              const accessLink = links.get(session.id);
              const isReserved = booking?.status === "reserved" || booking?.status === "waitlisted";

              return (
                <article key={session.id} className="feature-tile rounded-[2rem] border border-[rgba(var(--border-rgb),0.42)] bg-[rgba(255,255,255,0.88)] p-5">
                  <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                    <div
                      className="relative min-h-[14rem] overflow-hidden rounded-[1.7rem] border border-[rgba(var(--border-rgb),0.3)] bg-cover bg-center"
                      style={{
                        backgroundColor: "rgba(238, 225, 228, 0.85)",
                        backgroundImage: session.cover_image_url ? `url(${session.cover_image_url})` : undefined
                      }}
                    >
                      {indice === 0 && (
                        <span style={{
                          position: "absolute", top: 14, left: 14,
                          display: "inline-flex", alignItems: "center", gap: 7,
                          background: "rgba(28,25,23,0.82)", color: "#fff",
                          fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                          padding: "7px 13px", borderRadius: 99, textTransform: "uppercase",
                        }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--pink)" }} />
                          Próxima clase
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col">
                      <div className="flex flex-wrap gap-2">
                        <span className="studio-chip">{membershipTierLabel(session.membership_tier_required)}</span>
                        <span className="studio-chip">{liveSessionStatusLabel(session.status)}</span>
                        {booking ? <span className="studio-chip">{bookingStatusLabel(booking.status)}</span> : null}
                        {/* Sin esto, una alumna ve una clase marcada "Principal" con su
                            plan de Corps y parece un error del sistema. La marca explica
                            por que la esta viendo. Va con --pink-mid y no --pink: aca hay
                            texto para leer, no una etiqueta que se mira de reojo. */}
                        {invitadaA.has(session.id) && (
                          <span
                            className="studio-chip"
                            style={{ background: "var(--pink-mid)", color: "#fff", borderColor: "transparent" }}
                          >
                            Invitada por Brunela
                          </span>
                        )}
                      </div>

                      <h3 className="display mt-5 text-4xl">{resolveI18nText(session.title_i18n)}</h3>
                      <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                        {resolveI18nText(session.description_i18n) || "Descripcion pendiente en admin."}
                      </p>

                      <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <Detalle
                          d="M3 4.5h10v9H3v-9z" d2="M3 7.2h10M5.6 2.6v3M10.4 2.6v3"
                          titulo="Inicio" valor={<HoraSesion iso={session.starts_at} zonaEstudio={session.session_timezone} />}
                        />
                        <Detalle
                          d="M8 4v4l2.5 1.5" d2="M8 14A6 6 0 108 2a6 6 0 000 12z"
                          titulo="Fin" valor={<HoraSesion iso={session.ends_at} zonaEstudio={session.session_timezone} />}
                        />
                        <Detalle
                          d="M6.2 7.6a2.6 2.6 0 100-5.2 2.6 2.6 0 000 5.2zM1.6 13.4a4.6 4.6 0 019.2 0"
                          d2="M10.6 3.1a2.2 2.2 0 010 4.3M11.6 9.2a3.8 3.8 0 012.8 3.6"
                          titulo="Capacidad" valor={`${session.capacity} lugares`}
                        />
                        <Detalle
                          d="M6.5 9.5a2.5 2.5 0 003.5 0l2-2a2.5 2.5 0 00-3.5-3.5l-.6.6"
                          d2="M9.5 6.5a2.5 2.5 0 00-3.5 0l-2 2a2.5 2.5 0 003.5 3.5l.6-.6"
                          titulo="Enlace"
                          /* La regla real: el enlace se revela al reservar, no a una
                             hora fija. No hay ventana de minutos en ningun lado. */
                          valor={accessLink ? "Disponible ahora" : "Disponible al reservar"}
                        />
                      </div>

                      <div className="mt-6 flex flex-wrap gap-3">
                        {isReserved ? (
                          <form action={cancelLiveSessionBookingAction}>
                            <input name="sessionId" type="hidden" value={session.id} />
                            <input name="redirectTo" type="hidden" value={redirectTo} />
                            <button className="button-secondary" type="submit">
                              Cancelar reserva
                            </button>
                          </form>
                        ) : (
                          <form action={reserveLiveSessionAction}>
                            <input name="sessionId" type="hidden" value={session.id} />
                            <input name="redirectTo" type="hidden" value={redirectTo} />
                            <button className="button-primary" type="submit">
                              Reservar lugar
                            </button>
                          </form>
                        )}

                        {accessLink ? (
                          <a className="button-ghost" href={accessLink.join_url} rel="noreferrer" target="_blank">
                            Entrar a la clase
                          </a>
                        ) : null}
                      </div>

                      {accessLink?.passcode ? (
                        <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                          Passcode: <strong className="text-[color:var(--ink)]">{accessLink.passcode}</strong>
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Franja de cierre. Cada linea dice algo que el sistema HACE:
              no promete avisos ni notificaciones, porque no existen. */}
          {sessions.length > 0 && (
            <div style={{
              marginTop: 22, borderRadius: 20, padding: "18px 22px",
              background: "var(--pink-wash)",
              display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            }}>
              {[
                ["Reservás en un clic", "Sin formularios ni confirmaciones por mail."],
                ["El enlace aparece acá", "En esta misma pantalla, una vez que reservaste."],
                ["Cancelás cuando quieras", "El lugar vuelve a quedar libre al instante."],
              ].map(([titulo, texto]) => (
                <div key={titulo}>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>{titulo}</p>
                  <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.55 }}>{texto}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
