import { Gift, X } from "lucide-react";
import { BotonEnviar } from "@/components/boton-enviar";
import { Desplegable } from "@/components/desplegable";
import { CantidadGratis } from "@/components/cantidad-gratis";
import { darAccesoGratisAction, quitarAccesoGratisAction } from "@/src/features/admin/acceso-gratis-actions";
import { PLAN_LABEL, estaVencido, fechaCorta, fechaLarga, type PlanPago } from "@/src/features/studio/acceso-gratis-reglas";

/**
 * Piezas del acceso gratis para el panel: el chip ("Gratis hasta 15 dic") y
 * los dos formularios (dar/extender y quitar). Server component: los iconos
 * se renderizan aca (trampa 6); a cliente solo cruzan CantidadGratis y el
 * Desplegable, con cadenas.
 */

export type EstadoGratis = { hasta: string | null; plan: PlanPago | null };

export function ChipGratis({ estado }: { estado: EstadoGratis | null | undefined }) {
  if (!estado?.hasta) return null;
  const vencido = estado.hasta && estaVencido(estado.hasta);
  return (
    <span className={"agr-chip" + (vencido ? " es-vencido" : "")} title={`${estado.plan ? PLAN_LABEL[estado.plan] : ""} gratis hasta el ${fechaLarga(estado.hasta)}`}>
      <style>{CSS_CHIP}</style>
      <Gift size={12} strokeWidth={2.4} aria-hidden="true" />
      {vencido ? `Prueba terminó el ${fechaCorta(estado.hasta)}` : `Gratis hasta ${fechaCorta(estado.hasta)}`}
    </span>
  );
}

const CSS_CHIP = `
.agr-chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 99px; font-size: 12px; font-weight: 800; background: #FFF4E8; color: var(--melocoton-deep); border: 1px solid #FBD9C2; white-space: nowrap; }
.agr-chip.es-vencido { background: var(--crema); color: var(--muted); border-color: var(--linea); }
`;

export function AccesoGratisControles({
  alumnaId, estado, volverA,
}: {
  alumnaId: string;
  estado: EstadoGratis | null;
  /** /admin/users[...] o la ficha: a donde vuelve despues de guardar. */
  volverA: string;
}) {
  const vigente = !!estado?.hasta && !estaVencido(estado.hasta);
  return (
    <div className="agr" id={`gratis-${alumnaId}`}>
      <style>{CSS}</style>
      <p className="agr-estado">
        {vigente
          ? <>Tiene <strong>{estado?.plan ? PLAN_LABEL[estado.plan] : "un plan"}</strong> gratis hasta el <strong>{fechaLarga(estado!.hasta!)}</strong>. Lo que sumes se agrega a partir de esa fecha.</>
          : estado?.hasta
            ? <>Su prueba gratis terminó el {fechaLarga(estado.hasta)}. Podés darle otra.</>
            : <>Regalale un plan por un tiempo. Cuando termine, el sistema le avisa y le ofrece elegir uno.</>}
      </p>
      <form action={darAccesoGratisAction} className="agr-form">
        <input type="hidden" name="alumnaId" value={alumnaId} />
        <input type="hidden" name="volverA" value={volverA} />
        <div className="pf-campo">
          <span className="pf-etq">Plan</span>
          <Desplegable
            name="plan"
            etiqueta="Plan gratis"
            defaultValue={estado?.plan ?? "solista"}
            opciones={[
              { value: "corps_de_ballet", label: "Corps de Ballet" },
              { value: "solista", label: "Solista" },
              { value: "principal", label: "Principal" },
            ]}
          />
        </div>
        <div className="pf-campo">
          <span className="pf-etq">{vigente ? "Sumar" : "Tiempo gratis"}</span>
          <CantidadGratis etiqueta={vigente ? "Tiempo a sumar" : "Tiempo gratis"} />
        </div>
        <div className="agr-botones">
          <BotonEnviar className="pf-guardar" pendingLabel="Guardando…">
            <Gift size={16} strokeWidth={2.2} aria-hidden="true" /> {vigente ? "Extender acceso gratis" : "Dar acceso gratis"}
          </BotonEnviar>
          {estado?.hasta && (
            <BotonEnviar
              className="pf-borrar agr-quitar"
              formAction={quitarAccesoGratisAction}
              pendingLabel="Quitando…"
              confirmar="¿Quitarle el acceso gratis? Si no paga una suscripción, queda sin plan."
            >
              <X size={15} strokeWidth={2.4} aria-hidden="true" /> Quitar acceso gratis
            </BotonEnviar>
          )}
        </div>
      </form>
    </div>
  );
}

const CSS = `
.agr { display: flex; flex-direction: column; gap: 12px; }
.agr-estado { font-size: 13.5px; line-height: 1.55; color: var(--muted); }
.agr-estado strong { color: var(--ink); font-weight: 800; }
.agr-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px 18px; align-items: end; padding: 18px; border-radius: 20px; background: linear-gradient(120deg, #FFF6EF, #FFFAF6 60%); border: 1px solid #FBE3D3; }
.agr-botones { grid-column: 1 / -1; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.agr-quitar { margin-left: 0; }
@media (max-width: 560px) { .agr-form { padding: 14px; } .agr-botones > * { flex: 1 1 auto; justify-content: center; } }
`;
