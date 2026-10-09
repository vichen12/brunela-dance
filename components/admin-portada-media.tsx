"use client";

import { useRef, useState } from "react";
import { Upload, Check, AlertCircle, ExternalLink, ImageIcon, Film, Loader2 } from "lucide-react";

type Props = {
  /** El name del input que viaja en el formulario. Es la clave de campos.ts. */
  name: string;
  etiqueta: string;
  ayuda: string;
  valorActual: string;
  /** Qué ofrece el selector de archivos. */
  accept: string;
};

/**
 * Sube un archivo del tráiler y deja su URL en un input oculto.
 *
 * POR QUE NO LO SUBE UNA SERVER ACTION
 *   El cuerpo de una server action está limitado a 1 MB por defecto. Un video
 *   de portada pesa mucho más, así que el archivo NO puede pasar por el
 *   servidor: se pide una credencial firmada, el navegador la usa para poner el
 *   archivo directo en Storage, y lo único que llega al formulario es la URL.
 *   Es el mismo esquema que ya usan los documentos y el audio de las clases.
 *
 * ⚠️ EL CAMPO DE TEXTO SE DEJA VISIBLE A PROPOSITO.
 *    Subir es el camino cómodo, pero si Brunela ya tiene el video en otro lado
 *    -- o si algún día Storage se queda sin cuota -- pegar una dirección tiene
 *    que seguir funcionando. Un widget que sólo sabe subir es un widget que un
 *    día deja a alguien sin salida.
 *
 * La vista previa muestra lo que va a ver la visitante: el video corre mudo y
 * en bucle, como en la portada. Se puede soltar el archivo encima.
 */
export function SubidorDePortada({ name, etiqueta, ayuda, valorActual, accept }: Props) {
  const inputArchivo = useRef<HTMLInputElement>(null);
  const [valor, setValor] = useState(valorActual);
  const [estado, setEstado] = useState<"quieto" | "subiendo" | "listo" | "error">("quieto");
  const [mensaje, setMensaje] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const [rota, setRota] = useState(false);
  const esVideo = accept.startsWith("video");
  const hayUrl = /^https?:\/\/\S+$/.test(valor.trim());

  async function subir(file: File) {
    setEstado("subiendo");
    setMensaje(`Subiendo ${file.name}…`);

    try {
      const init = await fetch("/api/admin/portada/upload-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, size: file.size, contentType: file.type }),
      });

      const datos = await init.json();
      if (!init.ok) throw new Error(datos?.error ?? "No se pudo preparar la subida.");

      // PUT directo a Storage con la credencial firmada.
      const puesta = await fetch(datos.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!puesta.ok) throw new Error("La subida falló a mitad de camino.");

      setValor(datos.publicUrl);
      setRota(false);
      setEstado("listo");
      setMensaje("Subido. Falta guardar para que se vea en la portada.");
    } catch (e) {
      setEstado("error");
      setMensaje(e instanceof Error ? e.message : "No se pudo subir.");
    }
  }

  return (
    <div className="pm">
      {/* Vista previa: tambien es zona para soltar el archivo. */}
      <div
        className={"pm-vista" + (arrastrando ? " es-arrastre" : "")}
        onDragOver={(e) => { e.preventDefault(); if (estado !== "subiendo") setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          const f = e.dataTransfer.files?.[0];
          if (f && estado !== "subiendo") void subir(f);
        }}
      >
        {hayUrl && !rota ? (
          esVideo ? (
            <video key={valor} src={valor} muted loop autoPlay playsInline onError={() => setRota(true)} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={valor} src={valor} alt="" onError={() => setRota(true)} />
          )
        ) : (
          <span className="pm-vacia">
            {esVideo ? <Film size={24} strokeWidth={1.6} aria-hidden /> : <ImageIcon size={24} strokeWidth={1.6} aria-hidden />}
            {rota ? "No se pudo cargar esa dirección" : "Soltá el archivo acá"}
          </span>
        )}
        {estado === "subiendo" && (
          <span className="pm-cargando"><Loader2 size={22} className="dup-gira" aria-hidden /></span>
        )}
      </div>

      <div className="pm-datos">
        <label className="pm-label" htmlFor={`pm-${name}`}>{etiqueta}</label>
        <p className="pm-ayuda">{ayuda}</p>

        {/* Lo que viaja en el formulario es SIEMPRE esto: la URL, no el archivo. */}
        <input
          id={`pm-${name}`}
          className="pm-input"
          type="url"
          name={name}
          value={valor}
          onChange={(e) => { setValor(e.target.value); setRota(false); }}
          placeholder="https://…"
        />

        <div className="pm-fila">
          {/* type="button": sin eso, un <button> dentro de un <form> envía el
              formulario, y tocar "Subir" guardaría la portada a medias. */}
          <button type="button" className="pm-subir" onClick={() => inputArchivo.current?.click()} disabled={estado === "subiendo"}>
            <Upload size={15} aria-hidden />
            {estado === "subiendo" ? "Subiendo…" : hayUrl ? "Reemplazar" : "Subir un archivo"}
          </button>
          {hayUrl && estado !== "subiendo" && (
            <a className="pm-ver" href={valor} target="_blank" rel="noopener noreferrer">
              Abrir <ExternalLink size={13} aria-hidden />
            </a>
          )}
        </div>

        {mensaje !== "" && (
          <p className={`pm-msg pm-${estado}`} role="status">
            {estado === "listo" && <Check size={14} aria-hidden />}
            {estado === "error" && <AlertCircle size={14} aria-hidden />}
            {mensaje}
          </p>
        )}
      </div>

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
