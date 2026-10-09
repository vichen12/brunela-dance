"use client";

import { useState, useRef } from "react";
import { FileCheck2, Loader2, UploadCloud } from "lucide-react";

const MAX_BYTES = 52_428_800; // 50 MiB

/** El `file_type` de la tabla, deducido del MIME real del archivo. */
function tipoDesdeMime(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.includes("word") || mime.includes("officedocument")) return "doc";
  return "other";
}

const ETIQUETA: Record<string, string> = {
  pdf: "PDF", image: "Imagen", video: "Video", audio: "Audio",
  doc: "Documento Word", other: "Otro",
};

type Props = {
  /** Ruta ya guardada, al editar un documento existente. */
  valorInicial?: string | null;
  nombreCampo?: string;
};

/**
 * Selector de archivo para los documentos del estudio.
 *
 * Reemplaza al campo donde habia que pegar una URL a mano, que le pedia a
 * Brunela subir el archivo a un CDN por su cuenta -- o sea, que la seccion no
 * se podia usar.
 *
 * El archivo va DIRECTO del navegador a Storage con una credencial firmada: los
 * bytes no pasan por el servidor, que tiene un limite de 1 MB por cuerpo de
 * peticion. Lo que se guarda en la fila es la RUTA, no una URL: la descarga se
 * firma despues, cuando ya se comprobo el plan de quien la pide.
 */
export function AdminDocumentUpload({ valorInicial, nombreCampo = "fileUrl" }: Props) {
  const [ruta, setRuta] = useState<string | null>(valorInicial ?? null);
  const [tipo, setTipo] = useState<string>("pdf");
  const [pesoKb, setPesoKb] = useState<number | null>(null);
  const [nombre, setNombre] = useState<string | null>(null);
  const [estado, setEstado] = useState<"idle" | "subiendo" | "listo" | "error">(
    valorInicial ? "listo" : "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [progreso, setProgreso] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const [arrastrando, setArrastrando] = useState(false);

  function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void subir(file);
    // Vaciar el input: sin esto, elegir el MISMO archivo despues de un error no
    // dispara onChange y parece que el boton no anda.
    e.target.value = "";
  }

  async function subir(file: File) {

    setError(null);
    setNombre(file.name);

    if (file.size > MAX_BYTES) {
      setEstado("error");
      setError(`"${file.name}" pesa ${(file.size / 1048576).toFixed(1)} MB y el máximo es 50 MB.`);
      return;
    }

    setEstado("subiendo");
    setProgreso(0);

    try {
      const init = await fetch("/api/admin/documents/upload-init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name, size: file.size }),
      });
      const ticket = await init.json();
      if (!init.ok) throw new Error(ticket.error ?? "No se pudo preparar la subida.");

      // XHR y no fetch: es lo unico que expone el progreso de subida, y un PDF
      // grande sin barra parece colgado.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", ticket.signedUrl, true);
        xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgreso(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage respondió ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("Se cortó la conexión durante la subida."));
        xhr.send(file);
      });

      setRuta(ticket.path);
      setTipo(tipoDesdeMime(file.type));
      setPesoKb(Math.max(1, Math.round(file.size / 1024)));
      setEstado("listo");
    } catch (err) {
      setEstado("error");
      setError(err instanceof Error ? err.message : "No se pudo subir el archivo.");
    }
  }

  return (
    <div>
      {/* Lo que viaja al server action. El tipo y el peso se deducen del archivo:
          antes habia que tipearlos a mano y nada garantizaba que coincidieran. */}
      <input type="hidden" name={nombreCampo} value={ruta ?? ""} />
      <input type="hidden" name="fileType" value={tipo} />
      <input type="hidden" name="fileSizeKb" value={pesoKb ?? ""} />

      <input
        ref={inputRef}
        type="file"
        onChange={alElegir}
        accept=".pdf,.jpg,.jpeg,.png,.webp,.mp4,.mp3,.doc,.docx"
        style={{ display: "none" }}
      />

      {/* Zona de carga: se hace clic o se SUELTA el archivo encima. */}
      <div
        role="button"
        tabIndex={estado === "subiendo" ? -1 : 0}
        aria-label={estado === "listo" ? "Cambiar el archivo" : "Elegir un archivo"}
        className={"dup" + (arrastrando ? " es-arrastre" : "") + (estado === "listo" ? " es-listo" : "") + (estado === "error" ? " es-error" : "") + (estado === "subiendo" ? " es-subiendo" : "")}
        onClick={() => estado !== "subiendo" && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && estado !== "subiendo") { e.preventDefault(); inputRef.current?.click(); }
        }}
        onDragOver={(e) => { e.preventDefault(); if (estado !== "subiendo") setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          const file = e.dataTransfer.files?.[0];
          if (file && estado !== "subiendo") void subir(file);
        }}
      >
        {estado === "listo" ? (
          <>
            <span className="dup-ico dup-ico--listo"><FileCheck2 size={22} strokeWidth={1.8} aria-hidden="true" /></span>
            <span className="dup-txt">
              <span className="dup-titulo">{nombre ?? "Archivo cargado"}</span>
              <span className="dup-sub">
                {nombre ? `${ETIQUETA[tipo]}${pesoKb ? ` · ${pesoKb >= 1000 ? `${(pesoKb / 1000).toFixed(1)} MB` : `${pesoKb} KB`}` : ""} · subido` : "Ya tiene un archivo. Elegí otro sólo si querés reemplazarlo."}
              </span>
            </span>
            <span className="dup-cambiar">Cambiar</span>
          </>
        ) : estado === "subiendo" ? (
          <>
            <span className="dup-ico"><Loader2 size={22} strokeWidth={1.8} className="dup-gira" aria-hidden="true" /></span>
            <span className="dup-txt">
              <span className="dup-titulo">Subiendo {nombre}…</span>
              <span className="dup-barra"><span style={{ width: `${progreso}%` }} /></span>
            </span>
            <span className="dup-pct">{progreso}%</span>
          </>
        ) : (
          <>
            <span className="dup-ico"><UploadCloud size={24} strokeWidth={1.7} aria-hidden="true" /></span>
            <span className="dup-txt">
              <span className="dup-titulo">{estado === "error" ? "Probá con otro archivo" : <>Arrastrá el archivo acá o <u>elegilo</u></>}</span>
              <span className="dup-sub">PDF, imagen, video, audio o Word · hasta 50 MB</span>
            </span>
          </>
        )}
      </div>

      {error && <p className="dup-error">{error}</p>}
    </div>
  );
}
