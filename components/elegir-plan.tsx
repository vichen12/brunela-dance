import { Check, Gift, Package } from "lucide-react";
import type { EleccionDePlan } from "@/src/features/planes/eleccion";

/**
 * El selector de plan del final del registro: lo usan el onboarding (paso 4)
 * y /registro/plan. Va DENTRO del <form> de quien lo usa.
 *
 * Server component, sin JavaScript: los controles son radios NATIVOS
 * escondidos (teclado y lector de pantalla siguen andando) y lo que se ve
 * reacciona con :has(input:checked), igual que el resto del onboarding. El
 * cambio Mensual/Anual tambien es CSS: los dos importes estan en la pagina y
 * se muestra el del intervalo marcado.
 *
 * Los iconos se renderizan aca y no viajan como prop (trampa 6).
 *
 * Si venia por un PACK, se muestra el pack y no el selector: un pack se paga
 * una vez y no tiene plan que elegir.
 */
export function ElegirPlan({ eleccion }: { eleccion: EleccionDePlan }) {
  const { tarjetas, diasPrueba, tier, intervalo, pack } = eleccion;

  if (pack) {
    return (
      <div className="ep">
        <style>{CSS}</style>
        <input type="hidden" name="pack" value={pack.slug} />
        <div className="ep-pack">
          <span className="ep-pack-ico" aria-hidden="true"><Package size={22} strokeWidth={2} /></span>
          <span className="ep-pack-body">
            <span className="ep-pack-kicker">Tu pack</span>
            <strong className="ep-pack-nombre">{pack.nombre}</strong>
            {pack.descripcion && <span className="ep-pack-desc">{pack.descripcion}</span>}
            <span className="ep-pack-meta">
              {pack.clases > 0 ? `${pack.clases} ${pack.clases === 1 ? "clase" : "clases"} · ` : ""}pago único · son tuyas para siempre
            </span>
          </span>
          <span className="ep-pack-precio">{pack.precio}</span>
        </div>
      </div>
    );
  }

  if (tarjetas.length === 0 || !tier) {
    return (
      <div className="ep">
        <style>{CSS}</style>
        <p className="ep-vacio">
          Los planes todavía no están configurados. Escribinos a info@bruneladance.com y te ayudamos.
        </p>
      </div>
    );
  }

  const ahorro = Math.max(0, ...tarjetas.map((t) => t.ahorro));

  return (
    <div className="ep">
      <style>{CSS}</style>

      <div className="ep-periodo" role="radiogroup" aria-label="Forma de pago">
        <label className="ep-periodo-op">
          <input className="ep-oculto" type="radio" name="interval" value="monthly" defaultChecked={intervalo === "monthly"} />
          <span>Mensual</span>
        </label>
        <label className="ep-periodo-op">
          <input className="ep-oculto" type="radio" name="interval" value="yearly" defaultChecked={intervalo === "yearly"} />
          <span>Anual</span>
          {ahorro > 0 && <small className="ep-ahorro">−{ahorro}%</small>}
        </label>
      </div>

      <div className="ep-planes">
        {tarjetas.map((t) => (
          <label key={t.tier} className="ep-plan">
            <input className="ep-oculto" type="radio" name="plan" value={t.tier} defaultChecked={t.tier === tier} required />
            <span className="ep-plan-cabeza">
              <span className="ep-plan-nombre">{t.nombre}</span>
              <span className="ep-marca" aria-hidden="true"><Check size={13} strokeWidth={3.2} /></span>
            </span>
            <span className="ep-precio ep-precio--mes">
              <strong>{t.mensual}</strong> <span>/ mes</span>
            </span>
            <span className="ep-precio ep-precio--anual">
              <strong>{t.anual}</strong> <span>/ año</span>
              {t.anualPorMes && <small>≈ {t.anualPorMes} por mes</small>}
            </span>
            <span className="ep-plan-desc">{t.desc}</span>
            <span className="ep-incluye">
              {t.incluye.slice(0, 3).map((f) => (
                <span key={f} className="ep-incluye-item">
                  <Check size={12} strokeWidth={3} aria-hidden="true" /> {f}
                </span>
              ))}
            </span>
          </label>
        ))}
      </div>

      {diasPrueba > 0 && (
        <p className="ep-prueba">
          <span className="ep-prueba-ico" aria-hidden="true"><Gift size={17} strokeWidth={2.2} /></span>
          <span>
            <strong>{diasPrueba} días gratis.</strong> Si cancelás antes, no se cobra nada. Sin permanencia.
          </span>
        </p>
      )}
    </div>
  );
}

const CSS = `
.ep { display: grid; gap: 14px; }
.ep-oculto { position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; pointer-events: none; }

.ep-periodo { display: inline-flex; justify-self: start; gap: 4px; padding: 4px; border-radius: 99px; background: var(--crema); border: 1px solid var(--linea); }
.ep-periodo-op { position: relative; display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 16px; border-radius: 99px; cursor: pointer; font-size: 14px; font-weight: 800; color: var(--muted); transition: background .2s, color .2s, box-shadow .25s; }
.ep-periodo-op:has(input:checked) { background: #fff; color: var(--ink); box-shadow: 0 6px 14px -10px rgba(176,58,62,.55); }
.ep-periodo-op:has(input:focus-visible) { outline: 3px solid rgba(230,79,85,.45); outline-offset: 2px; }
.ep-ahorro { font-size: 11.5px; font-weight: 900; color: var(--pink-deep); background: var(--rubor); padding: 2px 7px; border-radius: 99px; }

.ep-planes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.ep-plan { position: relative; display: flex; flex-direction: column; gap: 6px; padding: 15px 15px 14px; border-radius: 22px; border: 1.5px solid var(--linea); background: #fff; cursor: pointer; transition: border-color .2s, background .25s, transform .35s var(--curva), box-shadow .35s; }
.ep-plan:hover { border-color: var(--linea-fuerte); background: var(--crema); transform: translateY(-1px); }
.ep-plan-cabeza { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ep-plan-nombre { font-size: 15.5px; font-weight: 900; color: var(--ink); letter-spacing: -0.01em; }
.ep-marca { flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; border: 1.5px solid var(--linea-fuerte); background: #fff; color: transparent; transition: background .2s, border-color .2s, color .2s, transform .35s var(--curva); }
.ep-precio { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px; color: var(--muted); font-size: 13px; font-weight: 700; }
.ep-precio strong { font-size: 24px; font-weight: 900; color: var(--ink); letter-spacing: -0.02em; }
.ep-precio small { flex-basis: 100%; font-size: 12px; font-weight: 700; color: var(--muted); }
.ep-precio--anual { display: none; }
.ep:has(input[name="interval"][value="yearly"]:checked) .ep-precio--mes { display: none; }
.ep:has(input[name="interval"][value="yearly"]:checked) .ep-precio--anual { display: flex; }
.ep-plan-desc { font-size: 12.5px; color: var(--muted); line-height: 1.45; }
.ep-incluye { display: grid; gap: 4px; margin-top: 2px; }
.ep-incluye-item { display: flex; align-items: flex-start; gap: 6px; font-size: 12.5px; font-weight: 700; color: var(--ink); line-height: 1.35; }
.ep-incluye-item svg { flex-shrink: 0; margin-top: 2px; color: #C25E3A; }

.ep-plan:has(input:checked) { border-color: var(--pink); background: linear-gradient(160deg, #FFEDE8, #FFF8F5 75%); box-shadow: 0 12px 26px -18px rgba(230,79,85,.7); }
.ep-plan:has(input:checked) .ep-marca { background: var(--pink); border-color: var(--pink); color: #fff; transform: scale(1.06); }
.ep-plan:has(input:checked) .ep-incluye-item svg { color: var(--pink); }
.ep-plan:has(input:focus-visible) { outline: 3px solid rgba(230,79,85,.45); outline-offset: 2px; }

.ep-prueba { display: flex; align-items: center; gap: 10px; margin: 0; padding: 11px 14px; border-radius: 16px; background: var(--rubor); color: var(--ink); font-size: 13.5px; line-height: 1.45; }
.ep-prueba strong { color: var(--pink-deep); font-weight: 900; }
.ep-prueba-ico { flex-shrink: 0; width: 32px; height: 32px; border-radius: 11px; display: grid; place-items: center; background: #fff; color: var(--pink); }

.ep-pack { display: flex; align-items: center; gap: 14px; padding: 16px; border-radius: 22px; border: 1.5px solid var(--pink); background: linear-gradient(100deg, #FFEDE8, #FFF8F5 75%); }
.ep-pack-ico { flex-shrink: 0; width: 46px; height: 46px; border-radius: 15px; display: grid; place-items: center; background: var(--pink); color: #fff; }
.ep-pack-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ep-pack-kicker { font-size: 11.5px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; color: var(--pink-deep); }
.ep-pack-nombre { font-size: 16px; font-weight: 900; color: var(--ink); }
.ep-pack-desc { font-size: 13px; color: var(--muted); line-height: 1.45; }
.ep-pack-meta { font-size: 12.5px; font-weight: 700; color: var(--muted); }
.ep-pack-precio { flex-shrink: 0; font-size: 22px; font-weight: 900; color: var(--ink); }
.ep-vacio { margin: 0; padding: 14px 16px; border-radius: 16px; background: var(--crema); color: var(--muted); font-size: 14px; }

@media (max-width: 620px) {
  .ep-planes { grid-template-columns: minmax(0, 1fr); }
  .ep-incluye { display: none; }
  .ep-plan:has(input:checked) .ep-incluye { display: grid; }
}
@media (prefers-reduced-motion: reduce) { .ep-plan, .ep-marca { transition: none; } }
`;
