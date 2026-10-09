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
import { AdminAviso, AdminCabecera, AdminCifras, AdminNueva } from "@/components/admin-ui";
import { CalendarDays, Check, Clock, Users, Video } from "lucide-react";
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

const STATUS_STYLE: Record<string, { clase: string; label: string }> = {
  draft:     { clase: "lv-chip--borrador", label: "Borrador" },
  scheduled: { clase: "lv-chip--ok", label: "Publicada" },
  completed: { clase: "lv-chip--hecha", label: "Completada" },
  canceled:  { clase: "lv-chip--cancelada", label: "Cancelada" },
};

const TIER_STYLE: Record<string, { clase: string; label: string }> = {
  corps_de_ballet: { clase: "lv-plan--corps", label: "Corps de Ballet" },
  solista:         { clase: "lv-plan--solista", label: "Solista" },
  principal:       { clase: "lv-plan--principal", label: "Principal" },
};

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
    <main className="lv">
      <style>{CSS}</style>

      <AdminCabecera
        eyebrow="Gestión de contenido"
        titulo="Sesiones en vivo"
        lede="Programá las clases en directo, definí el cupo y controlá quién puede reservar según su plan."
      />

      <AdminAviso mensaje={success} tono="ok" />
      <AdminAviso mensaje={error} tono="error" />

      {/* Stats row */}
      <AdminCifras items={[
        { value: total,     label: "Sesiones totales", sub: "en el sistema" },
        { value: scheduled, label: "Publicadas",        sub: "visibles a alumnas" },
        { value: upcoming,  label: "Próximas",          sub: "pendientes de dar" },
      ]} />

      {/* Create new session */}
      <AdminNueva titulo="Nueva sesión en vivo" sub="Fecha, cupo, plan y enlace de Zoom">
        <LiveForm />
      </AdminNueva>

      {/* Session list */}
      <section className="lv-seccion">
        <h2 className="lv-h2">Sesiones <span>{total}</span></h2>
        <AdminBuscador
          action="/admin/live"
          q={q}
          placeholder="Buscar por título o dirección…"
          filtros={[{ name: "estado", valor: fEstado, etiqueta: "Estado", opciones: ESTADOS_LIVE }]}
          total={totalSesiones ?? sessions.length}
          mostrando={sessions.length}
        />
        {sessions.length === 0 ? (
          <div className="lv-vacio">
            <div className="lv-vacio-burbujas" aria-hidden="true">
              <span><Video size={20} strokeWidth={2.2} /></span>
              <span><CalendarDays size={22} strokeWidth={2.2} /></span>
              <span><Users size={20} strokeWidth={2.2} /></span>
            </div>
            <p className="lv-vacio-titulo">
              {q || fEstado ? "Ninguna sesión coincide." : "Todavía no hay sesiones."}
            </p>
            <p className="lv-vacio-txt">
              {q || fEstado
                ? "Probá con otra palabra o con otro estado."
                : "Creá la primera desde «Nueva sesión en vivo», arriba: fecha, cupo y el enlace de Zoom."}
            </p>
          </div>
        ) : (
          <ul className="lv-lista">
            {sessions.map((session) => {
              const st = STATUS_STYLE[session.status] ?? STATUS_STYLE.draft;
              const tier = TIER_STYLE[session.membership_tier_required] ?? TIER_STYLE.corps_de_ballet;
              const startDate = new Date(session.starts_at);
              const isPast = startDate < new Date();

              return (
                <li key={session.id} className="lv-fila">
                  {/* Header row */}
                  <div className="lv-fila-cuerpo">
                    {/* Cover */}
                    <div className="lv-portada">
                      {session.cover_image_url ? (
                        <img src={session.cover_image_url} alt="" />
                      ) : (
                        <Video size={22} strokeWidth={2} aria-hidden="true" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="lv-info">
                      <div className="lv-titulo-fila">
                        <span className="lv-titulo">
                          {session.title_i18n.es ?? session.slug}
                        </span>
                        <span className={"lv-chip " + st.clase}>{st.label}</span>
                        <span className={"lv-chip " + tier.clase}>{tier.label}</span>
                      </div>
                      <div className="lv-meta">
                        <span className={"lv-hora" + (isPast ? " es-pasada" : "")}>
                          <Clock size={13} strokeWidth={2.2} aria-hidden="true" />
                          {/* perspectiva="admin": Brunela ve primero la hora de
                              la zona en la que programo la clase, que es la que
                              tiene en la cabeza. */}
                          <HoraSesion iso={session.starts_at} zonaEstudio={session.session_timezone} perspectiva="admin" />
                        </span>
                        <span className="lv-dato">
                          <Users size={13} strokeWidth={2.2} aria-hidden="true" />
                          {session.bookings_count} / {session.capacity} reservas
                        </span>
                        {session.invitations.length > 0 && (
                          <span className="lv-dato lv-dato--inv">
                            {session.invitations.length === 1
                              ? "1 invitada"
                              : `${session.invitations.length} invitadas`}
                          </span>
                        )}
                        {session.access_link && (
                          <span className="lv-dato lv-dato--ok"><Check size={13} strokeWidth={2.6} aria-hidden="true" /> Zoom OK</span>
                        )}
                      </div>
                    </div>

                    {/* Quick status change */}
                    <div className="lv-rapido">
                      {session.status === "draft" && (
                        <form action={updateStatusAction}>
                          <input type="hidden" name="id" value={session.id} />
                          <input type="hidden" name="status" value="scheduled" />
                          <BotonEnviar className="lv-accion lv-accion--publicar">Publicar</BotonEnviar>
                        </form>
                      )}
                      {session.status === "scheduled" && (
                        <form action={updateStatusAction}>
                          <input type="hidden" name="id" value={session.id} />
                          <input type="hidden" name="status" value="completed" />
                          <BotonEnviar className="lv-accion lv-accion--completar">Completar</BotonEnviar>
                        </form>
                      )}
                      {(session.status === "draft" || session.status === "scheduled") && (
                        <form action={updateStatusAction}>
                          <input type="hidden" name="id" value={session.id} />
                          <input type="hidden" name="status" value="canceled" />
                          <BotonEnviar className="lv-accion lv-accion--cancelar">Cancelar</BotonEnviar>
                        </form>
                      )}
                    </div>
                  </div>

                  {/* Edicion en panel lateral. Antes el formulario de 17
                      campos de CADA sesion vivia aca dentro de un <details>:
                      oculto, pero renderizado igual. */}
                  <div className="lv-pie">
                    <EditarSesion session={session} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

const CSS = `
.lv { display: flex; flex-direction: column; }
.lv .ad-nueva { margin-bottom: 26px; }
.lv-seccion { display: flex; flex-direction: column; }
.lv-h2 { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; font-size: 20px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.lv-h2 span { padding: 3px 11px; border-radius: 99px; background: var(--rubor); color: var(--pink-deep); font-size: 13px; font-weight: 800; letter-spacing: 0; }

.lv-lista { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.lv-fila { background: #fff; border: 1px solid var(--linea); border-radius: var(--radio); box-shadow: var(--sombra); transition: transform .35s var(--curva), box-shadow .35s var(--curva), border-color .2s; }
.lv-fila:hover { transform: translateY(-2px); box-shadow: var(--sombra-alta); border-color: var(--linea-fuerte); }
.lv-fila-cuerpo { display: flex; align-items: center; gap: 16px; padding: 16px 20px; flex-wrap: wrap; }
.lv-portada { width: 84px; height: 58px; border-radius: 18px; flex-shrink: 0; overflow: hidden; display: grid; place-items: center; background: linear-gradient(140deg, #FFE2D3, #FDECEC); color: var(--pink-deep); }
.lv-portada img { width: 100%; height: 100%; object-fit: cover; }
.lv-info { flex: 1 1 280px; min-width: 0; }
.lv-titulo-fila { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.lv-titulo { font-size: 16px; font-weight: 800; color: var(--ink); }
.lv-chip { padding: 4px 11px; border-radius: 99px; font-size: 12px; font-weight: 800; }
.lv-chip--ok { background: var(--salvia); color: var(--salvia-deep); }
.lv-chip--borrador { background: #FFF4E8; color: var(--melocoton-deep); }
.lv-chip--hecha { background: #F7F0FA; color: #7A4F8C; }
.lv-chip--cancelada { background: var(--rubor); color: var(--pink-deep); }
.lv-plan--corps { background: #fff; color: var(--pink-deep); border: 1px solid var(--pink-line); }
.lv-plan--solista { background: var(--rubor); color: var(--pink-deep); border: 1px solid var(--pink-line); }
.lv-plan--principal { background: var(--pink); color: #fff; }
.lv-meta { display: flex; align-items: center; gap: 8px 16px; flex-wrap: wrap; font-size: 13px; color: var(--muted); }
.lv-hora, .lv-dato { display: inline-flex; align-items: center; gap: 6px; }
.lv-hora { color: var(--ink); font-weight: 700; }
.lv-hora.es-pasada { color: var(--muted); font-weight: 500; }
.lv-dato--inv { color: var(--pink-deep); font-weight: 700; }
.lv-dato--ok { padding: 2px 10px; border-radius: 99px; background: var(--salvia); color: var(--salvia-deep); font-weight: 800; font-size: 12px; }
.lv-rapido { display: flex; gap: 6px; flex-shrink: 0; flex-wrap: wrap; }
.lv-accion { height: 34px; padding: 0 14px; border-radius: 99px; border: 1.5px solid transparent; cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 800; transition: transform .25s var(--curva), filter .2s; }
.lv-accion:hover { transform: translateY(-1px); filter: brightness(.97); }
.lv-accion--publicar { background: var(--salvia); color: var(--salvia-deep); border-color: #CFE3C9; }
.lv-accion--completar { background: #F7F0FA; color: #7A4F8C; border-color: #E9DAF0; }
.lv-accion--cancelar { background: #fff; color: var(--pink-deep); border-color: var(--pink-line); }
.lv-pie { display: flex; align-items: center; gap: 8px; padding: 12px 0 14px; border-top: 1px dashed var(--linea-fuerte); margin: 0 20px; }

.lv-vacio { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 14px; padding: 46px 24px; text-align: center; border-radius: 28px; background: var(--crema); border: 1.5px dashed var(--linea-fuerte); }
.lv-vacio-burbujas { display: flex; gap: 10px; margin-bottom: 6px; }
.lv-vacio-burbujas span { width: 46px; height: 46px; border-radius: 16px; display: grid; place-items: center; background: #fff; color: var(--pink-deep); box-shadow: var(--sombra); }
.lv-vacio-burbujas span:nth-child(2) { transform: translateY(-8px); background: var(--rubor); }
.lv-vacio-titulo { font-size: 20px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.lv-vacio-txt { max-width: 44ch; font-size: 14px; line-height: 1.6; color: var(--muted); }
@media (max-width: 760px) {
  .lv-fila-cuerpo { padding: 14px 16px; gap: 12px; }
  .lv-portada { width: 64px; height: 48px; border-radius: 14px; }
  .lv-pie { margin: 0 16px; }
}
@media (prefers-reduced-motion: reduce) { .lv-fila { transition: none; } .lv-fila:hover { transform: none; } }
`;
