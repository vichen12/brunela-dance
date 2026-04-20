import { StudioNav } from "@/components/studio-nav";
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

  const [{ data: sessionsData }, { data: bookingsData }, { data: linksData }] = await Promise.all([
    supabase
      .from("live_sessions")
      .select(
        "id, slug, title_i18n, description_i18n, status, membership_tier_required, starts_at, ends_at, booking_opens_at, booking_closes_at, capacity, cover_image_url"
      )
      .order("starts_at", { ascending: true }),
    supabase
      .from("live_session_bookings")
      .select("live_session_id, status")
      .eq("user_id", user.id),
    supabase.from("live_session_access_links").select("live_session_id, join_url, passcode")
  ]);

  const sessions = (sessionsData ?? []) as LiveSessionRecord[];
  const bookings = new Map(
    ((bookingsData ?? []) as BookingRecord[]).map((booking) => [booking.live_session_id, booking])
  );
  const links = new Map(
    ((linksData ?? []) as AccessLinkRecord[]).map((link) => [link.live_session_id, link])
  );

  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">
        <StudioNav current="live" />

        <header className="hero-stage">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="studio-chip">Live sessions</span>
              <h1 className="display mt-8 text-5xl leading-none md:text-7xl">Clases en vivo y reservas.</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[color:var(--ink-soft)] md:text-lg">
                Esta capa ya permite reservar, cancelar y mostrar el link de acceso cuando la politica de RLS lo
                habilita para la alumna correcta.
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

            {sessions.map((session) => {
              const booking = bookings.get(session.id);
              const accessLink = links.get(session.id);
              const isReserved = booking?.status === "reserved" || booking?.status === "waitlisted";

              return (
                <article key={session.id} className="feature-tile rounded-[2rem] border border-[rgba(var(--border-rgb),0.42)] bg-[rgba(255,255,255,0.88)] p-5">
                  <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                    <div
                      className="min-h-[14rem] rounded-[1.7rem] border border-[rgba(var(--border-rgb),0.3)] bg-cover bg-center"
                      style={{
                        backgroundColor: "rgba(238, 225, 228, 0.85)",
                        backgroundImage: session.cover_image_url ? `url(${session.cover_image_url})` : undefined
                      }}
                    />

                    <div className="flex flex-col">
                      <div className="flex flex-wrap gap-2">
                        <span className="studio-chip">{membershipTierLabel(session.membership_tier_required)}</span>
                        <span className="studio-chip">{liveSessionStatusLabel(session.status)}</span>
                        {booking ? <span className="studio-chip">{bookingStatusLabel(booking.status)}</span> : null}
                      </div>

                      <h3 className="display mt-5 text-4xl">{resolveI18nText(session.title_i18n)}</h3>
                      <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                        {resolveI18nText(session.description_i18n) || "Descripcion pendiente en admin."}
                      </p>

                      <div className="mt-6 grid gap-3 text-sm leading-7 text-[color:var(--ink-soft)] md:grid-cols-2">
                        <p>
                          <strong className="text-[color:var(--ink)]">Inicio:</strong> {formatDateTimeLabel(session.starts_at)}
                        </p>
                        <p>
                          <strong className="text-[color:var(--ink)]">Fin:</strong> {formatDateTimeLabel(session.ends_at)}
                        </p>
                        <p>
                          <strong className="text-[color:var(--ink)]">Capacidad:</strong> {session.capacity} lugares
                        </p>
                        <p>
                          <strong className="text-[color:var(--ink)]">Booking:</strong>{" "}
                          {session.booking_closes_at ? formatDateTimeLabel(session.booking_closes_at) : "Sin cierre"}
                        </p>
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
        </section>
      </section>
    </main>
  );
}
