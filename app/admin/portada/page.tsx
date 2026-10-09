import { ArrowDown, ArrowUp, Check, ExternalLink, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { AdminAviso, AdminCabecera } from "@/components/admin-ui";
import { CertificadosDePortada } from "@/components/admin-portada-certificados";
import { BotonEnviar } from "@/components/boton-enviar";
import { SubidorDePortada } from "@/components/admin-portada-media";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { CAMPOS, campo } from "@/src/features/admin/portada/campos";
import {
  borrarPreguntaAction,
  crearPreguntaAction,
  editarPreguntaAction,
  guardarCamposDePortadaAction,
  moverPreguntaAction,
  publicarPreguntaAction,
} from "@/src/features/admin/portada/actions";

export const dynamic = "force-dynamic";

/**
 * La portada, editable.
 *
 * ALCANCE, Y POR QUE ES ESTE
 *   Tres cosas: el FAQ, el video del tráiler y los certificados. Los textos del
 *   hero y de las secciones quedaron AFUERA por decisión del dueño: son ~42
 *   campos por cuatro idiomas, es lo más trabajoso de construir y lo que menos
 *   se toca. Siguen viniendo compilados de src/i18n/public.ts.
 *
 *   Lo que NO se puede editar desde acá -- estructura, secciones, colores,
 *   tipografía -- tampoco tiene endpoint: la lista blanca de campos.ts es lo que
 *   la acción valida, no lo que la pantalla dibuja.
 *
 * ⚠️ EL FAQ VA FUERA DEL <form> GRANDE.
 *    Cada pregunta tiene sus propios botones (publicar, mover, borrar) y los
 *    formularios anidados son HTML inválido: el parser descarta el interno y sus
 *    botones terminan enviando el de afuera. En este proyecto ya pasó -- el
 *    botón de eliminar de una clase terminaba llamando a la acción de guardar.
 */

type FilaTexto = { key: string; value_i18n: Record<string, unknown> | null };

type FilaFaq = {
  id: string;
  display_order: number;
  is_published: boolean;
  question_i18n: Record<string, string> | null;
  answer_i18n: Record<string, string> | null;
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PortadaAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const ok = typeof params.success === "string" ? params.success : undefined;
  const err = typeof params.error === "string" ? params.error : undefined;

  const supabase = createSupabaseAdminClient();

  /**
   * Acá se leen las TABLAS, no las vistas: el panel tiene que ver los
   * borradores sin publicar, que es justamente lo que las vistas esconden.
   */
  const [{ data: textos }, { data: faq }] = await Promise.all([
    supabase.from("landing_texts").select("key, value_i18n"),
    supabase.from("landing_faq").select("*").order("display_order"),
  ]);

  const valor = (clave: string): string => {
    const fila = ((textos ?? []) as FilaTexto[]).find((t) => t.key === clave);
    const v = fila?.value_i18n?.es;
    if (Array.isArray(v)) return v.join("\n");
    return typeof v === "string" ? v : "";
  };

  const preguntas = (faq ?? []) as FilaFaq[];
  const publicadas = preguntas.filter((p) => p.is_published).length;
  const certificados = campo("about.highlights");

  return (
    <main className="pa">
      <style>{CSS}</style>

      <AdminCabecera
        eyebrow="Sitio público"
        titulo="Portada"
        lede={<>Lo que ve alguien que entra a <strong>bruneladance.com</strong> sin tener cuenta: el tráiler, los certificados y las preguntas frecuentes.</>}
        acciones={<a href="/" target="_blank" rel="noopener noreferrer" className="ad-btn"><ExternalLink size={15} strokeWidth={2} aria-hidden="true" /> Ver la portada</a>}
      />

      <AdminAviso mensaje={ok ?? null} tono="ok" />
      <AdminAviso mensaje={err ?? null} tono="error" />

      {/* ── 01 y 02: el tráiler y los certificados, un solo formulario ── */}
      <form action={guardarCamposDePortadaAction} className="pa-bloque">
        <div className="pa-bloque-cab">
          <span className="pf-num">01</span>
          <div>
            <h2>El tráiler</h2>
            <p>El video de fondo de la portada y la imagen que se ve mientras carga.</p>
          </div>
        </div>
        <div className="pa-medios">
          {CAMPOS.filter((c) => c.tipo === "url").map((c) => (
            <SubidorDePortada
              key={c.clave}
              name={c.clave}
              etiqueta={c.etiqueta}
              ayuda={c.ayuda}
              valorActual={valor(c.clave)}
              accept={c.clave === "video.src" ? "video/mp4,video/webm" : "image/*"}
            />
          ))}
        </div>

        {certificados && (
          <>
            <div className="pa-bloque-cab pa-bloque-cab--sep">
              <span className="pf-num">02</span>
              <div>
                <h2>{certificados.etiqueta}</h2>
                <p>{certificados.ayuda}</p>
              </div>
            </div>
            <CertificadosDePortada name={certificados.clave} valorActual={valor(certificados.clave)} />
          </>
        )}

        <div className="pa-pie">
          <BotonEnviar className="pf-guardar" pendingLabel="Guardando…">
            <Check size={16} strokeWidth={2.4} aria-hidden="true" /> Guardar tráiler y certificados
          </BotonEnviar>
        </div>
      </form>

      {/* ── 03: el FAQ ──
          Va FUERA del form de arriba: cada pregunta tiene sus propios
          formularios y no se pueden anidar. */}
      <section className="pa-bloque">
        <div className="pa-bloque-cab">
          <span className="pf-num">03</span>
          <div>
            <h2>Preguntas frecuentes</h2>
            <p>
              Se escriben <strong>en español</strong> y se ven igual en los cuatro idiomas hasta que alguien las traduzca.
              Una pregunta nace sin publicar.
            </p>
          </div>
          {preguntas.length > 0 && (
            <span className="pa-conteo"><strong>{publicadas}</strong> de {preguntas.length} en la portada</span>
          )}
        </div>

        {preguntas.length === 0 ? (
          <p className="pa-vacio">
            Todavía no hay ninguna. Mientras no haya al menos una publicada, la sección no aparece en la portada.
          </p>
        ) : (
          <ol className="pa-faq">
            {preguntas.map((p, i) => (
              <li key={p.id} className={"pa-faq-item" + (p.is_published ? " es-pub" : "")}>
                <span className="pa-faq-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <form action={editarPreguntaAction} className="pa-faq-form">
                  <input type="hidden" name="id" value={p.id} />
                  <input className="pa-pregunta" name="pregunta" defaultValue={p.question_i18n?.es ?? ""} placeholder="¿Necesito experiencia previa?" aria-label="Pregunta" />
                  <textarea className="pa-respuesta" name="respuesta" rows={3} defaultValue={p.answer_i18n?.es ?? ""} placeholder="La respuesta, en español." aria-label="Respuesta" />
                  <div className="pa-faq-pie">
                    <span className={"pa-estado" + (p.is_published ? " es-pub" : "")}>
                      <span className="pa-punto" aria-hidden="true" />{p.is_published ? "En la portada" : "Borrador"}
                    </span>
                    <BotonEnviar className="pa-guardar" pendingLabel="Guardando…">Guardar</BotonEnviar>
                  </div>
                </form>

                {/* Fuera del form de arriba: no se pueden anidar. */}
                <div className="pa-faq-botones">
                  <form action={publicarPreguntaAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="publicar" value={p.is_published ? "0" : "1"} />
                    <BotonEnviar className={"pa-icono" + (p.is_published ? "" : " pa-icono--publicar")} title={p.is_published ? "Sacar de la portada" : "Publicar en la portada"} pendingLabel="…">
                      {p.is_published ? <EyeOff size={15} /> : <Eye size={15} />}
                    </BotonEnviar>
                  </form>
                  <form action={moverPreguntaAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="direccion" value="arriba" />
                    <BotonEnviar className="pa-icono" title="Subir" disabled={i === 0} pendingLabel="…"><ArrowUp size={15} /></BotonEnviar>
                  </form>
                  <form action={moverPreguntaAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="direccion" value="abajo" />
                    <BotonEnviar className="pa-icono" title="Bajar" disabled={i === preguntas.length - 1} pendingLabel="…"><ArrowDown size={15} /></BotonEnviar>
                  </form>
                  <form action={borrarPreguntaAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <BotonEnviar className="pa-icono pa-borrar" title="Borrar" pendingLabel="…" confirmar="¿Borrar esta pregunta del FAQ?">
                      <Trash2 size={15} />
                    </BotonEnviar>
                  </form>
                </div>
              </li>
            ))}
          </ol>
        )}

        <form action={crearPreguntaAction} className="pa-nueva">
          <p className="pa-nueva-titulo"><Plus size={16} strokeWidth={2.2} aria-hidden="true" /> Agregar una pregunta</p>
          <input className="pa-pregunta" name="pregunta" placeholder="¿Necesito experiencia previa?" aria-label="Pregunta nueva" required />
          <textarea className="pa-respuesta" name="respuesta" rows={3} placeholder="La respuesta, en español." aria-label="Respuesta nueva" required />
          <div className="pa-faq-pie">
            <span className="pa-nota">Nace sin publicar: la publicás después con el ojo.</span>
            <BotonEnviar className="pf-guardar" pendingLabel="Creando…"><Plus size={16} strokeWidth={2.2} aria-hidden="true" /> Crear pregunta</BotonEnviar>
          </div>
        </form>
      </section>
    </main>
  );
}

const CSS = `
.pa { display: flex; flex-direction: column; gap: 18px; }
.pa .ad-mast { padding-bottom: 6px; }
.pa-bloque { border: 1px solid #F0DED6; border-radius: 24px; background: #fff; padding: clamp(18px, 2.4vw, 28px); }
.pa-bloque-cab { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 18px; }
.pa-bloque-cab--sep { margin-top: 26px; padding-top: 24px; border-top: 1px solid #F6E7E1; }
.pa-bloque-cab .pf-num { margin-top: 3px; }
.pa-bloque-cab h2 { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 20px; letter-spacing: -0.03em; color: var(--ink); }
.pa-bloque-cab p { margin-top: 3px; max-width: 64ch; font-size: 13.5px; line-height: 1.6; color: #8A6F68; }
.pa-bloque-cab p strong { color: var(--ink); }
.pa-conteo { margin-left: auto; flex-shrink: 0; font-size: 12.5px; color: #8A6F68; padding: 6px 12px; border-radius: 99px; background: #FFFAF6; }
.pa-conteo strong { color: var(--ink); }
.pa-pie { display: flex; justify-content: flex-end; margin-top: 22px; padding-top: 18px; border-top: 1px solid #F6E7E1; }

/* tráiler: SubidorDePortada */
.pa-medios { display: grid; gap: 14px; }
.pm { display: grid; grid-template-columns: minmax(200px, 300px) minmax(0, 1fr); gap: 20px; align-items: start; padding: 14px; border-radius: 18px; background: #FFFAF6; }
.pm-vista {
  position: relative; aspect-ratio: 16 / 9; border-radius: 14px; overflow: hidden; border: 1.5px dashed transparent;
  background: linear-gradient(135deg, var(--pink-wash) 0%, var(--pink-soft) 55%, var(--rose) 130%); transition: border-color .2s, transform .2s;
}
.pm-vista.es-arrastre { border-color: var(--pink); transform: scale(1.01); }
.pm-vista video, .pm-vista img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; animation: pf-aparece .5s ease both; }
.pm-vacia { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--pink-deep); }
.pm-cargando { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.6); color: var(--pink-deep); }
.pm-datos { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.pm-label { font-weight: 800; font-size: 15px; color: var(--ink); }
.pm-ayuda { font-size: 12.5px; line-height: 1.55; color: #8A6F68; }
.pm-input { border-radius: 12px; border: 1.5px solid #F0DED6; padding: 0.7rem 0.9rem; font-size: 13.5px; background: #fff; }
.pm-input:focus { border-color: var(--pink); }
.pm-fila { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 2px; }
.pm-subir {
  display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 15px; border-radius: 99px; cursor: pointer;
  border: 1.5px solid var(--ink); background: #fff; color: var(--ink); font: inherit; font-size: 13px; font-weight: 700; transition: background .2s, color .2s;
}
.pm-subir:hover:not(:disabled) { background: var(--ink); color: #fff; }
.pm-subir:disabled { opacity: 0.6; cursor: progress; }
.pm-ver { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700; color: var(--pink-deep); text-decoration: none; }
.pm-ver:hover { text-decoration: underline; }
.pm-msg { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; }
.pm-subiendo { color: #8A6F68; }
.pm-listo { color: #15803d; }
.pm-error { color: var(--pink-deep); }

/* certificados */
.pt-cert { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; align-items: stretch; }
.pt-cert-texto { border-radius: 14px; border: 1.5px solid #F0DED6; padding: 0.85rem 1rem; font-size: 14px; line-height: 1.7; resize: vertical; }
.pt-cert-texto:focus { border-color: var(--pink); }
.pt-cert-vista { display: flex; flex-direction: column; gap: 12px; padding: 16px 18px; border-radius: 16px; background: #FFFAF6; }
.pt-cert-rotulo { font-size: 10.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #B39189; }
.pt-cert-vacio { font-size: 13px; color: #B39189; }
.pt-cert-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.pt-cert-chip {
  padding: 7px 14px; border-radius: 99px; background: #fff; border: 1px solid var(--pink-line);
  font-size: 13px; font-weight: 700; color: var(--pink-deep); animation: ad-entra .35s ease both;
}

/* FAQ */
.pa-vacio { padding: 16px 18px; border-radius: 14px; background: #FFFAF6; font-size: 13.5px; color: #8A6F68; }
.pa-faq { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.pa-faq-item {
  position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 14px; align-items: start;
  padding: 16px; border-radius: 18px; border: 1.5px dashed #F0DED6; background: #FFFAF6;
  transition: border-color .2s, box-shadow .25s;
}
.pa-faq-item.es-pub { border-style: solid; background: #fff; }
.pa-faq-item:hover { border-color: var(--pink-line); box-shadow: 0 16px 30px -24px rgba(176,58,62,0.5); }
.pa-faq-num { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 22px; letter-spacing: -0.03em; color: var(--pink-line); padding-top: 4px; }
.pa-faq-item.es-pub .pa-faq-num { color: var(--pink-mid); }
.pa-faq-form { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.pa-pregunta { border-radius: 12px; border: 1.5px solid #F0DED6; padding: 0.65rem 0.85rem; font-size: 14.5px; font-weight: 700; background: #fff; }
.pa-respuesta { border-radius: 12px; border: 1.5px solid #F0DED6; padding: 0.65rem 0.85rem; font-size: 13.5px; line-height: 1.6; background: #fff; resize: vertical; }
.pa-pregunta:focus, .pa-respuesta:focus { border-color: var(--pink); }
.pa-faq-pie { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.pa-estado { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #8A6F68; }
.pa-estado.es-pub { color: #15803d; }
.pa-punto { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.pa-guardar {
  height: 36px; padding: 0 16px; border-radius: 99px; cursor: pointer; border: 1.5px solid var(--ink); background: #fff; color: var(--ink);
  font: inherit; font-size: 13px; font-weight: 700; transition: background .2s, color .2s;
}
.pa-guardar:hover { background: var(--ink); color: #fff; }
.pa-faq-botones { display: flex; flex-direction: column; gap: 6px; }
.pa-faq-botones form { display: contents; }
.pa-icono {
  width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; border-radius: 10px; cursor: pointer;
  border: 1px solid #F0DED6; background: #fff; color: #6E5550; transition: background .2s, color .2s, border-color .2s;
}
.pa-icono:hover:not(:disabled) { background: var(--pink-wash); color: var(--pink-deep); border-color: var(--pink-line); }
.pa-icono:disabled { opacity: 0.3; cursor: default; }
.pa-icono--publicar { background: var(--pink); border-color: var(--pink); color: #fff; }
.pa-icono--publicar:hover:not(:disabled) { background: var(--pink-mid); color: #fff; }
.pa-borrar:hover:not(:disabled) { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
.pa-nueva { display: flex; flex-direction: column; gap: 8px; margin-top: 18px; padding: 18px; border-radius: 18px; border: 1.5px dashed var(--pink-line); }
.pa-nueva-titulo { display: flex; align-items: center; gap: 7px; font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 16px; letter-spacing: -0.02em; color: var(--ink); margin-bottom: 4px; }
.pa-nota { font-size: 12.5px; color: #B39189; }

@media (max-width: 760px) {
  .pm, .pt-cert { grid-template-columns: minmax(0, 1fr); }
  .pa-faq-item { grid-template-columns: minmax(0, 1fr); }
  .pa-faq-num { display: none; }
  .pa-faq-botones { flex-direction: row; }
  .pa-bloque-cab { flex-wrap: wrap; }
  .pa-conteo { margin-left: 0; }
}
`;
