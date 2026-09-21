"use client";

import { useRef, useState } from "react";
import { Upload, Check, AlertCircle } from "lucide-react";

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
 */
export function SubidorDePortada({ name, etiqueta, ayuda, valorActual, accept }: Props) {
  const inputArchivo = useRef<HTMLInputElement>(null);
  const [valor, setValor] = useState(valorActual);
  const [estado, setEstado] = useState<"quieto" | "subiendo" | "listo" | "error">("quieto");
  const [mensaje, setMensaje] = useState("");

  async function subir(file: File) {
    setEstado("subiendo");
    setMensaje(`Subiendo ${file.name}...`);

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
      setEstado("listo");
      setMensaje("Subido. Falta guardar el formulario para que se vea en la portada.");
    } catch (e) {
      setEstado("error");
      setMensaje(e instanceof Error ? e.message : "No se pudo subir.");
    }
  }

  return (
    <div className="pm-campo">
      <label className="pm-label" htmlFor={`pm-${name}`}>
        {etiqueta}
      </label>
      <p className="pm-ayuda">{ayuda}</p>

      {/* Lo que viaja en el formulario es SIEMPRE esto: la URL, no el archivo. */}
      <input
        id={`pm-${name}`}
        className="pm-input"
        type="url"
        name={name}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="https://..."
      />

      <div className="pm-fila">
        <button
          type="button"
          className="pm-subir"
          onClick={() => inputArchivo.current?.click()}
          disabled={estado === "subiendo"}
        >
          <Upload size={15} aria-hidden />
          {estado === "subiendo" ? "Subiendo..." : "Subir un archivo"}
        </button>

        {valor !== "" && estado !== "subiendo" && (
          <a className="pm-ver" href={valor} target="_blank" rel="noopener noreferrer">
            Ver el actual
          </a>
        )}
      </div>

      {/*
        type="button" en el de arriba no es un detalle: sin eso, un <button>
        dentro de un <form> envía el formulario, y tocar "Subir" guardaría la
        portada a medias.
      */}
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

      {mensaje !== "" && (
        <p className={`pm-msg pm-${estado}`} role="status">
          {estado === "listo" && <Check size={14} aria-hidden />}
          {estado === "error" && <AlertCircle size={14} aria-hidden />}
          {mensaje}
        </p>
      )}

      <style>{`
        .pm-campo { display: grid; gap: 0.35rem; }

        .pm-label {
          font-size: 0.8rem;
          font-weight: 800;
          color: var(--ink, #1c1917);
        }

        .pm-ayuda {
          margin: 0;
          font-size: 0.78rem;
          line-height: 1.5;
          color: var(--pink-muted, #8C5F5F);
        }

        .pm-input {
          min-height: 42px;
          padding: 0 0.75rem;
          border: 1px solid var(--pink-line, #F2C6C6);
          border-radius: 10px;
          background: #fff;
          font-family: var(--font-body), sans-serif;
          font-size: 0.85rem;
          color: var(--ink, #1c1917);
        }

        .pm-input:focus-visible {
          outline: 2px solid var(--pink-deep, #B03A3E);
          outline-offset: 1px;
          border-color: transparent;
        }

        .pm-fila { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }

        .pm-subir {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          min-height: 38px;
          padding: 0 0.85rem;
          border: 1px solid var(--pink-line, #F2C6C6);
          border-radius: 999px;
          background: var(--pink-wash, #FDECEC);
          color: var(--pink-deep, #B03A3E);
          font-size: 0.75rem;
          font-weight: 800;
          cursor: pointer;
        }

        .pm-subir:hover:not(:disabled) { background: var(--pink-soft, #FFDADA); }
        .pm-subir:disabled { opacity: 0.6; cursor: progress; }

        .pm-ver {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--pink-muted, #8C5F5F);
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .pm-msg {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          margin: 0.1rem 0 0;
          font-size: 0.76rem;
          font-weight: 600;
        }

        .pm-subiendo { color: var(--pink-muted, #8C5F5F); }
        .pm-listo    { color: #166534; }
        .pm-error    { color: var(--pink-deep, #B03A3E); }
      `}</style>
    </div>
  );
}
