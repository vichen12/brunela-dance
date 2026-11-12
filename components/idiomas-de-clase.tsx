"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Captions, Check, Loader2, Music, Trash2, Upload } from "lucide-react";

/**
 * "Idiomas y subtítulos" en la ficha de una clase del panel (2026-11-12).
 *
 * Todo opcional: una clase sin nada de esto se ve como siempre, y nada de lo
 * que se hace aca toca el video. Ver src/lib/audio/idiomas.ts.
 *
 *   Audio: un mp3 por idioma (el español va dentro del video).
 *   Subtítulos: un .srt o .vtt por idioma, español incluido.
 */

const AUDIOS = [
  { locale: "en", nombre: "Inglés" },
  { locale: "fr", nombre: "Francés" },
  { locale: "it", nombre: "Italiano" },
];
const SUBTITULOS = [{ locale: "es", nombre: "Español" }, ...AUDIOS];
const MAX_AUDIO = 50 * 1024 * 1024;

type Cargados = { audios: string[]; subtitulos: string[] };
type Tipo = "audio" | "subtitulos";

function subirConProgreso(url: string, archivo: File, alAvanzar: (pct: number) => void): Promise<void> {
  return new Promise((ok, mal) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("content-type", archivo.type || "audio/mpeg");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) alAvanzar(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? ok() : mal(new Error(String(xhr.status))));
    xhr.onerror = () => mal(new Error("red"));
    xhr.send(archivo);
  });
}

export function IdiomasDeClase({ bunnyVideoId }: { bunnyVideoId: string | null }) {
  const [cargados, setCargados] = useState<Cargados | null>(null);
  const [ocupado, setOcupado] = useState<{ clave: string; pct: number | null } | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const entradas = useRef<Record<string, HTMLInputElement | null>>({});

  const leer = useCallback(async () => {
    if (!bunnyVideoId) return;
    const r = await fetch(`/api/admin/videos/idiomas?bunny=${bunnyVideoId}`, { cache: "no-store" }).catch(() => null);
    if (r?.ok) setCargados(await r.json());
    else setCargados({ audios: [], subtitulos: [] });
  }, [bunnyVideoId]);
  useEffect(() => { void leer(); }, [leer]);

  if (!bunnyVideoId) {
    return <p className="idc-nota">Cuando el video termine de subirse vas a poder agregarle otros idiomas y subtítulos.</p>;
  }

  async function subir(tipo: Tipo, locale: string, nombre: string, archivo: File) {
    const clave = `${tipo}-${locale}`;
    setAviso(null);
    try {
      if (tipo === "audio") {
        if (!/\.(mp3|m4a|aac)$/i.test(archivo.name) && !archivo.type.startsWith("audio/")) throw new Error("Tiene que ser un archivo de audio (mp3).");
        if (archivo.size > MAX_AUDIO) throw new Error("Ese audio pesa más de 50 MB. Exportalo en mp3 a 96 kbps y entra de sobra.");
        setOcupado({ clave, pct: 0 });
        const r = await fetch("/api/admin/videos/idiomas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tipo: "audio", bunny: bunnyVideoId, idioma: locale, bytes: archivo.size }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.signedUrl) throw new Error(d.error ?? "No se pudo preparar la subida.");
        await subirConProgreso(d.signedUrl, archivo, (pct) => setOcupado({ clave, pct }));
      } else {
        if (!/\.(srt|vtt)$/i.test(archivo.name)) throw new Error("Los subtítulos tienen que ser un archivo .srt o .vtt.");
        setOcupado({ clave, pct: null });
        const fd = new FormData();
        fd.set("tipo", "subtitulos"); fd.set("bunny", bunnyVideoId!); fd.set("idioma", locale); fd.set("archivo", archivo);
        const r = await fetch("/api/admin/videos/idiomas", { method: "POST", body: fd });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? "No se pudieron guardar los subtítulos.");
      }
      setAviso({ tipo: "ok", texto: `${tipo === "audio" ? "Audio" : "Subtítulos"} en ${nombre} listo. Las alumnas ya lo ven en la clase.` });
      await leer();
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setAviso({ tipo: "error", texto: /^\d+$|^red$/.test(m) || !m ? "Se cortó la subida. Probá de nuevo." : m });
    } finally {
      setOcupado(null);
    }
  }

  async function quitar(tipo: Tipo, locale: string, nombre: string) {
    if (!window.confirm(`¿Quitar ${tipo === "audio" ? "el audio" : "los subtítulos"} en ${nombre}? El video no cambia.`)) return;
    setAviso(null);
    setOcupado({ clave: `${tipo}-${locale}`, pct: null });
    const r = await fetch(`/api/admin/videos/idiomas?bunny=${bunnyVideoId}&tipo=${tipo}&idioma=${locale}`, { method: "DELETE" }).catch(() => null);
    setOcupado(null);
    if (!r?.ok) { setAviso({ tipo: "error", texto: "No se pudo quitar. Probá de nuevo." }); return; }
    await leer();
  }

  function fila(tipo: Tipo, locale: string, nombre: string) {
    const clave = `${tipo}-${locale}`;
    const tiene = (tipo === "audio" ? cargados?.audios : cargados?.subtitulos)?.includes(locale) ?? false;
    const trabajando = ocupado?.clave === clave;
    return (
      <li key={clave} className={"idc-fila" + (tiene ? " es-cargado" : "")}>
        <span className="idc-cod">{locale.toUpperCase()}</span>
        <span className="idc-nombre">
          {nombre}
          <small>{trabajando ? (ocupado?.pct != null ? `Subiendo… ${ocupado.pct}%` : "Guardando…") : tiene ? <><Check size={12} strokeWidth={3} aria-hidden="true" /> Cargado</> : "Sin cargar"}</small>
        </span>
        <input
          ref={(el) => { entradas.current[clave] = el; }}
          type="file"
          hidden
          accept={tipo === "audio" ? "audio/mpeg,audio/mp4,audio/aac,.mp3,.m4a" : ".srt,.vtt"}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void subir(tipo, locale, nombre, f); }}
        />
        <button type="button" className="idc-btn" disabled={!!ocupado || !cargados} onClick={() => entradas.current[clave]?.click()}>
          {trabajando ? <Loader2 size={15} className="idc-gira" aria-hidden="true" /> : <Upload size={15} strokeWidth={2.4} aria-hidden="true" />}
          {tiene ? "Cambiar" : "Subir"}
        </button>
        {tiene && (
          <button type="button" className="idc-btn idc-btn--quitar" disabled={!!ocupado} onClick={() => void quitar(tipo, locale, nombre)} aria-label={`Quitar ${tipo === "audio" ? "audio" : "subtítulos"} en ${nombre}`}>
            <Trash2 size={15} strokeWidth={2.2} aria-hidden="true" />
          </button>
        )}
      </li>
    );
  }

  return (
    <div className="idc">
      <p className="idc-nota">Opcional. Si no subís nada, la clase se ve como siempre, en español. Lo que agregues aparece como botones de idioma y de subtítulos en el reproductor.</p>

      <p className="idc-tit"><Music size={15} strokeWidth={2.4} aria-hidden="true" /> Audio en otro idioma <small>un mp3 por idioma, de la misma duración que el video</small></p>
      <ul className="idc-lista">{AUDIOS.map((a) => fila("audio", a.locale, a.nombre))}</ul>

      <p className="idc-tit"><Captions size={15} strokeWidth={2.4} aria-hidden="true" /> Subtítulos <small>archivo .srt o .vtt</small></p>
      <ul className="idc-lista">{SUBTITULOS.map((a) => fila("subtitulos", a.locale, a.nombre))}</ul>

      {aviso && <p role={aviso.tipo === "error" ? "alert" : "status"} className={"idc-aviso idc-aviso--" + aviso.tipo}>{aviso.texto}</p>}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.idc { display: flex; flex-direction: column; gap: 10px; }
.idc-nota { margin: 0; font-size: 13px; line-height: 1.6; color: #8A6F68; }
.idc-tit { margin: 6px 0 0; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; font-size: 13.5px; font-weight: 800; color: #3B2A2C; }
.idc-tit svg { color: #E64F55; }
.idc-tit small { font-weight: 600; color: #A0857E; }
.idc-lista { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.idc-fila { display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 10px; border-radius: 16px; border: 1px solid #F3E3DC; background: #FFFAF6; }
.idc-fila.es-cargado { background: #F4FAF1; border-color: #D6E9CF; }
.idc-cod { width: 36px; height: 30px; flex-shrink: 0; display: grid; place-items: center; border-radius: 10px; background: #fff; border: 1px solid #F0DCD4; font-size: 11px; font-weight: 900; letter-spacing: .08em; color: #B4434A; }
.idc-nombre { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 13.5px; font-weight: 800; color: #3B2A2C; }
.idc-nombre small { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: #A0857E; }
.idc-fila.es-cargado .idc-nombre small { color: #4E7A43; }
.idc-btn { height: 44px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px; border-radius: 99px; border: 1.5px solid #F0C9C9; background: #fff; color: #B4434A; font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; transition: background .2s; }
.idc-btn:hover:not(:disabled) { background: #FFF1EF; }
.idc-btn:disabled { opacity: .55; cursor: default; }
.idc-btn--quitar { width: 44px; padding: 0; justify-content: center; border-color: #EBDAD3; color: #8A6F68; }
.idc-gira { animation: idc-gira .8s linear infinite; }
@keyframes idc-gira { to { transform: rotate(360deg); } }
.idc-aviso { margin: 2px 0 0; padding: 10px 14px; border-radius: 14px; font-size: 13px; font-weight: 700; line-height: 1.5; }
.idc-aviso--ok { background: #F4FAF1; color: #3F6B35; border: 1px solid #D6E9CF; }
.idc-aviso--error { background: #FFF1EF; color: #A23A3F; border: 1px solid #F6CFCB; }
`;
