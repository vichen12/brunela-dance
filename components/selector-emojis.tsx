'use client';

import { useEffect, useRef, useState } from 'react';
import { Smile } from 'lucide-react';

/**
 * El boton de emojis del chat (2026-11-11: "antes me dejaba poner emojis").
 *
 * Una grilla corta, elegida para un estudio de ballet: no hace falta el
 * catalogo entero, y asi no se carga ninguna libreria. En el celular el
 * teclado ya trae los suyos; esto es sobre todo para la compu.
 *
 * `onElegir` recibe el emoji: quien lo usa decide donde insertarlo.
 */
const EMOJIS = [
  '🩰', '💗', '❤️', '🥰', '😍', '😊', '😄', '😂',
  '🙌', '👏', '💪', '🔥', '✨', '🌸', '💐', '🎉',
  '👍', '🙏', '🤗', '😘', '😉', '🤩', '🥹', '😅',
  '😢', '😮', '🤔', '😴', '💃', '🎶', '⭐', '☀️',
];

export function SelectorEmojis({ onElegir }: { onElegir: (emoji: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierto]);

  return (
    <div className="sem" ref={caja}>
      <style>{CSS}</style>
      <button
        type="button"
        className={'sem-boton' + (abierto ? ' es-abierto' : '')}
        onClick={() => setAbierto((v) => !v)}
        aria-label="Agregar un emoji"
        aria-expanded={abierto}
        title="Emojis"
      >
        <Smile size={21} strokeWidth={2} aria-hidden="true" />
      </button>
      {abierto && (
        <div className="sem-panel" role="dialog" aria-label="Elegí un emoji">
          {EMOJIS.map((e) => (
            <button key={e} type="button" className="sem-op" onClick={() => onElegir(e)} aria-label={e}>{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}

const CSS = `
.sem { position: relative; flex-shrink: 0; }
.sem-boton { width: 44px; height: 44px; border-radius: 50%; border: 0; display: grid; place-items: center; cursor: pointer; background: transparent; color: var(--muted, #8A6F68); transition: background .2s, color .2s; }
.sem-boton:hover, .sem-boton.es-abierto { background: var(--rubor, #FFF2EE); color: var(--pink-deep, #B03A3E); }
.sem-panel { position: absolute; z-index: 30; bottom: calc(100% + 10px); left: 0; width: min(320px, calc(100vw - 32px)); padding: 10px; display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; border-radius: 20px; background: #fff; border: 1px solid var(--linea, #F6E7E1); box-shadow: 0 24px 48px -20px rgba(120,50,40,.45); }
.sem-op { aspect-ratio: 1; min-height: 36px; border: 0; border-radius: 10px; background: transparent; font-size: 21px; line-height: 1; cursor: pointer; transition: background .15s, transform .15s; }
.sem-op:hover { background: var(--rubor, #FFF2EE); transform: scale(1.15); }
@media (prefers-reduced-motion: reduce) { .sem-op { transition: none; } .sem-op:hover { transform: none; } }
`;
