'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, Loader2, X } from 'lucide-react';

/**
 * Confirmar el cambio de plan, con lo que se cobra HOY a la vista.
 *
 * Paso 1 (al abrir): le pregunta al servidor cuanto se cobra hoy -- la
 * diferencia por lo que queda del periodo -- o cuanto le queda a favor si baja.
 * Paso 2 (al confirmar): hace el cambio con esa misma fecha, asi el cobro es el
 * que se le mostro. Ver app/api/stripe/cambiar-plan/route.ts.
 */

type Presupuesto = { fecha: number; moneda: string; cobroHoyCentimos: number; aFavorCentimos: number; enPrueba: boolean };

function plata(centimos: number, moneda: string) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: (moneda || 'eur').toUpperCase(), maximumFractionDigits: centimos % 100 ? 2 : 0 }).format(centimos / 100);
}

export function CambiarPlan({
  tier, interval, nombre, precioTexto, onCerrar,
}: {
  tier: string;
  interval: 'monthly' | 'yearly';
  nombre: string;
  /** "29 € por mes": lo que va a pagar desde la proxima renovacion. */
  precioTexto: string;
  onCerrar: () => void;
}) {
  const [presupuesto, setPresupuesto] = useState<Presupuesto | null>(null);
  const [estado, setEstado] = useState<'calculando' | 'listo' | 'cambiando' | 'hecho' | 'error'>('calculando');
  const [mensaje, setMensaje] = useState('');
  // El portal se dibuja recien montado en el navegador: nunca en el HTML del servidor.
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);

  useEffect(() => {
    let vivo = true;
    fetch('/api/stripe/cambiar-plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tier, interval, confirmar: false }) })
      .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (!vivo) return;
        if (!ok) { setEstado('error'); setMensaje(data.error ?? 'No pudimos calcular el cambio.'); return; }
        setPresupuesto(data); setEstado('listo');
      })
      .catch(() => { if (vivo) { setEstado('error'); setMensaje('Se cortó la conexión. Probá de nuevo.'); } });
    return () => { vivo = false; };
  }, [tier, interval]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && estado !== 'cambiando') onCerrar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [estado, onCerrar]);

  async function confirmar() {
    if (!presupuesto) return;
    setEstado('cambiando');
    try {
      const r = await fetch('/api/stripe/cambiar-plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tier, interval, confirmar: true, fecha: presupuesto.fecha }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setEstado('error'); setMensaje(data.error ?? 'No pudimos cambiar el plan.'); return; }
      // El banco pide verificar el pago: el plan cambia cuando se pague.
      if (data.estado === 'pendiente' && data.url) { window.location.href = data.url; return; }
      if (data.estado === 'pendiente') { setEstado('error'); setMensaje('Tu banco todavía no aprobó el cobro, así que tu plan sigue como estaba. Revisá tu tarjeta en «Gestionar» y probá de nuevo.'); return; }
      setEstado('hecho');
      // El plan nuevo lo escribe el aviso de Stripe (webhook), que llega en segundos.
      window.setTimeout(() => window.location.reload(), 2500);
    } catch {
      setEstado('error'); setMensaje('Se cortó la conexión. Revisá tu plan en un minuto antes de reintentar.');
    }
  }

  if (!montado) return null;
  return createPortal(
    <div className="cpl-velo" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && estado !== 'cambiando') onCerrar(); }}>
      <style>{CSS}</style>
      <div className="cpl sistema" role="dialog" aria-modal="true" aria-labelledby="cpl-titulo">
        {estado !== 'cambiando' && estado !== 'hecho' && (
          <button type="button" className="cpl-cerrar" onClick={onCerrar} aria-label="Cerrar"><X size={18} strokeWidth={2.4} /></button>
        )}
        <p className="cpl-ceja">Cambiar de plan</p>
        <h2 id="cpl-titulo" className="cpl-titulo">Pasar a {nombre}</h2>

        {estado === 'calculando' && <p className="cpl-txt cpl-cargando"><Loader2 size={18} className="cpl-gira" aria-hidden="true" /> Calculando cuánto sería…</p>}

        {(estado === 'listo' || estado === 'cambiando') && presupuesto && (
          <>
            <div className="cpl-montos">
              <div className="cpl-monto">
                <span className="cpl-monto-etq">Hoy</span>
                <strong>{presupuesto.cobroHoyCentimos > 0 ? plata(presupuesto.cobroHoyCentimos, presupuesto.moneda) : 'Sin cobro'}</strong>
                <small>
                  {presupuesto.enPrueba ? 'Seguís en tu prueba gratis.'
                    : presupuesto.cobroHoyCentimos > 0 ? 'La diferencia por lo que queda de este período.'
                    : presupuesto.aFavorCentimos > 0 ? `Te quedan ${plata(presupuesto.aFavorCentimos, presupuesto.moneda)} a favor para el próximo cobro.`
                    : 'No hay diferencia para cobrar.'}
                </small>
              </div>
              <div className="cpl-monto">
                <span className="cpl-monto-etq">Después</span>
                <strong>{precioTexto}</strong>
                <small>Desde tu próxima renovación.</small>
              </div>
            </div>
            <p className="cpl-txt">El cambio es inmediato: el plan nuevo ya queda activo. Se cobra con la tarjeta que tenés guardada.</p>
            <div className="cpl-acciones">
              <button type="button" className="cpl-btn cpl-btn--suave" onClick={onCerrar} disabled={estado === 'cambiando'}>Mejor no</button>
              <button type="button" className="cpl-btn" onClick={confirmar} disabled={estado === 'cambiando'}>
                {estado === 'cambiando' ? <><Loader2 size={16} className="cpl-gira" aria-hidden="true" /> Cambiando…</> : <>Confirmar cambio <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" /></>}
              </button>
            </div>
          </>
        )}

        {estado === 'hecho' && (
          <p className="cpl-txt cpl-hecho"><span aria-hidden="true"><Check size={18} strokeWidth={3} /></span> ¡Listo! Ya estás en {nombre}. Actualizando tu plan…</p>
        )}

        {estado === 'error' && (
          <>
            <p className="cpl-txt cpl-error" role="alert">{mensaje}</p>
            <div className="cpl-acciones"><button type="button" className="cpl-btn cpl-btn--suave" onClick={onCerrar}>Cerrar</button></div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

const CSS = `
.cpl-velo { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 16px; background: rgba(90, 50, 45, .35); backdrop-filter: blur(4px); }
.cpl { position: relative; width: min(480px, 100%); padding: 26px 24px 22px; border-radius: 28px; background: #fff; box-shadow: 0 30px 60px -24px rgba(120,50,40,.5); font-family: inherit; }
.cpl-cerrar { position: absolute; top: 14px; right: 14px; width: 40px; height: 40px; border-radius: 50%; border: 0; display: grid; place-items: center; cursor: pointer; background: var(--rubor, #FFF2EE); color: var(--pink-deep, #B03A3E); }
.cpl-ceja { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--pink-deep, #B03A3E); }
.cpl-titulo { margin: 6px 0 14px; font-size: 24px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink, #3B2A2C); }
.cpl-txt { margin: 12px 0 0; font-size: 14px; line-height: 1.55; color: var(--muted, #8A6F68); }
.cpl-cargando, .cpl-hecho { display: flex; align-items: center; gap: 10px; color: var(--ink, #3B2A2C); font-weight: 700; }
.cpl-hecho span { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: #E6F0E6; color: #4F7A55; flex-shrink: 0; }
.cpl-error { color: var(--pink-deep, #B03A3E); font-weight: 700; }
.cpl-montos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.cpl-monto { display: flex; flex-direction: column; gap: 3px; padding: 14px; border-radius: 18px; background: var(--crema, #FFFAF6); border: 1px solid var(--linea, #F6E7E1); }
.cpl-monto:first-child { background: #FFF1EC; border-color: #F6D3CB; }
.cpl-monto-etq { font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--muted, #8A6F68); }
.cpl-monto strong { font-size: 22px; font-weight: 900; color: var(--ink, #3B2A2C); }
.cpl-monto small { font-size: 12.5px; line-height: 1.4; color: var(--muted, #8A6F68); }
.cpl-acciones { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
.cpl-btn { display: inline-flex; align-items: center; gap: 8px; min-height: 46px; padding: 0 20px; border-radius: 99px; border: 0; cursor: pointer; font: inherit; font-size: 14.5px; font-weight: 800; background: var(--pink, #E64F55); color: #fff; box-shadow: 0 10px 20px -12px rgba(230,79,85,.9); }
.cpl-btn:disabled { opacity: .7; cursor: progress; }
.cpl-btn--suave { background: #fff; color: var(--ink, #3B2A2C); border: 1.5px solid var(--linea-fuerte, #E9CFC5); box-shadow: none; }
.cpl-gira { animation: cpl-gira 1s linear infinite; }
@keyframes cpl-gira { to { transform: rotate(360deg); } }
@media (max-width: 420px) { .cpl-montos { grid-template-columns: 1fr; } }
`;
