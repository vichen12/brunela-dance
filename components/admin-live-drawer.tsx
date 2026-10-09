"use client";
import { Desplegable } from "@/components/desplegable";
import { AutoDireccion } from "@/components/auto-direccion";

import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Trash2, UserPlus } from "lucide-react";
import { useFormStatus } from "react-dom";
import { BotonEnviar } from "@/components/boton-enviar";
import { AdminDrawer, BloqueAvanzado } from "@/components/admin-drawer";
import {
  createLiveSessionAction,
  deleteLiveSessionAction,
  inviteToLiveSessionAction,
  uninviteFromLiveSessionAction,
  updateLiveSessionAction,
} from "@/src/features/admin/live-actions";

/**
 * Edicion de una sesion en vivo, en panel lateral.
 *
 * Es el formulario mas grande del panel: 17 campos. Antes vivian todos dentro
 * de un <details> por sesion, o sea renderizados siempre -- <details> oculta,
 * no desmonta. Aca el formulario no existe hasta abrir el panel.
 */

export type LiveSession = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  status: "draft" | "scheduled" | "completed" | "canceled";
  membership_tier_required: "corps_de_ballet" | "solista" | "principal";
  starts_at: string;
  ends_at: string;
  session_timezone: string;
  capacity: number;
  cover_image_url: string | null;
  booking_opens_at: string | null;
  booking_closes_at: string | null;
  bookings_count: number;
  access_link: { join_url: string; passcode: string | null } | null;
  /** Alumnas invitadas a mano, que entran aunque su plan no les alcance. */
  invitations: { user_id: string; full_name: string | null; email: string; note: string | null }[];
};

/* Estilos del formulario y de las invitaciones. Viven aca porque el mismo
   formulario se monta en la pagina (crear) y en el panel lateral (editar). */
const CSS = `
.lvf { display: flex; flex-direction: column; gap: 14px; }
.lvf-grilla { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px 16px; }
.lvf .pf-campo input, .lvf .pf-campo textarea { width: 100%; height: 48px; padding: 0 16px; border-radius: 16px; border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); font: inherit; font-size: 14px; outline: none; transition: border-color .2s, box-shadow .2s; }
.lvf .pf-campo textarea { height: auto; min-height: 92px; padding: 12px 16px; resize: vertical; line-height: 1.55; }
.lvf .pf-campo input:focus, .lvf .pf-campo textarea:focus { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.1); }
/* El bloque plegable trae su CSS dentro de AdminDrawer, que solo se monta al
   EDITAR. Al crear (formulario en la pagina) quedaba sin estilo: se repite aca. */
.lvf .adr-avanzado { border: 1px solid var(--linea); border-radius: 20px; background: #fff; transition: border-color .2s, background .2s; }
.lvf .adr-avanzado[open] { background: var(--crema); }
.lvf .adr-avanzado:hover { border-color: var(--linea-fuerte); }
.lvf .adr-avanzado > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 0 16px; }
.lvf .adr-avanzado > summary::-webkit-details-marker { display: none; }
.lvf .adr-avanzado-tit { flex: 1; font-size: 14px; font-weight: 800; color: var(--ink); }
.lvf .adr-avanzado-n { font-size: 12px; font-weight: 800; color: var(--melocoton-deep); background: var(--melocoton); padding: 3px 10px; border-radius: 99px; }
.lvf .adr-avanzado-flecha { color: var(--muted); transition: transform .3s; }
.lvf .adr-avanzado[open] .adr-avanzado-flecha { transform: rotate(180deg); }
.lvf .adr-avanzado-cuerpo { padding: 2px 16px 16px; display: grid; gap: 12px; }
.lvf-pie { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding-top: 6px; }
.lvf-pie .pf-borrar { margin-left: 0; }
.lvi { margin-top: 24px; padding: 20px; border-radius: 24px; background: linear-gradient(150deg, #FFF4E8, #FFFAF6 70%); border: 1px solid var(--linea); }
.lvi-cab { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.lvi-ico { width: 38px; height: 38px; border-radius: 13px; flex-shrink: 0; display: grid; place-items: center; background: #fff; color: var(--melocoton-deep); box-shadow: var(--sombra); }
.lvi-titulo { font-size: 16px; font-weight: 900; letter-spacing: -0.01em; color: var(--ink); }
.lvi-txt { font-size: 13.5px; line-height: 1.6; color: var(--muted); margin-bottom: 14px; }
.lvi-txt strong { color: var(--ink); }
.lvi-form { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: end; }
.lvi-form .pf-campo input { width: 100%; height: 48px; padding: 0 16px; border-radius: 16px; border: 1.5px solid var(--linea-fuerte); background: #fff; font: inherit; font-size: 14px; outline: none; }
.lvi-form .pf-campo input:focus { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.1); }
.lvi-form .pf-guardar { height: 48px; }
.lvi-lista { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.lvi-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 10px 10px 12px; border-radius: 18px; background: #fff; border: 1px solid var(--linea); }
.lvi-quien { display: flex; align-items: center; gap: 10px; min-width: 0; font-size: 13.5px; color: var(--ink); }
.lvi-ini { width: 32px; height: 32px; border-radius: 11px; flex-shrink: 0; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); font-weight: 900; font-size: 13px; }
.lvi-quien strong { font-weight: 800; }
.lvi-correo { margin-left: 6px; color: var(--muted); font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lvi-quitar { height: 32px; padding: 0 12px; border-radius: 99px; border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--muted); font: inherit; font-size: 12.5px; font-weight: 800; cursor: pointer; transition: background .2s, color .2s, border-color .2s; }
.lvi-quitar:hover { background: var(--rubor); color: var(--pink-deep); border-color: var(--pink-line); }
.lve-editar { display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 16px; border-radius: 99px; cursor: pointer; border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); font: inherit; font-size: 13px; font-weight: 800; transition: background .2s, border-color .2s, color .2s, transform .3s var(--curva); }
.lve-editar:hover { background: var(--pink); border-color: var(--pink); color: #fff; transform: translateY(-1px); }
.lve-ok { margin-left: 8px; display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 99px; font-size: 12px; font-weight: 800; color: var(--salvia-deep); background: var(--salvia); }
@media (max-width: 560px) { .lvi-form { grid-template-columns: 1fr; } .lvi-correo { display: none; } }
`;

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="pf-campo">
      <span className="pf-etq">{label}</span>
      {children}
    </label>
  );
}

function toLocalDatetime(iso: string | null) {
  if (!iso) return "";
  return iso.slice(0, 16);
}

/**
 * Cierra el panel cuando el guardado termino bien.
 * Un error navega y desmonta esto; si seguimos montados, guardo.
 * TIENE que estar dentro del <form>: useFormStatus lee el formulario padre.
 */
function CerrarAlGuardar({ onExito }: { onExito: () => void }) {
  const { pending } = useFormStatus();
  const enviando = useRef(false);
  useEffect(() => {
    if (enviando.current && !pending) onExito();
    enviando.current = pending;
  }, [pending, onExito]);
  return null;
}

/**
 * El formulario, uno solo.
 *
 * Lo usan los DOS caminos: crear (en la pagina, sin panel) y editar (dentro del
 * drawer). Tener una copia por camino garantiza que en unos meses uno tenga un
 * campo que el otro no.
 */
export function LiveForm({ session, onGuardado }: { session?: LiveSession; onGuardado?: () => void }) {
  const isNew = !session;
  const tz = session?.session_timezone ?? "America/Buenos_Aires";

  return (
    <form action={isNew ? createLiveSessionAction : updateLiveSessionAction} className="lvf">
      <style>{CSS}</style>
        {onGuardado && <CerrarAlGuardar onExito={onGuardado} />}
      {!isNew && <input type="hidden" name="id" value={session.id} />}

      <div className="lvf-grilla">
        <F label="Dirección">
          <input name="slug" required defaultValue={session?.slug ?? ""} placeholder="clase-ballet-lunes" />
          {/* Solo al CREAR. Al editar, regenerarla romperia los enlaces compartidos. */}
          <AutoDireccion desde="titleEs" activo={isNew} />
        </F>
        <F label="Estado">
          <Desplegable
            name="status" defaultValue={session?.status ?? "draft"}
            opciones={[
              { value: "draft", label: "Borrador" },
              { value: "scheduled", label: "Publicada" },
              { value: "completed", label: "Completada" },
              { value: "canceled", label: "Cancelada" },
            ]}
          />
        </F>

        <F label="Título en español">
          <input name="titleEs" required defaultValue={session?.title_i18n?.es ?? ""} placeholder="Clase de Ballet — Lunes" />
        </F>

        <F label="Inicio (fecha y hora)">
          <input name="startsAt" type="datetime-local" required defaultValue={toLocalDatetime(session?.starts_at ?? null)} />
        </F>
        <F label="Fin (fecha y hora)">
          <input name="endsAt" type="datetime-local" required defaultValue={toLocalDatetime(session?.ends_at ?? null)} />
        </F>

        <F label="Plan que la puede ver">
          <Desplegable
            name="membershipTierRequired" defaultValue={session?.membership_tier_required ?? "corps_de_ballet"}
            opciones={[
              { value: "corps_de_ballet", label: "Corps de Ballet" },
              { value: "solista", label: "Solista" },
              { value: "principal", label: "Principal" },
            ]}
          />
        </F>
        <F label="Capacidad">
          <input name="capacity" type="number" min={1} required defaultValue={session?.capacity ?? 20} />
        </F>


      </div>

      <div className="lvf-grilla">
        <F label="Descripción en español">
          <textarea name="descriptionEs" defaultValue={session?.description_i18n?.es ?? ""} placeholder="Descripción de la sesión…" />
        </F>
      </div>

      {/* Aca habia un recuadro titulado "Enlace de acceso (Zoom)" con la grilla
          VACIA adentro: los campos se mudaron al bloque plegable "Enlace de
          Zoom" de mas abajo y el encabezado quedo huerfano. Brunela veia dos
          cosas casi homonimas y la primera no tenia nada. */}

        <BloqueAvanzado titulo="Traducción al inglés" cantidad={2}>
        <F label="Título en inglés">
          <input name="titleEn" defaultValue={session?.title_i18n?.en ?? ""} placeholder="Ballet Class — Monday" />
        </F>
        <F label="Descripción en inglés">
          <textarea name="descriptionEn" defaultValue={session?.description_i18n?.en ?? ""} placeholder="Session description..." />
        </F>
        </BloqueAvanzado>

        <BloqueAvanzado titulo="Reservas" cantidad={2}>
        <F label="Apertura de reservas">
          <input name="bookingOpensAt" type="datetime-local" defaultValue={toLocalDatetime(session?.booking_opens_at ?? null)} />
        </F>
        <F label="Cierre de reservas">
          <input name="bookingClosesAt" type="datetime-local" defaultValue={toLocalDatetime(session?.booking_closes_at ?? null)} />
        </F>
        </BloqueAvanzado>

        <BloqueAvanzado titulo="Enlace de Zoom" cantidad={2}>
          <F label="URL de ingreso">
            <input name="zoomJoinUrl" type="url" defaultValue={session?.access_link?.join_url ?? ""} placeholder="https://zoom.us/j/..." />
          </F>
          <F label="Código de acceso">
            <input name="zoomPasscode" defaultValue={session?.access_link?.passcode ?? ""} placeholder="123456" />
          </F>
        </BloqueAvanzado>

        <BloqueAvanzado titulo="Portada y zona horaria" cantidad={2}>
        <F label="URL de portada">
          <input name="coverImageUrl" type="url" defaultValue={session?.cover_image_url ?? ""} placeholder="https://..." />
        </F>
        <F label="Zona horaria">
          <input name="sessionTimezone" defaultValue={tz} placeholder="America/Buenos_Aires" />
        </F>
        </BloqueAvanzado>

      <div className="lvf-pie">
        <button type="submit" className="pf-guardar">
          <Check size={16} strokeWidth={2.4} aria-hidden="true" /> {isNew ? "Crear sesión" : "Guardar cambios"}
        </button>
        {/* formAction en el boton, sin anidar formularios: ver la nota en
            app/admin/videos/page.tsx. Anidado, el parser descartaba este form y
            ELIMINAR terminaba llamando a updateLiveSessionAction. El id ya
            viaja en el hidden del formulario externo. */}
        {!isNew && (
          <BotonEnviar pendingLabel="Borrando…" confirmar="¿Borrar esta sesión en vivo? Se pierden sus reservas. No se puede deshacer." formAction={deleteLiveSessionAction} className="pf-borrar">
            <Trash2 size={15} strokeWidth={2.2} aria-hidden="true" /> Eliminar
          </BotonEnviar>
        )}
      </div>
    </form>
  );
}


/**
 * Invitaciones puntuales.
 *
 * ⚠️ VA FUERA DE <LiveForm>, NO ADENTRO. Un <form> dentro de otro <form> lo
 *    descarta el parser de HTML, y en este mismo archivo ya paso: el boton
 *    ELIMINAR terminaba llamando a updateLiveSessionAction. Cada invitacion es
 *    su propio formulario, asi que van todos como hermanos del principal.
 */
function Invitaciones({ session }: { session: LiveSession }) {
  const hay = session.invitations.length;

  return (
    <section className="lvi">
      <div className="lvi-cab">
        <span className="lvi-ico" aria-hidden="true"><UserPlus size={18} strokeWidth={2.2} /></span>
        <p className="lvi-titulo">Invitar a alguien en particular</p>
      </div>
      <p className="lvi-txt">
        Quien invites entra a <strong>esta</strong> clase aunque su plan no le alcance.
        Sigue teniendo que reservar, y si el cupo está lleno queda en lista de espera.
      </p>

      <form action={inviteToLiveSessionAction} className="lvi-form">
        <input type="hidden" name="liveSessionId" value={session.id} />
        <F label="Correo o nombre de la alumna">
          <input name="alumna" required placeholder="ana@ejemplo.com" autoComplete="off" />
        </F>
        <BotonEnviar pendingLabel="Invitando…" className="pf-guardar">Invitar</BotonEnviar>
      </form>

      {hay > 0 && (
        <ul className="lvi-lista">
          {session.invitations.map((i) => (
            <li key={i.user_id} className="lvi-item">
              <span className="lvi-quien">
                <span className="lvi-ini" aria-hidden="true">{(i.full_name || i.email)[0]?.toUpperCase()}</span>
                <strong>{i.full_name || i.email}</strong>
                {i.full_name && (
                  <span className="lvi-correo">{i.email}</span>
                )}
              </span>
              <form action={uninviteFromLiveSessionAction}>
                <input type="hidden" name="liveSessionId" value={session.id} />
                <input type="hidden" name="userId" value={i.user_id} />
                <BotonEnviar pendingLabel="…" className="lvi-quitar">Quitar</BotonEnviar>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** El boton de la fila y su panel. */
export function EditarSesion({ session }: { session: LiveSession }) {
  const [abierto, setAbierto] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    if (!guardado) return;
    const t = window.setTimeout(() => setGuardado(false), 2600);
    return () => window.clearTimeout(t);
  }, [guardado]);

  return (
    <>
      <style>{CSS}</style>
      <button type="button" onClick={() => setAbierto(true)} className="lve-editar">
        <Pencil size={14} strokeWidth={2.2} aria-hidden="true" /> Editar
      </button>

      {guardado && (
        <span className="lve-ok"><Check size={13} strokeWidth={2.6} aria-hidden="true" /> Guardado</span>
      )}

      <AdminDrawer
        abierto={abierto}
        titulo={session.title_i18n?.es ?? session.slug}
        subtitulo={`/${session.slug}`}
        onCerrar={() => setAbierto(false)}
      >
        <LiveForm
          session={session}
          onGuardado={() => { setAbierto(false); setGuardado(true); }}
        />
        <Invitaciones session={session} />
      </AdminDrawer>
    </>
  );
}
