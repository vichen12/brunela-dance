"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import { ProveedorIcono } from "@/components/proveedor-icono";
import { textoUnirse, type Proveedor } from "@/src/features/studio/enlace-clase";

/**
 * Cartel "Tu clase empieza en X min" con el boton grande para unirse.
 *
 * Aparece arriba del inicio, de la agenda y de la pagina de la clase cuando la
 * alumna tiene una clase RESERVADA que empieza en menos de 1 h o esta en curso.
 * El servidor decide si se monta; aca solo corre la cuenta regresiva.
 *
 * Props: solo cadenas (trampa 6). El icono del proveedor se elige de este lado
 * a partir de la cadena `proveedor`.
 *
 * ⚠️ El primer render no muestra minutos: el reloj del servidor y el del
 *    navegador no coinciden, y un numero distinto romperia la hidratacion.
 *    Mientras tanto dice "Tu clase empieza pronto".
 */
export function ClaseInminente({
  titulo,
  inicio,
  fin,
  joinUrl,
  proveedor,
  passcode,
  perfil,
}: {
  titulo: string;
  inicio: string;
  fin: string;
  joinUrl: string | null;
  proveedor: Proveedor | null;
  passcode: string | null;
  /** Pagina de la clase, para cuando todavia no hay enlace. null = ya estamos ahi. */
  perfil: string | null;
}) {
  const [ahora, setAhora] = useState<number | null>(null);

  useEffect(() => {
    setAhora(Date.now());
    const id = window.setInterval(() => setAhora(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  const ini = new Date(inicio).getTime();
  const fi = new Date(fin).getTime();
  // Termino mientras la pagina estaba abierta: el cartel se va solo.
  if (ahora !== null && ahora >= fi) return null;

  let titular = "Tu clase empieza pronto";
  if (ahora !== null) {
    const min = Math.ceil((ini - ahora) / 60000);
    titular = min <= 0 ? "Tu clase ya empezó" : min === 1 ? "Tu clase empieza en 1 min" : `Tu clase empieza en ${min} min`;
  }
  const enCurso = ahora !== null && ahora >= ini;

  return (
    <section className={"ci" + (enCurso ? " es-ya" : "")} aria-live="polite">
      <style>{CSS}</style>
      <span className="ci-mancha" aria-hidden="true" />
      <span className="ci-pulso" aria-hidden="true"><span /></span>
      <div className="ci-txt">
        <p className="ci-titular">{titular}</p>
        <p className="ci-clase">{titulo}</p>
        {passcode && joinUrl && (
          <p className="ci-codigo"><KeyRound size={13} strokeWidth={2.4} aria-hidden="true" /> Código <b>{passcode}</b></p>
        )}
        {!joinUrl && <p className="ci-nota">El enlace aparece acá antes de la clase.</p>}
      </div>
      {joinUrl && proveedor ? (
        <a href={joinUrl} target="_blank" rel="noreferrer" className="ci-btn">
          <ProveedorIcono proveedor={proveedor} size={19} /> {textoUnirse(proveedor)}
        </a>
      ) : perfil ? (
        <Link href={perfil as never} className="ci-btn ci-btn--suave">
          Ver la clase <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
        </Link>
      ) : null}
    </section>
  );
}

const CSS = `
.ci { position: relative; overflow: hidden; display: flex; align-items: center; gap: 18px; padding: 20px 22px; border-radius: 28px; background: linear-gradient(120deg, #FFE7DF, #FFF4EE 55%, #FFE9DF); border: 1.5px solid var(--pink-line); box-shadow: var(--sombra-alta); animation: ci-entra .6s var(--curva) both; }
.ci-mancha { position: absolute; right: -80px; top: -120px; width: 300px; height: 300px; border-radius: 50%; background: radial-gradient(circle, rgba(255,170,140,.45), transparent 65%); pointer-events: none; }
.ci > :not(.ci-mancha) { position: relative; }
.ci-pulso { width: 54px; height: 54px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; background: #fff; box-shadow: var(--sombra); }
.ci-pulso span { width: 16px; height: 16px; border-radius: 50%; background: var(--pink); box-shadow: 0 0 0 0 rgba(230,79,85,.55); animation: ci-late 1.8s ease-out infinite; }
.ci-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ci-titular { font-size: 14px; font-weight: 800; color: var(--pink-deep); }
.ci-clase { font-size: clamp(19px, 2.2vw, 24px); font-weight: 900; letter-spacing: -0.02em; line-height: 1.15; color: var(--ink); overflow-wrap: anywhere; }
.ci-codigo { display: inline-flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 13px; color: var(--muted); }
.ci-codigo svg { color: var(--pink-deep); }
.ci-codigo b { color: var(--ink); letter-spacing: .06em; }
.ci-nota { margin-top: 2px; font-size: 13.5px; color: var(--muted); }
.ci-btn { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; gap: 9px; height: 58px; padding: 0 28px; border-radius: 99px; background: var(--pink); color: #fff; font-size: 16.5px; font-weight: 900; text-decoration: none; white-space: nowrap; box-shadow: 0 16px 30px -14px rgba(230,79,85,.95); transition: transform .3s var(--curva), background .2s; }
.ci-btn:hover { background: var(--pink-mid); transform: translateY(-2px); }
.ci-btn--suave { background: #fff; color: var(--ink); border: 1.5px solid var(--linea-fuerte); box-shadow: none; }
.ci-btn--suave:hover { background: var(--rubor); }
@keyframes ci-late { 0% { box-shadow: 0 0 0 0 rgba(230,79,85,.55); } 80%, 100% { box-shadow: 0 0 0 16px rgba(230,79,85,0); } }
@keyframes ci-entra { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@media (max-width: 640px) {
  .ci { flex-wrap: wrap; gap: 14px; padding: 16px; border-radius: 24px; }
  .ci-pulso { width: 44px; height: 44px; }
  .ci-txt { flex-basis: calc(100% - 60px); padding-right: 44px; }
  .ci-btn { width: 100%; height: 54px; }
}
@media (prefers-reduced-motion: reduce) { .ci, .ci-pulso span { animation: none; } .ci-btn { transition: none; } }
`;
