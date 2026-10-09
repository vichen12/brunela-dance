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
.sv-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
@keyframes sv-entra { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
.sv-card {
  display: flex; gap: 22px; padding: 18px 22px 18px 18px; border-radius: 28px; border: 1px solid var(--linea); background: #fff;
  box-shadow: var(--sombra); animation: sv-entra .7s var(--curva) backwards;
  transition: transform .35s var(--curva), box-shadow .35s, border-color .25s;
}
.sv-lista > .sv-card:nth-child(2) { animation-delay: .06s; }
.sv-lista > .sv-card:nth-child(3) { animation-delay: .12s; }
.sv-lista > .sv-card:nth-child(n+4) { animation-delay: .18s; }
.sv-card:hover { transform: translateY(-3px); border-color: var(--linea-fuerte); box-shadow: var(--sombra-alta); }
.sv-card.es-reservada { border-color: #D5E7CF; background: linear-gradient(100deg, #F4F9F2 0%, #fff 50%); }
.sv-card.es-pasada { opacity: 0.72; box-shadow: none; }

/* Bloque de fecha: una pastilla pastel, como una hoja de calendario blanda. */
.sv-fecha {
  width: 92px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  padding: 14px 6px; border-radius: 22px; align-self: stretch; min-height: 108px;
  background: linear-gradient(160deg, #FFE9DE 0%, #FFF4EE 100%); color: var(--melocoton-deep);
  transition: transform .45s var(--curva);
}
.sv-card:hover .sv-fecha { transform: rotate(-3deg) scale(1.03); }
.sv-lista > .sv-card:nth-child(3n+2) .sv-fecha { background: linear-gradient(160deg, #FFE4E4 0%, #FFF3F2 100%); color: var(--pink-deep); }
.sv-lista > .sv-card:nth-child(3n+3) .sv-fecha { background: linear-gradient(160deg, #F7EBFA 0%, #FBF5FC 100%); color: #8A4E9C; }
.sv-card.es-reservada .sv-fecha { background: linear-gradient(160deg, #E2F0DE 0%, #F2F8F0 100%); color: var(--salvia-deep); }
.sv-fecha-semana { font-size: 13px; font-weight: 800; text-transform: capitalize; }
.sv-fecha-dia { font-weight: 900; font-size: 40px; line-height: 1; letter-spacing: -0.03em; color: var(--ink); }
.sv-fecha-mes { padding: 2px 9px; border-radius: 99px; background: rgba(255,255,255,.75); font-size: 12px; font-weight: 800; text-transform: capitalize; }

.sv-cuerpo { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; padding: 4px 0; }
.sv-linea { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sv-proxima { display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px 5px 10px; border-radius: 99px; background: var(--pink); color: #fff; font-size: 12.5px; font-weight: 800; box-shadow: 0 8px 16px -10px rgba(230,79,85,.8); }
.sv-vivo { width: 8px; height: 8px; border-radius: 50%; background: #fff; animation: sv-latido 1.6s ease-in-out infinite; }
@keyframes sv-latido { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.8); } 50% { box-shadow: 0 0 0 5px rgba(255,255,255,0); } }
.sv-estado { display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border-radius: 99px; font-size: 12.5px; font-weight: 800; }
.sv-estado.es-ok { background: var(--salvia); color: var(--salvia-deep); }
.sv-estado.es-invitada { background: var(--melocoton); color: var(--melocoton-deep); }
.sv-plan { padding: 4px 11px; border-radius: 99px; font-size: 12.5px; font-weight: 800; color: var(--pink-deep); background: var(--rubor); }
.sv-titulo { margin-top: 2px; font-weight: 900; font-size: 23px; line-height: 1.15; letter-spacing: -0.02em; color: var(--ink); }
.sv-desc { font-size: 14px; line-height: 1.6; color: var(--muted); max-width: 72ch; }
.sv-datos { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.sv-datos li { display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px 6px 8px; border-radius: 99px; background: var(--crema); border: 1px solid var(--linea); font-size: 13px; font-weight: 600; color: var(--ink); }
.sv-datos svg { color: var(--pink-deep); flex-shrink: 0; }
.sv-acciones { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
.sv-acciones form { display: contents; }
.sv-reservar, .sv-entrar {
  display: inline-flex; align-items: center; gap: 8px; height: 48px; padding: 0 24px; border-radius: 99px; border: 0; cursor: pointer;
  background: var(--pink); color: #fff; font: inherit; font-size: 14.5px; font-weight: 800; text-decoration: none;
  box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); transition: background .2s, transform .3s var(--curva), box-shadow .3s;
}
.sv-reservar:hover, .sv-entrar:hover { background: var(--pink-mid); transform: translateY(-2px); }
.sv-entrar { background: var(--salvia-deep); box-shadow: 0 14px 26px -14px rgba(63,122,69,.8); }
.sv-entrar:hover { background: #356A3B; }
.sv-cancelar {
  display: inline-flex; align-items: center; height: 48px; padding: 0 22px; border-radius: 99px; cursor: pointer;
  border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); font: inherit; font-size: 14px; font-weight: 800;
  transition: border-color .2s, background .2s, color .2s, transform .3s var(--curva);
}
.sv-cancelar:hover { border-color: var(--pink-line); background: var(--rubor); color: var(--pink-deep); transform: translateY(-2px); }
.sv-pass { display: inline-flex; align-self: flex-start; align-items: center; gap: 6px; margin-top: 4px; padding: 6px 12px; border-radius: 14px; background: var(--crema); font-size: 13px; color: var(--muted); }
.sv-pass strong { color: var(--ink); letter-spacing: 0.04em; }
.sv-pasadas { margin-top: 6px; }
.sv-pasadas > summary {
  list-style: none; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; margin-bottom: 14px;
  height: 42px; padding: 0 8px 0 16px; border-radius: 99px; background: #fff; border: 1.5px solid var(--linea-fuerte);
  font-size: 14px; font-weight: 800; color: var(--ink); transition: background .2s, border-color .2s;
}
.sv-pasadas > summary:hover { background: var(--rubor); border-color: var(--pink-line); }
.sv-pasadas > summary::-webkit-details-marker { display: none; }
.sv-pasadas > summary span { display: grid; place-items: center; min-width: 28px; height: 28px; padding: 0 8px; border-radius: 99px; background: var(--rubor); color: var(--pink-deep); font-size: 12.5px; }
.sv-ejemplo { display: flex; gap: 16px; padding: 16px; align-items: stretch; border-radius: 26px; }
.sv-ejemplo .sv-fecha { min-height: 0; }
.sv-ejemplo .sv-cuerpo { gap: 8px; align-items: flex-start; }
.sv-ejemplo .sv-entrar { height: 42px; font-size: 13.5px; padding: 0 18px; }
@media (max-width: 640px) {
  .sv-card { flex-direction: column; gap: 12px; padding: 14px; border-radius: 24px; }
  .sv-fecha { flex-direction: row; width: auto; min-height: 0; align-self: flex-start; gap: 8px; padding: 8px 16px 8px 14px; border-radius: 99px; }
  .sv-fecha-dia { font-size: 24px; }
  .sv-titulo { font-size: 20px; }
  .sv-acciones > * { flex: 1 1 auto; justify-content: center; }
  .sv-ejemplo { flex-direction: column; gap: 12px; }
  .sv-ejemplo .sv-fecha { align-self: flex-start; }
}
@media (prefers-reduced-motion: reduce) { .sv-vivo, .sv-card { animation: none; } .sv-card:hover .sv-fecha { transform: none; } }
`;
