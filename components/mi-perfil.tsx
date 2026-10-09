"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2, Trash2 } from "lucide-react";
import { BotonEnviar } from "@/components/boton-enviar";
import { guardarMiPerfilAction } from "@/src/features/auth/perfil-actions";

/**
 * Editar el propio perfil: foto y nombre. Lo usan /admin/perfil y
 * /dashboard/perfil. La foto se achica en el navegador a 512 px antes de
 * subirla: una foto de celular pesa 4-8 MB y en el avatar se ve a 40 px.
 */
async function achicar(archivo: File): Promise<Blob> {
  const img = await createImageBitmap(archivo);
  const lado = 512;
  const escala = Math.max(lado / img.width, lado / img.height);
  const w = img.width * escala, h = img.height * escala;
  const canvas = document.createElement("canvas");
  canvas.width = lado; canvas.height = lado;
  const ctx = canvas.getContext("2d");
  if (!ctx) return archivo;
  // Recorte cuadrado centrado: el avatar es redondo.
  ctx.drawImage(img, (lado - w) / 2, (lado - h) / 2, w, h);
  return await new Promise((ok) => canvas.toBlob((b) => ok(b ?? archivo), "image/jpeg", 0.88));
}

export function MiPerfil({
  nombre, email, foto, plan, volver,
}: {
  nombre: string;
  email: string;
  foto: string | null;
  plan: string;
  volver: "/admin/perfil" | "/dashboard/perfil";
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState<string | null>(foto);
  const [estado, setEstado] = useState<"" | "subiendo" | "ok" | "error">("");
  const [mensaje, setMensaje] = useState("");
  const inicial = (nombre.trim()[0] ?? email[0] ?? "?").toUpperCase();

  async function subir(archivo: File) {
    if (!archivo.type.startsWith("image/")) { setEstado("error"); setMensaje("Elegí una imagen."); return; }
    setEstado("subiendo"); setMensaje("");
    const previa = URL.createObjectURL(archivo);
    setVista(previa);
    try {
      const blob = await achicar(archivo);
      const fd = new FormData();
      fd.append("foto", new File([blob], "foto.jpg", { type: "image/jpeg" }));
      const r = await fetch("/api/perfil/foto", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "No se pudo subir la foto.");
      setVista(j.url); setEstado("ok"); setMensaje("Foto actualizada.");
      router.refresh();
    } catch (e) {
      setVista(foto); setEstado("error");
      setMensaje(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "No se pudo subir la foto. Revisá tu conexión y probá de nuevo.");
    } finally {
      URL.revokeObjectURL(previa);
    }
  }

  async function quitar() {
    if (!window.confirm("¿Quitar tu foto? Vuelve a verse tu inicial.")) return;
    setEstado("subiendo");
    const r = await fetch("/api/perfil/foto", { method: "DELETE" });
    if (r.ok) { setVista(null); setEstado("ok"); setMensaje("Foto quitada."); router.refresh(); }
    else { setEstado("error"); setMensaje("No se pudo quitar la foto."); }
  }

  return (
    <div className="mp">
      <section className="mp-foto">
        <button
          type="button"
          className="mp-avatar"
          onClick={() => input.current?.click()}
          aria-label="Cambiar foto de perfil"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) subir(f); }}
        >
          {vista ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vista} alt="" />
          ) : (
            <span className="mp-inicial">{inicial}</span>
          )}
          <span className="mp-camara" aria-hidden="true">
            {estado === "subiendo" ? <Loader2 size={18} className="mp-gira" /> : <Camera size={18} strokeWidth={2.2} />}
          </span>
        </button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ""; }}
        />
        <div className="mp-foto-txt">
          <p className="mp-foto-titulo">Tu foto</p>
          <p className="mp-ayuda">Tocá el círculo o arrastrá una imagen. Se recorta cuadrada.</p>
          <div className="mp-foto-acciones">
            <button type="button" className="mp-btn" onClick={() => input.current?.click()} disabled={estado === "subiendo"}>
              <Camera size={15} strokeWidth={2.2} aria-hidden="true" /> {vista ? "Cambiar foto" : "Subir foto"}
            </button>
            {vista && (
              <button type="button" className="mp-btn mp-btn--suave" onClick={quitar} disabled={estado === "subiendo"}>
                <Trash2 size={15} strokeWidth={2.2} aria-hidden="true" /> Quitar
              </button>
            )}
          </div>
          {mensaje && (
            <p className={"mp-msj" + (estado === "error" ? " es-error" : "")} role="status">
              {estado === "ok" && <Check size={14} strokeWidth={3} aria-hidden="true" />} {mensaje}
            </p>
          )}
        </div>
      </section>

      <form action={guardarMiPerfilAction} className="mp-form">
        <input type="hidden" name="volver" value={volver} />
        <label className="mp-campo">
          <span>Cómo te llamás</span>
          <input name="nombre" defaultValue={nombre} required minLength={2} maxLength={80} placeholder="Tu nombre y apellido" autoComplete="name" />
        </label>
        <label className="mp-campo">
          <span>Correo</span>
          <input value={email} readOnly aria-readonly="true" />
          <small>Con este correo entrás. Para cambiarlo, escribinos.</small>
        </label>
        <div className="mp-campo">
          <span>Plan</span>
          <p className="mp-plan">{plan}</p>
        </div>
        <BotonEnviar className="mp-guardar" pendingLabel="Guardando…">
          <Check size={16} strokeWidth={2.6} aria-hidden="true" /> Guardar cambios
        </BotonEnviar>
      </form>
    </div>
  );
}

export const CSS_MI_PERFIL = `
.mp { display: grid; grid-template-columns: minmax(260px, 340px) minmax(0, 1fr); gap: 18px; align-items: start; }
.mp-foto, .mp-form { background: #fff; border: 1px solid var(--linea); border-radius: 28px; box-shadow: var(--sombra); padding: 26px; }
.mp-foto { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px; background: linear-gradient(160deg, #FFF1EC, #fff 70%); }
.mp-avatar { position: relative; width: 168px; height: 168px; border-radius: 50%; border: 0; padding: 0; cursor: pointer; background: linear-gradient(135deg, var(--melocoton), var(--pink-soft)); box-shadow: 0 0 0 6px #fff, 0 20px 40px -20px rgba(176,70,70,.6); transition: transform .35s var(--curva); }
.mp-avatar:hover { transform: scale(1.03); }
.mp-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; }
.mp-inicial { display: grid; place-items: center; width: 100%; height: 100%; font-size: 64px; font-weight: 900; color: var(--pink-deep); }
.mp-camara { position: absolute; right: 6px; bottom: 6px; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; background: var(--pink); color: #fff; box-shadow: 0 0 0 4px #fff; }
.mp-gira { animation: mp-gira 1s linear infinite; }
@keyframes mp-gira { to { transform: rotate(360deg); } }
.mp-foto-titulo { font-size: 18px; font-weight: 900; color: var(--ink); }
.mp-ayuda { font-size: 13px; color: var(--muted); margin-top: 2px; }
.mp-foto-acciones { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 12px; }
.mp-btn { display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 16px; border-radius: 99px; border: 0; cursor: pointer; font: inherit; font-size: 13.5px; font-weight: 800; background: var(--pink); color: #fff; box-shadow: 0 10px 20px -12px rgba(230,79,85,.9); }
.mp-btn--suave { background: #fff; color: var(--ink); border: 1.5px solid var(--linea-fuerte); box-shadow: none; }
.mp-btn:disabled { opacity: .6; cursor: default; }
.mp-msj { display: inline-flex; align-items: center; gap: 5px; margin-top: 10px; padding: 6px 12px; border-radius: 99px; background: var(--rubor); color: var(--pink-deep); font-size: 12.5px; font-weight: 800; }
.mp-msj.es-error { background: var(--pink-wash); color: var(--pink-deep); }
.mp-form { display: flex; flex-direction: column; gap: 18px; }
.mp-campo { display: flex; flex-direction: column; gap: 7px; }
.mp-campo > span { font-size: 13px; font-weight: 800; color: var(--ink); }
.mp-campo input { height: 50px; border-radius: 16px; border: 1.5px solid var(--linea-fuerte); padding: 0 16px; font: inherit; font-size: 15px; color: var(--ink); background: #fff; outline: none; transition: border-color .2s, box-shadow .2s; }
.mp-campo input:focus { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.1); }
.mp-campo input[readonly] { background: var(--crema); color: var(--muted); }
.mp-campo small { font-size: 12px; color: var(--muted); }
.mp-plan { align-self: flex-start; padding: 7px 14px; border-radius: 99px; background: var(--rubor); color: var(--pink-deep); font-size: 13.5px; font-weight: 800; }
.mp-guardar { align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; height: 50px; padding: 0 24px; border-radius: 99px; border: 0; cursor: pointer; font: inherit; font-size: 15px; font-weight: 800; background: var(--pink); color: #fff; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); transition: transform .3s var(--curva); }
.mp-guardar:hover { transform: translateY(-2px); }
@media (max-width: 760px) { .mp { grid-template-columns: 1fr; } .mp-foto, .mp-form { padding: 20px; border-radius: 24px; } }
`;
