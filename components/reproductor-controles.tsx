"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { Captions, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";

/**
 * Controles propios del reproductor (2026-11-12).
 *
 * POR QUE NO LOS DEL NAVEGADOR
 *   "Si adelanto con la barrita no se adelanta bien, se corta, se vuelve para
 *   atras. Y el doble toque tampoco anda." Dos causas:
 *
 *   1. Al ARRASTRAR la barra nativa, el navegador pide un salto por cada
 *      pixel. Con hls.js (Chrome, Android) cada salto descarta lo cargado y
 *      pide otro pedazo; con decenas seguidos, el motor se acomoda al ultimo
 *      pedazo que llego y el video "vuelve para atras". Aca la barra se mueve
 *      con el dedo pero el video salta UNA vez, al soltar.
 *
 *   2. Con `controls`, el <video> se queda con los toques: en el iPhone el
 *      doble toque casi nunca llegaba a nuestro codigo, y en la compu el doble
 *      clic ponia pantalla completa. Ahora una capa encima recibe todo.
 *
 * GESTOS
 *   Un toque: muestra/oculta los controles (en la compu, un clic = play/pausa).
 *   Doble toque o doble clic a un costado: -10 / +10 s. Cada toque extra
 *   seguido suma otros 10, como en YouTube. Doble clic al centro: pantalla
 *   completa. Teclado: espacio/K, flechas, F, M.
 */

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  contenedorRef: RefObject<HTMLDivElement | null>;
  listo: boolean;
  duracionRespaldo: number;
  /** Selector de idioma del audio (ya armado por el reproductor). */
  selectorAudio?: ReactNode;
  /** Hay subtitulos: aparece el boton. */
  haySubtitulos: boolean;
  /** Idioma del subtitulo que se ve, o null si estan apagados. */
  subtituloActivo: string | null;
  onSubtitulos: () => void;
  /** Con un audio en otro idioma sonando, silenciar actua sobre ESE audio. */
  audioRef?: RefObject<HTMLAudioElement | null>;
};

const SALTO = 10;
const VENTANA_DOBLE_MS = 280;
const OCULTAR_MS = 2600;

function reloj(seg: number): string {
  if (!Number.isFinite(seg) || seg < 0) seg = 0;
  const s = Math.floor(seg % 60);
  const m = Math.floor((seg / 60) % 60);
  const h = Math.floor(seg / 3600);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function ControlesReproductor({ videoRef, contenedorRef, listo, duracionRespaldo, selectorAudio, haySubtitulos, subtituloActivo, onSubtitulos, audioRef }: Props) {
  const subtitulosActivos = subtituloActivo !== null;
  const [enPausa, setEnPausa] = useState(true);
  const [tiempo, setTiempo] = useState(0);
  const [duracion, setDuracion] = useState(duracionRespaldo || 0);
  const [cargado, setCargado] = useState(0);
  const [esperando, setEsperando] = useState(false);
  const [mudo, setMudo] = useState(false);
  const [completa, setCompleta] = useState(false);
  const [visibles, setVisibles] = useState(true);
  // Mientras arrastra: donde va a caer. null = no esta arrastrando.
  const [arrastre, setArrastre] = useState<number | null>(null);
  const [salto, setSalto] = useState<{ lado: number; total: number; clave: number } | null>(null);

  const barraRef = useRef<HTMLDivElement>(null);
  const ocultarRef = useRef<number | null>(null);
  const toqueRef = useRef<{ lado: number; at: number; timer: number | null; racha: number } | null>(null);
  // Hacia donde ya se pidio ir: varios toques seguidos suman sobre ESTE valor y
  // no sobre currentTime, que tarda en moverse mientras carga.
  const destinoRef = useRef<number | null>(null);

  const total = duracion || duracionRespaldo || 0;

  // ── Estado del video ────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const alTiempo = () => {
      setTiempo(v.currentTime);
      if (Number.isFinite(v.duration) && v.duration > 0) setDuracion(v.duration);
      const b = v.buffered;
      for (let i = 0; i < b.length; i++) {
        if (b.start(i) <= v.currentTime + 0.5 && b.end(i) >= v.currentTime) { setCargado(b.end(i)); break; }
      }
    };
    const alPlay = () => setEnPausa(false);
    const alPausa = () => { setEnPausa(true); setVisibles(true); };
    const alEsperar = () => setEsperando(true);
    const alSeguir = () => setEsperando(false);
    const alSaltar = () => { destinoRef.current = null; setEsperando(false); };
    const alVolumen = () => { if (!audioRef?.current) setMudo(v.muted || v.volume === 0); };
    v.addEventListener("timeupdate", alTiempo);
    v.addEventListener("progress", alTiempo);
    v.addEventListener("durationchange", alTiempo);
    v.addEventListener("loadedmetadata", alTiempo);
    v.addEventListener("play", alPlay);
    v.addEventListener("pause", alPausa);
    v.addEventListener("waiting", alEsperar);
    v.addEventListener("playing", alSeguir);
    v.addEventListener("canplay", alSeguir);
    v.addEventListener("seeked", alSaltar);
    v.addEventListener("volumechange", alVolumen);
    setEnPausa(v.paused);
    return () => {
      v.removeEventListener("timeupdate", alTiempo);
      v.removeEventListener("progress", alTiempo);
      v.removeEventListener("durationchange", alTiempo);
      v.removeEventListener("loadedmetadata", alTiempo);
      v.removeEventListener("play", alPlay);
      v.removeEventListener("pause", alPausa);
      v.removeEventListener("waiting", alEsperar);
      v.removeEventListener("playing", alSeguir);
      v.removeEventListener("canplay", alSeguir);
      v.removeEventListener("seeked", alSaltar);
      v.removeEventListener("volumechange", alVolumen);
    };
  }, [videoRef, audioRef]);

  // Al cambiar de idioma, el boton de sonido muestra el del audio que suena.
  useEffect(() => {
    const s = audioRef?.current ?? videoRef.current;
    if (s) setMudo(audioRef?.current ? s.muted : s.muted || s.volume === 0);
  }, [audioRef, videoRef]);

  useEffect(() => {
    const alCambiar = () => setCompleta(document.fullscreenElement === contenedorRef.current);
    document.addEventListener("fullscreenchange", alCambiar);
    return () => document.removeEventListener("fullscreenchange", alCambiar);
  }, [contenedorRef]);

  // ── Mostrar / ocultar ───────────────────────────────────────────────────
  const mostrar = useCallback(() => {
    setVisibles(true);
    if (ocultarRef.current) window.clearTimeout(ocultarRef.current);
    ocultarRef.current = window.setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused) setVisibles(false);
    }, OCULTAR_MS);
  }, [videoRef]);
  useEffect(() => () => { if (ocultarRef.current) window.clearTimeout(ocultarRef.current); }, []);

  // ── Acciones ────────────────────────────────────────────────────────────
  const alternarPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || !listo) return;
    if (v.paused || v.ended) {
      // El audio en otro idioma arranca en el MISMO toque: el iPhone no deja
      // sonar un audio que no empezo por un gesto.
      const a = audioRef?.current;
      if (a) { a.currentTime = v.currentTime; void a.play().catch(() => {}); }
      void v.play().catch(() => {});
    } else v.pause();
    mostrar();
  }, [videoRef, audioRef, listo, mostrar]);

  const irA = useCallback((seg: number) => {
    const v = videoRef.current;
    if (!v || !listo) return;
    const fin = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : total || Infinity;
    const destino = Math.max(0, Math.min(fin - 0.5, seg));
    destinoRef.current = destino;
    v.currentTime = destino;
    setTiempo(destino);
  }, [videoRef, listo, total]);

  const saltar = useCallback((lado: number, racha: number) => {
    const v = videoRef.current;
    if (!v) return;
    const desde = destinoRef.current ?? v.currentTime;
    irA(desde + lado * SALTO);
    setSalto({ lado, total: racha * SALTO, clave: Date.now() });
  }, [videoRef, irA]);

  const pantallaCompleta = useCallback(() => {
    const c = contenedorRef.current;
    const v = videoRef.current;
    if (!c || !v) return;
    if (document.fullscreenElement) { void document.exitFullscreen().catch(() => {}); return; }
    if (c.requestFullscreen) { void c.requestFullscreen().catch(() => {}); return; }
    // iPhone: no deja poner en pantalla completa un div, solo el video (con
    // los controles de Apple, que en pantalla completa si andan bien).
    const ios = v as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    ios.webkitEnterFullscreen?.();
  }, [contenedorRef, videoRef]);

  const alternarMudo = useCallback(() => {
    const s = audioRef?.current ?? videoRef.current;
    if (!s) return;
    s.muted = !s.muted;
    if (!s.muted && s.volume === 0) s.volume = 1;
    setMudo(s.muted);
  }, [videoRef, audioRef]);

  // ── Toques sobre el video ───────────────────────────────────────────────
  function alSoltar(e: ReactPointerEvent<HTMLDivElement>) {
    if (!listo) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const lado = x < 0.36 ? -1 : x > 0.64 ? 1 : 0;
    const ahora = Date.now();
    const previo = toqueRef.current;
    const raton = e.pointerType === "mouse";

    // Segundo toque (o siguientes) del mismo lado, a tiempo: salto.
    if (previo && ahora - previo.at < (previo.racha > 1 ? 650 : VENTANA_DOBLE_MS) && previo.lado === lado) {
      if (previo.timer) window.clearTimeout(previo.timer);
      if (lado === 0) {
        toqueRef.current = null;
        pantallaCompleta();
        return;
      }
      const racha = previo.racha + 1;
      saltar(lado, racha - 1);
      toqueRef.current = { lado, at: ahora, timer: null, racha };
      return;
    }

    // Primer toque: se espera un instante por si viene el segundo.
    if (previo?.timer) window.clearTimeout(previo.timer);
    const timer = window.setTimeout(() => {
      toqueRef.current = null;
      if (raton) alternarPlay();
      else if (visibles && !enPausa) setVisibles(false);
      else mostrar();
    }, VENTANA_DOBLE_MS);
    toqueRef.current = { lado, at: ahora, timer, racha: 1 };
  }

  // ── Barra de tiempo ─────────────────────────────────────────────────────
  function segundosEn(clientX: number): number {
    const b = barraRef.current;
    if (!b || !total) return 0;
    const r = b.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * total;
  }
  function barraAbajo(e: ReactPointerEvent<HTMLDivElement>) {
    if (!listo || !total) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrastre(segundosEn(e.clientX));
    mostrar();
  }
  function barraMueve(e: ReactPointerEvent<HTMLDivElement>) {
    if (arrastre === null) return;
    setArrastre(segundosEn(e.clientX));
  }
  function barraArriba(e: ReactPointerEvent<HTMLDivElement>) {
    if (arrastre === null) return;
    const destino = segundosEn(e.clientX);
    setArrastre(null);
    irA(destino); // UN solo salto, al soltar
    mostrar();
  }
  function barraTeclado(e: ReactKeyboardEvent<HTMLDivElement>) {
    const v = videoRef.current;
    if (!v) return;
    const paso = e.shiftKey ? 30 : 5;
    if (e.key === "ArrowRight") { e.preventDefault(); irA((destinoRef.current ?? v.currentTime) + paso); }
    if (e.key === "ArrowLeft") { e.preventDefault(); irA((destinoRef.current ?? v.currentTime) - paso); }
    if (e.key === "Home") { e.preventDefault(); irA(0); }
    if (e.key === "End") { e.preventDefault(); irA(total); }
  }

  // Atajos con el reproductor enfocado (no en toda la pagina: el chat y los
  // formularios usan el espacio).
  function teclado(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const v = videoRef.current;
    if (!v) return;
    const k = e.key.toLowerCase();
    if (k === " " || k === "k") { e.preventDefault(); alternarPlay(); }
    else if (k === "arrowright" || k === "l") { e.preventDefault(); saltar(1, 1); }
    else if (k === "arrowleft" || k === "j") { e.preventDefault(); saltar(-1, 1); }
    else if (k === "f") { e.preventDefault(); pantallaCompleta(); }
    else if (k === "m") { e.preventDefault(); alternarMudo(); }
  }

  const mostrado = arrastre ?? tiempo;
  const pct = total > 0 ? (mostrado / total) * 100 : 0;
  const pctCargado = total > 0 ? Math.min(100, (cargado / total) * 100) : 0;
  const controlesVisibles = visibles || enPausa || arrastre !== null;

  return (
    <div
      className={"rpc" + (controlesVisibles ? " es-visible" : "")}
      tabIndex={0}
      role="group"
      aria-label="Reproductor de la clase. Espacio para reproducir o pausar, flechas para adelantar o atrasar 10 segundos."
      onKeyDown={teclado}
      onPointerMove={(e) => { if (e.pointerType === "mouse") mostrar(); }}
    >
      {/* Capa de toques: encima del video y debajo de los botones. */}
      <div className="rpc-toques" onPointerUp={alSoltar} onContextMenu={(e) => e.preventDefault()} />

      {salto && (
        <div key={salto.clave} className={"rpc-salto " + (salto.lado < 0 ? "es-izq" : "es-der")} aria-hidden="true" onAnimationEnd={() => setSalto(null)}>
          {salto.lado < 0 ? <RotateCcw size={22} strokeWidth={2.4} /> : <RotateCw size={22} strokeWidth={2.4} />}
          <span>{salto.total} s</span>
        </div>
      )}

      {listo && (esperando || enPausa) && (
        <button type="button" className={"rpc-centro" + (esperando && !enPausa ? " es-cargando" : "")} onClick={alternarPlay} aria-label={enPausa ? "Reproducir" : "Cargando"}>
          {esperando && !enPausa ? <span className="rpc-giro" aria-hidden="true" /> : <Play size={30} strokeWidth={2.2} fill="currentColor" />}
        </button>
      )}

      {selectorAudio && <div className="rpc-arriba">{selectorAudio}</div>}

      <div className="rpc-barra-abajo" onPointerUp={(e) => e.stopPropagation()}>
        <div
          ref={barraRef}
          className={"rpc-tiempo" + (arrastre !== null ? " es-arrastrando" : "")}
          role="slider"
          tabIndex={0}
          aria-label="Posición en la clase"
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(mostrado)}
          aria-valuetext={`${reloj(mostrado)} de ${reloj(total)}`}
          onPointerDown={barraAbajo}
          onPointerMove={barraMueve}
          onPointerUp={barraArriba}
          onPointerCancel={() => setArrastre(null)}
          onKeyDown={barraTeclado}
        >
          <div className="rpc-riel">
            <div className="rpc-cargado" style={{ width: `${pctCargado}%` }} />
            <div className="rpc-visto" style={{ width: `${pct}%` }} />
            <div className="rpc-perilla" style={{ left: `${pct}%` }} />
          </div>
          {arrastre !== null && <span className="rpc-burbuja" style={{ left: `${pct}%` }}>{reloj(arrastre)}</span>}
        </div>

        <div className="rpc-botones">
          <button type="button" className="rpc-btn" onClick={alternarPlay} aria-label={enPausa ? "Reproducir" : "Pausar"}>
            {enPausa ? <Play size={20} strokeWidth={2.2} fill="currentColor" /> : <Pause size={20} strokeWidth={2.2} fill="currentColor" />}
          </button>
          <button type="button" className="rpc-btn" onClick={() => saltar(-1, 1)} aria-label="Atrasar 10 segundos"><RotateCcw size={19} strokeWidth={2.2} /></button>
          <button type="button" className="rpc-btn" onClick={() => saltar(1, 1)} aria-label="Adelantar 10 segundos"><RotateCw size={19} strokeWidth={2.2} /></button>
          <span className="rpc-reloj">{reloj(mostrado)} <i>/ {reloj(total)}</i></span>
          <span className="rpc-hueco" />
          <button type="button" className="rpc-btn rpc-solo-compu" onClick={alternarMudo} aria-label={mudo ? "Activar sonido" : "Silenciar"}>
            {mudo ? <VolumeX size={19} strokeWidth={2.2} /> : <Volume2 size={19} strokeWidth={2.2} />}
          </button>
          {haySubtitulos && (
            <button type="button" className={"rpc-btn" + (subtitulosActivos ? " es-activo" : "")} onClick={onSubtitulos} aria-pressed={subtitulosActivos} aria-label={subtitulosActivos ? `Subtítulos en ${subtituloActivo?.toUpperCase()}: tocá para cambiar o apagar` : "Mostrar subtítulos"}>
              <Captions size={20} strokeWidth={2.2} />
              {subtituloActivo && <span className="rpc-sub-idioma">{subtituloActivo.toUpperCase()}</span>}
            </button>
          )}
          <button type="button" className="rpc-btn" onClick={pantallaCompleta} aria-label={completa ? "Salir de pantalla completa" : "Pantalla completa"}>
            {completa ? <Minimize size={19} strokeWidth={2.2} /> : <Maximize size={19} strokeWidth={2.2} />}
          </button>
        </div>
      </div>

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.rpc { position: absolute; inset: 0; z-index: 3; outline: none; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
.rpc:focus-visible { box-shadow: inset 0 0 0 3px rgba(240,160,184,.8); border-radius: inherit; }
.rpc-toques { position: absolute; inset: 0; touch-action: manipulation; cursor: pointer; }
.rpc-arriba { position: absolute; top: 12px; right: 12px; z-index: 2; opacity: 0; transition: opacity .25s; pointer-events: none; }
.rpc.es-visible .rpc-arriba { opacity: 1; pointer-events: auto; }
.rpc-centro { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); z-index: 2; width: 68px; height: 68px; border-radius: 50%; border: 0; display: grid; place-items: center; background: rgba(230,79,85,.92); color: #fff; cursor: pointer; box-shadow: 0 14px 34px -10px rgba(0,0,0,.55); transition: transform .2s; }
.rpc-centro:hover { transform: translate(-50%,-50%) scale(1.06); }
.rpc-centro svg { margin-left: 4px; }
.rpc-centro.es-cargando { background: rgba(28,22,24,.55); pointer-events: none; }
.rpc-giro { width: 30px; height: 30px; border-radius: 50%; border: 3px solid rgba(255,255,255,.3); border-top-color: #fff; animation: rpc-gira .8s linear infinite; }
@keyframes rpc-gira { to { transform: rotate(360deg); } }
.rpc-salto { position: absolute; top: 50%; z-index: 2; transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px 18px; border-radius: 999px; background: rgba(28,22,24,.55); color: #FDF8F6; font-size: 13px; font-weight: 800; pointer-events: none; animation: rpc-salto .7s ease-out forwards; }
.rpc-salto.es-izq { left: 10%; } .rpc-salto.es-der { right: 10%; }
@keyframes rpc-salto { 0% { opacity: 0; transform: translateY(-50%) scale(.85); } 20% { opacity: 1; transform: translateY(-50%) scale(1); } 100% { opacity: 0; } }
.rpc-barra-abajo { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; padding: 26px 12px 8px; background: linear-gradient(to top, rgba(20,14,16,.82), rgba(20,14,16,0)); opacity: 0; transform: translateY(6px); transition: opacity .25s, transform .25s; pointer-events: none; }
.rpc.es-visible .rpc-barra-abajo { opacity: 1; transform: none; pointer-events: auto; }
.rpc-tiempo { position: relative; height: 26px; display: flex; align-items: center; cursor: pointer; touch-action: none; outline: none; }
.rpc-riel { position: relative; width: 100%; height: 4px; border-radius: 99px; background: rgba(255,255,255,.25); transition: height .15s; }
.rpc-tiempo:hover .rpc-riel, .rpc-tiempo.es-arrastrando .rpc-riel, .rpc-tiempo:focus-visible .rpc-riel { height: 6px; }
.rpc-cargado { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: rgba(255,255,255,.35); }
.rpc-visto { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: #F0A0B8; }
.rpc-perilla { position: absolute; top: 50%; width: 15px; height: 15px; margin-left: -7.5px; margin-top: -7.5px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 4px rgba(240,160,184,.45); transform: scale(.8); transition: transform .15s; }
.rpc-tiempo:hover .rpc-perilla, .rpc-tiempo.es-arrastrando .rpc-perilla { transform: scale(1.1); }
.rpc-tiempo:focus-visible .rpc-perilla { box-shadow: 0 0 0 4px #F0A0B8; }
.rpc-burbuja { position: absolute; bottom: 28px; transform: translateX(-50%); padding: 4px 9px; border-radius: 8px; background: rgba(28,22,24,.9); color: #fff; font-size: 12px; font-weight: 800; font-variant-numeric: tabular-nums; pointer-events: none; white-space: nowrap; }
.rpc-botones { display: flex; align-items: center; gap: 2px; }
.rpc-btn { width: 44px; height: 44px; display: grid; place-items: center; border: 0; border-radius: 12px; background: transparent; color: #FDF8F6; cursor: pointer; transition: background .15s; }
.rpc-btn:hover { background: rgba(255,255,255,.12); }
.rpc-btn:focus-visible { outline: 2px solid #F0A0B8; outline-offset: -2px; }
.rpc-btn.es-activo { color: #F0A0B8; position: relative; }
.rpc-sub-idioma { position: absolute; right: 2px; bottom: 4px; padding: 0 4px; border-radius: 5px; background: #F0A0B8; color: #2D1520; font-size: 9px; font-weight: 900; line-height: 13px; }
video::cue { background: rgba(20,14,16,.78); color: #fff; font-family: inherit; font-size: 1.05em; line-height: 1.35; }
.rpc-reloj { margin-left: 6px; color: #FDF8F6; font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
.rpc-reloj i { font-style: normal; font-weight: 600; opacity: .7; }
.rpc-hueco { flex: 1; }
@media (hover: none) { .rpc-solo-compu { display: none; } }
@media (max-width: 480px) { .rpc-barra-abajo { padding: 18px 6px 2px; } .rpc-reloj { font-size: 12px; margin-left: 2px; } .rpc-btn { width: 40px; height: 44px; } }
@media (prefers-reduced-motion: reduce) { .rpc-salto, .rpc-giro { animation-duration: .01ms; } }
`;
