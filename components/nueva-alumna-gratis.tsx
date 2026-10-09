"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Copy, Gift, KeyRound, Mail, RefreshCw, Send, UserPlus } from "lucide-react";
import { Desplegable } from "@/components/desplegable";
import { BotonEnviar } from "@/components/boton-enviar";
import { CantidadGratis } from "@/components/cantidad-gratis";
import { crearAlumnaGratisAction, darAccesoGratisAction, type EstadoNuevaAlumna } from "@/src/features/admin/acceso-gratis-actions";
import { PLAN_LABEL, generarContrasena } from "@/src/features/studio/acceso-gratis-reglas";

/**
 * "Nueva alumna" con acceso gratis, en /admin/users.
 *
 * useActionState y no redirect: la contraseña provisoria se muestra UNA vez, en
 * la respuesta de la action, y nunca viaja en la URL (quedaria en el historial
 * del navegador y en los registros de Vercel).
 *
 * Dos formas (2026-10-09, ya con SMTP): por defecto le llega la INVITACION por
 * mail y ella elige su contraseña. La otra, contraseña provisoria que Brunela
 * le pasa a mano, queda por si el mail no le llega: por eso esa tarjeta final
 * trae "Copiar todo" con un texto listo para pegar en WhatsApp.
 */

const SITIO = "bruneladance.com/sign-in";

function aleatorio(n: number) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

const PLANES = [
  { value: "corps_de_ballet", label: "Corps de Ballet" },
  { value: "solista", label: "Solista" },
  { value: "principal", label: "Principal" },
];

export function NuevaAlumnaGratis() {
  const [estado, enviar] = useActionState<EstadoNuevaAlumna, FormData>(crearAlumnaGratisAction, { tipo: "inicial" });
  const [clave, setClave] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [vuelta, setVuelta] = useState(0);
  // Controlados a proposito: React 19 vacia el formulario despues de cada
  // action, y ante un error ("ese correo no parece valido") Brunela perderia
  // todo lo que escribio.
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [plan, setPlan] = useState("solista");
  const [modo, setModo] = useState<"mail" | "clave">("mail");

  // La contraseña se genera en el navegador, despues de montar: generarla en el
  // render daria una distinta en servidor y cliente.
  useEffect(() => { setClave(generarContrasena(aleatorio)); }, [vuelta]);

  if (estado.tipo === "invitada") {
    return (
      <div className="nag-lista" role="status">
        <style>{CSS}</style>
        <div className="nag-lista-cab">
          <span className="nag-burbuja nag-burbuja--ok" aria-hidden="true"><Send size={19} strokeWidth={2.4} /></span>
          <div>
            <p className="nag-lista-titulo">¡Invitación enviada a {estado.nombre}!</p>
            <p className="nag-lista-sub">
              Le llegó un mail a <strong>{estado.correo}</strong> con el botón «Aceptar invitación». Al tocarlo
              elige su contraseña y entra. Tiene {estado.plan} gratis hasta el {estado.hasta}.
            </p>
          </div>
        </div>
        <p className="nag-nota">Si no lo ve, que revise Spam o Promociones. Llega desde no-responder@bruneladance.com.</p>
        <div className="nag-pie">
          <button type="button" className="nag-sec" onClick={() => { window.location.href = "/admin/users?nueva=1#nueva"; }}>
            <UserPlus size={16} strokeWidth={2.2} aria-hidden="true" /> Invitar a otra
          </button>
        </div>
      </div>
    );
  }

  if (estado.tipo === "creada") {
    const texto =
      `¡Hola ${estado.nombre.split(" ")[0]}! Ya tenés tu acceso al estudio de Brunela.\n` +
      `Entrá en: https://${SITIO}\n` +
      `Correo: ${estado.correo}\n` +
      `Contraseña provisoria: ${estado.contrasena}\n` +
      `Tenés ${estado.plan} gratis hasta el ${estado.hasta}.`;
    return (
      <div className="nag-lista" role="status">
        <style>{CSS}</style>
        <div className="nag-lista-cab">
          <span className="nag-burbuja nag-burbuja--ok" aria-hidden="true"><Check size={20} strokeWidth={2.6} /></span>
          <div>
            <p className="nag-lista-titulo">¡Listo! {estado.nombre} ya tiene su cuenta.</p>
            <p className="nag-lista-sub">{estado.plan} gratis hasta el {estado.hasta}. Pasale estos datos: la contraseña no se vuelve a mostrar.</p>
          </div>
        </div>
        <dl className="nag-datos">
          <div><dt>Entra en</dt><dd>{SITIO}</dd></div>
          <div><dt>Correo</dt><dd>{estado.correo}</dd></div>
          <div><dt>Contraseña provisoria</dt><dd className="nag-clave">{estado.contrasena}</dd></div>
        </dl>
        <div className="nag-pie">
          <button
            type="button"
            className="pf-guardar"
            onClick={async () => {
              try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2400); } catch { /* sin permiso: queda a la vista */ }
            }}
          >
            {copiado ? <><Check size={16} strokeWidth={2.6} aria-hidden="true" /> Copiado</> : <><Copy size={16} strokeWidth={2.2} aria-hidden="true" /> Copiar todo</>}
          </button>
          <button type="button" className="nag-sec" onClick={() => { window.location.href = "/admin/users"; }}>
            <UserPlus size={16} strokeWidth={2.2} aria-hidden="true" /> Crear otra
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="nag">
      <style>{CSS}</style>

      {estado.tipo === "error" && <div role="alert" className="ad-aviso ad-aviso--error">{estado.mensaje}</div>}

      {estado.tipo === "existe" && (
        <div className="nag-existe" role="status">
          <span className="nag-burbuja" aria-hidden="true"><Gift size={18} strokeWidth={2.2} /></span>
          <div className="nag-existe-txt">
            <p className="nag-lista-titulo">{estado.correo} ya tiene cuenta</p>
            <p className="nag-lista-sub">Es de {estado.nombre}. No se creó nada nuevo. ¿Le damos el acceso gratis a esa cuenta?</p>
          </div>
          <form action={darAccesoGratisAction}>
            <input type="hidden" name="alumnaId" value={estado.id} />
            <input type="hidden" name="plan" value={estado.plan} />
            <input type="hidden" name="unidad" value={estado.unidad} />
            <input type="hidden" name="cantidad" value={estado.cantidad} />
            <input type="hidden" name="volverA" value={`/admin/users?q=${encodeURIComponent(estado.correo)}`} />
            <BotonEnviar className="pf-guardar" pendingLabel="Dándole acceso…">
              <Gift size={16} strokeWidth={2.2} aria-hidden="true" />
              Darle {estado.cantidad} {estado.unidad === "meses" ? (estado.cantidad === 1 ? "mes" : "meses") : "días"} de {PLAN_LABEL[estado.plan]}
            </BotonEnviar>
          </form>
        </div>
      )}

      <form action={enviar} className="nag-form">
        <div className="pf-grilla">
          <label className="pf-campo">
            <span className="pf-etq">Nombre</span>
            <input name="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} maxLength={120} autoComplete="off" placeholder="Lucía Fernández" />
          </label>
          <label className="pf-campo">
            <span className="pf-etq">Correo</span>
            <input name="correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required autoComplete="off" placeholder="lucia@correo.com" />
          </label>
          <div className="pf-campo">
            <span className="pf-etq">Plan</span>
            <Desplegable name="plan" value={plan} onChange={setPlan} opciones={PLANES} etiqueta="Plan" required />
          </div>
          <div className="pf-campo">
            <span className="pf-etq">Tiempo gratis</span>
            <CantidadGratis />
          </div>
        </div>

        <fieldset className="nag-modos">
          <legend className="pf-etq">Cómo le llega</legend>
          <label className="nag-modo">
            <input type="radio" name="modo" value="mail" checked={modo === "mail"} onChange={() => setModo("mail")} />
            <span className="nag-modo-ico" aria-hidden="true"><Mail size={18} strokeWidth={2.2} /></span>
            <span className="nag-modo-txt">
              <strong>Por mail <em>recomendado</em></strong>
              <small>Le llega una invitación y elige ella su contraseña.</small>
            </span>
          </label>
          <label className="nag-modo">
            <input type="radio" name="modo" value="clave" checked={modo === "clave"} onChange={() => setModo("clave")} />
            <span className="nag-modo-ico" aria-hidden="true"><KeyRound size={18} strokeWidth={2.2} /></span>
            <span className="nag-modo-txt">
              <strong>Le paso yo la contraseña</strong>
              <small>Por WhatsApp, por ejemplo. Sirve si el mail no le llega.</small>
            </span>
          </label>
        </fieldset>

        {modo === "clave" && (
          <div className="pf-campo nag-clave-campo">
            <span className="pf-etq">Contraseña provisoria <small>se la pasás vos; después la puede cambiar</small></span>
            <div className="nag-clave-fila">
              <span className="nag-clave-ico" aria-hidden="true"><KeyRound size={16} strokeWidth={2.2} /></span>
              <input name="contrasena" value={clave} onChange={(e) => setClave(e.target.value)} required minLength={8} maxLength={72} autoComplete="off" spellCheck={false} />
              <button type="button" className="nag-sec" onClick={() => setVuelta((v) => v + 1)}>
                <RefreshCw size={14} strokeWidth={2.4} aria-hidden="true" /> Otra
              </button>
            </div>
          </div>
        )}

        <div className="pf-pie">
          {modo === "mail" ? (
            <BotonEnviar className="pf-guardar" pendingLabel="Mandando la invitación…">
              <Send size={16} strokeWidth={2.2} aria-hidden="true" /> Mandar invitación
            </BotonEnviar>
          ) : (
            <BotonEnviar className="pf-guardar" pendingLabel="Creando la cuenta…">
              <UserPlus size={16} strokeWidth={2.2} aria-hidden="true" /> Crear alumna
            </BotonEnviar>
          )}
          <span className="nag-nota">La primera vez que entra completa su perfil.</span>
        </div>
      </form>
    </div>
  );
}

const CSS = `
.nag { display: flex; flex-direction: column; gap: 16px; }
.nag-form { display: flex; flex-direction: column; gap: 14px; }
.nag-clave-campo { max-width: 520px; }
.nag-modos { border: 0; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.nag-modos legend { margin-bottom: 8px; }
.nag-modo { position: relative; display: flex; align-items: center; gap: 12px; padding: 13px 14px; border-radius: 18px; border: 1.5px solid var(--linea); background: #fff; cursor: pointer; transition: border-color .2s, background .2s; }
.nag-modo:hover { border-color: var(--linea-fuerte); background: var(--crema); }
.nag-modo input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.nag-modo:has(input:checked) { border-color: var(--pink); background: var(--rubor); }
.nag-modo:has(input:focus-visible) { outline: 3px solid rgba(230,79,85,.4); outline-offset: 2px; }
.nag-modo-ico { width: 38px; height: 38px; border-radius: 12px; flex-shrink: 0; display: grid; place-items: center; background: var(--crema); color: #C25E3A; transition: background .2s, color .2s; }
.nag-modo:has(input:checked) .nag-modo-ico { background: var(--pink); color: #fff; }
.nag-modo-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.nag-modo-txt strong { font-size: 14.5px; font-weight: 900; color: var(--ink); }
.nag-modo-txt em { font-style: normal; font-size: 11px; font-weight: 800; color: var(--pink-deep); background: #fff; border: 1px solid var(--pink-line); padding: 1px 7px; border-radius: 99px; margin-left: 6px; vertical-align: 1px; }
.nag-modo-txt small { font-size: 12.5px; line-height: 1.45; color: var(--muted); }
.nag-clave-fila { position: relative; display: flex; align-items: center; gap: 10px; }
.nag-clave-fila input { flex: 1; min-width: 0; padding-left: 2.6rem !important; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .02em; }
.nag-clave-ico { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--pink-deep); display: inline-flex; pointer-events: none; }
.nag-sec { display: inline-flex; align-items: center; gap: 7px; height: 42px; padding: 0 16px; border-radius: 99px; cursor: pointer; flex-shrink: 0; border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); font: inherit; font-size: 13.5px; font-weight: 800; transition: background .2s, border-color .2s; }
.nag-sec:hover { background: var(--rubor); border-color: var(--pink-line); }
.nag-nota { font-size: 13px; color: var(--muted); }
.nag-burbuja { width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: var(--rubor); color: var(--pink-deep); }
.nag-burbuja--ok { background: var(--pink); color: #fff; box-shadow: 0 10px 20px -12px rgba(230,79,85,.9); }
.nag-existe { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 16px 18px; border-radius: 20px; background: linear-gradient(120deg, #FFF1EC, #FFF7F3 55%, #FFEFE6); border: 1px solid var(--pink-line); }
.nag-existe-txt { flex: 1 1 260px; min-width: 0; }
.nag-lista { display: flex; flex-direction: column; gap: 16px; padding: 22px; border-radius: 24px; background: linear-gradient(120deg, #FFF1EC, #FFF7F3 55%, #FFEFE6); border: 1px solid var(--pink-line); animation: nag-entra .5s var(--curva) both; }
.nag-lista-cab { display: flex; gap: 14px; align-items: flex-start; }
.nag-lista-titulo { font-size: 17px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.nag-lista-sub { margin-top: 3px; font-size: 13.5px; line-height: 1.5; color: var(--muted); }
.nag-datos { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 0; }
.nag-datos > div { padding: 12px 16px; border-radius: 16px; background: #fff; border: 1px solid var(--linea); min-width: 0; }
.nag-datos dt { font-size: 12.5px; font-weight: 800; color: var(--muted); }
.nag-datos dd { margin: 3px 0 0; font-size: 15px; font-weight: 800; color: var(--ink); overflow-wrap: anywhere; }
.nag-clave { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--pink-deep) !important; letter-spacing: .03em; }
.nag-pie { display: flex; gap: 10px; flex-wrap: wrap; }
@keyframes nag-entra { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@media (max-width: 560px) {
  .nag-lista { padding: 16px; }
  .nag-clave-fila { flex-wrap: wrap; }
  .nag-modos { grid-template-columns: minmax(0, 1fr); }
  .nag-pie .pf-guardar, .nag-pie .nag-sec { flex: 1 1 auto; justify-content: center; }
  .nag-form .pf-pie { flex-wrap: wrap; }
  .nag-form .pf-pie .pf-guardar { width: 100%; justify-content: center; white-space: nowrap; }
}
@media (prefers-reduced-motion: reduce) { .nag-lista { animation: none; } }
`;
