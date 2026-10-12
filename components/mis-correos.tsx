import { Check, Mail } from "lucide-react";
import { BotonEnviar } from "@/components/boton-enviar";
import { guardarMisCorreosAction } from "@/src/features/auth/correos-actions";
import { INTERRUPTORES_DE_CORREO } from "@/src/features/correos/reglas";

/**
 * "Mis correos": un interruptor por cada aviso OPCIONAL. Sin JavaScript propio:
 * checkboxes con aspecto de interruptor y un solo boton de guardar.
 *
 * `encendidos` lo calcula la pagina (clases nuevas desde la baja de marketing,
 * el resto desde correos_desactivados). Ver src/features/correos/reglas.ts.
 */
export function MisCorreos({ encendidos }: { encendidos: ReadonlySet<string> }) {
  return (
    <section id="correos" className="mc" aria-labelledby="mc-titulo">
      <div className="mc-cabeza">
        <span className="mc-ico" aria-hidden="true"><Mail size={18} strokeWidth={2.2} /></span>
        <div>
          <h2 id="mc-titulo" className="mc-titulo">Mis correos</h2>
          <p className="mc-sub">Elegí qué avisos querés recibir. Lo podés cambiar cuando quieras.</p>
        </div>
      </div>
      <form action={guardarMisCorreosAction} className="mc-form">
        <ul className="mc-lista">
          {INTERRUPTORES_DE_CORREO.map((i) => (
            <li key={i.campo}>
              <label className="mc-fila">
                <span className="mc-txt">
                  <span className="mc-nombre">{i.titulo}</span>
                  <span className="mc-desc">{i.descripcion}</span>
                </span>
                <input type="checkbox" name={i.campo} value="si" defaultChecked={encendidos.has(i.campo)} className="mc-check" />
                <span className="mc-switch" aria-hidden="true" />
              </label>
            </li>
          ))}
        </ul>
        <p className="mc-siempre">
          Siempre te llegan: confirmación de cuenta, cambio de contraseña, recibos de pago y la bienvenida.
        </p>
        <BotonEnviar className="mp-guardar" pendingLabel="Guardando…">
          <Check size={16} strokeWidth={2.6} aria-hidden="true" /> Guardar mis correos
        </BotonEnviar>
      </form>
    </section>
  );
}

export const CSS_MIS_CORREOS = `
.mc { margin-top: 18px; background: #fff; border: 1px solid var(--linea); border-radius: 28px; box-shadow: var(--sombra); padding: 26px; }
.mc-cabeza { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 14px; }
.mc-ico { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); }
.mc-titulo { font-size: 18px; font-weight: 900; color: var(--ink); }
.mc-sub { font-size: 13.5px; color: var(--muted); margin-top: 2px; }
.mc-form { display: flex; flex-direction: column; gap: 16px; }
.mc-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.mc-lista li + li { border-top: 1px solid var(--linea); }
.mc-fila { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; cursor: pointer; }
.mc-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.mc-nombre { font-size: 15px; font-weight: 800; color: var(--ink); }
.mc-desc { font-size: 13px; color: var(--muted); }
.mc-check { position: absolute; opacity: 0; width: 1px; height: 1px; }
.mc-switch { flex: none; position: relative; width: 46px; height: 28px; border-radius: 99px; background: var(--linea-fuerte); transition: background .2s; }
.mc-switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 2px 6px rgba(59,42,44,.25); transition: transform .25s var(--curva); }
.mc-check:checked + .mc-switch { background: var(--pink); }
.mc-check:checked + .mc-switch::after { transform: translateX(18px); }
.mc-check:focus-visible + .mc-switch { box-shadow: 0 0 0 4px rgba(230,79,85,.2); }
.mc-siempre { font-size: 12.5px; color: var(--muted); background: var(--crema); border-radius: 14px; padding: 10px 14px; }
@media (max-width: 760px) { .mc { padding: 20px; border-radius: 24px; } }
`;
