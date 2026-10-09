import Link from "next/link";
import { ArrowRight, Gift, Heart } from "lucide-react";
import { PLAN_LABEL, fechaLarga, progreso, textoRestante, type PlanPago } from "@/src/features/studio/acceso-gratis-reglas";

/**
 * Lo que ve la alumna de su acceso gratis. Server components: los iconos se
 * renderizan aca (trampa 6).
 *
 *   TarjetaGratis  -> mientras dura (inicio y Mi plan)
 *   FranjaGratis   -> cuando ya termino, arriba del inicio, discreta
 *
 * El aviso grande de fin (modal) es components/aviso-fin-gratis.tsx.
 */

export function TarjetaGratis({ plan, hasta, desde, compacta }: { plan: PlanPago; hasta: string; desde: string | null; compacta?: boolean }) {
  const pct = progreso(desde, hasta);
  const restante = textoRestante(hasta);
  return (
    <section className={"agt" + (compacta ? " agt--compacta" : "")} aria-label="Tu acceso gratis">
      <style>{CSS}</style>
      <span className="agt-mancha" aria-hidden="true" />
      <span className="agt-burbuja" aria-hidden="true"><Gift size={20} strokeWidth={2.2} /></span>
      <div className="agt-cuerpo">
        <p className="agt-titulo">Estás usando <strong>{PLAN_LABEL[plan]}</strong> gratis</p>
        <p className="agt-sub">
          <span className="agt-restante">{restante[0].toUpperCase() + restante.slice(1)}</span>
          <span aria-hidden="true"> · </span>
          hasta el {fechaLarga(hasta)}
        </p>
        <div className="agt-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Cuánto de tu acceso gratis ya pasó">
          <span style={{ width: `${Math.max(4, pct)}%` }} />
        </div>
      </div>
      <Link href="/dashboard/plan" className="agt-btn">
        Elegir mi plan <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
      </Link>
    </section>
  );
}

export function FranjaGratis({ plan, hasta }: { plan: PlanPago | null; hasta: string }) {
  return (
    <div className="agf" role="note">
      <style>{CSS}</style>
      <Heart size={15} strokeWidth={2.4} aria-hidden="true" className="agf-ico" />
      <p>
        Tu prueba gratis{plan ? <> de <strong>{PLAN_LABEL[plan]}</strong></> : null} terminó el {fechaLarga(hasta)}. Tus clases te esperan.
      </p>
      <Link href="/dashboard/plan" className="agf-link">Elegir mi plan <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" /></Link>
    </div>
  );
}

const CSS = `
.agt { position: relative; overflow: hidden; isolation: isolate; display: flex; align-items: center; gap: 18px; padding: 20px 22px; margin-bottom: 18px; border-radius: 28px; background: linear-gradient(120deg, #FFF1EC, #FFF7F3 55%, #FFEFE6); border: 1px solid var(--pink-line); box-shadow: var(--sombra); animation: agt-entra .6s var(--curva) both; }
.agt-mancha { position: absolute; z-index: -1; width: 220px; height: 220px; right: -60px; top: -110px; border-radius: 50%; background: radial-gradient(circle, rgba(255,205,185,.65), transparent 70%); pointer-events: none; }
.agt-burbuja { width: 48px; height: 48px; flex-shrink: 0; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; background: #fff; color: var(--pink-deep); box-shadow: 0 8px 18px -12px rgba(230,79,85,.7); }
.agt-cuerpo { flex: 1; min-width: 0; }
.agt-titulo { font-size: 17px; font-weight: 800; letter-spacing: -0.01em; color: var(--ink); }
.agt-titulo strong { font-weight: 900; color: var(--pink-deep); }
.agt-sub { margin-top: 2px; font-size: 13.5px; color: var(--muted); }
.agt-restante { font-weight: 800; color: var(--ink); }
.agt-barra { margin-top: 10px; height: 8px; border-radius: 99px; background: rgba(255,255,255,.85); box-shadow: inset 0 0 0 1px var(--linea); overflow: hidden; max-width: 420px; }
.agt-barra span { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #FFB7A4, var(--pink)); transition: width .8s var(--curva); }
.agt-btn { display: inline-flex; align-items: center; gap: 8px; height: 46px; padding: 0 22px; border-radius: 99px; flex-shrink: 0; text-decoration: none; font-size: 14px; font-weight: 800; color: #fff; background: var(--pink); box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); transition: background .2s, transform .25s var(--curva), gap .25s var(--curva); }
.agt-btn:hover { background: var(--pink-mid); transform: translateY(-1px); gap: 11px; }
.agt--compacta { margin-bottom: 0; }
@keyframes agt-entra { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

.agf { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 16px; margin-bottom: 16px; border-radius: 18px; background: var(--rubor); border: 1px solid var(--pink-line); font-size: 13.5px; color: var(--ink); }
.agf p { flex: 1 1 240px; min-width: 0; line-height: 1.5; }
.agf strong { font-weight: 800; }
.agf-ico { color: var(--pink); flex-shrink: 0; }
.agf-link { display: inline-flex; align-items: center; gap: 5px; font-weight: 800; color: var(--pink-deep); text-decoration: none; white-space: nowrap; }
.agf-link:hover { text-decoration: underline; text-underline-offset: 3px; }

@media (max-width: 640px) {
  .agt { flex-wrap: wrap; padding: 18px; gap: 14px; }
  .agt-cuerpo { flex: 1 1 calc(100% - 66px); }
  .agt-btn { width: 100%; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) { .agt { animation: none; } .agt-barra span { transition: none; } }
`;
