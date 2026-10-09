"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Heart, X } from "lucide-react";
import { marcarAvisoGratisVistoAction } from "@/src/features/studio/acceso-gratis-actions";

/**
 * El aviso de "tu prueba gratis termino". Pedido de la duena: "pero bien".
 *
 * Calido, no un muro: se puede cerrar ("Ahora no", la X, Esc o tocando
 * afuera), y cerrarlo lo marca como visto para que NO vuelva a salir. Despues
 * queda solo una franja discreta en el inicio (FranjaGratis). Las clases ya
 * estan con candado igual que para cualquiera sin plan: el aviso no bloquea
 * nada, solo explica que paso.
 *
 * Se oculta en el acto, sin esperar al servidor: la alumna no tiene que mirar
 * un modal "trabado" mientras se guarda la marca.
 */
export function AvisoFinGratis({ plan, nombre }: { plan: string | null; nombre: string }) {
  const [abierto, setAbierto] = useState(true);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const principal = useRef<HTMLAnchorElement>(null);

  function cerrar(despues?: () => void) {
    setAbierto(false);
    startTransition(async () => {
      await marcarAvisoGratisVistoAction();
      despues?.();
    });
  }

  useEffect(() => {
    if (!abierto) return;
    principal.current?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") cerrar(); };
    document.addEventListener("keydown", tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", tecla); document.body.style.overflow = antes; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  if (!abierto) return null;

  return (
    <div className="afg-fondo" onClick={(e) => { if (e.target === e.currentTarget) cerrar(); }}>
      <style>{CSS}</style>
      <div className="afg" role="dialog" aria-modal="true" aria-labelledby="afg-titulo" aria-describedby="afg-texto">
        <span className="afg-mancha afg-mancha--a" aria-hidden="true" />
        <span className="afg-mancha afg-mancha--b" aria-hidden="true" />
        <button type="button" className="afg-x" onClick={() => cerrar()} aria-label="Cerrar">
          <X size={18} strokeWidth={2.4} aria-hidden="true" />
        </button>

        <span className="afg-corazon" aria-hidden="true"><Heart size={30} strokeWidth={2.2} fill="currentColor" /></span>

        <h2 id="afg-titulo" className="afg-titulo">Tu prueba gratis terminó 💗</h2>
        <p id="afg-texto" className="afg-texto">
          Gracias por entrenar con Brunela{nombre ? `, ${nombre}` : ""}.
          {plan ? <> Estos días tuviste <strong>{plan}</strong> para vos.</> : null} Para seguir con tus clases, elegí un plan.
        </p>
        <p className="afg-nota">Tu progreso queda guardado: retomás donde lo dejaste.</p>

        <div className="afg-botones">
          <a
            ref={principal}
            href="/dashboard/plan"
            className="afg-btn afg-btn--lleno"
            onClick={(e) => { e.preventDefault(); cerrar(() => router.push("/dashboard/plan")); }}
          >
            Elegir mi plan <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
          </a>
          <button type="button" className="afg-btn" onClick={() => cerrar()}>Ahora no</button>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.afg-fondo { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(255, 236, 228, .72); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); animation: afg-fade .35s ease both; }
.afg { position: relative; overflow: hidden; isolation: isolate; width: 100%; max-width: 460px; padding: 40px 32px 28px; border-radius: 32px; text-align: center; background: linear-gradient(160deg, #FFF1EC, #FFFFFF 58%, #FFF4EC); border: 1px solid var(--pink-line); box-shadow: 0 40px 80px -36px rgba(176,58,62,.45), 0 0 0 8px rgba(255,255,255,.55); animation: afg-sube .6s var(--curva) both; }
.afg-mancha { position: absolute; z-index: -1; border-radius: 50%; pointer-events: none; }
.afg-mancha--a { width: 260px; height: 260px; left: -90px; top: -120px; background: radial-gradient(circle, rgba(255,205,185,.7), transparent 70%); }
.afg-mancha--b { width: 220px; height: 220px; right: -80px; bottom: -110px; background: radial-gradient(circle, rgba(255,190,190,.55), transparent 70%); }
.afg-x { position: absolute; top: 14px; right: 14px; width: 38px; height: 38px; border-radius: 99px; border: 0; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; background: rgba(255,255,255,.8); color: var(--muted); transition: background .2s, color .2s; }
.afg-x:hover { background: var(--rubor); color: var(--pink-deep); }
.afg-x:focus-visible, .afg-btn:focus-visible { outline: none; box-shadow: 0 0 0 4px rgba(230,79,85,.25); }
.afg-corazon { width: 76px; height: 76px; margin: 0 auto 18px; border-radius: 26px; display: flex; align-items: center; justify-content: center; color: var(--pink); background: #fff; box-shadow: 0 16px 30px -18px rgba(230,79,85,.8), inset 0 0 0 1.5px var(--pink-line); animation: afg-latido 2.4s ease-in-out .7s infinite; }
.afg-titulo { font-family: var(--font-display), sans-serif; font-size: 27px; font-weight: 900; letter-spacing: -0.02em; line-height: 1.15; color: var(--ink); }
.afg-texto { margin: 12px auto 0; max-width: 360px; font-size: 15.5px; line-height: 1.6; color: var(--ink); }
.afg-texto strong { font-weight: 800; color: var(--pink-deep); }
.afg-nota { margin-top: 8px; font-size: 13px; color: var(--muted); }
.afg-botones { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
.afg-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 50px; padding: 0 24px; border-radius: 99px; cursor: pointer; text-decoration: none; font: inherit; font-size: 15px; font-weight: 800; color: var(--muted); background: transparent; border: 0; transition: background .2s, color .2s, transform .25s var(--curva), gap .25s var(--curva); }
.afg-btn:hover { color: var(--pink-deep); background: rgba(255,255,255,.7); }
.afg-btn--lleno { color: #fff; background: var(--pink); box-shadow: 0 16px 28px -14px rgba(230,79,85,.9); }
.afg-btn--lleno:hover { color: #fff; background: var(--pink-mid); transform: translateY(-1px); gap: 11px; }
@keyframes afg-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes afg-sube { from { opacity: 0; transform: translateY(18px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes afg-latido { 0%, 100% { transform: scale(1); } 12% { transform: scale(1.08); } 24% { transform: scale(1); } 36% { transform: scale(1.05); } 48% { transform: scale(1); } }
@media (max-width: 480px) { .afg { padding: 34px 20px 20px; border-radius: 28px; } .afg-titulo { font-size: 23px; } }
@media (prefers-reduced-motion: reduce) { .afg-fondo, .afg, .afg-corazon { animation: none; } }
`;
