import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, CalendarCheck, Check, Clock, Download, ExternalLink, FileText, KeyRound, Link2,
  Paperclip, Plus, Trash2, UploadCloud, UserRound, Users, Video, X,
} from "lucide-react";
import { requireAdmin } from "@/src/features/auth/guards";
import { updateStatusAction } from "@/src/features/admin/live-actions";
import {
  adjuntarDocumentoASesionAction,
  quitarDocumentoDeSesionAction,
  subirMaterialDeSesionAction,
} from "@/src/features/admin/live-material-actions";
import { idsMaterial } from "@/src/features/studio/material-sesion";
import { CampoEnlace, EditarSesion, Invitaciones, type LiveSession } from "@/components/admin-live-drawer";
import { guardarEnlaceSesionAction, quitarEnlaceSesionAction } from "@/src/features/admin/live-enlace-actions";
import { NOMBRE_PROVEEDOR, proveedorDe } from "@/src/features/studio/enlace-clase";
import { ProveedorIcono } from "@/components/proveedor-icono";
import { AdminDocumentUpload } from "@/components/admin-document-upload";
import { AdminAviso } from "@/components/admin-ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { Desplegable } from "@/components/desplegable";
import { HoraSesion } from "@/components/hora-sesion";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { firmarDescarga } from "@/src/lib/documents/storage";

export const dynamic = "force-dynamic";

/**
 * Perfil de UNA sesion en vivo, para Brunela.
 *
 * Pedido de la duena: "que cada clase tenga un perfil, asi yo veo todo:
 * quienes se inscribieron, si tengo que subir documentos, etc.".
 *
 * Todo se lee con el cliente de la sesion (la admin pasa RLS por is_admin()).
 * Las escrituras son las mismas actions del listado, con `redirectTo` para
 * volver aca; el material tiene las suyas en live-material-actions.ts.
 */

const ESTADO_SESION: Record<string, { clase: string; label: string }> = {
  draft: { clase: "es-borrador", label: "Borrador" },
  scheduled: { clase: "es-publicada", label: "Publicada" },
  completed: { clase: "es-hecha", label: "Completada" },
  canceled: { clase: "es-cancelada", label: "Cancelada" },
};
const PLAN: Record<string, string> = { none: "Sin plan", corps_de_ballet: "Corps de Ballet", solista: "Solista", principal: "Principal" };
const PLAN_CLASE: Record<string, string> = { corps_de_ballet: "es-corps", solista: "es-solista", principal: "es-principal" };
const RANGO: Record<string, number> = { none: 0, corps_de_ballet: 1, solista: 2, principal: 3 };
const TIPO_DOC: Record<string, string> = { pdf: "PDF", image: "Imagen", video: "Video", audio: "Audio", doc: "Word", other: "Archivo" };

/** Grupos de inscriptas, en el orden en que Brunela los necesita. */
const GRUPOS: { estado: string; titulo: string; vacio?: string }[] = [
  { estado: "reserved", titulo: "Reservadas" },
  { estado: "waitlisted", titulo: "En lista de espera" },
  { estado: "attended", titulo: "Asistieron" },
  { estado: "missed", titulo: "Faltaron" },
];

type Perfil = { full_name: string | null; email: string; membership_tier: string; avatar_url: string | null };
type Reserva = { user_id: string; status: string; reserved_at: string; canceled_at: string | null; profiles: Perfil | Perfil[] | null };
type Doc = { id: string; title: string; file_url: string; file_type: string; membership_tier_required: string; is_published: boolean };

export default async function AdminLivePerfilPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const sp = (await searchParams) ?? {};
  const success = typeof sp.success === "string" ? sp.success : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  const aqui = `/admin/live/${id}`;

  const supabase = await createSupabaseServerClient();
  const [
    { data: sesionData },
    { data: linkData },
    { data: reservasData },
    { data: invitacionesData },
    { data: docsData },
  ] = await Promise.all([
    supabase
      .from("live_sessions")
      .select("id, slug, title_i18n, description_i18n, status, membership_tier_required, starts_at, ends_at, session_timezone, capacity, cover_image_url, booking_opens_at, booking_closes_at, metadata")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("live_session_access_links").select("join_url, passcode, provider").eq("live_session_id", id).maybeSingle(),
    supabase
      .from("live_session_bookings")
      .select("user_id, status, reserved_at, canceled_at, profiles(full_name, email, membership_tier, avatar_url)")
      .eq("live_session_id", id)
      .order("reserved_at", { ascending: true }),
    supabase.from("live_session_invitations").select("user_id, profiles(full_name, email)").eq("live_session_id", id),
    // Todos: para el desplegable de "adjuntar uno existente" y para resolver
    // los adjuntos. Son decenas, no miles.
    supabase
      .from("documents")
      .select("id, title, file_url, file_type, membership_tier_required, is_published")
      .order("title"),
  ]);
  if (!sesionData) notFound();

  const s = sesionData as Omit<LiveSession, "bookings_count" | "access_link" | "invitations"> & { metadata: unknown };
  const reservas = ((reservasData ?? []) as unknown as Reserva[]).map((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.user_id,
      estado: r.status,
      reservo: r.reserved_at,
      cancelo: r.canceled_at,
      nombre: p?.full_name?.trim() || p?.email?.split("@")[0] || "Alumna",
      correo: p?.email ?? "",
      plan: p?.membership_tier ?? "none",
      foto: p?.avatar_url ?? null,
    };
  });
  type FilaInv = { user_id: string; profiles: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null };
  const invitations = ((invitacionesData ?? []) as FilaInv[]).flatMap((i) => {
    const p = Array.isArray(i.profiles) ? i.profiles[0] : i.profiles;
    return p ? [{ user_id: i.user_id, full_name: p.full_name, email: p.email, note: null }] : [];
  });

  // Ocupan cupo las reservadas y, en una clase ya dada, las que asistieron o
  // faltaron. La lista de espera no.
  const ocupadas = reservas.filter((r) => ["reserved", "attended", "missed"].includes(r.estado)).length;
  const pct = Math.min(100, Math.round((ocupadas / Math.max(1, s.capacity)) * 100));
  const link = (linkData as { join_url: string; passcode: string | null; provider: string | null } | null) ?? null;
  const proveedor = link ? proveedorDe(link.provider, link.join_url) : null;

  const session: LiveSession = { ...s, bookings_count: ocupadas, access_link: link, invitations };

  // Material: ids del metadata, resueltos contra la tabla. Uno que ya no existe
  // (borrado desde Documentos) se muestra como tal para poder quitarlo.
  const docs = (docsData ?? []) as Doc[];
  const porId = new Map(docs.map((d) => [d.id, d]));
  const adjuntosIds = idsMaterial(s.metadata);
  const adjuntos = await Promise.all(
    adjuntosIds.map(async (docId) => {
      const d = porId.get(docId);
      return d ? { ...d, href: await firmarDescarga(d.file_url), falta: false } : { id: docId, falta: true as const };
    })
  );
  const disponibles = docs.filter((d) => !adjuntosIds.includes(d.id));

  const st = ESTADO_SESION[s.status] ?? ESTADO_SESION.draft;
  const titulo = s.title_i18n?.es || s.slug;
  const descripcion = s.description_i18n?.es?.trim() ?? "";
  const pasada = new Date(s.ends_at).getTime() < Date.now();
  const canceladas = reservas.filter((r) => r.estado === "canceled");
  const activas = reservas.length - canceladas.length;
  const fecha = (iso: string) =>
    new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: s.session_timezone || "Europe/Madrid" }).format(new Date(iso));

  const fila = (r: (typeof reservas)[number]) => (
    <li key={r.id}>
      <Link href={`/admin/users/${r.id}` as never} className="lp-alumna">
        {r.foto ? (
          <img src={r.foto} alt="" className="lp-avatar" />
        ) : (
          <span className="lp-avatar" aria-hidden="true">{r.nombre[0]?.toUpperCase()}</span>
        )}
        <span className="lp-alumna-txt">
          <span className="lp-alumna-nombre">{r.nombre}</span>
          <span className="lp-alumna-correo">{r.correo}</span>
        </span>
        <span className={"lp-plan " + (PLAN_CLASE[r.plan] ?? "es-sin")}>{PLAN[r.plan] ?? "Sin plan"}</span>
        <span className="lp-alumna-fecha">
          {r.estado === "canceled" && r.cancelo ? `Canceló ${fecha(r.cancelo)}` : `Reservó ${fecha(r.reservo)}`}
        </span>
      </Link>
    </li>
  );

  return (
    <main className="lp">
      <style>{CSS}</style>

      <Link href="/admin/live" className="lp-volver"><ArrowLeft size={15} strokeWidth={2.4} aria-hidden="true" /> Sesiones en vivo</Link>

      <AdminAviso mensaje={success} tono="ok" />
      <AdminAviso mensaje={error} tono="error" />

      {/* ── Enlace de la clase ──
          Pedido de la duena: "que el link lo pueda poner cuando quiera". Va
          arriba de todo y con su propio formulario: se carga o se cambia en
          cualquier momento, tambien minutos antes o durante la clase, sin abrir
          el cajon de edicion. Quien lo ve lo decide RLS: la admin y las que
          reservaron. */}
      <section id="enlace" className={"lp-enlace" + (link ? " tiene" : " falta")} aria-labelledby="lp-enl">
        <span className="lp-enlace-mancha" aria-hidden="true" />
        <div className="lp-enlace-cab">
          <span className="lp-enlace-ico" aria-hidden="true">
            {proveedor ? <ProveedorIcono proveedor={proveedor} size={22} /> : <Link2 size={21} strokeWidth={2.3} />}
          </span>
          <div className="lp-enlace-tit">
            <h2 id="lp-enl" className="lp-h2">Enlace de la clase</h2>
            {proveedor && link ? (
              <p className="lp-enlace-prov">
                <b>{NOMBRE_PROVEEDOR[proveedor]}</b>
                <a href={link.join_url} target="_blank" rel="noreferrer" className="lp-enlace-url">{link.join_url}</a>
              </p>
            ) : (
              <p className="lp-enlace-prov">Zoom, Google Meet o cualquier enlace https.</p>
            )}
          </div>
          {link && (
            <div className="lp-enlace-acc">
              {link.passcode && <span className="lp-enlace-cod"><KeyRound size={14} strokeWidth={2.4} aria-hidden="true" /> {link.passcode}</span>}
              <a href={link.join_url} target="_blank" rel="noreferrer" className="lp-btn lp-btn--dar">
                <ExternalLink size={15} strokeWidth={2.4} aria-hidden="true" /> Abrir
              </a>
              {/* Formulario propio, hermano del de guardar: nunca uno dentro de otro. */}
              <form action={quitarEnlaceSesionAction} className="lp-enlace-quitar">
                <input type="hidden" name="sessionId" value={s.id} />
                <BotonEnviar className="lp-btn lp-btn--quitar" pendingLabel="Quitando…" confirmar="¿Quitar el enlace? Las inscriptas dejan de verlo hasta que cargues otro.">
                  <Trash2 size={15} strokeWidth={2.4} aria-hidden="true" /> Quitar enlace
                </BotonEnviar>
              </form>
            </div>
          )}
        </div>

        {!link && (
          <p className="lp-enlace-aviso">
            <Clock size={16} strokeWidth={2.4} aria-hidden="true" />
            Todavía no cargaste el enlace. Las inscriptas lo van a ver apenas lo guardes.
          </p>
        )}

        <form action={guardarEnlaceSesionAction} className="lp-enlace-form">
          <input type="hidden" name="sessionId" value={s.id} />
          <div className="lp-enlace-url-campo">
            <CampoEnlace name="joinUrl" inicial={link?.join_url ?? ""} label={link ? "Cambiar el enlace" : "Pegá el enlace"} required />
          </div>
          <label className="pf-campo lp-enlace-cod-campo">
            <span className="pf-etq">Código (opcional)</span>
            <input name="passcode" defaultValue={link?.passcode ?? ""} placeholder="123456" autoComplete="off" />
          </label>
          <BotonEnviar className="pf-guardar lp-enlace-guardar" pendingLabel="Guardando…">
            <Check size={16} strokeWidth={2.4} aria-hidden="true" /> Guardar
          </BotonEnviar>
        </form>
      </section>

      {/* ── Cabecera ── */}
      <section className="lp-hero">
        <div className="lp-mancha" aria-hidden="true" />
        <div className="lp-portada">
          {s.cover_image_url ? <img src={s.cover_image_url} alt="" /> : <Video size={40} strokeWidth={1.8} aria-hidden="true" />}
        </div>
        <div className="lp-hero-txt">
          <div className="lp-chips">
            <span className={"lp-chip " + st.clase}>{st.label}</span>
            <span className={"lp-plan " + (PLAN_CLASE[s.membership_tier_required] ?? "")}>{PLAN[s.membership_tier_required]}</span>
            {pasada && s.status === "scheduled" && <span className="lp-chip es-hecha">Ya pasó · falta completarla</span>}
          </div>
          <h1 className="lp-titulo">{titulo}</h1>
          <p className="lp-hora">
            <Clock size={16} strokeWidth={2.2} aria-hidden="true" />
            <HoraSesion iso={s.starts_at} zonaEstudio={s.session_timezone} perspectiva="admin" />
          </p>
          <div className="lp-cupo">
            <div className="lp-cupo-fila">
              <span className="lp-cupo-num"><b>{ocupadas}</b> / {s.capacity}</span>
              <span className="lp-cupo-txt">
                {ocupadas >= s.capacity ? "Cupo completo" : `${s.capacity - ocupadas} ${s.capacity - ocupadas === 1 ? "lugar libre" : "lugares libres"}`}
              </span>
            </div>
            <span className="lp-barra" role="img" aria-label={`${ocupadas} de ${s.capacity} lugares ocupados`}>
              <span style={{ width: `${pct}%` }} />
            </span>
          </div>
          <div className="lp-acciones">
            {s.status === "scheduled" && link && (
              <a href={link.join_url} target="_blank" rel="noreferrer" className="lp-btn lp-btn--dar">
                {proveedor ? <ProveedorIcono proveedor={proveedor} size={16} /> : null} Dar la clase
              </a>
            )}
            <EditarSesion session={session} redirectTo={aqui} conInvitaciones={false} />
            {s.status === "draft" && (
              <form action={updateStatusAction}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="status" value="scheduled" />
                <input type="hidden" name="redirectTo" value={aqui} />
                <BotonEnviar className="lp-btn lp-btn--publicar" pendingLabel="Publicando…">Publicar</BotonEnviar>
              </form>
            )}
            {s.status === "scheduled" && (
              <form action={updateStatusAction}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="status" value="completed" />
                <input type="hidden" name="redirectTo" value={aqui} />
                <BotonEnviar className="lp-btn" pendingLabel="Guardando…"><Check size={15} strokeWidth={2.4} aria-hidden="true" /> Completar</BotonEnviar>
              </form>
            )}
            {(s.status === "draft" || s.status === "scheduled") && (
              <form action={updateStatusAction}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="status" value="canceled" />
                <input type="hidden" name="redirectTo" value={aqui} />
                <BotonEnviar className="lp-btn lp-btn--cancelar" pendingLabel="Cancelando…" confirmar="¿Cancelar esta sesión? Las alumnas la van a ver como cancelada.">
                  <X size={15} strokeWidth={2.4} aria-hidden="true" /> Cancelar
                </BotonEnviar>
              </form>
            )}
          </div>
        </div>
      </section>

      <div className="lp-grilla">
        {/* ── Inscriptas ── */}
        <section className="lp-bloque lp-inscriptas" aria-labelledby="lp-insc">
          <header className="lp-bloque-cab">
            <span className="lp-ico" aria-hidden="true"><Users size={18} strokeWidth={2.2} /></span>
            <h2 id="lp-insc" className="lp-h2">Inscriptas <span>{activas}</span></h2>
            {reservas.length > 0 && (
              <a href={`/api/admin/live/${s.id}/inscriptas`} className="lp-mini" download>
                <Download size={14} strokeWidth={2.4} aria-hidden="true" /> Descargar CSV
              </a>
            )}
          </header>

          {activas === 0 ? (
            <div className="lp-vacio">
              <span className="lp-vacio-ico" aria-hidden="true"><CalendarCheck size={20} strokeWidth={2.2} /></span>
              <p><b>Todavía no se anotó nadie.</b> Cuando una alumna reserve, aparece acá con su plan y la fecha.</p>
            </div>
          ) : (
            GRUPOS.map((g) => {
              const del = reservas.filter((r) => r.estado === g.estado);
              if (!del.length) return null;
              return (
                <div key={g.estado} className={"lp-grupo es-" + g.estado}>
                  <p className="lp-grupo-tit">{g.titulo} <span>{del.length}</span></p>
                  <ul className="lp-alumnas">{del.map(fila)}</ul>
                </div>
              );
            })
          )}

          {canceladas.length > 0 && (
            <details className="lp-canceladas">
              <summary>Cancelaron su reserva <span>{canceladas.length}</span></summary>
              <ul className="lp-alumnas">{canceladas.map(fila)}</ul>
            </details>
          )}
        </section>

        <div className="lp-col">
          {/* ── Material ── */}
          <section id="material" className="lp-bloque" aria-labelledby="lp-mat">
            <header className="lp-bloque-cab">
              <span className="lp-ico" aria-hidden="true"><Paperclip size={18} strokeWidth={2.2} /></span>
              <h2 id="lp-mat" className="lp-h2">Material de la clase <span>{adjuntos.length}</span></h2>
            </header>
            <p className="lp-nota">Las alumnas lo ven en la página de la clase cuando reservan.</p>

            {adjuntos.length > 0 && (
              <ul className="lp-docs">
                {adjuntos.map((d) => (
                  <li key={d.id} className="lp-doc">
                    <span className="lp-doc-ico" aria-hidden="true"><FileText size={17} strokeWidth={2.1} /></span>
                    <span className="lp-doc-txt">
                      {d.falta ? (
                        <span className="lp-doc-titulo es-falta">Documento borrado</span>
                      ) : (
                        <>
                          <span className="lp-doc-titulo">{d.title}</span>
                          <span className="lp-doc-meta">
                            {TIPO_DOC[d.file_type] ?? "Archivo"} · {d.membership_tier_required === "none" ? "Todas las alumnas" : PLAN[d.membership_tier_required]}
                            {!d.is_published && " · sin publicar"}
                          </span>
                          {/* RLS de documents decide: un documento de un plan mas
                              alto que el de la clase no lo ve quien reservo con
                              el plan justo. Se avisa, no se bloquea. */}
                          {(RANGO[d.membership_tier_required] ?? 0) > (RANGO[s.membership_tier_required] ?? 0) && (
                            <span className="lp-doc-aviso">Solo lo ven alumnas {PLAN[d.membership_tier_required]} o más</span>
                          )}
                          {!d.is_published && <span className="lp-doc-aviso">Sin publicar: las alumnas no lo ven</span>}
                        </>
                      )}
                    </span>
                    {!d.falta && d.href && (
                      <a href={d.href} target="_blank" rel="noreferrer" className="lp-icono-btn" aria-label={`Abrir ${d.title}`}>
                        <ExternalLink size={15} strokeWidth={2.3} />
                      </a>
                    )}
                    <form action={quitarDocumentoDeSesionAction}>
                      <input type="hidden" name="sessionId" value={s.id} />
                      <input type="hidden" name="documentId" value={d.id} />
                      <BotonEnviar className="lp-icono-btn lp-icono-btn--quitar" pendingLabel="…" title="Quitar de la clase (no borra el documento)">
                        <Trash2 size={15} strokeWidth={2.3} aria-hidden="true" /><span className="lp-sr">Quitar de la clase</span>
                      </BotonEnviar>
                    </form>
                  </li>
                ))}
              </ul>
            )}

            {disponibles.length > 0 && (
              <form action={adjuntarDocumentoASesionAction} className="lp-adjuntar">
                <input type="hidden" name="sessionId" value={s.id} />
                <label className="pf-campo">
                  <span className="pf-etq">Adjuntar un documento que ya subiste</span>
                  <Desplegable
                    name="documentId"
                    required
                    placeholder="Elegí un documento"
                    opciones={disponibles.map((d) => ({
                      value: d.id,
                      label: `${d.title} · ${d.membership_tier_required === "none" ? "Todas" : PLAN[d.membership_tier_required]}`,
                    }))}
                  />
                </label>
                <BotonEnviar className="pf-guardar" pendingLabel="Adjuntando…"><Plus size={16} strokeWidth={2.4} aria-hidden="true" /> Adjuntar</BotonEnviar>
              </form>
            )}

            <details className="lp-subir">
              <summary><UploadCloud size={16} strokeWidth={2.3} aria-hidden="true" /> Subir un documento nuevo</summary>
              <form action={subirMaterialDeSesionAction} className="lp-subir-form">
                <input type="hidden" name="sessionId" value={s.id} />
                <AdminDocumentUpload />
                <label className="pf-campo">
                  <span className="pf-etq">Título</span>
                  <input name="title" required placeholder="Secuencia de la barra" />
                </label>
                <label className="pf-campo">
                  <span className="pf-etq">Quién lo puede ver</span>
                  <Desplegable
                    name="membershipTierRequired"
                    defaultValue={s.membership_tier_required}
                    opciones={[
                      { value: "none", label: "Todas las alumnas" },
                      { value: "corps_de_ballet", label: "Corps de Ballet o más" },
                      { value: "solista", label: "Solista o más" },
                      { value: "principal", label: "Solo Principal" },
                    ]}
                  />
                </label>
                <p className="lp-nota">Se publica también en Documentos, para quien tenga ese plan.</p>
                <BotonEnviar className="pf-guardar" pendingLabel="Guardando…"><Check size={16} strokeWidth={2.4} aria-hidden="true" /> Subir y adjuntar</BotonEnviar>
              </form>
            </details>
          </section>

          {/* ── Invitadas ── */}
          <div className="lp-invitadas">
            <Invitaciones session={session} redirectTo={aqui} />
          </div>

          {/* ── Detalles: solo aca, nunca en la vista de alumna sin reserva ── */}
          <section className="lp-bloque" aria-labelledby="lp-det">
            <header className="lp-bloque-cab">
              <span className="lp-ico" aria-hidden="true"><UserRound size={18} strokeWidth={2.2} /></span>
              <h2 id="lp-det" className="lp-h2">Detalles</h2>
            </header>
            {descripcion ? <p className="lp-desc">{descripcion}</p> : <p className="lp-nota">Sin descripción. Se agrega desde Editar.</p>}
            <dl className="lp-datos">
              <div>
                <dt><Link2 size={14} strokeWidth={2.3} aria-hidden="true" /> Enlace</dt>
                <dd>{link && proveedor ? <>{NOMBRE_PROVEEDOR[proveedor]} · <a href="#enlace">cambiarlo arriba</a></> : <a href="#enlace">Cargarlo arriba</a>}</dd>
              </div>
              <div>
                <dt><KeyRound size={14} strokeWidth={2.3} aria-hidden="true" /> Código</dt>
                <dd>{link?.passcode ? <b className="lp-codigo">{link.passcode}</b> : "Sin código"}</dd>
              </div>
              <div>
                <dt>Dirección</dt>
                <dd>/{s.slug}</dd>
              </div>
              {(s.booking_opens_at || s.booking_closes_at) && (
                <div>
                  <dt>Reservas</dt>
                  <dd>
                    {s.booking_opens_at ? `abren ${fecha(s.booking_opens_at)}` : ""}
                    {s.booking_opens_at && s.booking_closes_at ? " · " : ""}
                    {s.booking_closes_at ? `cierran ${fecha(s.booking_closes_at)}` : ""}
                  </dd>
                </div>
              )}
            </dl>
            {s.status !== "draft" && (
              <Link href={`/dashboard/live/${s.slug}` as never} className="lp-mini lp-mini--ancho">
                Ver cómo la ve una alumna <ExternalLink size={13} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

const CSS = `
.lp { display: flex; flex-direction: column; gap: 18px; }
.lp-volver { align-self: flex-start; display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 16px 0 12px; border-radius: 99px; background: #fff; border: 1.5px solid var(--linea-fuerte); color: var(--ink); font-size: 13.5px; font-weight: 800; text-decoration: none; transition: background .2s, border-color .2s, gap .25s var(--curva); }
.lp-volver:hover { background: var(--rubor); border-color: var(--pink-line); gap: 10px; }

.lp-hero { position: relative; overflow: hidden; display: grid; grid-template-columns: minmax(0, 400px) minmax(0, 1fr); gap: 28px; padding: 22px; border-radius: 32px; background: linear-gradient(120deg, #FFF1EC, #FFF7F3 55%, #FFEFE6); border: 1px solid var(--linea); box-shadow: var(--sombra); }
.lp-mancha { position: absolute; right: -120px; top: -140px; width: 420px; height: 420px; border-radius: 50%; background: radial-gradient(circle, rgba(255,190,160,.45), transparent 65%); pointer-events: none; }
.lp-portada { position: relative; aspect-ratio: 16 / 10; border-radius: 24px; overflow: hidden; display: grid; place-items: center; background: linear-gradient(140deg, #FFE2D3, #FDECEC); color: var(--pink-deep); box-shadow: 0 18px 36px -24px rgba(176,70,70,.6); }
.lp-portada img { width: 100%; height: 100%; object-fit: cover; }
.lp-hero-txt { position: relative; min-width: 0; display: flex; flex-direction: column; gap: 12px; justify-content: center; }
.lp-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.lp-chip, .lp-plan { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 99px; font-size: 12.5px; font-weight: 800; white-space: nowrap; }
.lp-chip.es-publicada { background: var(--pink-wash); color: var(--pink-deep); border: 1px solid var(--pink-line); }
.lp-chip.es-borrador { background: #FFF4E8; color: var(--melocoton-deep); }
.lp-chip.es-hecha { background: #FFF0EA; color: #B4533A; }
.lp-chip.es-cancelada { background: #fff; color: var(--muted); border: 1px solid var(--linea-fuerte); }
.lp-plan.es-principal { background: var(--pink); color: #fff; }
.lp-plan.es-solista { background: var(--rubor); color: var(--pink-deep); border: 1px solid var(--pink-line); }
.lp-plan.es-corps { background: #fff; color: var(--pink-deep); border: 1px solid var(--pink-line); }
.lp-plan.es-sin { background: var(--crema); color: var(--muted); border: 1px solid var(--linea); }
.lp-titulo { font-size: clamp(28px, 3.4vw, 44px); font-weight: 900; line-height: 1.06; letter-spacing: -0.025em; color: var(--ink); overflow-wrap: anywhere; }
.lp-hora { display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; color: var(--ink); }
.lp-hora svg { color: var(--pink-deep); flex-shrink: 0; }
.lp-cupo { max-width: 420px; padding: 12px 16px 14px; border-radius: 20px; background: rgba(255,255,255,.8); border: 1px solid var(--linea); }
.lp-cupo-fila { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
.lp-cupo-num { font-size: 15px; font-weight: 800; color: var(--muted); }
.lp-cupo-num b { font-size: 26px; font-weight: 900; color: var(--ink); letter-spacing: -0.02em; }
.lp-cupo-txt { font-size: 13px; font-weight: 800; color: var(--pink-deep); }
.lp-barra { display: block; height: 10px; border-radius: 99px; background: #FFE9DC; overflow: hidden; }
.lp-barra span { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #FFB59A, var(--pink)); transition: width .8s var(--curva); }
.lp-acciones { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 4px; }
.lp-acciones form { display: contents; }
.lp-acciones .lve-editar { height: 44px; padding: 0 18px; font-size: 14px; }
.lp-btn { display: inline-flex; align-items: center; gap: 7px; height: 44px; padding: 0 18px; border-radius: 99px; border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); font: inherit; font-size: 14px; font-weight: 800; text-decoration: none; cursor: pointer; transition: transform .3s var(--curva), background .2s, border-color .2s; }
.lp-btn:hover { transform: translateY(-2px); background: var(--rubor); border-color: var(--pink-line); }
.lp-btn--dar, .lp-btn--publicar { background: var(--pink); border-color: var(--pink); color: #fff; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); }
.lp-btn--dar:hover, .lp-btn--publicar:hover { background: var(--pink-mid); border-color: var(--pink-mid); }
.lp-btn--cancelar { color: var(--pink-deep); border-color: var(--pink-line); }

.lp-grilla { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 18px; align-items: start; }
.lp-col { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
.lp-bloque { background: #fff; border: 1px solid var(--linea); border-radius: 28px; box-shadow: var(--sombra); padding: 20px 22px 22px; min-width: 0; scroll-margin-top: 20px; }
.lp-bloque-cab { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.lp-ico { width: 40px; height: 40px; border-radius: 14px; flex-shrink: 0; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); }
.lp-h2 { flex: 1; display: flex; align-items: center; gap: 10px; font-size: 19px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.lp-h2 span { padding: 2px 10px; border-radius: 99px; background: var(--rubor); color: var(--pink-deep); font-size: 13px; font-weight: 800; letter-spacing: 0; }
.lp-mini { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: 99px; background: #fff; border: 1.5px solid var(--linea-fuerte); color: var(--ink); font-size: 12.5px; font-weight: 800; text-decoration: none; white-space: nowrap; transition: background .2s, border-color .2s; }
.lp-mini:hover { background: var(--rubor); border-color: var(--pink-line); }
.lp-mini--ancho { margin-top: 14px; }
.lp-nota { font-size: 13px; line-height: 1.55; color: var(--muted); }

.lp-grupo + .lp-grupo { margin-top: 16px; }
.lp-grupo-tit { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 13px; font-weight: 800; color: var(--muted); }
.lp-grupo-tit span { padding: 1px 9px; border-radius: 99px; background: var(--crema); border: 1px solid var(--linea); font-size: 12px; color: var(--ink); }
.lp-grupo.es-waitlisted .lp-grupo-tit { color: var(--melocoton-deep); }
.lp-alumnas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.lp-alumna { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 12px; padding: 9px 12px 9px 9px; border-radius: 18px; background: var(--crema); border: 1px solid #F6EAE4; color: var(--ink); text-decoration: none; transition: background .2s, border-color .2s, transform .3s var(--curva); }
.lp-alumna:hover { background: var(--rubor); border-color: var(--pink-line); transform: translateX(2px); }
.lp-avatar { width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0; object-fit: cover; display: grid; place-items: center; background: linear-gradient(135deg, var(--melocoton), var(--pink-soft)); color: var(--pink-deep); font-size: 15px; font-weight: 900; }
.lp-alumna-txt { display: flex; flex-direction: column; min-width: 0; }
.lp-alumna-nombre { font-size: 14px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lp-alumna-correo { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lp-alumna .lp-plan { font-size: 11.5px; padding: 3px 10px; }
.lp-alumna-fecha { font-size: 12px; font-weight: 700; color: var(--muted); white-space: nowrap; }
.lp-canceladas { margin-top: 16px; }
.lp-canceladas > summary { list-style: none; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 8px 0 14px; border-radius: 99px; border: 1.5px solid var(--linea-fuerte); background: #fff; font-size: 13px; font-weight: 800; color: var(--muted); }
.lp-canceladas > summary::-webkit-details-marker { display: none; }
.lp-canceladas > summary span { padding: 1px 9px; border-radius: 99px; background: var(--crema); color: var(--ink); font-size: 12px; }
.lp-canceladas[open] > summary { margin-bottom: 10px; }
.lp-canceladas .lp-alumna { opacity: .75; }
.lp-vacio { display: flex; align-items: center; gap: 14px; padding: 18px; border-radius: 22px; background: var(--crema); border: 1.5px dashed var(--linea-fuerte); font-size: 14px; line-height: 1.55; color: var(--muted); }
.lp-vacio b { color: var(--ink); }
.lp-vacio-ico { width: 44px; height: 44px; border-radius: 15px; flex-shrink: 0; display: grid; place-items: center; background: #fff; color: var(--pink-deep); box-shadow: var(--sombra); }

.lp-docs { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.lp-doc { display: flex; align-items: center; gap: 12px; padding: 10px 10px 10px 12px; border-radius: 18px; background: linear-gradient(150deg, #FFF6F2, #fff 70%); border: 1px solid var(--linea); }
.lp-doc form { display: contents; }
.lp-doc-ico { width: 36px; height: 36px; border-radius: 12px; flex-shrink: 0; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); }
.lp-doc-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.lp-doc-titulo { font-size: 14px; font-weight: 800; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lp-doc-titulo.es-falta { color: var(--muted); font-style: normal; }
.lp-doc-meta { font-size: 12px; color: var(--muted); }
.lp-doc-aviso { align-self: flex-start; margin-top: 2px; padding: 2px 9px; border-radius: 99px; background: #FFF4E8; color: var(--melocoton-deep); font-size: 11.5px; font-weight: 800; }
.lp-icono-btn { width: 36px; height: 36px; flex-shrink: 0; display: grid; place-items: center; border-radius: 50%; border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); cursor: pointer; transition: background .2s, border-color .2s, color .2s; }
.lp-icono-btn:hover { background: var(--rubor); border-color: var(--pink-line); color: var(--pink-deep); }
.lp-icono-btn--quitar { color: var(--muted); }
.lp-adjuntar { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: end; margin-top: 16px; }
.lp-adjuntar .pf-guardar, .lp-subir-form .pf-guardar { height: 48px; display: inline-flex; align-items: center; gap: 7px; }
.lp-subir { margin-top: 12px; border: 1px solid var(--linea); border-radius: 20px; background: #fff; transition: background .2s, border-color .2s; }
.lp-subir[open] { background: var(--crema); }
.lp-subir:hover { border-color: var(--linea-fuerte); }
.lp-subir > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 9px; min-height: 50px; padding: 0 16px; font-size: 14px; font-weight: 800; color: var(--ink); }
.lp-subir > summary svg { color: var(--pink-deep); }
.lp-subir > summary::-webkit-details-marker { display: none; }
.lp-subir-form { display: flex; flex-direction: column; gap: 12px; padding: 4px 16px 16px; }
.lp-subir-form .pf-campo input, .lp-adjuntar .pf-campo input:not([type=hidden]) { width: 100%; height: 48px; padding: 0 16px; border-radius: 16px; border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); font: inherit; font-size: 14px; outline: none; }
.lp-subir-form .pf-campo input:focus { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.1); }
.lp-subir-form .pf-guardar { align-self: flex-start; }

.lp-invitadas .lvi { margin-top: 0; border-radius: 28px; box-shadow: var(--sombra); }
.lp-desc { font-size: 14.5px; line-height: 1.65; color: var(--ink); white-space: pre-line; }
.lp-datos { display: flex; flex-direction: column; gap: 8px; margin: 14px 0 0; }
.lp-datos > div { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 10px; align-items: baseline; padding: 10px 14px; border-radius: 16px; background: var(--crema); }
.lp-datos dt { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 800; color: var(--muted); }
.lp-datos dt svg { color: var(--pink-deep); }
.lp-datos dd { margin: 0; font-size: 13.5px; font-weight: 600; color: var(--ink); overflow-wrap: anywhere; }
.lp-datos dd a { color: var(--pink-deep); font-weight: 700; }
.lp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.lp-codigo { letter-spacing: .06em; font-weight: 900; }

.lp-enlace { position: relative; overflow: hidden; scroll-margin-top: 20px; display: flex; flex-direction: column; gap: 14px; padding: 22px 24px; border-radius: 30px; background: linear-gradient(120deg, #FFF1EC, #FFF8F4 55%, #FFEFE6); border: 1.5px solid var(--pink-line); box-shadow: var(--sombra-alta); }
.lp-enlace.falta { background: linear-gradient(120deg, #FFF4E8, #FFFAF6 60%, #FFEFE2); border-color: #F6D9C4; }
.lp-enlace-mancha { position: absolute; right: -90px; top: -120px; width: 320px; height: 320px; border-radius: 50%; background: radial-gradient(circle, rgba(255,190,160,.4), transparent 65%); pointer-events: none; }
.lp-enlace > :not(.lp-enlace-mancha) { position: relative; }
.lp-enlace-cab { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.lp-enlace-ico { width: 52px; height: 52px; border-radius: 18px; flex-shrink: 0; display: grid; place-items: center; background: var(--pink); color: #fff; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); }
.lp-enlace.falta .lp-enlace-ico { background: #fff; color: var(--melocoton-deep); box-shadow: var(--sombra); }
.lp-enlace-tit { flex: 1 1 260px; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.lp-enlace .lp-h2 { flex: none; font-size: 21px; }
.lp-enlace-prov { display: flex; align-items: baseline; gap: 8px; min-width: 0; font-size: 13.5px; color: var(--muted); }
.lp-enlace-prov b { flex-shrink: 0; color: var(--pink-deep); font-weight: 900; }
.lp-enlace-url { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-weight: 600; text-decoration: none; }
.lp-enlace-url:hover { color: var(--pink-deep); text-decoration: underline; }
.lp-enlace-acc { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lp-enlace-cod { display: inline-flex; align-items: center; gap: 6px; height: 44px; padding: 0 16px; border-radius: 99px; background: #fff; border: 1px solid var(--linea); font-size: 14px; font-weight: 900; letter-spacing: .06em; color: var(--ink); }
.lp-enlace-cod svg { color: var(--pink-deep); }
.lp-enlace-aviso { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 18px; background: var(--melocoton); color: var(--melocoton-deep); font-size: 14px; font-weight: 800; line-height: 1.45; }
.lp-enlace-aviso svg { flex-shrink: 0; }
.lp-enlace-form { display: grid; grid-template-columns: minmax(0, 1fr) 200px auto; gap: 12px; align-items: start; }
.lp-enlace-form .pf-campo input:not([type=hidden]) { width: 100%; height: 50px; padding: 0 16px; border-radius: 16px; border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); font: inherit; font-size: 14.5px; outline: none; transition: border-color .2s, box-shadow .2s; }
.lp-enlace-form .pf-campo input:focus { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.12); }
.lp-enlace-guardar { height: 50px; margin-top: 23px; display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }
.lp-enlace-quitar { display: contents; }
.lp-btn--quitar { color: var(--muted); }
.lp-btn--quitar:hover { color: var(--pink-deep); }
@media (max-width: 820px) {
  .lp-enlace { padding: 18px; border-radius: 26px; }
  .lp-enlace-form { grid-template-columns: minmax(0, 1fr); }
  .lp-enlace-guardar { margin-top: 0; justify-content: center; }
  .lp-enlace-acc { width: 100%; }
  .lp-enlace-acc > * { flex: 1 1 auto; justify-content: center; }
}

@media (max-width: 1100px) {
  .lp-grilla { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 820px) {
  .lp-hero { grid-template-columns: minmax(0, 1fr); gap: 16px; padding: 14px; border-radius: 26px; }
  .lp-portada { border-radius: 18px; }
}
@media (max-width: 560px) {
  .lp-bloque { padding: 16px; border-radius: 24px; }
  .lp-bloque-cab { flex-wrap: wrap; }
  .lp-alumna { grid-template-columns: auto minmax(0, 1fr) auto; }
  .lp-alumna-fecha { grid-column: 2 / -1; margin-top: -4px; }
  .lp-adjuntar { grid-template-columns: minmax(0, 1fr); }
  .lp-datos > div { grid-template-columns: minmax(0, 1fr); gap: 2px; }
  .lp-acciones > *, .lp-acciones form > * { flex: 1 1 auto; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) { .lp-barra span, .lp-alumna, .lp-btn { transition: none; } }
`;
