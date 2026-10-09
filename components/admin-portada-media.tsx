"use client";

import { useRef, useState } from "react";
import { AlertCircle, Check, ExternalLink, Film, ImageIcon, Link2, Trash2, Upload } from "lucide-react";

type Props = {
  /** El name del input que viaja en el formulario. Es la clave de campos.ts. */
  name: string;
  /** Número del paso (1 = video, 2 = portada). */
  paso: number;
  titulo: string;
  ayuda: string;
  valorActual: string;
  /** Qué ofrece el selector de archivos. */
  accept: string;
  /** Formatos legibles, para el texto del paso: "MP4 o WebM". */
  formatos: string;
  /** Tope por archivo, en MB. Sale de MAX_PORTADA_BYTES en el servidor. */
  maxMb: number;
  /** Ancla de la portada donde se ve esto. */
  ancla: string;
};

/**
 * Sube un archivo del tráiler y deja su URL en un input del formulario.
 *
 * POR QUE NO LO SUBE UNA SERVER ACTION
 *   El cuerpo de una server action está limitado a 1 MB por defecto. Un video
 *   de portada pesa mucho más, así que el archivo NO puede pasar por el
 *   servidor: se pide una credencial firmada, el navegador la usa para poner el
 *   archivo directo en Storage, y lo único que llega al formulario es la URL.
 *   Es el mismo esquema que ya usan los documentos y el audio de las clases.
 *
 * POR QUE XMLHttpRequest Y NO fetch
 *   Sólo para el porcentaje. `fetch` no informa el progreso de una SUBIDA, y un
 *   video de 40 MB sin porcentaje es un spinner que parece colgado. La petición
 *   es la misma de antes: PUT a la URL firmada con su Content-Type.
 *
 * ⚠️ EL CAMPO DE TEXTO SIGUE EXISTIENDO, AHORA PLEGADO.
 *    Subir es el camino cómodo, pero si Brunela ya tiene el video en otro lado
 *    -- un enlace de YouTube, o si algún día Storage se queda sin cuota --
 *    pegar una dirección tiene que seguir funcionando. Un widget que sólo sabe
 *    subir es un widget que un día deja a alguien sin salida.
 *    Va como `type="text"` y no `url`: plegado dentro de un <details>, un valor
 *    inválido frenaría el envío sin que el globito del navegador se vea. La
 *    validación de verdad la hace la acción (campos.ts, con el parser de URL).
 */
export function SubidorDePortada({ name, paso, titulo, ayuda, valorActual, accept, formatos, maxMb, ancla }: Props) {
  const inputArchivo = useRef<HTMLInputElement>(null);
  const [valor, setValor] = useState(valorActual);
  const [estado, setEstado] = useState<"quieto" | "subiendo" | "error">("quieto");
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState("");
  const [recienSubido, setRecienSubido] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [rota, setRota] = useState(false);
  const esVideo = accept.startsWith("video");
  const hayUrl = /^https?:\/\/\S+$/.test(valor.trim());
  const idYt = esVideo ? idDeYouTube(valor.trim()) : null;
  const cambiado = valor.trim() !== valorActual.trim();
  const tiposAceptados = accept.split(",").map((t) => t.trim());

  function subirConProgreso(url: string, file: File) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgreso(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("La subida falló a mitad de camino.")));
      xhr.onerror = () => reject(new Error("Se cortó la conexión durante la subida."));
      xhr.send(file);
    });
  }

  async function subir(file: File) {
    setError("");

    // Cortesía para avisar rápido: la regla de verdad está en upload-init.
    const aceptado = tiposAceptados.some((t) => (t.endsWith("/*") ? file.type.startsWith(t.slice(0, -1)) : file.type === t));
    if (!aceptado) {
      setEstado("error");
      setError(`Ese archivo no sirve acá: tiene que ser ${formatos}.`);
      return;
    }
    if (file.size > maxMb * 1_048_576) {
      setEstado("error");
      setError(`Pesa ${(file.size / 1_048_576).toFixed(1)} MB y el máximo es ${maxMb} MB.`);
      return;
    }

    setEstado("subiendo");
    setProgreso(0);

    try {
      const init = await fetch("/api/admin/portada/upload-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, size: file.size, contentType: file.type }),
      });

      const datos = await init.json();
      if (!init.ok) throw new Error(datos?.error ?? "No se pudo preparar la subida.");

      // PUT directo a Storage con la credencial firmada.
      await subirConProgreso(datos.signedUrl, file);

      setValor(datos.publicUrl);
      setRota(false);
      setRecienSubido(true);
      setEstado("quieto");
    } catch (e) {
      setEstado("error");
      setError(e instanceof Error ? e.message : "No se pudo subir.");
    }
  }

  const subiendo = estado === "subiendo";
  const listo = hayUrl && !subiendo;

  return (
    <div className={"pm" + (listo ? " es-listo" : "")}>
      <div className="pm-cab">
        <span className="pm-paso" aria-hidden="true">{paso}</span>
        <div className="pm-cab-texto">
          <h3 className="pm-titulo">{titulo}</h3>
          <p className="pm-ayuda">{ayuda}</p>
        </div>
        <span className={"pm-estado" + (subiendo ? " es-subiendo" : listo ? " es-listo" : "")} role="status">
          {subiendo ? (
            <>Subiendo… {progreso}%</>
          ) : listo ? (
            <><Check size={13} strokeWidth={3} aria-hidden="true" /> Listo</>
          ) : esVideo ? (
            "Sin video todavía"
          ) : (
            "Sin imagen todavía"
          )}
        </span>
      </div>

      {/* Zona de arrastre: con archivo muestra la vista previa; sin archivo, la invitación. */}
      <div
        className={"pm-zona" + (arrastrando ? " es-arrastre" : "") + (listo ? " tiene-medio" : "")}
        onDragOver={(e) => { e.preventDefault(); if (!subiendo) setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !subiendo) void subir(f);
        }}
      >
        {subiendo ? (
          <div className="pm-subiendo">
            <span className="pm-burbuja" aria-hidden="true"><Upload size={22} strokeWidth={2.2} /></span>
            <p className="pm-zona-titulo">Subiendo… {progreso}%</p>
            <div className="pm-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progreso} aria-label="Progreso de la subida">
              <span style={{ width: `${progreso}%` }} />
            </div>
            <p className="pm-zona-sub">No cierres esta pestaña hasta que termine.</p>
          </div>
        ) : listo && !rota ? (
          <div className="pm-vista">
            {idYt ? (
              // Un enlace de YouTube no es un archivo: se muestra su miniatura.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`https://i.ytimg.com/vi/${encodeURIComponent(idYt)}/hqdefault.jpg`} alt="Miniatura del video de YouTube" onError={() => setRota(true)} />
            ) : esVideo ? (
              <video key={valor} src={valor} muted controls playsInline preload="metadata" onError={() => setRota(true)} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={valor} src={valor} alt="Imagen de portada del tráiler" onError={() => setRota(true)} />
            )}
          </div>
        ) : (
          <div className="pm-invita">
            <span className="pm-burbuja" aria-hidden="true">
              {rota ? <AlertCircle size={22} strokeWidth={2.2} /> : esVideo ? <Film size={22} strokeWidth={2.2} /> : <ImageIcon size={22} strokeWidth={2.2} />}
            </span>
            <p className="pm-zona-titulo">
              {rota ? "No se pudo cargar esa dirección" : arrastrando ? "Soltalo acá" : `Arrastrá ${esVideo ? "el video" : "la imagen"} acá`}
            </p>
            <p className="pm-zona-sub">o</p>
            {/* type="button": sin eso, un <button> dentro de un <form> envía el
                formulario, y tocar "Elegir archivo" guardaría la portada a medias. */}
            <button type="button" className="pm-elegir" onClick={() => inputArchivo.current?.click()}>
              <Upload size={16} strokeWidth={2.2} aria-hidden="true" /> Elegir archivo
            </button>
            <p className="pm-zona-sub">{formatos} · hasta {maxMb} MB</p>
          </div>
        )}
      </div>

      {listo && (
        <div className="pm-acciones">
          <button type="button" className="pm-btn" onClick={() => inputArchivo.current?.click()}>
            <Upload size={14} strokeWidth={2.2} aria-hidden="true" /> Reemplazar
          </button>
          <button
            type="button"
            className="pm-btn pm-btn--quitar"
            onClick={() => { setValor(""); setRota(false); setRecienSubido(false); setError(""); setEstado("quieto"); }}
          >
            <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" /> Quitar
          </button>
          <a className="pm-btn" href={`/#${ancla}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} strokeWidth={2.2} aria-hidden="true" /> Ver en la portada
          </a>
        </div>
      )}

      {estado === "error" && error !== "" && (
        <p className="pm-aviso pm-aviso--error" role="alert"><AlertCircle size={14} aria-hidden="true" /> {error}</p>
      )}
      {cambiado && !subiendo && (
        <p className="pm-aviso">
          {recienSubido && hayUrl ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}
          {hayUrl
            ? `${recienSubido ? "Subido. " : ""}Falta tocar «Guardar» abajo para que se vea en la portada.`
            : `Sin ${esVideo ? "video" : "imagen"}: al guardar, la portada vuelve a mostrar ${esVideo ? "el video" : "la imagen"} de siempre.`}
        </p>
      )}

      <details className="pm-enlace">
        <summary><Link2 size={14} strokeWidth={2.2} aria-hidden="true" /> ¿Ya está subido en otro lado? Pegá el enlace</summary>
        {/* Lo que viaja en el formulario es SIEMPRE esto: la URL, no el archivo. */}
        <input
          className="pm-input"
          type="text"
          inputMode="url"
          name={name}
          value={valor}
          onChange={(e) => { setValor(e.target.value); setRota(false); setRecienSubido(false); }}
          placeholder={esVideo ? "https://… (también sirve un enlace de YouTube)" : "https://…"}
          aria-label={`Enlace: ${titulo}`}
        />
      </details>

      <input
        ref={inputArchivo}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void subir(f);
          // Se limpia para que elegir el MISMO archivo otra vez vuelva a disparar
          // el evento: sin esto, reintentar después de un error no hace nada.
          e.target.value = "";
        }}
      />
    </div>
  );
}

/**
 * Misma lectura que components/video-showcase.tsx: host exacto, nunca
 * `includes("youtube")`. Sólo sirve para elegir la vista previa.
 */
function idDeYouTube(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.slice(1) || null;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(?:embed|v|shorts)\/([^/?]+)/);
      return m ? m[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}
