import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, ArrowRight, CalendarCheck, Clock, Download, FileText, Hourglass, KeyRound, Lock,
  Paperclip, Sparkles, Users, Video,
} from "lucide-react";
import { requireUser } from "@/src/features/auth/guards";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { cancelLiveSessionBookingAction, reserveLiveSessionAction } from "@/src/features/studio/actions";
import { membershipTierLabel, resolveI18nText, type MembershipTier } from "@/src/features/studio/helpers";
import { idsMaterial } from "@/src/features/studio/material-sesion";
import { AdminAviso } from "@/components/admin-ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { HoraSesion } from "@/components/hora-sesion";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { firmarDescarga } from "@/src/lib/documents/storage";
import { ProveedorIcono } from "@/components/proveedor-icono";
import { ClaseInminente } from "@/components/clase-inminente";
import { proveedorDe, textoUnirse } from "@/src/features/studio/enlace-clase";

export const dynamic = "force-dynamic";

/**
 * Perfil de una clase en vivo, del lado de la alumna.
 *
 * QUIEN DECIDE QUE
 *   - Si la puede ver y reservar: RLS. La sesion se busca con el cliente DE LA
 *     ALUMNA; si no vuelve, es de un plan que no tiene (o no existe).
 *   - En ese caso se muestra igual la vitrina, con service_role y columnas
 *     ACOTADAS (sin metadata, sin enlace, sin codigo), como hace el listado
 *     de /dashboard/live. Reservarla fallaria en la base de todos modos.
 *   - El enlace, el codigo y el material se muestran SOLO con reserva. Esta
 *     vista se comporta igual para la admin: la profesora da la clase desde
 *     /admin/live/[id].
 *   - El material se lee con el cliente de la alumna: RLS de `documents`
 *     decide si ve cada uno, y recien ahi se firma (firmar es dar acceso).
 */

type Sesion = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  status: "draft" | "scheduled" | "completed" | "canceled";
  membership_tier_required: MembershipTier;
  starts_at: string;
  ends_at: string;
  session_timezone: string;
  capacity: number;
  cover_image_url: string | null;
};

const COLUMNAS_VITRINA = "id, slug, title_i18n, description_i18n, status, membership_tier_required, starts_at, ends_at, session_timezone, capacity, cover_image_url";
const RANGO: Record<string, number> = { none: 0, corps_de_ballet: 1, solista: 2, principal: 3 };
const TIPO_DOC: Record<string, string> = { pdf: "PDF", image: "Imagen", video: "Video", audio: "Audio", doc: "Word", other: "Archivo" };

export default async function DashboardLiveSesionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireUser();
  const { slug: slugCrudo } = await params;
  const slug = decodeURIComponent(slugCrudo);
  if (!/^[a-z0-9-]{1,120}$/i.test(slug)) notFound();
  const sp = (await searchParams) ?? {};
  const success = typeof sp.success === "string" ? sp.success : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  const aqui = `/dashboard/live/${slug}`;

  const supabase = await createSupabaseServerClient();
  const { data: accesible } = await supabase
    .from("live_sessions")
    .select(COLUMNAS_VITRINA + ", metadata")
    .eq("slug", slug)
    .maybeSingle<Sesion & { metadata: unknown }>();

  let sesion: Sesion | null = accesible;
  const bloqueada = !accesible;
  if (!accesible) {
    // Vitrina: solo lo publicado o ya dado, y sin nada que de acceso.
    const { data } = await createSupabaseAdminClient()
      .from("live_sessions")
      .select(COLUMNAS_VITRINA)
      .eq("slug", slug)
      .in("status", ["scheduled", "completed"])
      .maybeSingle<Sesion>();
    sesion = data;
  }
  // Un borrador no tiene perfil, tampoco para la admin desde esta vista.
  if (!sesion || sesion.status === "draft") notFound();

  const [{ data: reserva }, { data: invitacion }, { count: ocupadasCount }, perfil] = await Promise.all([
    supabase
      .from("live_session_bookings")
      .select("status")
      .eq("live_session_id", sesion.id)
      .eq("user_id", user.id)
      .maybeSingle<{ status: string }>(),
    supabase
      .from("live_session_invitations")
      .select("live_session_id")
      .eq("live_session_id", sesion.id)
      .eq("user_id", user.id)
      .maybeSingle(),
    // Solo la CUENTA, con service_role: la alumna no puede ver reservas ajenas
    // (y no tiene por que), pero si cuantos lugares quedan. Ningun nombre sale
    // de esta consulta.
    createSupabaseAdminClient()
      .from("live_session_bookings")
      .select("id", { count: "exact", head: true })
      .eq("live_session_id", sesion.id)
      .in("status", ["reserved", "attended", "missed"]),
    getCurrentProfile(user.id),
  ]);

  const estado = reserva?.status ?? null;
  const reservo = estado === "reserved";
  const enEspera = estado === "waitlisted";
  const tuvoLugar = estado === "reserved" || estado === "attended" || estado === "missed";
  const pasada = sesion.status !== "scheduled" || new Date(sesion.ends_at).getTime() < Date.now();
  const ocupadas = ocupadasCount ?? 0;
  const libres = Math.max(0, sesion.capacity - ocupadas);
  const pct = Math.min(100, Math.round((ocupadas / Math.max(1, sesion.capacity)) * 100));

  // Enlace: solo con reserva y antes de que termine.
  // Con el cliente DE ELLA: RLS (can_current_user_view_live_session_link) es
  // quien decide. Nunca service_role para esto.
  let enlace: { join_url: string; passcode: string | null; provider: string | null } | null = null;
  if (!bloqueada && reservo && !pasada) {
    const { data } = await supabase
      .from("live_session_access_links")
      .select("join_url, passcode, provider")
      .eq("live_session_id", sesion.id)
      .maybeSingle<{ join_url: string; passcode: string | null; provider: string | null }>();
    enlace = data ?? null;
  }
  const proveedor = enlace ? proveedorDe(enlace.provider, enlace.join_url) : null;
  // Falta 1 h o menos, o esta en curso: cartel con cuenta regresiva arriba.
  const ahoraMs = Date.now();
  const inminente = reservo && !pasada && new Date(sesion.starts_at).getTime() - ahoraMs <= 3600 * 1000;

  // Material: solo con lugar (reservado, o ya dada la clase con su lugar).
  type Doc = { id: string; title: string; description: string | null; file_url: string; file_type: string; file_size_kb: number | null; membership_tier_required: string };
  let material: (Doc & { href: string })[] = [];
  if (!bloqueada && tuvoLugar && accesible) {
    const ids = idsMaterial(accesible.metadata);
    if (ids.length) {
      const { data } = await supabase
        .from("documents")
        .select("id, title, description, file_url, file_type, file_size_kb, membership_tier_required")
        .in("id", ids)
        .eq("is_published", true);
      // Segunda barrera, igual que /dashboard/documents: lo caro no es leer el
      // titulo, es FIRMAR. Un plan desconocido se trata como inalcanzable.
      const mio = RANGO[perfil?.membership_tier ?? "none"] ?? 0;
      const visibles = ((data ?? []) as Doc[])
        .filter((d) => RANGO[d.membership_tier_required] !== undefined && mio >= RANGO[d.membership_tier_required])
        .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
      material = (await Promise.all(visibles.map(async (d) => ({ ...d, href: await firmarDescarga(d.file_url) })))).filter((d) => d.href);
    }
  }

  const titulo = resolveI18nText(sesion.title_i18n);
  const descripcion = resolveI18nText(sesion.description_i18n).trim();
  const minutos = Math.round((new Date(sesion.ends_at).getTime() - new Date(sesion.starts_at).getTime()) / 60000);
  const f = partesFecha(sesion.starts_at, sesion.session_timezone);
  const peso = (kb: number | null) => (!kb ? "" : kb >= 1000 ? ` · ${(kb / 1000).toFixed(1)} MB` : ` · ${kb} KB`);

  return (
    <main className="sp">
      <style>{CSS}</style>
      <section className="sp-shell">
        <Link href="/dashboard/live" className="sp-volver"><ArrowLeft size={15} strokeWidth={2.4} aria-hidden="true" /> Clases en vivo</Link>

        <AdminAviso mensaje={success} tono="ok" />
        <AdminAviso mensaje={error} tono="error" />

        {inminente && (
          <ClaseInminente
            titulo={titulo}
            inicio={sesion.starts_at}
            fin={sesion.ends_at}
            joinUrl={enlace?.join_url ?? null}
            proveedor={proveedor}
            passcode={enlace?.passcode ?? null}
            perfil={null}
          />
        )}

        <div className={"sp-portada" + (bloqueada ? " es-bloqueada" : "")}>
          {sesion.cover_image_url ? (
            <img src={sesion.cover_image_url} alt="" />
          ) : (
            <span className="sp-portada-vacia" aria-hidden="true"><Video size={46} strokeWidth={1.6} /></span>
          )}
          {bloqueada && (
            <span className="sp-portada-candado"><Lock size={14} strokeWidth={2.6} aria-hidden="true" /> Disponible desde {membershipTierLabel(sesion.membership_tier_required)}</span>
          )}
        </div>

        <div className="sp-grilla">
          <div className="sp-main">
            <div className="sp-chips">
              <span className="sp-chip es-plan">{membershipTierLabel(sesion.membership_tier_required)}</span>
              {invitacion && <span className="sp-chip es-invitada"><Sparkles size={12} strokeWidth={2.6} aria-hidden="true" /> Invitada por Brunela</span>}
              {sesion.status === "completed" && <span className="sp-chip">Clase ya dada</span>}
            </div>
            <h1 className="sp-titulo">{titulo}</h1>
            <p className="sp-hora">
              <Clock size={17} strokeWidth={2.2} aria-hidden="true" />
              <HoraSesion iso={sesion.starts_at} zonaEstudio={sesion.session_timezone} />
            </p>

            <ul className="sp-datos">
              {minutos > 0 && <li><Hourglass size={14} strokeWidth={2.2} aria-hidden="true" /> {minutos} minutos</li>}
              <li><Users size={14} strokeWidth={2.2} aria-hidden="true" /> {sesion.capacity} lugares</li>
              {!pasada && <li className={libres === 0 ? "es-lleno" : ""}>{libres === 0 ? "Sin lugares libres" : `${libres} ${libres === 1 ? "lugar libre" : "lugares libres"}`}</li>}
            </ul>
            {!pasada && (
              <span className="sp-barra" role="img" aria-label={`${ocupadas} de ${sesion.capacity} lugares ocupados`}><span style={{ width: `${pct}%` }} /></span>
            )}

            {descripcion && <p className="sp-desc">{descripcion}</p>}

            {/* ── Material ── */}
            {!bloqueada && (
              <section className="sp-material" aria-labelledby="sp-mat">
                <header className="sp-material-cab">
                  <span className="sp-ico" aria-hidden="true"><Paperclip size={18} strokeWidth={2.2} /></span>
                  <h2 id="sp-mat" className="sp-h2">Material de la clase</h2>
                </header>
                {!tuvoLugar ? (
                  <div className="sp-material-vacio">
                    <span className="sp-material-candado" aria-hidden="true"><Lock size={18} strokeWidth={2.2} /></span>
                    <p><b>El material aparece cuando reservás.</b> Si Brunela prepara algo para esta clase, lo vas a encontrar acá.</p>
                  </div>
                ) : material.length === 0 ? (
                  <div className="sp-material-vacio">
                    <span className="sp-material-candado" aria-hidden="true"><FileText size={18} strokeWidth={2.2} /></span>
                    <p>Por ahora no hay material para esta clase. Si Brunela sube algo, aparece acá.</p>
                  </div>
                ) : (
                  <ul className="sp-docs">
                    {material.map((d) => (
                      <li key={d.id}>
                        <a href={d.href} target="_blank" rel="noreferrer" className="sp-doc">
                          <span className="sp-doc-ico" aria-hidden="true"><FileText size={19} strokeWidth={2} /></span>
                          <span className="sp-doc-txt">
                            <span className="sp-doc-titulo">{d.title}</span>
                            <span className="sp-doc-meta">{TIPO_DOC[d.file_type] ?? "Archivo"}{peso(d.file_size_kb)}{d.description ? ` · ${d.description}` : ""}</span>
                          </span>
                          <span className="sp-doc-bajar"><Download size={15} strokeWidth={2.4} aria-hidden="true" /> Abrir</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>

          {/* ── Tu lugar ── */}
          <aside className="sp-lugar" aria-label="Tu lugar en esta clase">
            <div className="sp-fecha" aria-hidden="true">
              <span>{f.semana}</span>
              <b>{f.dia}</b>
              <span>{f.mes}</span>
            </div>

            {bloqueada ? (
              <>
                <p className="sp-lugar-tit"><Lock size={16} strokeWidth={2.4} aria-hidden="true" /> Disponible desde {membershipTierLabel(sesion.membership_tier_required)}</p>
                <p className="sp-lugar-txt">Esta clase es del plan {membershipTierLabel(sesion.membership_tier_required)}. Con ese plan podés reservarla y ver su material.</p>
                <Link href="/dashboard/plan" className="sp-btn sp-btn--lleno">Ver planes <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" /></Link>
              </>
            ) : pasada ? (
              <>
                <p className="sp-lugar-tit">{sesion.status === "completed" || new Date(sesion.ends_at).getTime() < Date.now() ? "Esta clase ya pasó" : "Esta clase no está disponible"}</p>
                <p className="sp-lugar-txt">
                  {estado === "attended" ? "Estuviste. ¡Gracias por venir!" : estado === "missed" ? "Esta vez no llegaste. La próxima te esperamos." : tuvoLugar ? "Tenías tu lugar reservado." : "Mirá las próximas en la agenda."}
                </p>
                <Link href="/dashboard/live" className="sp-btn">Ver la agenda</Link>
              </>
            ) : reservo || enEspera ? (
              <>
                <p className={"sp-estado" + (enEspera ? " es-espera" : "")}>
                  <CalendarCheck size={15} strokeWidth={2.4} aria-hidden="true" /> {enEspera ? "Estás en lista de espera" : "Reservaste tu lugar"}
                </p>
                {enlace && proveedor ? (
                  <>
                    <a href={enlace.join_url} target="_blank" rel="noreferrer" className="sp-btn sp-btn--lleno sp-btn--unirse">
                      <ProveedorIcono proveedor={proveedor} size={18} /> {textoUnirse(proveedor)}
                    </a>
                    {enlace.passcode && (
                      <p className="sp-codigo"><KeyRound size={14} strokeWidth={2.4} aria-hidden="true" /> Código <b>{enlace.passcode}</b></p>
                    )}
                  </>
                ) : enEspera ? (
                  <p className="sp-lugar-txt">Si se libera un lugar, pasás a tenerlo y aparece acá el enlace.</p>
                ) : (
                  <p className="sp-sin-enlace">
                    <Video size={16} strokeWidth={2.3} aria-hidden="true" /> El enlace aparece acá antes de la clase
                  </p>
                )}
                <form action={cancelLiveSessionBookingAction}>
                  <input name="sessionId" type="hidden" value={sesion.id} />
                  <input name="redirectTo" type="hidden" value={aqui} />
                  <BotonEnviar className="sp-btn sp-btn--suave" pendingLabel="Cancelando…" confirmar="¿Cancelar tu reserva? Si la clase está llena, otra persona puede tomar tu lugar.">
                    Cancelar reserva
                  </BotonEnviar>
                </form>
              </>
            ) : (
              <>
                <p className="sp-lugar-tit">{libres === 0 ? "La clase está llena" : "Reservá tu lugar"}</p>
                <p className="sp-lugar-txt">
                  {libres === 0 ? "Podés anotarte igual: quedás en lista de espera y si alguien cancela, el lugar es tuyo." : "Al reservar aparecen acá el enlace para entrar y el material de la clase."}
                </p>
                <form action={reserveLiveSessionAction}>
                  <input name="sessionId" type="hidden" value={sesion.id} />
                  <input name="redirectTo" type="hidden" value={aqui} />
                  <BotonEnviar className="sp-btn sp-btn--lleno" pendingLabel="Reservando…">
                    <CalendarCheck size={17} strokeWidth={2.3} aria-hidden="true" /> {libres === 0 ? "Anotarme en espera" : "Reservar mi lugar"}
                  </BotonEnviar>
                </form>
              </>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

/** Dia, mes y dia de semana en la zona DEL ESTUDIO: igual en servidor y cliente. */
function partesFecha(iso: string, zona: string) {
  try {
    const d = new Date(iso);
    const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-ES", { ...o, timeZone: zona }).format(d).replace(".", "");
    return { dia: fmt({ day: "numeric" }), mes: fmt({ month: "long" }), semana: fmt({ weekday: "long" }) };
  } catch {
    return { dia: "—", mes: "", semana: "" };
  }
}

const CSS = `
.sp { padding-bottom: 80px; }
.sp-shell { max-width: 1180px; margin: 0 auto; padding: clamp(20px, 3vw, 40px) clamp(16px, 3.4vw, 48px) 0; display: flex; flex-direction: column; gap: 18px; }
.sp-volver { align-self: flex-start; display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 16px 0 12px; border-radius: 99px; background: #fff; border: 1.5px solid var(--linea-fuerte); color: var(--ink); font-size: 13.5px; font-weight: 800; text-decoration: none; transition: background .2s, border-color .2s, gap .25s var(--curva); }
.sp-volver:hover { background: var(--rubor); border-color: var(--pink-line); gap: 10px; }

@keyframes sp-entra { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.sp-portada { position: relative; aspect-ratio: 21 / 8; border-radius: 32px; overflow: hidden; background: linear-gradient(120deg, #FFE2D3, #FDECEC 55%, #FFF1EC); box-shadow: var(--sombra); animation: sp-entra .7s var(--curva) backwards; }
.sp-portada img { width: 100%; height: 100%; object-fit: cover; }
.sp-portada-vacia { position: absolute; inset: 0; display: grid; place-items: center; color: var(--pink-deep); }
.sp-portada-vacia::before, .sp-portada-vacia::after { content: ""; position: absolute; border-radius: 50%; filter: blur(2px); }
.sp-portada-vacia::before { width: 340px; height: 340px; left: -60px; top: -120px; background: radial-gradient(circle, rgba(255,190,160,.6), transparent 65%); }
.sp-portada-vacia::after { width: 300px; height: 300px; right: -40px; bottom: -140px; background: radial-gradient(circle, rgba(242,198,198,.7), transparent 65%); }
.sp-portada.es-bloqueada img { filter: saturate(.75); }
.sp-portada-candado { position: absolute; left: 18px; bottom: 18px; display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; border-radius: 99px; background: rgba(255,255,255,.92); color: var(--pink-deep); font-size: 13px; font-weight: 800; box-shadow: var(--sombra); }

.sp-grilla { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 26px; align-items: start; animation: sp-entra .7s .08s var(--curva) backwards; }
.sp-main { min-width: 0; display: flex; flex-direction: column; gap: 12px; }
.sp-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.sp-chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 99px; font-size: 12.5px; font-weight: 800; background: var(--crema); color: var(--muted); border: 1px solid var(--linea); }
.sp-chip.es-plan { background: var(--rubor); color: var(--pink-deep); border-color: var(--pink-line); }
.sp-chip.es-invitada { background: var(--melocoton); color: var(--melocoton-deep); border-color: transparent; }
.sp-titulo { font-size: clamp(30px, 4vw, 50px); font-weight: 900; line-height: 1.04; letter-spacing: -0.03em; color: var(--ink); overflow-wrap: anywhere; }
.sp-hora { display: inline-flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: var(--ink); }
.sp-hora svg { color: var(--pink-deep); flex-shrink: 0; }
.sp-datos { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.sp-datos li { display: inline-flex; align-items: center; gap: 7px; padding: 7px 13px 7px 10px; border-radius: 99px; background: #fff; border: 1px solid var(--linea); font-size: 13.5px; font-weight: 700; color: var(--ink); }
.sp-datos svg { color: var(--pink-deep); }
.sp-datos li.es-lleno { background: var(--rubor); color: var(--pink-deep); border-color: var(--pink-line); }
.sp-barra { display: block; max-width: 360px; height: 8px; border-radius: 99px; background: #FFE9DC; overflow: hidden; }
.sp-barra span { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #FFB59A, var(--pink)); }
.sp-desc { margin-top: 6px; max-width: 68ch; font-size: 15.5px; line-height: 1.7; color: #6E5550; white-space: pre-line; }

.sp-material { margin-top: 14px; padding: 20px 22px 22px; border-radius: 28px; background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra); }
.sp-material-cab { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.sp-ico { width: 40px; height: 40px; border-radius: 14px; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); flex-shrink: 0; }
.sp-h2 { font-size: 19px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.sp-material-vacio { display: flex; align-items: center; gap: 14px; padding: 16px 18px; border-radius: 20px; background: var(--crema); border: 1.5px dashed var(--linea-fuerte); font-size: 14px; line-height: 1.55; color: var(--muted); }
.sp-material-vacio b { color: var(--ink); }
.sp-material-candado { width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0; display: grid; place-items: center; background: #fff; color: var(--pink-deep); box-shadow: var(--sombra); }
.sp-docs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.sp-doc { display: flex; align-items: center; gap: 14px; padding: 12px 12px 12px 12px; border-radius: 20px; background: linear-gradient(150deg, #FFF6F2, #fff 70%); border: 1px solid var(--linea); color: var(--ink); text-decoration: none; transition: transform .3s var(--curva), box-shadow .3s, border-color .2s; }
.sp-doc:hover { transform: translateY(-2px); box-shadow: var(--sombra-alta); border-color: var(--pink-line); }
.sp-doc-ico { width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); }
.sp-doc-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.sp-doc-titulo { font-size: 15px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-doc-meta { font-size: 12.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-doc-bajar { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 99px; background: var(--pink); color: #fff; font-size: 13px; font-weight: 800; box-shadow: 0 10px 20px -12px rgba(230,79,85,.9); }

.sp-lugar { position: sticky; top: 24px; display: flex; flex-direction: column; gap: 12px; padding: 22px; border-radius: 30px; background: linear-gradient(160deg, #FFF1EC, #FFF8F4 60%, #fff); border: 1px solid var(--pink-line); box-shadow: var(--sombra-alta); }
.sp-lugar form { display: contents; }
.sp-fecha { align-self: flex-start; display: flex; align-items: baseline; gap: 8px; padding: 8px 16px; border-radius: 99px; background: #fff; color: var(--pink-deep); box-shadow: var(--sombra); }
.sp-fecha span { font-size: 13px; font-weight: 800; text-transform: capitalize; }
.sp-fecha b { font-size: 24px; font-weight: 900; color: var(--ink); line-height: 1; }
.sp-lugar-tit { display: flex; align-items: center; gap: 8px; font-size: 19px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.sp-lugar-tit svg { color: var(--pink-deep); }
.sp-lugar-txt { font-size: 14px; line-height: 1.6; color: var(--muted); }
.sp-estado { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 6px 13px; border-radius: 99px; background: var(--pink); color: #fff; font-size: 13px; font-weight: 800; }
.sp-estado.es-espera { background: #FFF4E8; color: var(--melocoton-deep); }
.sp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 50px; padding: 0 22px; border-radius: 99px; border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); font: inherit; font-size: 15px; font-weight: 800; text-decoration: none; cursor: pointer; transition: transform .3s var(--curva), background .2s, border-color .2s, box-shadow .3s; }
.sp-btn:hover { transform: translateY(-2px); background: var(--rubor); border-color: var(--pink-line); }
.sp-btn--lleno { background: var(--pink); border-color: var(--pink); color: #fff; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); }
.sp-btn--lleno:hover { background: var(--pink-mid); border-color: var(--pink-mid); }
.sp-btn--suave { height: 44px; font-size: 14px; color: var(--muted); }
.sp-btn--unirse { height: 56px; font-size: 16px; }
.sp-sin-enlace { display: flex; align-items: center; gap: 9px; padding: 12px 14px; border-radius: 16px; background: #fff; border: 1.5px dashed var(--pink-line); font-size: 14px; font-weight: 800; color: var(--pink-deep); line-height: 1.4; }
.sp-sin-enlace svg { flex-shrink: 0; }
.sp-codigo { display: flex; align-items: center; justify-content: center; gap: 7px; padding: 10px 14px; border-radius: 16px; background: #fff; border: 1px solid var(--linea); font-size: 13.5px; color: var(--muted); }
.sp-codigo svg { color: var(--pink-deep); }
.sp-codigo b { color: var(--ink); letter-spacing: .06em; font-size: 15px; }

@media (max-width: 900px) {
  .sp-grilla { grid-template-columns: minmax(0, 1fr); gap: 18px; }
  .sp-lugar { position: static; order: -1; }
}
@media (max-width: 560px) {
  .sp-portada { aspect-ratio: 16 / 10; border-radius: 24px; }
  .sp-material { padding: 16px; border-radius: 24px; }
  .sp-lugar { padding: 18px; border-radius: 26px; }
  .sp-doc-bajar { width: 36px; padding: 0; justify-content: center; font-size: 0; gap: 0; }
}
@media (prefers-reduced-motion: reduce) { .sp-portada, .sp-grilla { animation: none; } .sp-doc, .sp-btn { transition: none; } }
`;
