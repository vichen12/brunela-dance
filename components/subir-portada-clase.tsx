"use client";

import { useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Trash2 } from "lucide-react";

/**
 * Foto de portada de una clase: elegir o arrastrar una imagen, verla, quitarla.
 *
 * Sube al mismo bucket publico de la portada (landing-media) con la ruta ya
 * existente /api/admin/portada/upload-init, que llama requireAdmin() y firma la
 * subida: los bytes van directo del navegador a Storage. El formulario recibe
 * solo la URL publica, en el campo `name` (thumbnailUrl en editar,
 * portadaUrl al subir).
 *
 * Si se deja vacio al subir, la portada sale sola del video (Bunny).
 */
const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_MB = 10;

export function SubirPortadaClase({ name, defaultValue = "", ayudaVacio }: { name: string; defaultValue?: string; ayudaVacio?: string }) {
  const [url, setUrl] = useState(defaultValue);
  const [estado, setEstado] = useState<"" | "subiendo" | "error">("");
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  function put(signedUrl: string, file: File) {
    return new Promise<void>((ok, mal) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", signedUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgreso(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? ok() : mal(new Error("La subida falló a mitad de camino.")));
      xhr.onerror = () => mal(new Error("Se cortó la conexión. Probá de nuevo."));
      xhr.send(file);
    });
  }

  async function subir(file: File) {
    setError("");
    if (!TIPOS.includes(file.type)) { setEstado("error"); setError("Tiene que ser una foto JPG, PNG, WebP o AVIF."); return; }
    if (file.size > MAX_MB * 1_048_576) { setEstado("error"); setError(`La foto pesa ${(file.size / 1_048_576).toFixed(1)} MB; el máximo es ${MAX_MB} MB.`); return; }
    setEstado("subiendo"); setProgreso(0);
    try {
      const r = await fetch("/api/admin/portada/upload-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, size: file.size, contentType: file.type }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? "No se pudo preparar la subida.");
      await put(d.signedUrl, file);
      setUrl(d.publicUrl);
      setEstado("");
    } catch (e) {
      setEstado("error");
      setError(e instanceof Error ? e.message : "No se pudo subir la foto.");
    }
  }

  return (
    <div
      className={"spc" + (url ? " tiene" : "")}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) subir(f); }}
    >
      <style>{CSS}</style>
      <input type="hidden" name={name} value={url} />
      <input ref={input} type="file" accept={TIPOS.join(",")} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ""; }} />

      <button type="button" className="spc-vista" onClick={() => input.current?.click()} aria-label={url ? "Cambiar la foto de portada" : "Elegir una foto de portada"}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" />
        ) : (
          <span className="spc-vacio"><ImagePlus size={26} strokeWidth={1.8} aria-hidden="true" />Soltá la foto acá</span>
        )}
        {estado === "subiendo" && <span className="spc-carga"><Loader2 size={20} className="spc-gira" aria-hidden="true" /> {progreso}%</span>}
      </button>

      <div className="spc-txt">
        <p className="spc-titulo">Foto de portada {url && estado !== "subiendo" && <span className="spc-ok"><Check size={12} strokeWidth={3} aria-hidden="true" /> Lista</span>}</p>
        <p className="spc-ayuda">{url ? "Es la imagen que ven las alumnas en la tarjeta de la clase." : ayudaVacio ?? "Elegí una foto horizontal. Es la que ven las alumnas en la tarjeta de la clase."}</p>
        <div className="spc-acciones">
          <button type="button" className="spc-btn" onClick={() => input.current?.click()} disabled={estado === "subiendo"}>
            <ImagePlus size={15} strokeWidth={2.2} aria-hidden="true" /> {url ? "Cambiar foto" : "Elegir foto"}
          </button>
          {url && (
            <button type="button" className="spc-btn spc-btn--suave" onClick={() => setUrl("")} disabled={estado === "subiendo"}>
              <Trash2 size={15} strokeWidth={2.2} aria-hidden="true" /> Quitar
            </button>
          )}
        </div>
        {error && <p className="spc-error" role="alert">{error}</p>}
      </div>
    </div>
  );
}

const CSS = `
.spc { display: grid; grid-template-columns: minmax(160px, 240px) minmax(0, 1fr); gap: 18px; align-items: center; padding: 14px; border-radius: 22px; border: 1.5px dashed var(--linea-fuerte, #E9CFC5); background: var(--crema, #FFFAF6); }
.spc.tiene { border-style: solid; border-color: var(--pink-line, #F2C6C6); background: #fff; }
.spc-vista { position: relative; aspect-ratio: 16 / 10; width: 100%; border: 0; padding: 0; border-radius: 16px; overflow: hidden; cursor: pointer; background: linear-gradient(135deg, #FFE9DE, #FFDADA); }
.spc-vista img { width: 100%; height: 100%; object-fit: cover; display: block; }
.spc-vacio { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--pink-deep, #B03A3E); font-size: 13px; font-weight: 800; }
.spc-carga { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 8px; background: rgba(255,255,255,.75); font-weight: 900; color: var(--pink-deep, #B03A3E); }
.spc-gira { animation: spc-gira 1s linear infinite; }
@keyframes spc-gira { to { transform: rotate(360deg); } }
.spc-titulo { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 900; color: var(--ink); }
.spc-ok { display: inline-flex; align-items: center; gap: 3px; padding: 2px 9px; border-radius: 99px; background: var(--rubor, #FFF2EE); color: var(--pink-deep, #B03A3E); font-size: 11.5px; font-weight: 800; }
.spc-ayuda { font-size: 13px; line-height: 1.5; color: var(--muted); margin-top: 3px; }
.spc-acciones { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.spc-btn { display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 16px; border-radius: 99px; border: 0; cursor: pointer; font: inherit; font-size: 13.5px; font-weight: 800; background: var(--pink, #E64F55); color: #fff; }
.spc-btn--suave { background: #fff; color: var(--ink); border: 1.5px solid var(--linea-fuerte, #E9CFC5); }
.spc-btn:disabled { opacity: .6; cursor: default; }
.spc-error { margin-top: 8px; font-size: 13px; font-weight: 700; color: var(--pink-deep, #B03A3E); }
@media (max-width: 560px) { .spc { grid-template-columns: 1fr; } }
`;
