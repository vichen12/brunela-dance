"use client";
import { AutoDireccion } from "@/components/auto-direccion";

import { useEffect, useRef, useState } from "react";
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

const inp: React.CSSProperties = {
  width: "100%", borderRadius: 10, border: "1px solid #e7e5e4",
  background: "#fff", color: "#1c1917", padding: "9px 13px",
  fontSize: 13, outline: "none", fontFamily: "inherit",
};

const sel: React.CSSProperties = {
  ...inp, appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23a8a29e' strokeWidth='1.5' strokeLinecap='round' fill='none'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 34,
};

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", color: "#78716c", textTransform: "uppercase", marginBottom: 5 }}>
      {children}
    </span>
  );
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column" }}>
      <Lbl>{label}</Lbl>
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
    <form action={isNew ? createLiveSessionAction : updateLiveSessionAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {onGuardado && <CerrarAlGuardar onExito={onGuardado} />}
      {!isNew && <input type="hidden" name="id" value={session.id} />}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <F label="Dirección">
          <input style={inp} name="slug" required defaultValue={session?.slug ?? ""} placeholder="clase-ballet-lunes" />
          {/* Solo al CREAR. Al editar, regenerarla romperia los enlaces compartidos. */}
          <AutoDireccion desde="titleEs" activo={isNew} />
        </F>
        <F label="Estado">
          <select style={sel} name="status" defaultValue={session?.status ?? "draft"}>
            <option value="draft">Borrador</option>
            <option value="scheduled">Publicada</option>
            <option value="completed">Completada</option>
            <option value="canceled">Cancelada</option>
          </select>
        </F>

        <F label="Título en español">
          <input style={inp} name="titleEs" required defaultValue={session?.title_i18n?.es ?? ""} placeholder="Clase de Ballet — Lunes" />
        </F>

        <F label="Inicio (fecha y hora)">
          <input style={inp} name="startsAt" type="datetime-local" required defaultValue={toLocalDatetime(session?.starts_at ?? null)} />
        </F>
        <F label="Fin (fecha y hora)">
          <input style={inp} name="endsAt" type="datetime-local" required defaultValue={toLocalDatetime(session?.ends_at ?? null)} />
        </F>

        <F label="Plan que la puede ver">
          <select style={sel} name="membershipTierRequired" defaultValue={session?.membership_tier_required ?? "corps_de_ballet"}>
            <option value="corps_de_ballet">Corps de Ballet</option>
            <option value="solista">Solista</option>
            <option value="principal">Principal</option>
          </select>
        </F>
        <F label="Capacidad">
          <input style={inp} name="capacity" type="number" min={1} required defaultValue={session?.capacity ?? 20} />
        </F>


      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <F label="Descripción en español">
          <textarea style={{ ...inp, minHeight: 72, resize: "vertical" }} name="descriptionEs" defaultValue={session?.description_i18n?.es ?? ""} placeholder="Descripción de la sesión…" />
        </F>
      </div>

      {/* Aca habia un recuadro titulado "Enlace de acceso (Zoom)" con la grilla
          VACIA adentro: los campos se mudaron al bloque plegable "Enlace de
          Zoom" de mas abajo y el encabezado quedo huerfano. Brunela veia dos
          cosas casi homonimas y la primera no tenia nada. */}

        <BloqueAvanzado titulo="Traducción al inglés" cantidad={2}>
        <F label="Título en inglés">
          <input style={inp} name="titleEn" defaultValue={session?.title_i18n?.en ?? ""} placeholder="Ballet Class — Monday" />
        </F>
        <F label="Descripción en inglés">
          <textarea style={{ ...inp, minHeight: 72, resize: "vertical" }} name="descriptionEn" defaultValue={session?.description_i18n?.en ?? ""} placeholder="Session description..." />
        </F>
        </BloqueAvanzado>

        <BloqueAvanzado titulo="Reservas" cantidad={2}>
        <F label="Apertura de reservas">
          <input style={inp} name="bookingOpensAt" type="datetime-local" defaultValue={toLocalDatetime(session?.booking_opens_at ?? null)} />
        </F>
        <F label="Cierre de reservas">
          <input style={inp} name="bookingClosesAt" type="datetime-local" defaultValue={toLocalDatetime(session?.booking_closes_at ?? null)} />
        </F>
        </BloqueAvanzado>

        <BloqueAvanzado titulo="Enlace de Zoom" cantidad={2}>
          <F label="URL de ingreso">
            <input style={inp} name="zoomJoinUrl" type="url" defaultValue={session?.access_link?.join_url ?? ""} placeholder="https://zoom.us/j/..." />
          </F>
          <F label="Código de acceso">
            <input style={inp} name="zoomPasscode" defaultValue={session?.access_link?.passcode ?? ""} placeholder="123456" />
          </F>
        </BloqueAvanzado>

        <BloqueAvanzado titulo="Portada y zona horaria" cantidad={2}>
        <F label="URL de portada">
          <input style={inp} name="coverImageUrl" type="url" defaultValue={session?.cover_image_url ?? ""} placeholder="https://..." />
        </F>
        <F label="Zona horaria">
          <input style={inp} name="sessionTimezone" defaultValue={tz} placeholder="America/Buenos_Aires" />
        </F>
        </BloqueAvanzado>

      <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
        <button type="submit" style={{
          background: isNew ? "linear-gradient(135deg, var(--pink), var(--pink-mid))" : "#1c1917",
          color: "#fff", border: "none", borderRadius: 99,
          padding: "10px 24px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
          cursor: "pointer",
        }}>
          {isNew ? "CREAR SESION" : "GUARDAR CAMBIOS"}
        </button>
        {/* formAction en el boton, sin anidar formularios: ver la nota en
            app/admin/videos/page.tsx. Anidado, el parser descartaba este form y
            ELIMINAR terminaba llamando a updateLiveSessionAction. El id ya
            viaja en el hidden del formulario externo. */}
        {!isNew && (
          <BotonEnviar pendingLabel="Borrando…" formAction={deleteLiveSessionAction} style={{
            background: "transparent", color: "#ef4444", border: "1px solid #fecaca",
            borderRadius: 99, padding: "10px 22px", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.1em", cursor: "pointer",
          }}>ELIMINAR</BotonEnviar>
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
    <section style={{ marginTop: 22, borderTop: "1px solid #f0eeec", paddingTop: 20 }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#78716c", textTransform: "uppercase", marginBottom: 6 }}>
        Invitar a alguien en particular
      </p>
      <p style={{ fontSize: 12, color: "#78716c", lineHeight: 1.5, marginBottom: 14 }}>
        Quien invites entra a <strong>esta</strong> clase aunque su plan no le alcance.
        Sigue teniendo que reservar, y si el cupo está lleno queda en lista de espera.
      </p>

      <form
        action={inviteToLiveSessionAction}
        style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end", marginBottom: hay ? 16 : 0 }}
      >
        <input type="hidden" name="liveSessionId" value={session.id} />
        <F label="Correo o nombre de la alumna">
          <input style={inp} name="alumna" required placeholder="ana@ejemplo.com" autoComplete="off" />
        </F>
        <BotonEnviar pendingLabel="Invitando…" style={{
          background: "#1c1917", color: "#fff", border: "none", borderRadius: 99,
          padding: "10px 20px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
          cursor: "pointer", whiteSpace: "nowrap",
        }}>INVITAR</BotonEnviar>
      </form>

      {hay > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {session.invitations.map((i) => (
            <li
              key={i.user_id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                background: "#fafaf9", border: "1px solid #f0eeec", borderRadius: 10, padding: "8px 12px",
              }}
            >
              <span style={{ fontSize: 12.5, color: "#1c1917", minWidth: 0 }}>
                <strong style={{ fontWeight: 700 }}>{i.full_name || i.email}</strong>
                {i.full_name && (
                  <span style={{ color: "#a8a29e", marginLeft: 8, fontSize: 11.5 }}>{i.email}</span>
                )}
              </span>
              <form action={uninviteFromLiveSessionAction}>
                <input type="hidden" name="liveSessionId" value={session.id} />
                <input type="hidden" name="userId" value={i.user_id} />
                <BotonEnviar pendingLabel="…" style={{
                  background: "transparent", border: "none", color: "#a8a29e",
                  fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  padding: "4px 6px",
                }}>Quitar</BotonEnviar>
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
      <button
        onClick={() => setAbierto(true)}
        style={{
          padding: "6px 14px", borderRadius: 8, cursor: "pointer",
          border: "1px solid #f0eeec", background: "#fff",
          color: "#57534e", fontSize: 11, fontWeight: 700, fontFamily: "inherit",
        }}
      >Editar</button>

      {guardado && (
        <span style={{
          marginLeft: 8, fontSize: 10.5, fontWeight: 700,
          color: "#166534", background: "#f0fdf4",
          padding: "4px 10px", borderRadius: 99,
        }}>Guardado</span>
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
