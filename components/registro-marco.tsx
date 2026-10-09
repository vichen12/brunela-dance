import { fuenteSistema } from "@/src/lib/fuente-sistema";

/**
 * El marco de las pantallas del final del alta (/registro/plan y
 * /registro/activando): la misma tarjeta blanca sobre manchas tibias que el
 * onboarding, para que pagar se sienta parte del mismo recorrido.
 *
 * Estas pantallas no viven bajo el layout del estudio -- a proposito: es el
 * layout el que manda aca a quien no tiene acceso, y si estuvieran debajo se
 * redirigirian a si mismas.
 */
export function RegistroMarco({ children, ancho = 680 }: { children: React.ReactNode; ancho?: number }) {
  return (
    <main className={`rm-page sistema ${fuenteSistema.variable}`}>
      <section className="rm-card" style={{ width: `min(${ancho}px, 100%)` }}>{children}</section>
      <style>{CSS}</style>
    </main>
  );
}

const CSS = `
.rm-page { position: relative; isolation: isolate; overflow: hidden; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 28px 16px 40px; }
.rm-page::before, .rm-page::after { content: ""; position: absolute; z-index: -1; border-radius: 50%; pointer-events: none; }
.rm-page::before { width: 620px; height: 620px; left: -200px; top: -260px; background: radial-gradient(circle, rgba(255,226,211,.75), transparent 66%); }
.rm-page::after { width: 560px; height: 560px; right: -200px; bottom: -240px; background: radial-gradient(circle, rgba(253,236,236,.9), transparent 66%); }
.rm-card { background: #fff; border: 1px solid var(--linea); border-radius: 32px; padding: 30px 32px; box-shadow: var(--sombra-alta); animation: rm-entra .7s var(--curva) both; }
@keyframes rm-entra { from { opacity: 0; transform: translateY(14px) scale(.985); } to { opacity: 1; transform: none; } }

.rm-pasos { display: flex; gap: 6px; margin-bottom: 18px; }
.rm-pasos span { height: 5px; flex: 1; border-radius: 99px; background: #F6BDB6; }
.rm-pasos .activo { background: var(--pink); }
.rm-kicker { display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px 5px 10px; border-radius: 99px; background: var(--rubor); font-size: 12.5px; font-weight: 800; color: var(--pink-deep); }
.rm-kicker::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--pink); }
.rm-title { font-size: 34px; line-height: 1.08; font-weight: 900; letter-spacing: -0.025em; color: var(--ink); margin: 14px 0 0; }
.rm-title span { color: var(--pink); }
.rm-sub { margin: 10px 0 0; font-size: 14.5px; color: var(--muted); line-height: 1.6; }
.rm-aviso { margin-top: 16px; border-radius: 18px; padding: .85rem 1rem; font-size: .88rem; font-weight: 700; line-height: 1.45; border: 1px solid var(--pink-line); background: var(--pink-wash); color: var(--pink-deep); }
.rm-form { margin-top: 24px; display: grid; gap: 18px; }
.rm-submit { width: 100%; min-height: 56px; border: 0; border-radius: 999px; background: var(--pink); color: #fff; cursor: pointer; font-family: inherit; font-size: 16px; font-weight: 800; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); transition: background .2s, transform .3s var(--curva), box-shadow .3s; }
.rm-submit:hover { background: var(--pink-mid); transform: translateY(-2px); }
.rm-nota { margin: -6px 0 0; text-align: center; font-size: 12.5px; color: var(--muted); }
.rm-pie { margin-top: 18px; display: flex; justify-content: center; }
.rm-salir { border: 0; background: transparent; cursor: pointer; font: inherit; font-size: 13.5px; font-weight: 800; color: var(--muted); text-decoration: underline; text-underline-offset: 3px; padding: 6px 10px; border-radius: 99px; }
.rm-salir:hover { color: var(--pink-deep); background: var(--rubor); }
@media (max-width: 520px) { .rm-card { padding: 24px 18px 22px; border-radius: 26px; } .rm-title { font-size: 28px; } }
@media (prefers-reduced-motion: reduce) { .rm-card { animation: none; } }
`;
