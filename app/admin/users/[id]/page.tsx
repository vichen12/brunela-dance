import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, CalendarCheck, CalendarDays, Check, CreditCard, Mail, MessageCircle, Package, PlayCircle, Send, Sparkles, Target, UserPlus, X } from "lucide-react";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { enviarMensajeDesdeFichaAction, invitarDesdeFichaAction, quitarInvitacionDesdeFichaAction } from "@/src/features/admin/ficha-actions";
import { AdminAviso } from "@/components/admin-ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { Desplegable } from "@/components/desplegable";
import { resolveI18nText } from "@/src/features/studio/helpers";
import { requireAdmin } from "@/src/features/auth/guards";
import { getFichaAlumna } from "@/src/features/admin/analitica/alumna";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Ficha individual de una alumna.
 *
 * Es la pantalla que Brunela abre cuando alguien le escribe o cuando quiere
 * entender por que una alumna dejo de entrenar. Por eso todo lo que muestra
 * termina en una accion posible: escribirle, ver su plan, mirar sus clases.
 */
export default async function FichaAlumnaPage({ params, searchParams }: Props) {
  const { user } = await requireAdmin();
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const success = typeof sp.success === "string" ? sp.success : null;
  const error = typeof sp.error === "string" ? sp.error : null;

  if (!UUID.test(id)) notFound();

  const f = await getFichaAlumna(id);
  if (!f) notFound();

  // Lo que hace falta para ACTUAR desde la ficha: la conversacion, su agenda
  // en vivo y lo que compro. service_role: esta pantalla ya paso requireAdmin.
  const db = createSupabaseAdminClient();
  const ahoraIso = new Date().toISOString();
  const [{ data: salas }, { data: reservasData }, { data: invitData }, { data: proxData }, { data: comprasData }] = await Promise.all([
    db.from("chat_rooms").select("id").eq("type", "dm").contains("participant_ids", [user.id, id]).order("created_at", { ascending: true }).limit(1),
    db.from("live_session_bookings").select("status, live_sessions(id, title_i18n, starts_at, session_timezone)").eq("user_id", id).in("status", ["reserved", "waitlisted"]),
    db.from("live_session_invitations").select("live_session_id, live_sessions(id, title_i18n, starts_at, session_timezone)").eq("user_id", id),
    db.from("live_sessions").select("id, title_i18n, starts_at, session_timezone, membership_tier_required").eq("status", "scheduled").gte("starts_at", ahoraIso).order("starts_at").limit(40),
    db.from("pack_purchases").select("id, purchased_at, packs(name_i18n)").eq("user_id", id).order("purchased_at", { ascending: false }),
  ]);
  const salaId = salas?.[0]?.id ?? null;
  const { data: mensajesData } = salaId
    ? await db.from("chat_messages").select("id, content, created_at, user_id, author_name, is_deleted").eq("room_id", salaId).eq("is_deleted", false).order("created_at", { ascending: false }).limit(6)
    : { data: [] as { id: string; content: string; created_at: string; user_id: string; author_name: string | null; is_deleted: boolean }[] };
  const mensajes = [...(mensajesData ?? [])].reverse();
  type Ses = { id: string; title_i18n: Record<string, string>; starts_at: string; session_timezone: string };
  const una = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
  const futura = (x: Ses | null): x is Ses => Boolean(x && x.starts_at >= ahoraIso);
  const reservas = (reservasData ?? []).map((r) => ({ estado: r.status as string, s: una(r.live_sessions as unknown as Ses | Ses[] | null) })).filter((r) => futura(r.s));
  const invitaciones = (invitData ?? []).map((i) => una(i.live_sessions as unknown as Ses | Ses[] | null)).filter(futura);
  const yaInvitada = new Set(invitaciones.map((x) => x.id));
  const invitables = ((proxData ?? []) as Ses[]).filter((x) => !yaInvitada.has(x.id));
  const compras = (comprasData ?? []).map((c) => ({ id: c.id as string, cuando: c.purchased_at as string, nombre: resolveI18nText((una(c.packs as unknown as { name_i18n: Record<string, string> } | null)?.name_i18n) ?? {}) || "Pack" }));
  const cuandoSes = (x: Ses) => new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: x.session_timezone || "Europe/Madrid" }).format(new Date(x.starts_at));
  const horaMsg = (iso: string) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(iso));

  const inactiva = f.actividad.diasSinEntrar !== null && f.actividad.diasSinEntrar > 14;

  // Sin full_name, getFichaAlumna devuelve "Sin nombre". Se muestra el prefijo
  // del correo, igual que la lista de /admin/users: "Sin nombre." como titular
  // no le dice a Brunela de quien es la ficha.
  const nombre = f.perfil.nombre === "Sin nombre" ? f.perfil.email.split("@")[0] : f.perfil.nombre;
  // "Cambiar su plan" lleva a SU fila, con el bloque de editar ya abierto.
  const editarPlan = `/admin/users?q=${encodeURIComponent(f.perfil.email)}&editar=${id}#editar-${id}`;

  // Los iconos se renderizan aca mismo (server component): no cruzan a cliente.
  const datos = [
    { valor: f.actividad.clasesEmpezadas, etiqueta: "Clases empezadas", icono: <PlayCircle size={18} strokeWidth={2.2} aria-hidden="true" /> },
    { valor: f.actividad.clasesTerminadas, etiqueta: "Clases terminadas", icono: <Check size={18} strokeWidth={2.4} aria-hidden="true" /> },
    { valor: f.reservas.total, etiqueta: "Sesiones reservadas", icono: <CalendarDays size={18} strokeWidth={2.2} aria-hidden="true" /> },
    { valor: f.reservas.asistio, etiqueta: "A las que asistió", icono: <CalendarCheck size={18} strokeWidth={2.2} aria-hidden="true" /> },
    { valor: f.mensajes, etiqueta: "Mensajes enviados", icono: <MessageCircle size={18} strokeWidth={2.2} aria-hidden="true" /> },
  ];

  return (
    <main className="fa">
      <style>{CSS}</style>

      <header className="fa-hero">
        <Link href={"/admin/users" as never} className="fa-volver">
          <ArrowLeft size={15} strokeWidth={2.4} aria-hidden="true" /> Volver a alumnas
        </Link>

        <div className="fa-hero-fila">
          <span className="fa-ini" aria-hidden="true">{nombre[0]?.toUpperCase()}</span>
          <div className="fa-hero-txt">
            <h1 className="fa-nombre">{nombre}</h1>
            <p className="fa-correo">{f.perfil.email}</p>
            <div className="fa-chips">
              <span className="fa-chip fa-chip--plan">{f.perfil.plan}</span>
              <span className="fa-chip fa-chip--nivel">{f.perfil.nivel}</span>
              {inactiva && (
                <span className="fa-chip fa-chip--alerta">Sin entrar hace {f.actividad.diasSinEntrar} días</span>
              )}
            </div>
          </div>
        </div>

        <div className="fa-acciones">
          <a href="#mensajes" className="fa-btn fa-btn--lleno">
            <MessageCircle size={16} strokeWidth={2.2} aria-hidden="true" /> Escribirle
          </a>
          <a href="#vivo" className="fa-btn">
            <UserPlus size={16} strokeWidth={2.2} aria-hidden="true" /> Invitar a una clase
          </a>
          <Link href={editarPlan as never} className="fa-btn">
            <CreditCard size={16} strokeWidth={2.2} aria-hidden="true" /> Cambiar su plan
          </Link>
          <a href={`mailto:${f.perfil.email}`} className="fa-btn">
            <Mail size={16} strokeWidth={2.2} aria-hidden="true" /> Correo
          </a>
        </div>
      </header>

      <AdminAviso mensaje={success} tono="ok" />
      <AdminAviso mensaje={error} tono="error" />

      {/* Numeros de un vistazo */}
      <div className="fa-datos">
        {datos.map((d) => (
          <div key={d.etiqueta} className="fa-dato">
            <span className="fa-burbuja">{d.icono}</span>
            <p className="fa-dato-num">{d.valor}</p>
            <p className="fa-dato-etq">{d.etiqueta}</p>
          </div>
        ))}
      </div>

      <div className="fa-grilla">
        {/* Suscripcion */}
        <section className="fa-tarjeta">
          <div className="fa-tarjeta-cab">
            <span className="fa-burbuja"><CreditCard size={18} strokeWidth={2.2} aria-hidden="true" /></span>
            <h2 className="fa-h2">Su plan</h2>
          </div>
          {!f.suscripcion ? (
            <p className="fa-txt">
              No tiene ninguna suscripción registrada. Se registró el {fecha(f.perfil.registradaEl)}
              {!f.perfil.onboardingCompleto && " y no llegó a terminar el registro"}.
            </p>
          ) : (
            <div className="fa-plan">
              <p className="fa-txt">
                <strong>{f.suscripcion.plan}</strong> — {f.suscripcion.etiquetaEstado}
              </p>
              {f.suscripcion.seDaDeBaja && (
                <p className="fa-baja">
                  Pidió darse de baja. Mantiene el acceso hasta el {fecha(f.suscripcion.finDePeriodo)}.
                </p>
              )}
              {f.suscripcion.canceladaEl && (
                <p className="fa-txt">Se dio de baja el {fecha(f.suscripcion.canceladaEl)}.</p>
              )}
              <p className="fa-txt fa-txt--suave">
                Alumna desde el {fecha(f.perfil.registradaEl)}.
              </p>
            </div>
          )}
        </section>

        {/* Objetivos: lo que ella dijo que buscaba */}
        <section className="fa-tarjeta">
          <div className="fa-tarjeta-cab">
            <span className="fa-burbuja fa-burbuja--melo"><Target size={18} strokeWidth={2.2} aria-hidden="true" /></span>
            <div>
              <h2 className="fa-h2">Qué buscaba</h2>
              <p className="fa-sub">Lo eligió ella cuando se registró.</p>
            </div>
          </div>
          {f.perfil.objetivos.length === 0 ? (
            <p className="fa-txt">No completó esta parte.</p>
          ) : (
            <div className="fa-objetivos">
              {f.perfil.objetivos.map((o) => (
                <span key={o}><Sparkles size={12} strokeWidth={2.4} aria-hidden="true" /> {o}</span>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="fa-grilla">
        {/* Mensajes: la conversacion privada, y escribirle sin salir de aca */}
        <section id="mensajes" className="fa-tarjeta fa-ancla">
          <div className="fa-tarjeta-cab">
            <span className="fa-burbuja"><MessageCircle size={18} strokeWidth={2.2} aria-hidden="true" /></span>
            <div>
              <h2 className="fa-h2">Mensajes</h2>
              <p className="fa-sub">Le llega a su chat privado con vos.</p>
            </div>
            {salaId && <Link href={`/admin/mensajes?user=${id}` as never} className="fa-mini">Abrir chat</Link>}
          </div>
          {mensajes.length === 0 ? (
            <p className="fa-txt">Todavía no se escribieron. El primer mensaje abre la conversación.</p>
          ) : (
            <ul className="fa-conv">
              {mensajes.map((m) => {
                const mio = m.user_id !== id;
                return (
                  <li key={m.id} className={"fa-msj" + (mio ? " es-mio" : "")}>
                    <p>{m.content}</p>
                    <span>{mio ? (m.author_name ?? "Vos") : nombre} · {horaMsg(m.created_at)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <form action={enviarMensajeDesdeFichaAction} className="fa-enviar">
            <input type="hidden" name="alumnaId" value={id} />
            <textarea name="mensaje" required maxLength={2000} rows={2} placeholder={`Escribile a ${nombre}…`} aria-label={`Mensaje para ${nombre}`} />
            <BotonEnviar className="fa-btn fa-btn--lleno fa-enviar-btn" pendingLabel="Enviando…">
              <Send size={16} strokeWidth={2.2} aria-hidden="true" /> Enviar
            </BotonEnviar>
          </form>
        </section>

        {/* En vivo: lo que reservo, a que esta invitada, e invitarla */}
        <section id="vivo" className="fa-tarjeta fa-ancla">
          <div className="fa-tarjeta-cab">
            <span className="fa-burbuja fa-burbuja--melo"><CalendarDays size={18} strokeWidth={2.2} aria-hidden="true" /></span>
            <div>
              <h2 className="fa-h2">Clases en vivo</h2>
              <p className="fa-sub">Sus próximas reservas e invitaciones.</p>
            </div>
          </div>
          {reservas.length === 0 && invitaciones.length === 0 ? (
            <p className="fa-txt">No tiene reservas ni invitaciones para las próximas clases.</p>
          ) : (
            <ul className="fa-agenda">
              {reservas.map((r) => r.s && (
                <li key={"r" + r.s.id}>
                  <span className="fa-agenda-tag es-ok"><Check size={12} strokeWidth={3} aria-hidden="true" /> {r.estado === "waitlisted" ? "En espera" : "Reservó"}</span>
                  <span className="fa-agenda-txt"><strong>{resolveI18nText(r.s.title_i18n)}</strong> · {cuandoSes(r.s)}</span>
                </li>
              ))}
              {invitaciones.map((x) => (
                <li key={"i" + x.id}>
                  <span className="fa-agenda-tag">Invitada</span>
                  <span className="fa-agenda-txt"><strong>{resolveI18nText(x.title_i18n)}</strong> · {cuandoSes(x)}</span>
                  <form action={quitarInvitacionDesdeFichaAction}>
                    <input type="hidden" name="alumnaId" value={id} />
                    <input type="hidden" name="sesionId" value={x.id} />
                    <BotonEnviar className="fa-quitar" pendingLabel="…" title="Quitar invitación" confirmar="¿Quitarle la invitación? Si ya reservó, la reserva no se toca.">
                      <X size={14} strokeWidth={2.4} aria-hidden="true" />
                    </BotonEnviar>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {invitables.length > 0 ? (
            <form action={invitarDesdeFichaAction} className="fa-invitar">
              <input type="hidden" name="alumnaId" value={id} />
              <Desplegable
                name="sesionId"
                required
                placeholder="Elegí una clase en vivo"
                opciones={invitables.map((x) => ({ value: x.id, label: `${resolveI18nText(x.title_i18n)} · ${cuandoSes(x)}` }))}
              />
              <BotonEnviar className="fa-btn fa-btn--lleno" pendingLabel="Invitando…">
                <UserPlus size={16} strokeWidth={2.2} aria-hidden="true" /> Invitar
              </BotonEnviar>
            </form>
          ) : (
            <p className="fa-txt fa-txt--suave">No hay clases programadas para invitarla.</p>
          )}
        </section>
      </div>

      {compras.length > 0 && (
        <section className="fa-tarjeta">
          <div className="fa-tarjeta-cab">
            <span className="fa-burbuja fa-burbuja--salvia"><Package size={18} strokeWidth={2.2} aria-hidden="true" /></span>
            <h2 className="fa-h2">Packs que compró</h2>
          </div>
          <ul className="fa-agenda">
            {compras.map((c) => (
              <li key={c.id}>
                <span className="fa-agenda-tag es-ok"><Check size={12} strokeWidth={3} aria-hidden="true" /> Pagado</span>
                <span className="fa-agenda-txt"><strong>{c.nombre}</strong> · {fecha(c.cuando)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Clases */}
      <section className="fa-tarjeta">
        <div className="fa-tarjeta-cab">
          <span className="fa-burbuja fa-burbuja--salvia"><BookOpen size={18} strokeWidth={2.2} aria-hidden="true" /></span>
          <h2 className="fa-h2">Sus últimas clases</h2>
        </div>
        {f.clases.length === 0 ? (
          <div className="fa-vacio">
            <span className="fa-burbuja"><PlayCircle size={20} strokeWidth={2.2} aria-hidden="true" /></span>
            <p className="fa-txt">
              Todavía no empezó ninguna clase.
              {f.suscripcion && " Tiene plan activo, así que puede ser un buen momento para escribirle."}
            </p>
          </div>
        ) : (
          <ul className="fa-clases">
            {f.clases.map((c) => (
              <li key={c.videoId} className="fa-clase">
                <div className="fa-clase-txt">
                  <p className="fa-clase-titulo">{c.titulo}</p>
                  <p className="fa-clase-fecha">{fecha(c.cuando)}</p>
                </div>
                <div className="fa-clase-der">
                  {!c.terminada && (
                    <span className="fa-barra" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, c.porcentaje))}%` }} /></span>
                  )}
                  <span className={"fa-estado" + (c.terminada ? " es-ok" : "")}>
                    {c.terminada ? "Terminada" : `${c.porcentaje}%`}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

const CSS = `
.fa-ancla { scroll-margin-top: 84px; display: flex; flex-direction: column; gap: 14px; }
.fa-ancla .fa-tarjeta-cab { margin-bottom: 0; }
.fa-mini { margin-left: auto; align-self: center; padding: 7px 14px; border-radius: 99px; background: var(--rubor); color: var(--pink-deep); font-size: 12.5px; font-weight: 800; text-decoration: none; white-space: nowrap; }
.fa-mini:hover { background: var(--pink-wash); }
.fa-conv { list-style: none; margin: 0; padding: 14px; display: flex; flex-direction: column; gap: 8px; border-radius: 20px; background: var(--crema); max-height: 320px; overflow-y: auto; }
.fa-msj { max-width: 82%; align-self: flex-start; }
.fa-msj p { padding: 9px 13px; border-radius: 16px 16px 16px 6px; background: #fff; border: 1px solid var(--linea); font-size: 13.5px; line-height: 1.5; color: var(--ink); white-space: pre-wrap; }
.fa-msj span { display: block; margin: 3px 6px 0; font-size: 11px; color: var(--muted); }
.fa-msj.es-mio { align-self: flex-end; text-align: right; }
.fa-msj.es-mio p { background: var(--pink-mid); border-color: var(--pink-mid); color: #fff; border-radius: 16px 16px 6px 16px; text-align: left; }
.fa-enviar { display: flex; gap: 10px; align-items: flex-end; }
.fa-enviar textarea { flex: 1; min-height: 48px; resize: vertical; border-radius: 20px; border: 1.5px solid var(--linea-fuerte); padding: 12px 16px; font: inherit; font-size: 14px; color: var(--ink); background: #fff; outline: none; transition: border-color .2s, box-shadow .2s; }
.fa-enviar textarea:focus { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.1); }
.fa-enviar-btn { flex-shrink: 0; cursor: pointer; font-family: inherit; }
.fa-agenda { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.fa-agenda li { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 16px; background: var(--crema); border: 1px solid #F6EAE4; }
.fa-agenda-tag { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; padding: 3px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 800; background: #FFF4E8; color: var(--melocoton-deep); }
.fa-agenda-tag.es-ok { background: var(--salvia); color: var(--salvia-deep); }
.fa-agenda-txt { flex: 1; min-width: 0; font-size: 13.5px; color: var(--muted); }
.fa-agenda-txt strong { color: var(--ink); font-weight: 800; }
.fa-quitar { width: 30px; height: 30px; border-radius: 50%; border: 0; display: grid; place-items: center; background: #fff; color: var(--muted); cursor: pointer; transition: background .2s, color .2s; }
.fa-quitar:hover { background: var(--pink-wash); color: var(--pink-deep); }
.fa-invitar { display: flex; gap: 10px; align-items: center; }
.fa-invitar .dsp { flex: 1; min-width: 0; }
.fa-invitar .fa-btn { flex-shrink: 0; cursor: pointer; font-family: inherit; }
@media (max-width: 560px) { .fa-enviar, .fa-invitar { flex-direction: column; align-items: stretch; } .fa-acciones { flex-wrap: wrap; } }
.fa { display: flex; flex-direction: column; gap: 18px; padding-bottom: 60px; }
.fa-hero { position: relative; overflow: hidden; isolation: isolate; padding: clamp(22px, 3.4vw, 40px) clamp(20px, 3.4vw, 44px); border-radius: 32px; border: 1px solid var(--linea); background: linear-gradient(120deg, #FFF1EC 0%, #FFF7F3 55%, #FFEFE6 100%); }
.fa-hero::before, .fa-hero::after { content: ""; position: absolute; z-index: -1; border-radius: 50%; pointer-events: none; }
.fa-hero::before { width: 320px; height: 320px; right: -80px; top: -150px; background: radial-gradient(circle, rgba(255,205,185,.75), transparent 68%); animation: fa-flota 12s ease-in-out infinite alternate; }
.fa-hero::after { width: 220px; height: 220px; right: 24%; bottom: -150px; background: radial-gradient(circle, rgba(242,198,198,.65), transparent 70%); animation: fa-flota 15s ease-in-out infinite alternate-reverse; }
@keyframes fa-flota { from { transform: translate(0,0) scale(1); } to { transform: translate(-24px, 18px) scale(1.08); } }
.fa-volver { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px 7px 11px; border-radius: 99px; background: #fff; box-shadow: var(--sombra); font-size: 13px; font-weight: 800; color: var(--pink-deep); text-decoration: none; transition: gap .25s var(--curva), transform .3s var(--curva); }
.fa-volver:hover { gap: 9px; transform: translateY(-1px); }
.fa-hero-fila { display: flex; align-items: center; gap: 20px; margin-top: 22px; }
.fa-ini { width: 76px; height: 76px; border-radius: 26px; flex-shrink: 0; display: grid; place-items: center; background: linear-gradient(135deg, var(--melocoton), var(--pink-soft)); color: var(--pink-deep); font-weight: 900; font-size: 32px; box-shadow: var(--sombra); }
.fa-hero-txt { min-width: 0; }
.fa-nombre { font-weight: 900; font-size: clamp(30px, 4vw, 48px); line-height: 1.04; letter-spacing: -0.03em; color: var(--ink); overflow-wrap: anywhere; }
.fa-correo { margin-top: 4px; font-size: 15px; color: var(--muted); overflow-wrap: anywhere; }
.fa-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.fa-chip { padding: 6px 13px; border-radius: 99px; font-size: 12.5px; font-weight: 800; }
.fa-chip--plan { background: #fff; color: var(--pink-deep); border: 1px solid var(--pink-line); }
.fa-chip--nivel { background: #fff; border: 1px solid #F6D9C6; color: var(--melocoton-deep); text-transform: capitalize; }
.fa-chip--alerta { background: var(--melocoton); color: var(--melocoton-deep); }
.fa-acciones { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 24px; }
.fa-btn { display: inline-flex; align-items: center; gap: 8px; height: 46px; padding: 0 20px; border-radius: 99px; text-decoration: none; font-size: 14px; font-weight: 800; color: var(--ink); background: #fff; border: 1.5px solid var(--linea-fuerte); transition: transform .3s var(--curva), background .2s, border-color .2s, box-shadow .3s; }
.fa-btn:hover { transform: translateY(-2px); background: var(--rubor); border-color: var(--pink-line); }
.fa-btn--lleno { background: var(--pink); border-color: var(--pink); color: #fff; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); }
.fa-btn--lleno:hover { background: var(--pink-mid); border-color: var(--pink-mid); }

.fa-datos { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.fa-dato { padding: 18px 20px; border-radius: var(--radio); border: 1px solid var(--linea); box-shadow: var(--sombra); transition: transform .35s var(--curva), box-shadow .35s var(--curva); }
.fa-dato:hover { transform: translateY(-3px); box-shadow: var(--sombra-alta); }
.fa-dato:nth-child(5n+1) { background: linear-gradient(160deg, #FFE9E2, #FFF8F5 78%); }
.fa-dato:nth-child(5n+2) { background: linear-gradient(160deg, #FFEFE3, #FFFAF6 78%); }
.fa-dato:nth-child(5n+3) { background: linear-gradient(160deg, #FFEEDB, #FFFAF4 78%); }
.fa-dato:nth-child(5n+4) { background: linear-gradient(160deg, #FFEDE6, #FBF8FD 78%); }
.fa-dato:nth-child(5n+5) { background: linear-gradient(160deg, #FFE1E1, #FFF7F7 78%); }
.fa-dato .fa-burbuja { background: #fff; box-shadow: var(--sombra); }
.fa-dato-num { margin-top: 14px; font-weight: 900; font-size: 36px; line-height: 1; letter-spacing: -0.03em; color: var(--ink); }
.fa-dato-etq { margin-top: 6px; font-size: 13px; font-weight: 800; color: var(--muted); }

.fa-burbuja { width: 40px; height: 40px; border-radius: 14px; flex-shrink: 0; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); }
.fa-burbuja--melo { background: #FFF4E8; color: var(--melocoton-deep); }
.fa-burbuja--salvia { background: var(--salvia); color: var(--salvia-deep); }

.fa-grilla { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.fa-tarjeta { padding: 22px 24px; border-radius: 28px; background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra); }
.fa-tarjeta-cab { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.fa-h2 { font-weight: 900; font-size: 19px; letter-spacing: -0.02em; color: var(--ink); }
.fa-sub { margin-top: 2px; font-size: 13px; color: var(--muted); }
.fa-txt { font-size: 14px; line-height: 1.65; color: var(--muted); }
.fa-txt strong { color: var(--ink); font-weight: 800; }
.fa-txt--suave { font-size: 13px; }
.fa-plan { display: grid; gap: 6px; }
.fa-baja { padding: 10px 14px; border-radius: 14px; background: var(--rubor); font-size: 13.5px; font-weight: 800; color: var(--pink-deep); }
.fa-objetivos { display: flex; gap: 8px; flex-wrap: wrap; }
.fa-objetivos span { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 99px; font-size: 13px; font-weight: 800; background: #FFF4E8; color: var(--melocoton-deep); }

.fa-vacio { display: flex; align-items: center; gap: 14px; padding: 18px; border-radius: 20px; background: var(--crema); border: 1.5px dashed var(--linea-fuerte); }
.fa-clases { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.fa-clase { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 18px; border-radius: 20px; background: var(--crema); border: 1px solid var(--linea); transition: transform .3s var(--curva), border-color .2s; }
.fa-clase:hover { transform: translateX(3px); border-color: var(--linea-fuerte); }
.fa-clase-txt { min-width: 0; }
.fa-clase-titulo { font-size: 14.5px; font-weight: 800; color: var(--ink); }
.fa-clase-fecha { margin-top: 2px; font-size: 12.5px; color: var(--muted); }
.fa-clase-der { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.fa-barra { width: 90px; height: 8px; border-radius: 99px; background: var(--linea); overflow: hidden; }
.fa-barra > span { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #FFB49A, var(--pink)); }
.fa-estado { padding: 5px 12px; border-radius: 99px; font-size: 12.5px; font-weight: 800; white-space: nowrap; background: var(--rubor); color: var(--pink-deep); }
.fa-estado.es-ok { background: var(--salvia); color: var(--salvia-deep); }

@media (max-width: 1100px) { .fa-datos { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 760px) {
  .fa-datos { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .fa-dato { padding: 16px; }
  .fa-dato-num { font-size: 30px; }
  .fa-dato:last-child:nth-child(odd) { grid-column: 1 / -1; }
  .fa-grilla { grid-template-columns: 1fr; }
  .fa-hero-fila { align-items: flex-start; gap: 14px; }
  .fa-ini { width: 58px; height: 58px; border-radius: 20px; font-size: 24px; }
  .fa-tarjeta { padding: 18px; border-radius: 24px; }
  .fa-barra { display: none; }
}
@media (prefers-reduced-motion: reduce) { .fa-hero::before, .fa-hero::after { animation: none; } .fa-dato, .fa-clase { transition: none; } }
`;
