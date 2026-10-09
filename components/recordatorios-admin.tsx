import Link from "next/link";
import { AlarmClock, ArrowRight, BellRing, CalendarCheck, Check, Link2Off, Users } from "lucide-react";
import { BotonEnviar } from "@/components/boton-enviar";
import { ProveedorIcono } from "@/components/proveedor-icono";
import { updateStatusAction } from "@/src/features/admin/live-actions";
import type { RecordatoriosAdminDatos } from "@/src/features/admin/recordatorios";

/**
 * Tarjeta "Recordatorios" de la admin: arriba de /admin/live y en /admin.
 *
 * Sin "use client" y sin estado: la renderiza una pagina de servidor
 * (/admin/live) y un componente de cliente (el panel de /admin). Recibe solo
 * cadenas y numeros; los iconos se dibujan aca (trampa 6).
 *
 * "Completar" usa la misma action del listado (updateStatusAction, con
 * requireAdmin adentro). `volverA` tiene que ser /admin/live o el perfil de
 * una sesion: la action rechaza cualquier otra ruta y vuelve al listado.
 */
export function RecordatoriosAdmin({ datos, volverA }: { datos: RecordatoriosAdminDatos; volverA: string }) {
  const { sinEnlace, proxima, sinCompletar, sinCompletarTotal } = datos;
  const pendientes = sinEnlace.length + sinCompletarTotal;

  if (!proxima && pendientes === 0) {
    return (
      <section className="rca rca--calma" aria-label="Recordatorios">
        <style>{CSS}</style>
        <span className="rca-ico" aria-hidden="true"><Check size={18} strokeWidth={2.6} /></span>
        <p className="rca-calma-txt"><b>Estás al día.</b> No hay clases en vivo pendientes de enlace ni de completar.</p>
      </section>
    );
  }

  return (
    <section className="rca" aria-labelledby="rca-tit">
      <style>{CSS}</style>
      <span className="rca-mancha" aria-hidden="true" />
      <header className="rca-cab">
        <span className="rca-ico" aria-hidden="true"><BellRing size={19} strokeWidth={2.3} /></span>
        <h2 id="rca-tit" className="rca-tit">Recordatorios</h2>
        {pendientes > 0 && <span className="rca-cuenta">{pendientes} {pendientes === 1 ? "pendiente" : "pendientes"}</span>}
      </header>

      <ul className="rca-lista">
        {sinEnlace.map((s) => (
          <li key={"se" + s.id} className="rca-fila es-falta">
            <span className="rca-fila-ico" aria-hidden="true"><Link2Off size={17} strokeWidth={2.3} /></span>
            <p className="rca-fila-txt">
              <b>{s.titulo}</b> es {s.dia} {s.hora} y no tiene enlace
              <span>Las inscriptas no tienen por dónde entrar hasta que lo cargues.</span>
            </p>
            <Link href={`/admin/live/${s.id}#enlace` as never} className="rca-btn rca-btn--lleno">
              Cargar enlace <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" />
            </Link>
          </li>
        ))}

        {proxima && (
          <li className={"rca-fila es-proxima" + (proxima.enCurso ? " es-ya" : "")}>
            <span className="rca-fila-ico" aria-hidden="true"><AlarmClock size={17} strokeWidth={2.3} /></span>
            <p className="rca-fila-txt">
              {proxima.enCurso ? <>En curso: </> : proxima.esHoy ? <>Hoy {proxima.hora}: </> : <>Próxima, {proxima.dia} {proxima.hora}: </>}
              <b>{proxima.titulo}</b>
              <span>
                <Users size={13} strokeWidth={2.4} aria-hidden="true" /> {proxima.inscriptas} {proxima.inscriptas === 1 ? "inscripta" : "inscriptas"} de {proxima.capacidad}
              </span>
            </p>
            <span className="rca-acc">
              {proxima.joinUrl && proxima.proveedor && (proxima.enCurso || proxima.esHoy) && (
                <a href={proxima.joinUrl} target="_blank" rel="noreferrer" className="rca-btn rca-btn--lleno">
                  <ProveedorIcono proveedor={proxima.proveedor} size={15} /> Dar la clase
                </a>
              )}
              <Link href={`/admin/live/${proxima.id}` as never} className="rca-btn">Ver la clase</Link>
            </span>
          </li>
        )}

        {sinCompletar.map((s) => (
          <li key={"sc" + s.id} className="rca-fila es-completar">
            <span className="rca-fila-ico" aria-hidden="true"><CalendarCheck size={17} strokeWidth={2.2} /></span>
            <p className="rca-fila-txt">
              <b>{s.titulo}</b> ya terminó ({s.fecha}). ¿Marcar como completada?
            </p>
            <form action={updateStatusAction} className="rca-acc">
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="status" value="completed" />
              <input type="hidden" name="redirectTo" value={volverA} />
              <BotonEnviar className="rca-btn" pendingLabel="Guardando…">
                <Check size={14} strokeWidth={2.6} aria-hidden="true" /> Completar
              </BotonEnviar>
            </form>
          </li>
        ))}
        {sinCompletarTotal > sinCompletar.length && (
          <li className="rca-mas">
            <Link href={"/admin/live?cuando=pasadas&estado=scheduled" as never}>
              Y {sinCompletarTotal - sinCompletar.length} más sin completar <ArrowRight size={13} strokeWidth={2.4} aria-hidden="true" />
            </Link>
          </li>
        )}
      </ul>
    </section>
  );
}

const CSS = `
.rca { position: relative; overflow: hidden; margin-bottom: 22px; padding: 20px 22px; border-radius: 28px; background: linear-gradient(120deg, #FFF1EC, #FFF8F4 55%, #FFEFE6); border: 1px solid var(--pink-line); box-shadow: var(--sombra); }
.rca-mancha { position: absolute; right: -100px; top: -130px; width: 320px; height: 320px; border-radius: 50%; background: radial-gradient(circle, rgba(255,190,160,.4), transparent 65%); pointer-events: none; }
.rca > :not(.rca-mancha) { position: relative; }
.rca-cab { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.rca-ico { width: 42px; height: 42px; border-radius: 15px; flex-shrink: 0; display: grid; place-items: center; background: var(--pink); color: #fff; box-shadow: 0 12px 22px -12px rgba(230,79,85,.85); }
.rca-tit { flex: 1; font-size: 20px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.rca-cuenta { padding: 4px 12px; border-radius: 99px; background: var(--melocoton); color: var(--melocoton-deep); font-size: 12.5px; font-weight: 800; white-space: nowrap; }
.rca-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.rca-fila { display: flex; align-items: center; gap: 12px; padding: 12px 12px 12px 12px; border-radius: 20px; background: #fff; border: 1px solid var(--linea); }
.rca-fila-ico { width: 38px; height: 38px; border-radius: 13px; flex-shrink: 0; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); }
.rca-fila.es-falta { border-color: #F6D9C4; background: linear-gradient(120deg, #FFF8F1, #fff 70%); }
.rca-fila.es-falta .rca-fila-ico { background: var(--melocoton); color: var(--melocoton-deep); }
.rca-fila.es-ya .rca-fila-ico { background: var(--pink); color: #fff; }
.rca-fila-txt { flex: 1; min-width: 0; font-size: 14px; line-height: 1.45; color: var(--ink); }
.rca-fila-txt b { font-weight: 900; }
.rca-fila-txt span { display: flex; align-items: center; gap: 5px; margin-top: 2px; font-size: 12.5px; color: var(--muted); }
.rca-fila-txt span svg { color: var(--pink-deep); }
.rca-acc { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex-shrink: 0; }
.rca-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 38px; padding: 0 15px; border-radius: 99px; border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); font: inherit; font-size: 13px; font-weight: 800; text-decoration: none; white-space: nowrap; cursor: pointer; transition: background .2s, border-color .2s, transform .3s var(--curva); }
.rca-btn:hover { background: var(--rubor); border-color: var(--pink-line); transform: translateY(-1px); }
.rca-btn--lleno { background: var(--pink); border-color: var(--pink); color: #fff; box-shadow: 0 10px 20px -12px rgba(230,79,85,.9); }
.rca-btn--lleno:hover { background: var(--pink-mid); border-color: var(--pink-mid); }
.rca-mas a { display: inline-flex; align-items: center; gap: 6px; padding: 4px 6px; font-size: 13px; font-weight: 800; color: var(--pink-deep); text-decoration: none; }
.rca-mas a:hover { text-decoration: underline; }
.rca--calma { display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: #fff; border-color: var(--linea); }
.rca--calma .rca-ico { width: 36px; height: 36px; border-radius: 12px; background: var(--rubor); color: var(--pink-deep); box-shadow: none; }
.rca-calma-txt { font-size: 14px; color: var(--muted); }
.rca-calma-txt b { color: var(--ink); }
@media (max-width: 640px) {
  .rca { padding: 16px; border-radius: 24px; }
  .rca-fila { flex-wrap: wrap; }
  .rca-fila-txt { flex-basis: calc(100% - 52px); }
  .rca-acc, .rca-fila > .rca-btn { width: 100%; }
  .rca-acc > *, .rca-fila > .rca-btn { flex: 1 1 auto; }
}
@media (prefers-reduced-motion: reduce) { .rca-btn { transition: none; } }
`;
