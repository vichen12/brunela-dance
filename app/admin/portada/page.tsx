import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
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

function Flash({ ok, err }: { ok?: string; err?: string }) {
  const msg = ok ?? err;
  if (!msg) return null;
  const bien = Boolean(ok);
  return (
    <div
      role="status"
      style={{
        borderRadius: 12,
        padding: "11px 16px",
        marginBottom: 20,
        fontSize: 13,
        fontWeight: 600,
        background: bien ? "#f0fdf4" : "#fef2f2",
        color: bien ? "#166534" : "#991b1b",
        border: `1px solid ${bien ? "#bbf7d0" : "#fecaca"}`,
      }}
    >
      {msg}
    </div>
  );
}

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

  return (
    <div className="pa-wrap">
      <header className="pa-head">
        <h1>Portada</h1>
        <p>
          Lo que ve alguien que entra a <strong>bruneladance.com</strong> sin tener cuenta.
        </p>
      </header>

      <Flash ok={ok} err={err} />

      {/* ── El tráiler y los certificados ── */}
      <form action={guardarCamposDePortadaAction} className="pa-card">
        <h2>El tráiler y los certificados</h2>

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

        {(() => {
          const c = campo("about.highlights");
          if (!c) return null;
          return (
            <div className="pa-campo">
              <label className="pa-label" htmlFor="highlights">
                {c.etiqueta}
              </label>
              <p className="pa-ayuda">{c.ayuda}</p>
              <textarea
                id="highlights"
                name={c.clave}
                rows={6}
                className="pa-textarea"
                defaultValue={valor(c.clave)}
                placeholder={"Ballet\nPilates\nPBT\nPCT\nRAD CPD Credits"}
              />
            </div>
          );
        })()}

        <div className="pa-acciones">
          <BotonEnviar>Guardar</BotonEnviar>
        </div>
      </form>

      {/* ── El FAQ ── */}
      <section className="pa-card">
        <h2>Preguntas frecuentes</h2>
        <p className="pa-ayuda">
          Se escriben <strong>en español</strong> y se ven igual en los cuatro idiomas hasta que
          alguien las traduzca. Una pregunta nace sin publicar: se ve acá, no en la portada.
          {preguntas.length > 0 && (
            <>
              {" "}
              Hay <strong>{preguntas.length}</strong> y {publicadas === 0 ? "ninguna" : publicadas}{" "}
              {publicadas === 1 ? "está publicada" : "están publicadas"}.
            </>
          )}
        </p>

        {preguntas.length === 0 ? (
          <p className="pa-vacio">
            Todavía no hay ninguna. Mientras no haya al menos una publicada, la sección no aparece
            en la portada.
          </p>
        ) : (
          <ul className="pa-faq">
            {preguntas.map((p, i) => (
              <li key={p.id} className={p.is_published ? "pa-faq-item" : "pa-faq-item pa-borrador"}>
                <form action={editarPreguntaAction} className="pa-faq-form">
                  <input type="hidden" name="id" value={p.id} />
                  <input
                    className="pa-input"
                    name="pregunta"
                    defaultValue={p.question_i18n?.es ?? ""}
                    placeholder="¿Necesito experiencia previa?"
                    aria-label="Pregunta"
                  />
                  <textarea
                    className="pa-textarea"
                    name="respuesta"
                    rows={3}
                    defaultValue={p.answer_i18n?.es ?? ""}
                    placeholder="La respuesta, en español."
                    aria-label="Respuesta"
                  />
                  <BotonEnviar>Guardar</BotonEnviar>
                </form>

                {/* Fuera del form de arriba: no se pueden anidar. */}
                <div className="pa-faq-botones">
                  <span className="pa-estado">{p.is_published ? "En la portada" : "Borrador"}</span>

                  <form action={publicarPreguntaAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="publicar" value={p.is_published ? "0" : "1"} />
                    <button className="pa-icono" type="submit" title={p.is_published ? "Despublicar" : "Publicar"}>
                      {p.is_published ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </form>

                  <form action={moverPreguntaAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="direccion" value="arriba" />
                    <button className="pa-icono" type="submit" title="Subir" disabled={i === 0}>
                      <ArrowUp size={15} />
                    </button>
                  </form>

                  <form action={moverPreguntaAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="direccion" value="abajo" />
                    <button
                      className="pa-icono"
                      type="submit"
                      title="Bajar"
                      disabled={i === preguntas.length - 1}
                    >
                      <ArrowDown size={15} />
                    </button>
                  </form>

                  <form action={borrarPreguntaAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="pa-icono pa-borrar" type="submit" title="Borrar">
                      <Trash2 size={15} />
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form action={crearPreguntaAction} className="pa-nueva">
          <h3>
            <Plus size={15} aria-hidden /> Agregar una pregunta
          </h3>
          <input
            className="pa-input"
            name="pregunta"
            placeholder="¿Necesito experiencia previa?"
            aria-label="Pregunta nueva"
            required
          />
          <textarea
            className="pa-textarea"
            name="respuesta"
            rows={3}
            placeholder="La respuesta, en español."
            aria-label="Respuesta nueva"
            required
          />
          <BotonEnviar>Crear</BotonEnviar>
        </form>
      </section>

      <style>{`
        .pa-wrap { max-width: 860px; }

        .pa-head { margin-bottom: 22px; }
        .pa-head h1 {
          margin: 0 0 4px;
          font-family: var(--font-display), sans-serif;
          font-size: 1.6rem;
          font-weight: 900;
          color: var(--ink, #1c1917);
        }
        .pa-head p { margin: 0; font-size: 0.86rem; color: var(--pink-muted, #8C5F5F); }

        .pa-card {
          display: grid;
          gap: 1.1rem;
          padding: 22px;
          margin-bottom: 20px;
          border: 1px solid #FFDADA;
          border-radius: 14px;
          background: #fff;
        }

        .pa-card h2 {
          margin: 0;
          font-size: 1rem;
          font-weight: 800;
          color: var(--ink, #1c1917);
        }

        .pa-campo { display: grid; gap: 0.35rem; }

        .pa-label { font-size: 0.8rem; font-weight: 800; color: var(--ink, #1c1917); }

        .pa-ayuda {
          margin: 0;
          font-size: 0.78rem;
          line-height: 1.55;
          color: var(--pink-muted, #8C5F5F);
        }

        .pa-input, .pa-textarea {
          width: 100%;
          padding: 0.6rem 0.75rem;
          border: 1px solid var(--pink-line, #F2C6C6);
          border-radius: 10px;
          background: #fff;
          font-family: var(--font-body), sans-serif;
          font-size: 0.85rem;
          line-height: 1.5;
          color: var(--ink, #1c1917);
        }

        .pa-textarea { resize: vertical; }

        .pa-input:focus-visible, .pa-textarea:focus-visible {
          outline: 2px solid var(--pink-deep, #B03A3E);
          outline-offset: 1px;
          border-color: transparent;
        }

        .pa-acciones { display: flex; justify-content: flex-end; }

        .pa-vacio {
          margin: 0;
          padding: 14px 16px;
          border-radius: 10px;
          background: var(--pink-wash, #FDECEC);
          font-size: 0.82rem;
          color: var(--pink-muted, #8C5F5F);
        }

        .pa-faq { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.9rem; }

        .pa-faq-item {
          display: grid;
          gap: 0.6rem;
          padding: 14px;
          border: 1px solid var(--pink-line, #F2C6C6);
          border-radius: 12px;
          background: #fffdfd;
        }

        /* Un borrador se distingue de lo publicado sin leer la etiqueta. */
        .pa-borrador { background: #fafafa; border-style: dashed; }

        .pa-faq-form { display: grid; gap: 0.5rem; justify-items: end; }
        .pa-faq-form .pa-input, .pa-faq-form .pa-textarea { justify-self: stretch; }

        .pa-faq-botones {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding-top: 0.6rem;
          border-top: 1px solid #F6E6E6;
        }

        .pa-estado {
          margin-right: auto;
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--pink-deep, #B03A3E);
        }

        .pa-borrador .pa-estado { color: #78716c; }

        .pa-icono {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border: 1px solid var(--pink-line, #F2C6C6);
          border-radius: 9px;
          background: #fff;
          color: var(--pink-deep, #B03A3E);
          cursor: pointer;
        }

        .pa-icono:hover:not(:disabled) { background: var(--pink-wash, #FDECEC); }
        .pa-icono:disabled { opacity: 0.35; cursor: default; }
        .pa-borrar { color: #b91c1c; }
        .pa-borrar:hover:not(:disabled) { background: #fef2f2; }

        .pa-nueva {
          display: grid;
          gap: 0.55rem;
          justify-items: end;
          padding-top: 1rem;
          border-top: 1px solid #F6E6E6;
        }

        .pa-nueva .pa-input, .pa-nueva .pa-textarea { justify-self: stretch; }

        .pa-nueva h3 {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          justify-self: start;
          margin: 0;
          font-size: 0.85rem;
          font-weight: 800;
          color: var(--ink, #1c1917);
        }
      `}</style>
    </div>
  );
}
