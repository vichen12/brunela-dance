import { CalendarPlus, Check, ChevronDown, Clock, Link2Off, Lock, Pencil, StickyNote, X } from "lucide-react";
import { BotonEnviar } from "@/components/boton-enviar";
import { Desplegable } from "@/components/desplegable";
import { ProveedorIcono } from "@/components/proveedor-icono";
import { NOMBRE_PROVEEDOR } from "@/src/features/studio/enlace-clase";
import {
  agendarSesionPrivadaAction, cancelarSesionPrivadaAction, editarSesionPrivadaAction,
} from "@/src/features/admin/sesiones-privadas-actions";
import {
  DURACIONES, DURACION_POR_DEFECTO, estadoVisible, fechaHoraCorta, isoAMadrid, proveedorDePrivada,
  type SesionPrivada,
} from "@/src/features/studio/sesiones-privadas-reglas";

/*
 * Piezas de las sesiones privadas en el panel: el formulario de agendar y la
 * lista con editar / cancelar. Las usan la ficha de la alumna y
 * /admin/sesiones-privadas.
 *
 * De SERVIDOR, sin estado: se renderizan desde paginas de servidor. Las
 * actions cruzan a BotonEnviar (cliente) como `formAction`, que es lo unico
 * que puede cruzar siendo funcion (trampa 6). Los iconos se dibujan aca.
 */

const OPCIONES_DURACION = DURACIONES.map((m) => ({ value: String(m), label: m === 60 ? "1 hora" : m === 120 ? "2 horas" : m > 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min` }));

function Campos({ fecha, hora, duracion, enlace, nota, idBase }: { fecha?: string; hora?: string; duracion?: number; enlace?: string | null; nota?: string | null; idBase: string }) {
  return (
    <>
      <label className="spa-campo">
        <span>Día</span>
        <input type="date" name="fecha" required defaultValue={fecha ?? ""} id={idBase + "-fecha"} />
      </label>
      <label className="spa-campo">
        <span>Hora <small>(Madrid)</small></span>
        <input type="time" name="hora" required step={300} defaultValue={hora ?? ""} />
      </label>
      <label className="spa-campo">
        <span>Duración</span>
        <Desplegable name="duracion" defaultValue={String(duracion ?? DURACION_POR_DEFECTO)} opciones={OPCIONES_DURACION} />
      </label>
      <label className="spa-campo spa-campo--ancho">
        <span>Enlace de Meet o Zoom <small>(opcional, lo podés cargar después)</small></span>
        <input type="url" name="enlace" inputMode="url" autoComplete="off" defaultValue={enlace ?? ""} placeholder="https://meet.google.com/…" />
      </label>
      <label className="spa-campo spa-campo--ancho">
        <span>Nota <small>(opcional, la ve ella)</small></span>
        <textarea name="nota" rows={2} maxLength={1000} defaultValue={nota ?? ""} placeholder="Ej.: trabajamos el port de bras. Tené a mano una silla." />
      </label>
    </>
  );
}

/**
 * Agendar. Con `alumnaId` va fijo (la ficha); con `alumnas` se elige de una
 * lista (la pantalla general y el calendario).
 */
export function FormAgendarPrivada({
  alumnaId, alumnas, volverA, fecha, nombre,
}: {
  alumnaId?: string;
  alumnas?: { id: string; nombre: string }[];
  volverA: string;
  /** "AAAA-MM-DD" para precargar el dia (desde el calendario). */
  fecha?: string;
  nombre?: string;
}) {
  return (
    <>
    <style>{CSS}</style>
    <form action={agendarSesionPrivadaAction} className="spa-form">
      <input type="hidden" name="volverA" value={volverA} />
      {alumnaId ? (
        <input type="hidden" name="alumnaId" value={alumnaId} />
      ) : (
        <label className="spa-campo spa-campo--ancho">
          <span>Alumna</span>
          <Desplegable name="alumnaId" required placeholder="Elegí a la alumna" opciones={(alumnas ?? []).map((a) => ({ value: a.id, label: a.nombre }))} />
        </label>
      )}
      <Campos fecha={fecha} idBase={"nueva-" + (alumnaId ?? "x")} />
      <div className="spa-pie">
        <p className="spa-ayuda">
          {nombre ? `A ${nombre} le llega un mensaje a su chat privado con el día y la hora.` : "A la alumna le llega un mensaje a su chat privado con el día y la hora."}
        </p>
        <BotonEnviar className="spa-btn spa-btn--lleno" pendingLabel="Agendando…">
          <CalendarPlus size={16} strokeWidth={2.2} aria-hidden="true" /> Agendar sesión
        </BotonEnviar>
      </div>
    </form>
    </>
  );
}

/** Las sesiones de una o varias alumnas, con editar y cancelar. */
export function ListaPrivadasAdmin({
  sesiones, volverA, nombreDe, vacio = "No hay sesiones privadas.",
}: {
  sesiones: SesionPrivada[];
  volverA: string;
  /** Si viene, se muestra el nombre de la alumna en cada fila (pantalla general). */
  nombreDe?: Record<string, string>;
  vacio?: string;
}) {
  if (sesiones.length === 0) return <><style>{CSS}</style><p className="spa-vacio">{vacio}</p></>;
  const ahora = Date.now();
  return (
    <>
    <style>{CSS}</style>
    <ul className="spa-lista">
      {sesiones.map((s) => {
        const estado = estadoVisible(s, ahora);
        const prov = proveedorDePrivada(s);
        const { fecha, hora } = isoAMadrid(s.starts_at);
        const editable = estado === "agendada";
        return (
          <li key={s.id} className={"spa-fila es-" + estado}>
            <div className="spa-fila-cab">
              <span className="spa-fila-ico" aria-hidden="true"><Lock size={15} strokeWidth={2.3} /></span>
              <div className="spa-fila-txt">
                <p className="spa-fila-titulo">
                  {nombreDe?.[s.alumna_id] ? <><a href={`/admin/users/${s.alumna_id}#privadas`}>{nombreDe[s.alumna_id]}</a> · </> : null}
                  {fechaHoraCorta(s.starts_at)}
                </p>
                <p className="spa-fila-meta">
                  <span><Clock size={12} strokeWidth={2.4} aria-hidden="true" /> {s.duracion_minutos} min</span>
                  {estado === "cancelada" ? (
                    <span className="spa-chip spa-chip--cancelada"><X size={11} strokeWidth={3} aria-hidden="true" /> Cancelada</span>
                  ) : estado === "hecha" ? (
                    <span className="spa-chip"><Check size={11} strokeWidth={3} aria-hidden="true" /> Hecha</span>
                  ) : prov ? (
                    <span className="spa-chip spa-chip--ok"><ProveedorIcono proveedor={prov} size={12} /> {NOMBRE_PROVEEDOR[prov]} listo</span>
                  ) : (
                    <span className="spa-chip spa-chip--falta"><Link2Off size={11} strokeWidth={2.6} aria-hidden="true" /> Sin enlace todavía</span>
                  )}
                </p>
                {s.nota && <p className="spa-fila-nota"><StickyNote size={12} strokeWidth={2.2} aria-hidden="true" /> {s.nota}</p>}
              </div>
            </div>

            {estado !== "cancelada" && (
              <details className="spa-editar">
                <summary>
                  <Pencil size={13} strokeWidth={2.2} aria-hidden="true" /> {editable && !prov ? "Editar o cargar el enlace" : "Editar"}
                  <ChevronDown size={14} strokeWidth={2} className="spa-flecha" aria-hidden="true" />
                </summary>
                <form action={editarSesionPrivadaAction} className="spa-form">
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="volverA" value={volverA} />
                  <Campos fecha={fecha} hora={hora} duracion={s.duracion_minutos} enlace={s.enlace} nota={s.nota} idBase={s.id} />
                  <div className="spa-pie">
                    {editable ? (
                      <BotonEnviar
                        className="spa-btn"
                        formAction={cancelarSesionPrivadaAction}
                        pendingLabel="Cancelando…"
                        confirmar="¿Cancelar esta sesión privada? Le avisamos por su chat."
                      >
                        <X size={15} strokeWidth={2.4} aria-hidden="true" /> Cancelar sesión
                      </BotonEnviar>
                    ) : <span />}
                    <BotonEnviar className="spa-btn spa-btn--lleno" pendingLabel="Guardando…">
                      <Check size={16} strokeWidth={2.4} aria-hidden="true" /> Guardar cambios
                    </BotonEnviar>
                  </div>
                </form>
              </details>
            )}
          </li>
        );
      })}
    </ul>
    </>
  );
}

/** Pastilla "1/2 este mes". */
export function CupoMes({ hechas, cupo }: { hechas: number; cupo: number }) {
  const lleno = hechas >= cupo;
  return (
    <>
      <style>{CSS}</style>
      <span className={"spa-cupo" + (lleno ? " es-lleno" : "")} title={`${hechas} de ${cupo} sesiones privadas este mes`}>
        <b>{hechas}/{cupo}</b> este mes
      </span>
    </>
  );
}

const CSS = `
.spa-form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 14px; padding: 16px; border-radius: 20px; background: var(--crema); border: 1px solid var(--linea); }
.spa-campo { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.spa-campo--ancho { grid-column: 1 / -1; }
.spa-campo > span { font-size: 12.5px; font-weight: 800; color: var(--ink); }
.spa-campo small { font-weight: 600; color: var(--muted); }
.spa-campo input, .spa-campo textarea { width: 100%; min-height: 44px; border-radius: 14px; border: 1.5px solid var(--linea-fuerte); padding: 10px 14px; font: inherit; font-size: 14px; color: var(--ink); background: #fff; outline: none; transition: border-color .2s, box-shadow .2s; }
.spa-campo textarea { resize: vertical; }
.spa-campo input:focus, .spa-campo textarea:focus { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.1); }
.spa-campo .dsp-boton { border-color: var(--linea-fuerte); }
.spa-pie { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.spa-ayuda { flex: 1 1 220px; font-size: 12.5px; color: var(--muted); }
.spa-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 44px; padding: 0 18px; border-radius: 99px; border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); font: inherit; font-size: 13.5px; font-weight: 800; cursor: pointer; transition: background .2s, border-color .2s, transform .3s var(--curva); }
.spa-btn:hover { background: var(--rubor); border-color: var(--pink-line); transform: translateY(-1px); }
.spa-btn--lleno { background: var(--pink); border-color: var(--pink); color: #fff; box-shadow: 0 12px 22px -14px rgba(230,79,85,.9); }
.spa-btn--lleno:hover { background: var(--pink-mid); border-color: var(--pink-mid); }
.spa-vacio { padding: 14px 16px; border-radius: 16px; background: var(--crema); font-size: 13.5px; color: var(--muted); }
.spa-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.spa-fila { padding: 12px 14px; border-radius: 18px; background: #fff; border: 1px solid var(--linea); }
.spa-fila.es-agendada { background: linear-gradient(120deg, #FFF6F0, #fff 70%); border-color: #F6D9C4; }
.spa-fila.es-cancelada { opacity: .65; }
.spa-fila.es-cancelada .spa-fila-titulo { text-decoration: line-through; }
.spa-fila-cab { display: flex; align-items: flex-start; gap: 12px; }
.spa-fila-ico { width: 34px; height: 34px; border-radius: 12px; flex-shrink: 0; display: grid; place-items: center; background: #FFF4E8; color: var(--melocoton-deep); }
.spa-fila-txt { flex: 1; min-width: 0; }
.spa-fila-titulo { font-size: 14.5px; font-weight: 900; color: var(--ink); text-transform: capitalize; }
.spa-fila-titulo a { color: inherit; text-decoration: none; }
.spa-fila-titulo a:hover { color: var(--pink-deep); text-decoration: underline; }
.spa-fila-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 4px; font-size: 12.5px; color: var(--muted); }
.spa-fila-meta > span { display: inline-flex; align-items: center; gap: 4px; }
.spa-chip { padding: 2px 9px; border-radius: 99px; font-size: 11.5px; font-weight: 800; background: var(--crema); color: var(--muted); }
.spa-chip--ok { background: var(--rubor); color: var(--pink-deep); }
.spa-chip--falta { background: var(--melocoton); color: var(--melocoton-deep); }
.spa-chip--cancelada { background: var(--crema); color: var(--muted); }
.spa-fila-nota { display: flex; gap: 6px; align-items: flex-start; margin-top: 6px; font-size: 13px; color: var(--muted); white-space: pre-wrap; }
.spa-fila-nota svg { margin-top: 3px; flex-shrink: 0; }
.spa-editar { margin-top: 8px; }
.spa-editar > summary { list-style: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 99px; font-size: 12.5px; font-weight: 800; color: var(--pink-deep); background: var(--rubor); user-select: none; }
.spa-editar > summary::-webkit-details-marker { display: none; }
.spa-editar > summary .spa-flecha { transition: transform .3s var(--curva); }
.spa-editar[open] > summary .spa-flecha { transform: rotate(180deg); }
.spa-editar[open] > .spa-form { margin-top: 10px; }
.spa-cupo { display: inline-flex; align-items: center; gap: 5px; padding: 4px 11px; border-radius: 99px; font-size: 12px; font-weight: 700; color: var(--melocoton-deep); background: #FFF4E8; white-space: nowrap; }
.spa-cupo b { font-weight: 900; }
.spa-cupo.es-lleno { background: var(--rubor); color: var(--pink-deep); }
@media (max-width: 640px) {
  .spa-form { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); padding: 14px; }
  .spa-campo:nth-of-type(3) { grid-column: 1 / -1; }
  .spa-pie .spa-btn { flex: 1 1 auto; }
}
`;
