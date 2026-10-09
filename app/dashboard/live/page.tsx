import {
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
import { BotonEnviar } from "@/components/boton-enviar";
import { ArrowRight, CalendarCheck, Check, Clock, Users, Video, X } from "lucide-react";
import { AdminAviso, AdminBoton, AdminCabecera, AdminCifras, AdminGuia } from "@/components/admin-ui";
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

  // Proximas y pasadas, separadas. Antes iban mezcladas y la marca de "Próxima
  // clase" caia en la primera de la lista aunque ya hubiera terminado.
  const ahora = Date.now();
  const proximas = sessions.filter((s) => new Date(s.ends_at).getTime() >= ahora && s.status !== "canceled" && s.status !== "completed");
  const pasadas = sessions.filter((s) => !proximas.includes(s)).reverse();
  const reservasActivas = Array.from(bookings.values()).filter((b) => b.status !== "canceled").length;

  const tarjeta = (session: LiveSessionRecord, esLaProxima: boolean, pasada: boolean) => {
    const booking = bookings.get(session.id);
    const accessLink = links.get(session.id);
    const isReserved = booking?.status === "reserved" || booking?.status === "waitlisted";
    const f = partesFecha(session.starts_at, session.session_timezone);
    return (
      <li key={session.id} className={"sv-card" + (isReserved ? " es-reservada" : "") + (pasada ? " es-pasada" : "")}>
        <div className="sv-fecha" aria-hidden="true">
          <span className="sv-fecha-semana">{f.semana}</span>
          <span className="sv-fecha-dia">{f.dia}</span>
          <span className="sv-fecha-mes">{f.mes}</span>
        </div>

        <div className="sv-cuerpo">
          <div className="sv-linea">
            {esLaProxima && <span className="sv-proxima"><span className="sv-vivo" aria-hidden="true" /> Próxima clase</span>}
            {isReserved && (
              <span className="sv-estado es-ok"><Check size={12} strokeWidth={3} aria-hidden="true" /> {booking?.status === "waitlisted" ? "En lista de espera" : "Reservaste tu lugar"}</span>
            )}
            {/* Sin esto, una alumna ve una clase marcada "Principal" con su plan
                de Corps y parece un error del sistema. La marca explica por que
                la esta viendo. */}
            {invitadaA.has(session.id) && <span className="sv-estado es-invitada">Invitada por Brunela</span>}
            <span className="sv-plan">{membershipTierLabel(session.membership_tier_required)}</span>
            {pasada && <span className="sv-plan">{liveSessionStatusLabel(session.status)}</span>}
          </div>

          <h3 className="sv-titulo">{resolveI18nText(session.title_i18n)}</h3>
          {resolveI18nText(session.description_i18n) && <p className="sv-desc">{resolveI18nText(session.description_i18n)}</p>}

          <ul className="sv-datos">
            <li><Clock size={14} strokeWidth={2} aria-hidden="true" /> <HoraSesion iso={session.starts_at} zonaEstudio={session.session_timezone} /></li>
            <li><Users size={14} strokeWidth={2} aria-hidden="true" /> {session.capacity} lugares</li>
            {/* La regla real: el enlace se revela al reservar, no a una hora
                fija. No hay ventana de minutos en ningun lado. */}
            <li><Video size={14} strokeWidth={2} aria-hidden="true" /> {accessLink ? "Enlace disponible" : "El enlace aparece al reservar"}</li>
          </ul>

          {!pasada && (
            <div className="sv-acciones">
              {accessLink && (
                <a className="sv-entrar" href={accessLink.join_url} rel="noreferrer" target="_blank">
                  <Video size={16} strokeWidth={2.2} aria-hidden="true" /> Entrar a la clase
                </a>
              )}
              {isReserved ? (
                <form action={cancelLiveSessionBookingAction}>
                  <input name="sessionId" type="hidden" value={session.id} />
                  <input name="redirectTo" type="hidden" value={redirectTo} />
                  <BotonEnviar className="sv-cancelar" pendingLabel="Cancelando…" confirmar="¿Cancelar tu reserva? Si la clase está llena, otra persona puede tomar tu lugar.">
                    Cancelar reserva
                  </BotonEnviar>
                </form>
              ) : (
                <form action={reserveLiveSessionAction}>
                  <input name="sessionId" type="hidden" value={session.id} />
                  <input name="redirectTo" type="hidden" value={redirectTo} />
                  <BotonEnviar className="sv-reservar" pendingLabel="Reservando…">
                    <CalendarCheck size={16} strokeWidth={2.2} aria-hidden="true" /> Reservar mi lugar
                  </BotonEnviar>
                </form>
              )}
            </div>
          )}
          {!pasada && accessLink?.passcode && (
            <p className="sv-pass">Código de acceso: <strong>{accessLink.passcode}</strong></p>
          )}
        </div>
      </li>
    );
  };

  return (
    <main className="sv">
      <style>{CSS}</style>
      <section className="sv-shell">
        <AdminCabecera
          eyebrow="Clases en vivo"
          titulo="En vivo con Brunela"
          lede="Reservá tu lugar en las próximas clases. Cuando reservás aparece acá el enlace para entrar, y podés cancelar si te surge algo."
        />

        <AdminAviso mensaje={success} tono="ok" />
        <AdminAviso mensaje={error} tono="error" />

        {proximas.length > 0 && (
          <AdminCifras items={[
            { label: "Próximas", value: proximas.length, sub: "clases en agenda" },
            { label: "Tus reservas", value: reservasActivas, sub: "activas o en espera" },
          ]} />
        )}

        {proximas.length === 0 ? (
          <AdminGuia
            rotuloEjemplo="Así se ve una clase en vivo"
            ejemplo={
              <div className="ad-guia-flota sv-ejemplo">
                <div className="sv-fecha"><span className="sv-fecha-semana">sáb</span><span className="sv-fecha-dia">25</span><span className="sv-fecha-mes">oct</span></div>
                <div className="sv-cuerpo">
                  <span className="sv-estado es-ok"><Check size={12} strokeWidth={3} /> Reservaste tu lugar</span>
                  <p className="sv-titulo">Barra a tierra</p>
                  <span className="sv-entrar"><Video size={16} strokeWidth={2.2} /> Entrar a la clase</span>
                </div>
              </div>
            }
            eyebrow="Todavía no hay clases programadas"
            titulo="Así funcionan."
            pasos={[
              { icono: <CalendarCheck size={18} strokeWidth={2} />, titulo: "Reservás en un clic", texto: "Sin formularios ni confirmaciones por mail." },
              { icono: <Video size={18} strokeWidth={2} />, titulo: "El enlace aparece acá", texto: "En esta misma pantalla, apenas reservás." },
              { icono: <X size={18} strokeWidth={2} />, titulo: "Cancelás cuando quieras", texto: "El lugar vuelve a quedar libre al instante." },
            ]}
            cta={<AdminBoton href="/dashboard/library" lleno>Mientras tanto, ver clases <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" /></AdminBoton>}
          />
        ) : (
          <ul className="sv-lista">{proximas.map((s, i) => tarjeta(s, i === 0, false))}</ul>
        )}

        {pasadas.length > 0 && (
          <details className="sv-pasadas">
            <summary>Clases pasadas <span>{pasadas.length}</span></summary>
            <ul className="sv-lista">{pasadas.map((s) => tarjeta(s, false, true))}</ul>
          </details>
        )}
      </section>
    </main>
  );
}

/** Dia, mes y dia de semana en la zona DEL ESTUDIO: igual en servidor y cliente. */
function partesFecha(iso: string, zona: string) {
  try {
    const d = new Date(iso);
    const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-ES", { ...o, timeZone: zona }).format(d).replace(".", "");
    return { dia: fmt({ day: "numeric" }), mes: fmt({ month: "short" }), semana: fmt({ weekday: "short" }) };
  } catch {
    return { dia: "—", mes: "", semana: "" };
  }
}

const CSS = `
.sv { padding-bottom: 80px; }
.sv-shell { max-width: 1320px; margin: 0 auto; padding: clamp(20px, 3vw, 40px) clamp(16px, 3.4vw, 48px) 0; display: flex; flex-direction: column; gap: 18px; }
.sv .ad-mast { padding-bottom: 4px; }
.sv-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.sv-card {
  display: flex; gap: 22px; padding: 20px 22px; border-radius: 22px; border: 1px solid #F0DED6; background: #fff;
  transition: transform .35s cubic-bezier(.16,1,.3,1), box-shadow .35s, border-color .25s;
}
.sv-card:hover { transform: translateY(-2px); border-color: var(--pink-line); box-shadow: 0 22px 40px -26px rgba(176,58,62,0.5); }
.sv-card.es-reservada { border-color: #bbf7d0; background: linear-gradient(90deg, #f0fdf4 0%, #fff 45%); }
.sv-card.es-pasada { opacity: 0.7; }
.sv-fecha {
  width: 86px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  padding: 12px 6px; border-radius: 18px; background: var(--pink-wash); align-self: flex-start;
}
.sv-fecha-semana { font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--pink-deep); }
.sv-fecha-dia { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 38px; line-height: 1; letter-spacing: -0.04em; color: var(--ink); }
.sv-fecha-mes { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #8A6F68; }
.sv-cuerpo { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.sv-linea { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sv-proxima { display: inline-flex; align-items: center; gap: 7px; padding: 4px 11px; border-radius: 99px; background: var(--ink); color: #fff; font-size: 10.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
.sv-vivo { width: 7px; height: 7px; border-radius: 50%; background: var(--pink); animation: sv-latido 1.6s ease-in-out infinite; }
@keyframes sv-latido { 0%, 100% { box-shadow: 0 0 0 0 rgba(230,79,85,0.6); } 50% { box-shadow: 0 0 0 5px rgba(230,79,85,0); } }
.sv-estado { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 99px; font-size: 12px; font-weight: 700; }
.sv-estado.es-ok { background: #dcfce7; color: #166534; }
.sv-estado.es-invitada { background: var(--pink-mid); color: #fff; }
.sv-plan { padding: 3px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 700; color: #6E5550; border: 1px solid #F0DED6; }
.sv-titulo { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 23px; line-height: 1.15; letter-spacing: -0.03em; color: var(--ink); }
.sv-desc { font-size: 14px; line-height: 1.6; color: #6E5550; max-width: 72ch; }
.sv-datos { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 18px; }
.sv-datos li { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #6E5550; }
.sv-datos svg { color: var(--pink-mid); }
.sv-acciones { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
.sv-acciones form { display: contents; }
.sv-reservar, .sv-entrar {
  display: inline-flex; align-items: center; gap: 8px; height: 46px; padding: 0 22px; border-radius: 99px; border: 0; cursor: pointer;
  background: var(--pink); color: #fff; font: inherit; font-size: 14px; font-weight: 700; text-decoration: none;
  box-shadow: 0 10px 22px -10px rgba(230,79,85,0.8); transition: background .2s, transform .2s;
}
.sv-reservar:hover, .sv-entrar:hover { background: var(--pink-mid); transform: translateY(-1px); }
.sv-entrar { background: #15803d; box-shadow: 0 10px 22px -10px rgba(21,128,61,0.7); }
.sv-entrar:hover { background: #166534; }
.sv-cancelar {
  display: inline-flex; align-items: center; height: 46px; padding: 0 20px; border-radius: 99px; cursor: pointer;
  border: 1.5px solid #E6CCC2; background: #fff; color: #6E5550; font: inherit; font-size: 13.5px; font-weight: 700; transition: border-color .2s, color .2s;
}
.sv-cancelar:hover { border-color: var(--pink); color: var(--pink-deep); }
.sv-pass { font-size: 13px; color: #6E5550; }
.sv-pass strong { color: var(--ink); letter-spacing: 0.04em; }
.sv-pasadas { margin-top: 6px; }
.sv-pasadas > summary {
  list-style: none; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; margin-bottom: 12px;
  font-size: 13px; font-weight: 700; color: #8A6F68;
}
.sv-pasadas > summary::-webkit-details-marker { display: none; }
.sv-pasadas > summary span { padding: 1px 8px; border-radius: 99px; background: #FBF0EB; font-size: 12px; }
.sv-ejemplo { display: flex; gap: 16px; padding: 18px; align-items: center; }
.sv-ejemplo .sv-cuerpo { gap: 8px; align-items: flex-start; }
.sv-ejemplo .sv-entrar { height: 40px; font-size: 13px; padding: 0 16px; }
@media (max-width: 640px) {
  .sv-card { flex-direction: column; gap: 14px; padding: 16px; }
  .sv-fecha { flex-direction: row; width: auto; gap: 8px; padding: 8px 14px; }
  .sv-fecha-dia { font-size: 24px; }
}
@media (prefers-reduced-motion: reduce) { .sv-vivo { animation: none; } }
`;
