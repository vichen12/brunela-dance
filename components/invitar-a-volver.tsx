"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, Heart, MailX, Send } from "lucide-react";
import { BotonEnviar } from "@/components/boton-enviar";
import { volverAlEstudio, type NovedadParaVolver } from "@/src/lib/email/mensajes";
import { mandarVolverAlEstudioAction } from "@/src/features/admin/volver-actions";

/**
 * Elegir a quien, ver el mail y mandarlo. Lo usan la lista filtrada de
 * /admin/users (varias alumnas, con "seleccionar todas") y la ficha de una
 * alumna (una sola).
 *
 * LO QUE SE VE ACA NO DECIDE NADA: la accion vuelve a leer en la base si a
 * cada elegida se le puede mandar (baja, 14 dias, acceso). Esto solo evita que
 * Brunela elija a alguien que el servidor igual va a saltear.
 *
 * La vista previa se arma en el navegador con el MISMO constructor que usa el
 * envio (src/lib/email/mensajes.ts es puro). El enlace de baja de la vista
 * previa es de mentira: el token de cada alumna no sale nunca del servidor.
 */

export type AlumnaParaVolver = {
  id: string;
  nombre: string;
  /** full_name, para el "Hola, …" de la vista previa. */
  nombreCompleto: string | null;
  email: string | null;
  /** null = se le puede mandar; si no, por que no ("no recibe correos"). */
  motivo: string | null;
  /** Solo si `motivo` es el de los 14 dias: "desde el 8 de noviembre". */
  desde: string | null;
};

export function InvitarAVolver({
  alumnas,
  novedades,
  disponible,
  avisoNoDisponible,
  appUrl,
  volverA,
  una = false,
}: {
  alumnas: AlumnaParaVolver[];
  novedades: { clasesNuevas: number; novedades: NovedadParaVolver[] };
  disponible: boolean;
  avisoNoDisponible: string;
  appUrl: string;
  volverA: string;
  /** Ficha de una alumna: sin lista ni "seleccionar todas". */
  una?: boolean;
}) {
  const elegibles = useMemo(() => alumnas.filter((a) => !a.motivo), [alumnas]);
  const [elegidas, setElegidas] = useState<Set<string>>(() => new Set(una ? elegibles.map((a) => a.id) : []));
  const [verPrevia, setVerPrevia] = useState(false);

  const todas = elegibles.length > 0 && elegibles.every((a) => elegidas.has(a.id));
  const n = elegidas.size;
  const paraPrevia = alumnas.find((a) => elegidas.has(a.id)) ?? elegibles[0] ?? alumnas[0];

  const previa = useMemo(() => {
    if (!verPrevia) return "";
    const base = appUrl.replace(/\/$/, "");
    return volverAlEstudio({
      nombre: paraPrevia?.nombreCompleto ?? null,
      clasesNuevas: novedades.clasesNuevas,
      novedades: novedades.novedades,
      urlVolver: `${base}/registro/plan`,
      urlBaja: `${base}/baja?token=vista-previa`,
    }).html;
  }, [verPrevia, paraPrevia, novedades, appUrl]);

  function alternar(id: string) {
    setElegidas((s) => {
      const nuevo = new Set(s);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  const resumenNovedades = novedades.clasesNuevas > 0
    ? `Les cuenta que en el último mes subiste ${novedades.clasesNuevas === 1 ? "1 clase nueva" : `${novedades.clasesNuevas} clases nuevas`}${novedades.novedades.length ? ", con las más recientes" : ""}.`
    : "Este mes no hay clases nuevas publicadas, así que el mail las invita sin hablar de novedades.";

  const unaSola = una ? alumnas[0] : null;

  return (
    <form action={mandarVolverAlEstudioAction} className="iav">
      <input type="hidden" name="volverA" value={volverA} />

      {!disponible && <div role="status" className="ad-aviso ad-aviso--error iav-aviso">{avisoNoDisponible}</div>}

      <p className="iav-explica">
        Un mail tuyo, cálido, que las invita a volver con un botón <strong>«Volver al estudio»</strong> para elegir su plan.
        Nunca habla de pagos ni de montos. {resumenNovedades} Como mucho uno cada 14 días por alumna.
      </p>

      {unaSola ? (
        unaSola.motivo ? (
          <p className="iav-estado"><MailX size={15} strokeWidth={2.2} aria-hidden="true" /> No se le puede mandar ahora: {unaSola.motivo}{unaSola.desde ? `. Se puede de nuevo ${unaSola.desde}` : ""}.</p>
        ) : (
          <input type="hidden" name="alumna" value={unaSola.id} />
        )
      ) : (
        <>
          <div className="iav-barra">
            <label className="iav-todas">
              <input
                type="checkbox"
                checked={todas}
                disabled={elegibles.length === 0}
                onChange={() => setElegidas(todas ? new Set() : new Set(elegibles.map((a) => a.id)))}
              />
              Seleccionar todas las que pueden recibirlo ({elegibles.length})
            </label>
            <span className="iav-cuenta">{n === 1 ? "1 elegida" : `${n} elegidas`}</span>
          </div>
          <ul className="iav-lista">
            {alumnas.map((a) => (
              <li key={a.id} className={"iav-fila" + (a.motivo ? " es-apagada" : "")}>
                <label>
                  <input
                    type="checkbox"
                    name="alumna"
                    value={a.id}
                    checked={!a.motivo && elegidas.has(a.id)}
                    disabled={Boolean(a.motivo)}
                    onChange={() => alternar(a.id)}
                  />
                  <span className="iav-quien">
                    <span className="iav-nombre">{a.nombre}</span>
                    <span className="iav-correo">{a.email ?? "sin correo"}</span>
                  </span>
                  {a.motivo && (
                    <span className="iav-motivo">
                      <MailX size={12} strokeWidth={2.4} aria-hidden="true" /> {a.motivo}{a.desde ? ` · se puede ${a.desde}` : ""}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="iav-acciones">
        <button type="button" className="iav-ver" onClick={() => setVerPrevia((v) => !v)} aria-expanded={verPrevia}>
          {verPrevia ? <EyeOff size={15} strokeWidth={2.2} aria-hidden="true" /> : <Eye size={15} strokeWidth={2.2} aria-hidden="true" />}
          {verPrevia ? "Ocultar el mail" : "Ver cómo le llega"}
        </button>
        <BotonEnviar
          className="iav-mandar"
          pendingLabel="Mandando…"
          disabled={!disponible || n === 0}
          confirmar={una ? `¿Mandarle a ${unaSola?.nombre ?? "esta alumna"} el mail para que vuelva?` : `¿Mandarle el mail para que vuelvan a ${n === 1 ? "1 alumna" : `${n} alumnas`}?`}
        >
          {una ? <Heart size={15} strokeWidth={2.2} aria-hidden="true" /> : <Send size={15} strokeWidth={2.2} aria-hidden="true" />}
          {una ? "Mandarle un mail para que vuelva" : n === 1 ? "Mandar a 1 alumna" : `Mandar a ${n} alumnas`}
        </BotonEnviar>
      </div>

      {verPrevia && (
        <div className="iav-previa">
          <p className="iav-previa-cab">
            Vista previa{paraPrevia ? <> con el nombre de <strong>{paraPrevia.nombre}</strong></> : null}. Asunto: <strong>{volverAlEstudio({ nombre: null, clasesNuevas: novedades.clasesNuevas, novedades: [], urlVolver: "", urlBaja: "" }).asunto}</strong>
          </p>
          <iframe title="Vista previa del mail" srcDoc={previa} sandbox="" className="iav-iframe" />
        </div>
      )}
      <style>{CSS}</style>
    </form>
  );
}

const CSS = `
.iav { display: flex; flex-direction: column; gap: 14px; }
.iav-aviso { margin: 0; }
.iav-explica { margin: 0; font-size: 13.5px; line-height: 1.6; color: var(--muted); max-width: 720px; }
.iav-explica strong { color: var(--ink); }
.iav-estado { margin: 0; display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 700; color: var(--melocoton-deep); background: #FFF4E8; padding: 10px 14px; border-radius: 14px; }
.iav-barra { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding: 10px 14px; border-radius: 16px; background: var(--rubor); border: 1px solid var(--pink-line); }
.iav-todas { display: inline-flex; align-items: center; gap: 10px; font-size: 13.5px; font-weight: 800; color: var(--ink); cursor: pointer; }
.iav-cuenta { font-size: 12.5px; font-weight: 800; color: var(--pink-deep); }
.iav input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--pink); flex-shrink: 0; cursor: pointer; }
.iav input[type="checkbox"]:disabled { cursor: not-allowed; }
.iav-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 360px; overflow-y: auto; }
.iav-fila label { display: flex; align-items: center; gap: 12px; padding: 9px 14px; border-radius: 14px; border: 1px solid var(--linea); background: #fff; cursor: pointer; transition: border-color .2s, background .2s; }
.iav-fila label:hover { border-color: var(--pink-line); background: #FFFBF9; }
.iav-fila.es-apagada label { cursor: not-allowed; background: var(--crema); }
.iav-fila.es-apagada .iav-nombre { color: var(--muted); }
.iav-quien { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.iav-nombre { font-size: 14px; font-weight: 800; color: var(--ink); }
.iav-correo { font-size: 12.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.iav-motivo { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 800; color: var(--melocoton-deep); background: #FFEBDF; padding: 4px 10px; border-radius: 99px; white-space: nowrap; }
.iav-acciones { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.iav-ver, .iav-mandar {
  display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px; border-radius: 99px; cursor: pointer;
  font: inherit; font-size: 14px; font-weight: 800; transition: background .2s, border-color .2s, transform .3s var(--curva);
}
.iav-ver { border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); }
.iav-ver:hover { background: var(--rubor); border-color: var(--pink-line); }
.iav-ver svg { color: var(--pink-deep); }
.iav-mandar { border: 0; background: var(--pink); color: #fff; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); }
.iav-mandar:hover:not(:disabled) { background: var(--pink-mid); transform: translateY(-2px); }
.iav-mandar:disabled { opacity: .5; cursor: not-allowed; box-shadow: none; }
.iav-previa { border: 1px solid var(--linea); border-radius: 20px; overflow: hidden; background: var(--crema); }
.iav-previa-cab { margin: 0; padding: 10px 16px; font-size: 12.5px; color: var(--muted); border-bottom: 1px solid var(--linea); }
.iav-previa-cab strong { color: var(--ink); }
.iav-iframe { display: block; width: 100%; height: 640px; border: 0; background: #FFFAF6; }
@media (max-width: 640px) {
  .iav-fila label { flex-wrap: wrap; }
  .iav-motivo { white-space: normal; }
  .iav-iframe { height: 520px; }
}
`;
