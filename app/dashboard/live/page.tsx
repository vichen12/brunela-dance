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
import { ArrowRight, CalendarCheck, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Users, Video, X } from "lucide-react";
import { AdminAviso, AdminBoton, AdminCabecera, AdminCifras, AdminGuia } from "@/components/admin-ui";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { AdminBuscador } from "@/components/admin-buscador";
import Link from "next/link";

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

  // Filtros y paginas. Se filtra en memoria: RLS ya recorta a lo que esta
  // alumna puede ver, y una agenda de clases en vivo son decenas, no miles.
  const txt = (k: string) => (typeof params[k] === "string" ? (params[k] as string).trim() : "");
  const q = txt("q");
  const fPlan = ["corps_de_ballet", "solista", "principal"].includes(txt("plan")) ? txt("plan") : "";
  const fCuando = ["semana", "mes"].includes(txt("cuando")) ? txt("cuando") : "";
  const fMias = ["reservadas", "libres"].includes(txt("mias")) ? txt("mias") : "";
  const pagina = Math.max(0, Math.min(100, Number(params.pagina) || 0));
  const POR_PAGINA = 6;
  // Calendario: mes que se mira (YYYY-MM) y dia elegido (YYYY-MM-DD). Por
  // defecto, el mes de hoy en la zona del estudio.
  const ZONA_ESTUDIO = "Europe/Madrid";
  const hoyKey = claveDia(new Date().toISOString(), ZONA_ESTUDIO);
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(txt("mes")) ? txt("mes") : hoyKey.slice(0, 7);
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(txt("dia")) && txt("dia").startsWith(mes) ? txt("dia") : "";
  const perfil = await getCurrentProfile(user.id);
  const esAdmin = Boolean(perfil?.is_admin);

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
    // Sus invitaciones. Para una alumna la policy ya devuelve solo las propias;
    // el filtro por user_id es para la ADMIN, que las ve todas y leia
    // "Invitada por Brunela" en sesiones a las que invito a otra persona.
    // La seguridad sigue estando en la base: esto es presentacion.
    supabase.from("live_session_invitations").select("live_session_id").eq("user_id", user.id)
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
  // La marca "Proxima clase" es de la primera de la agenda, filtre lo que filtre.
  const idProxima = proximas[0]?.id ?? null;

  const normal = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const reservada = (id: string) => { const b = bookings.get(id); return b?.status === "reserved" || b?.status === "waitlisted"; };
  const filtradas = proximas.filter((sesion) => {
    if (q && !normal(resolveI18nText(sesion.title_i18n) + " " + resolveI18nText(sesion.description_i18n)).includes(normal(q))) return false;
    if (fPlan && sesion.membership_tier_required !== fPlan) return false;
    if (fCuando) {
      const limite = ahora + (fCuando === "semana" ? 7 : 31) * 86400000;
      if (new Date(sesion.starts_at).getTime() > limite) return false;
    }
    if (fMias === "reservadas" && !reservada(sesion.id)) return false;
    if (fMias === "libres" && reservada(sesion.id)) return false;
    return true;
  });
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaReal = Math.min(pagina, totalPaginas - 1);
  const enPagina = filtradas.slice(paginaReal * POR_PAGINA, paginaReal * POR_PAGINA + POR_PAGINA);
  const conPagina = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (fPlan) u.set("plan", fPlan);
    if (fCuando) u.set("cuando", fCuando);
    if (fMias) u.set("mias", fMias);
    if (p > 0) u.set("pagina", String(p));
    if (mes !== hoyKey.slice(0, 7)) u.set("mes", mes);
    const t = u.toString();
    return "/dashboard/live" + (t ? "?" + t : "");
  };

  // ── Calendario ──
  // Todas las sesiones del mes, pasadas y canceladas incluidas: es la vista
  // de "que hay y que hubo". El dia sale en la zona de cada sesion, que es la
  // del estudio: una clase de las 23:30 en Madrid cae ese dia, no el siguiente.
  const porDia = new Map<string, LiveSessionRecord[]>();
  for (const sesion of sessions) {
    const k = claveDia(sesion.starts_at, sesion.session_timezone || ZONA_ESTUDIO);
    if (!k.startsWith(mes)) continue;
    porDia.set(k, [...(porDia.get(k) ?? []), sesion]);
  }
  const [anio, numMes] = mes.split("-").map(Number);
  const primerDia = (new Date(Date.UTC(anio, numMes - 1, 1)).getUTCDay() + 6) % 7; // lunes = 0
  const diasDelMes = new Date(Date.UTC(anio, numMes, 0)).getUTCDate();
  const celdas: (string | null)[] = [
    ...Array.from({ length: primerDia }, () => null),
    ...Array.from({ length: diasDelMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (celdas.length % 7) celdas.push(null);
  const mesVecino = (d: number) => {
    const x = new Date(Date.UTC(anio, numMes - 1 + d, 1));
    return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const urlCal = (m: string, d?: string) => {
    const u = new URLSearchParams();
    if (m !== hoyKey.slice(0, 7)) u.set("mes", m);
    if (d) u.set("dia", d);
    const t = u.toString();
    return "/dashboard/live" + (t ? "?" + t : "") + (d ? "#lista" : "");
  };
  // "octubre de 2026" -> "Octubre de 2026". Con text-transform: capitalize
  // salia "Octubre De 2026".
  const nombreMesCrudo = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(anio, numMes - 1, 1)));
  const nombreMes = nombreMesCrudo.charAt(0).toUpperCase() + nombreMesCrudo.slice(1);
  const delDia = dia ? (porDia.get(dia) ?? []) : [];
  const tituloDiaCrudo = dia ? new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(dia + "T12:00:00Z")) : "";
  const tituloDia = tituloDiaCrudo.charAt(0).toUpperCase() + tituloDiaCrudo.slice(1);
  const CLASE_TIER: Record<string, string> = { corps_de_ballet: "es-corps", solista: "es-solista", principal: "es-principal" };

  const tarjeta = (session: LiveSessionRecord, esLaProxima: boolean, pasada: boolean) => {
    const booking = bookings.get(session.id);
    const accessLink = links.get(session.id);
    const isReserved = booking?.status === "reserved" || booking?.status === "waitlisted";
    const f = partesFecha(session.starts_at, session.session_timezone);
    return (
      <li key={session.id} id={"sesion-" + session.id} className={"sv-card" + (isReserved ? " es-reservada" : "") + (pasada ? " es-pasada" : "")}>
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
                  <Video size={16} strokeWidth={2.2} aria-hidden="true" /> {esAdmin && !isReserved ? "Entrar como profesora" : "Entrar a la clase"}
                </a>
              )}
              {/* La admin no reserva: entra a dar la clase. Antes veia los dos
                  botones juntos y parecia que tenia que anotarse. */}
              {esAdmin && !isReserved ? null : isReserved ? (
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

        {sessions.length > 0 && (
          <section className="cal" aria-label="Calendario de clases en vivo">
            <header className="cal-cab">
              <span className="cal-ico" aria-hidden="true"><CalendarDays size={18} strokeWidth={2} /></span>
              <h2 className="cal-titulo">{nombreMes}</h2>
              <div className="cal-nav">
                <Link href={urlCal(mesVecino(-1)) as never} className="cal-flecha" aria-label="Mes anterior"><ChevronLeft size={18} strokeWidth={2.2} /></Link>
                {mes !== hoyKey.slice(0, 7) && <Link href={urlCal(hoyKey.slice(0, 7)) as never} className="cal-hoy-btn">Hoy</Link>}
                <Link href={urlCal(mesVecino(1)) as never} className="cal-flecha" aria-label="Mes siguiente"><ChevronRight size={18} strokeWidth={2.2} /></Link>
              </div>
            </header>
            <div className="cal-leyenda" aria-hidden="true">
              <span><i className="es-corps" /> Corps de Ballet</span>
              <span><i className="es-solista" /> Solista</span>
              <span><i className="es-principal" /> Principal</span>
              {!esAdmin && <span><i className="es-mia" /> Tu reserva</span>}
            </div>
            <div className="cal-grilla" role="grid">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <span key={d} className="cal-sem" role="columnheader">{d}</span>)}
              {celdas.map((k, i) => {
                if (!k) return <span key={"v" + i} className="cal-celda es-vacia" aria-hidden="true" />;
                const delK = porDia.get(k) ?? [];
                const clases = "cal-celda" + (k === hoyKey ? " es-hoy" : "") + (k === dia ? " es-elegido" : "") + (k < hoyKey ? " es-pasado" : "") + (delK.length ? " tiene" : "");
                const num = <span className="cal-num">{Number(k.slice(8))}</span>;
                if (!delK.length) return <span key={k} className={clases} role="gridcell">{num}</span>;
                return (
                  <Link key={k} href={(k === dia ? urlCal(mes) : urlCal(mes, k)) as never} className={clases} role="gridcell" aria-label={`${Number(k.slice(8))}: ${delK.length} ${delK.length === 1 ? "clase" : "clases"}`}>
                    {num}
                    <span className="cal-eventos">
                      {delK.slice(0, 3).map((sesion) => (
                        <span key={sesion.id} className={"cal-ev " + (CLASE_TIER[sesion.membership_tier_required] ?? "") + (reservada(sesion.id) ? " es-mia" : "") + (sesion.status === "canceled" ? " es-cancelada" : "")}>
                          <b>{new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: sesion.session_timezone || ZONA_ESTUDIO }).format(new Date(sesion.starts_at))}</b> {resolveI18nText(sesion.title_i18n)}
                        </span>
                      ))}
                      {delK.length > 3 && <span className="cal-mas">+{delK.length - 3} más</span>}
                    </span>
                  </Link>
                );
              })}
            </div>
            <p className="cal-pie">Horarios de Madrid. Tocá un día para ver sus clases.</p>
          </section>
        )}

        {dia && (
          <section id="lista" className="cal-dia" aria-label={`Clases del ${tituloDia}`}>
            <div className="cal-dia-cab">
              <h2 className="cal-dia-titulo">{tituloDia}</h2>
              <Link href={urlCal(mes) as never} className="ad-btn"><X size={15} strokeWidth={2.2} aria-hidden="true" /> Ver toda la agenda</Link>
            </div>
            {delDia.length === 0 ? (
              <p className="cal-dia-vacio">Ese día no hay clases.</p>
            ) : (
              <ul className="sv-lista">{delDia.map((sesion) => tarjeta(sesion, sesion.id === idProxima, !proximas.includes(sesion)))}</ul>
            )}
          </section>
        )}

        {dia ? null : proximas.length === 0 ? (
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
          <>
            <AdminBuscador
              action="/dashboard/live"
              q={q}
              placeholder="Buscar una clase en vivo"
              total={proximas.length}
              mostrando={filtradas.length}
              filtros={[
                { name: "cuando", valor: fCuando, etiqueta: "Cuándo", opciones: [{ key: "", label: "Todas las fechas" }, { key: "semana", label: "Próximos 7 días" }, { key: "mes", label: "Este mes" }] },
                { name: "plan", valor: fPlan, etiqueta: "Plan", opciones: [{ key: "", label: "Todos los planes" }, { key: "corps_de_ballet", label: "Corps de Ballet" }, { key: "solista", label: "Solista" }, { key: "principal", label: "Principal" }] },
                ...(esAdmin ? [] : [{ name: "mias", valor: fMias, etiqueta: "Reservas", opciones: [{ key: "", label: "Todas" }, { key: "reservadas", label: "Mis reservas" }, { key: "libres", label: "Sin reservar" }] }]),
              ]}
            />
            {filtradas.length === 0 ? (
              <div className="ad-vacio">
                <p className="ad-vacio-titulo">Ninguna clase coincide.</p>
                <p>Probá con otra fecha o sacá algún filtro.</p>
                <Link href="/dashboard/live" className="ad-btn">Ver todas</Link>
              </div>
            ) : (
              <ul className="sv-lista">{enPagina.map((s) => tarjeta(s, s.id === idProxima, false))}</ul>
            )}
            {totalPaginas > 1 && (
              <nav className="sv-paginas" aria-label="Páginas">
                {paginaReal > 0 ? <Link href={conPagina(paginaReal - 1) as never} className="ad-btn">← Anteriores</Link> : <span />}
                <span className="sv-paginas-txt">Página {paginaReal + 1} de {totalPaginas}</span>
                {paginaReal < totalPaginas - 1 ? <Link href={conPagina(paginaReal + 1) as never} className="ad-btn">Siguientes →</Link> : <span />}
              </nav>
            )}
          </>
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

/** "2026-10-10" en la zona dada. en-CA da el formato ISO de fecha. */
function claveDia(iso: string, zona: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: zona }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
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
/* ── Calendario ── */
.cal { border: 1px solid var(--linea); border-radius: 30px; background: linear-gradient(160deg, #FFF7F3, #fff 45%); box-shadow: var(--sombra); padding: 22px 22px 16px; }
.cal-cab { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.cal-ico { width: 40px; height: 40px; border-radius: 14px; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); flex-shrink: 0; }
.cal-titulo { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.cal-nav { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.cal-flecha { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: #fff; border: 1.5px solid var(--linea-fuerte); color: var(--ink); transition: background .2s, border-color .2s, transform .3s var(--curva); }
.cal-flecha:hover { background: var(--rubor); border-color: var(--pink-line); transform: scale(1.06); }
.cal-hoy-btn { height: 40px; padding: 0 16px; border-radius: 99px; display: inline-flex; align-items: center; font-size: 13px; font-weight: 800; color: var(--pink-deep); background: var(--rubor); text-decoration: none; }
.cal-leyenda { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0 2px 14px; font-size: 12px; font-weight: 700; color: var(--muted); }
.cal-leyenda span { display: inline-flex; align-items: center; gap: 6px; }
.cal-leyenda i { width: 10px; height: 10px; border-radius: 4px; display: inline-block; }
.cal-grilla { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
.cal-sem { text-align: center; font-size: 12px; font-weight: 800; color: var(--muted); padding: 4px 0 6px; }
.cal-celda { position: relative; min-height: 104px; border-radius: 18px; padding: 8px 8px 8px; background: #fff; border: 1px solid #F6EAE4; display: flex; flex-direction: column; gap: 4px; min-width: 0; text-decoration: none; color: inherit; transition: border-color .2s, box-shadow .3s, transform .3s var(--curva); }
.cal-celda.es-vacia { background: transparent; border-color: transparent; }
.cal-celda.es-pasado { background: #FFFCFA; }
.cal-celda.es-pasado .cal-num { color: #CDB3AB; }
a.cal-celda:hover { border-color: var(--pink-line); box-shadow: var(--sombra); transform: translateY(-2px); }
.cal-celda.es-hoy { border-color: var(--pink); box-shadow: 0 0 0 3px rgba(230,79,85,.12); }
.cal-celda.es-elegido { background: var(--rubor); border-color: var(--pink); }
.cal-num { font-size: 13px; font-weight: 900; color: var(--ink); width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; }
.cal-celda.es-hoy .cal-num { background: var(--pink); color: #fff; }
.cal-eventos { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.cal-ev { display: block; padding: 3px 7px; border-radius: 8px; font-size: 11px; font-weight: 700; line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-left: 3px solid transparent; }
.cal-ev b { font-weight: 900; }
.es-corps { background: #FFF1EC; color: #A2483B; border-color: #F2B9A5 !important; }
.es-solista { background: #FFF4E8; color: #A85A1E; border-color: #F3C795 !important; }
.es-principal { background: #FDECEC; color: var(--pink-deep); border-color: var(--pink) !important; }
.cal-leyenda i.es-corps { background: #F2B9A5; }
.cal-leyenda i.es-solista { background: #F3C795; }
.cal-leyenda i.es-principal { background: var(--pink); }
.cal-leyenda i.es-mia { background: #4C8F55; }
.cal-ev.es-mia { box-shadow: inset 0 0 0 1.5px #7DB585; }
.cal-ev.es-cancelada { text-decoration: line-through; opacity: .55; }
.cal-celda.es-pasado .cal-ev { opacity: .6; }
.cal-mas { font-size: 11px; font-weight: 800; color: var(--pink-deep); padding-left: 4px; }
.cal-pie { margin-top: 12px; font-size: 12px; color: var(--muted); }
.cal-dia { display: flex; flex-direction: column; gap: 14px; scroll-margin-top: 20px; }
.cal-dia-cab { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.cal-dia-titulo { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.02em; }
.cal-dia-vacio { padding: 24px; border-radius: 22px; background: var(--crema); color: var(--muted); text-align: center; }
@media (max-width: 760px) {
  .cal { padding: 16px 12px 12px; border-radius: 24px; }
  .cal-grilla { gap: 4px; }
  .cal-celda { min-height: 58px; padding: 5px 3px; border-radius: 12px; align-items: center; }
  .cal-ev { width: 8px; height: 8px; padding: 0; border-radius: 50%; border: 0; font-size: 0; }
  .cal-ev.es-corps { background: #F2B9A5; } .cal-ev.es-solista { background: #F3C795; } .cal-ev.es-principal { background: var(--pink); }
  .cal-ev.es-mia { box-shadow: 0 0 0 2px #fff, 0 0 0 3.5px #4C8F55; }
  .cal-eventos { flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 3px; }
  .cal-mas { font-size: 9px; padding: 0; }
  .cal-sem { font-size: 10.5px; }
}
.sv-paginas { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.sv-paginas-txt { font-size: 13px; font-weight: 700; color: var(--muted); padding: 8px 14px; border-radius: 99px; background: var(--rubor); }
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
