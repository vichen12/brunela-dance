import { ArrowDown, ArrowUp, Award, Check, ExternalLink, Eye, EyeOff, Film, HelpCircle, Plus, Trash2 } from "lucide-react";
import { AdminAviso, AdminCabecera } from "@/components/admin-ui";
import { CertificadosDePortada } from "@/components/admin-portada-certificados";
import { BotonEnviar } from "@/components/boton-enviar";
import { SubidorDePortada } from "@/components/admin-portada-media";
import { CamposDePreguntaFaq, type DatosDeIdioma, type IdiomaPestana } from "@/components/admin-portada-faq";
import { MAX_PORTADA_BYTES } from "@/src/lib/portada-media";
import { IDIOMAS_TRADUCIBLES, estadoDeIdioma } from "@/src/features/admin/portada/faq-idiomas";
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
  updated_at: string | null;
  question_i18n: Record<string, string> | null;
  answer_i18n: Record<string, string> | null;
  question_auto_i18n: Record<string, string> | null;
  answer_auto_i18n: Record<string, string> | null;
};

/**
 * Lo que cada pestaña de idioma necesita saber, en datos planos (trampa 6:
 * esto cruza a un componente de cliente). La regla de qué es «tuya» y qué es
 * «automática» vive en faq-idiomas.ts, no acá.
 */
function idiomasDe(p: FilaFaq): Record<IdiomaPestana, DatosDeIdioma> {
  const salida = {} as Record<IdiomaPestana, DatosDeIdioma>;
  for (const idioma of IDIOMAS_TRADUCIBLES) {
    const { estado, desactualizada } = estadoDeIdioma(p, idioma);
    const q = (p.question_i18n?.[idioma] ?? "").trim();
    const a = (p.answer_i18n?.[idioma] ?? "").trim();
    salida[idioma] = {
      pregunta: estado === "tuya" ? q : "",
      respuesta: estado === "tuya" ? a : "",
      autoPregunta: estado === "automatica" ? q : "",
      autoRespuesta: estado === "automatica" ? a : "",
      desactualizada,
    };
  }
  return salida;
}

const SIN_TRADUCCION: DatosDeIdioma = { pregunta: "", respuesta: "", autoPregunta: "", autoRespuesta: "", desactualizada: false };
const MAX_MB = Math.floor(MAX_PORTADA_BYTES / 1_048_576);

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
          <span className="pa-ico pa-ico--coral" aria-hidden="true"><Film size={19} strokeWidth={2.2} /></span>
          <div>
            <h2>El tráiler</h2>
            <p>El video que corre en la portada, en dos pasos. Subís los archivos, mirás la vista previa y al final tocás <strong>Guardar</strong>.</p>
          </div>
        </div>

        <ol className="pa-pasos">
          {CAMPOS.filter((c) => c.tipo === "url").map((c) => {
            const esVideo = c.clave === "video.src";
            return (
              <li key={c.clave}>
                <SubidorDePortada
                  name={c.clave}
                  paso={esVideo ? 1 : 2}
                  titulo={esVideo ? "Subí el video" : "Elegí la imagen de portada"}
                  ayuda={esVideo ? `MP4 o WebM, hasta ${MAX_MB} MB. Se reproduce sin sonido y en bucle.` : "Se ve mientras el video carga. Conviene que sea un cuadro del propio video."}
                  valorActual={valor(c.clave)}
                  accept={esVideo ? "video/mp4,video/webm" : "image/jpeg,image/png,image/webp,image/avif"}
                  formatos={esVideo ? "MP4 o WebM" : "JPG, PNG, WebP o AVIF"}
                  maxMb={MAX_MB}
                  ancla="video-trailer"
                />
              </li>
            );
          })}
        </ol>

        {certificados && (
          <>
            <div className="pa-bloque-cab pa-bloque-cab--sep">
              <span className="pa-ico pa-ico--melo" aria-hidden="true"><Award size={19} strokeWidth={2.2} /></span>
              <div>
                <h2>{certificados.etiqueta}</h2>
                <p>Las etiquetas que aparecen en «Sobre mí». Escribí una, apretá <strong>Enter</strong> y sumá la siguiente.</p>
              </div>
              <a className="pa-ver" href="/#sobre" target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} strokeWidth={2.2} aria-hidden="true" /> Ver en la portada
              </a>
            </div>
            <CertificadosDePortada name={certificados.clave} valorActual={valor(certificados.clave)} />
          </>
        )}

        <div className="pa-pie">
          <p className="pa-nota">Nada de esto se ve en la portada hasta que tocás Guardar.</p>
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
          <span className="pa-ico pa-ico--rubor" aria-hidden="true"><HelpCircle size={19} strokeWidth={2.2} /></span>
          <div>
            <h2>Preguntas frecuentes</h2>
            <p>
              Se escriben <strong>en español</strong>. En EN, FR e IT podés poner tu propia traducción; si dejás una
              pestaña vacía, ese idioma usa la traducción automática o, si no hay, el español. Una pregunta nace sin publicar.
            </p>
          </div>
          {preguntas.length > 0 && (
            <span className="pa-conteo"><strong>{publicadas}</strong> de {preguntas.length} en la portada</span>
          )}
        </div>

        <div className="pa-leyenda" aria-label="Qué significa cada color de idioma">
          <span><i className="pq-tab-punto pq-tab-punto--tuya" aria-hidden="true" /> Traducción tuya</span>
          <span><i className="pq-tab-punto pq-tab-punto--automatica" aria-hidden="true" /> Automática</span>
          <span><i className="pq-tab-punto pq-tab-punto--espanol" aria-hidden="true" /> Usa el español</span>
        </div>

        {preguntas.length === 0 ? (
          <div className="pa-vacio">
            <span className="pa-ico pa-ico--rubor" aria-hidden="true"><HelpCircle size={18} strokeWidth={2.2} /></span>
            <p>Todavía no hay ninguna. Mientras no haya al menos una publicada, la sección no aparece en la portada.</p>
          </div>
        ) : (
          <ol className="pa-faq">
            {preguntas.map((p, i) => (
              <li key={p.id} className={"pa-faq-item" + (p.is_published ? " es-pub" : "")}>
                <span className="pa-faq-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <form action={editarPreguntaAction} className="pa-faq-form">
                  <input type="hidden" name="id" value={p.id} />
                  {/* La key incluye updated_at: después de guardar, el
                      componente se rearma con lo que quedó en la base. */}
                  <CamposDePreguntaFaq
                    key={p.id + (p.updated_at ?? "")}
                    es={{ pregunta: p.question_i18n?.es ?? "", respuesta: p.answer_i18n?.es ?? "" }}
                    idiomas={idiomasDe(p)}
                  />
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
          {/* key = cantidad de preguntas: al crear una, el formulario vuelve a
              quedar en blanco en vez de conservar lo recién enviado. */}
          <CamposDePreguntaFaq
            key={preguntas.length}
            nueva
            es={{ pregunta: "", respuesta: "" }}
            idiomas={{ en: SIN_TRADUCCION, fr: SIN_TRADUCCION, it: SIN_TRADUCCION }}
          />
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
.pa { display: flex; flex-direction: column; gap: 18px; padding-bottom: 40px; }
.pa .ad-mast { margin-bottom: 4px; }
.pa .ad-lede strong { color: var(--ink); }
.pa-bloque { border: 1px solid var(--linea); border-radius: 28px; background: #fff; padding: clamp(18px, 2.6vw, 30px); box-shadow: var(--sombra); }
.pa-bloque-cab { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 18px; }
.pa-bloque-cab--sep { margin-top: 28px; padding-top: 26px; border-top: 1px dashed var(--linea-fuerte); }
.pa-ico { width: 44px; height: 44px; border-radius: 15px; flex-shrink: 0; display: grid; place-items: center; }
.pa-ico--coral { background: var(--pink); color: #fff; box-shadow: 0 12px 22px -14px rgba(230,79,85,.9); }
.pa-ico--melo { background: #FFEEDB; color: var(--melocoton-deep); }
.pa-ico--rubor { background: var(--rubor); color: var(--pink-deep); }
.pa-bloque-cab h2 { font-family: var(--font-display), sans-serif; font-weight: 900; font-size: 20px; letter-spacing: -0.02em; color: var(--ink); }
.pa-bloque-cab p { margin-top: 3px; max-width: 70ch; font-size: 14px; line-height: 1.6; color: var(--muted); }
.pa-bloque-cab p strong { color: var(--ink); }
.pa-conteo { margin-left: auto; flex-shrink: 0; font-size: 13px; font-weight: 700; color: var(--pink-deep); padding: 7px 14px; border-radius: 99px; background: var(--rubor); }
.pa-conteo strong { font-weight: 900; }
.pa-ver { margin-left: auto; flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 99px; background: #fff; border: 1px solid var(--linea-fuerte); font-size: 13px; font-weight: 800; color: var(--pink-deep); text-decoration: none; transition: background .2s; }
.pa-ver:hover { background: var(--rubor); }
.pa-pie { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 24px; padding-top: 18px; border-top: 1px dashed var(--linea-fuerte); }
.pa-nota { font-size: 13px; color: var(--muted); }

/* ── tráiler: dos pasos ── */
.pa-pasos { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.pa-pasos > li { display: flex; min-width: 0; }
.pm { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 14px; padding: 18px; border-radius: 26px; background: var(--crema); border: 1px solid var(--linea); transition: border-color .3s, box-shadow .35s var(--curva); }
.pm.es-listo { background: #fff; box-shadow: var(--sombra); }
.pm-cab { display: flex; align-items: flex-start; gap: 12px; }
.pm-paso { width: 38px; height: 38px; flex-shrink: 0; display: grid; place-items: center; border-radius: 14px; background: var(--rubor); color: var(--pink-deep); font-weight: 900; font-size: 17px; }
.pm.es-listo .pm-paso { background: var(--pink); color: #fff; box-shadow: 0 10px 18px -10px rgba(230,79,85,.9); }
.pm-cab-texto { flex: 1; min-width: 0; }
.pm-titulo { font-family: var(--font-display), sans-serif; font-weight: 900; font-size: 17px; letter-spacing: -0.015em; color: var(--ink); }
.pm-ayuda { margin-top: 2px; font-size: 13px; line-height: 1.5; color: var(--muted); }
.pm-estado { flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 99px; font-size: 12.5px; font-weight: 800; white-space: nowrap; background: #fff; border: 1px solid var(--linea-fuerte); color: var(--muted); }
.pm-estado.es-subiendo { background: #FFEEDB; border-color: transparent; color: var(--melocoton-deep); }
.pm-estado.es-listo { background: var(--pink-wash); border-color: var(--pink-line); color: var(--pink-deep); }

.pm-zona {
  position: relative; min-height: 236px; border-radius: 22px; border: 2px dashed var(--pink-line); overflow: hidden;
  background: radial-gradient(120% 90% at 0% 0%, #FFEEDB 0%, transparent 55%), radial-gradient(90% 80% at 100% 100%, var(--pink-wash) 0%, transparent 60%), #FFFAF7;
  display: grid; place-items: center; transition: border-color .2s, transform .3s var(--curva), background-color .2s;
}
.pm-zona.es-arrastre { border-color: var(--pink); transform: scale(1.012); background-color: var(--rubor); }
.pm-zona.tiene-medio { border-style: solid; border-color: var(--linea); background: #FBF1EC; }
.pm-invita, .pm-subiendo { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 26px 18px; text-align: center; }
.pm-burbuja { width: 52px; height: 52px; border-radius: 18px; display: grid; place-items: center; background: #fff; color: var(--pink-deep); box-shadow: var(--sombra); margin-bottom: 4px; }
.pm-zona-titulo { font-weight: 900; font-size: 15.5px; color: var(--ink); }
.pm-zona-sub { font-size: 12.5px; color: var(--muted); }
.pm-elegir {
  display: inline-flex; align-items: center; gap: 8px; height: 46px; padding: 0 24px; border-radius: 99px; cursor: pointer; margin: 2px 0 4px;
  border: 0; background: var(--pink); color: #fff; font: inherit; font-size: 14.5px; font-weight: 800;
  box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); transition: background .2s, transform .3s var(--curva);
}
.pm-elegir:hover { background: var(--pink-mid); transform: translateY(-1px); }
.pm-elegir:focus-visible, .pm-btn:focus-visible { outline: 3px solid var(--pink-soft); outline-offset: 2px; }
.pm-barra { width: min(260px, 100%); height: 10px; border-radius: 99px; background: #fff; border: 1px solid var(--pink-line); overflow: hidden; margin: 6px 0 2px; }
.pm-barra span { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #F7A27C, var(--pink)); transition: width .25s ease; }
.pm-vista { position: absolute; inset: 0; display: grid; place-items: center; padding: 12px; }
.pm-vista video, .pm-vista img { max-width: 100%; max-height: 100%; width: 100%; height: 100%; object-fit: contain; border-radius: 14px; background: #F6E6DF; animation: pf-aparece .5s ease both; }
.pm-acciones { display: flex; flex-wrap: wrap; gap: 8px; }
.pm-btn {
  display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 15px; border-radius: 99px; cursor: pointer;
  background: #fff; border: 1px solid var(--linea-fuerte); font: inherit; font-size: 13px; font-weight: 800; color: var(--ink); text-decoration: none;
  transition: background .2s, color .2s, border-color .2s;
}
.pm-btn:hover { background: var(--rubor); color: var(--pink-deep); border-color: var(--pink-line); }
.pm-btn--quitar { color: var(--pink-deep); }
.pm-aviso { display: flex; align-items: center; gap: 7px; padding: 9px 14px; border-radius: 16px; font-size: 13px; font-weight: 700; line-height: 1.45; background: #FFF4E8; color: var(--melocoton-deep); }
.pm-aviso--error { background: var(--rubor); color: var(--pink-deep); }
.pm-aviso svg { flex-shrink: 0; }
.pm-enlace > summary { display: inline-flex; align-items: center; gap: 7px; cursor: pointer; list-style: none; font-size: 13px; font-weight: 800; color: var(--pink-deep); padding: 4px 2px; border-radius: 10px; }
.pm-enlace > summary::-webkit-details-marker { display: none; }
.pm-enlace > summary:hover { text-decoration: underline; text-underline-offset: 3px; }
.pm-enlace[open] > summary { margin-bottom: 8px; }
.pm-input { width: 100%; height: 44px; border-radius: 14px; border: 1.5px solid var(--linea-fuerte); padding: 0 14px; font: inherit; font-size: 13.5px; background: #fff; color: var(--ink); outline: none; transition: border-color .2s, box-shadow .2s; }
.pm-input:focus { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.1); }

/* ── certificados: chips ── */
.pt-cert { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 18px; align-items: start; }
.pt-cert-editor { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.pt-cert-entrada { display: flex; gap: 8px; }
.pt-cert-campo { flex: 1; min-width: 0; height: 46px; border-radius: 16px; border: 1.5px solid var(--linea-fuerte); padding: 0 14px; font: inherit; font-size: 14px; background: #fff; color: var(--ink); outline: none; transition: border-color .2s, box-shadow .2s; }
.pt-cert-campo:focus { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.1); }
.pt-cert-campo:disabled { background: var(--crema); }
.pt-cert-agregar { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; height: 46px; padding: 0 18px; border-radius: 99px; border: 0; cursor: pointer; background: var(--pink); color: #fff; font: inherit; font-size: 13.5px; font-weight: 800; box-shadow: 0 12px 22px -14px rgba(230,79,85,.85); transition: background .2s, opacity .2s; }
.pt-cert-agregar:hover:not(:disabled) { background: var(--pink-mid); }
.pt-cert-agregar:disabled { opacity: .45; cursor: default; box-shadow: none; }
.pt-cert-meta { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 12.5px; color: var(--muted); }
.pt-cert-meta span:first-child { font-weight: 800; color: var(--pink-deep); }
.pt-cert-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.pt-cert-item {
  display: inline-flex; align-items: center; gap: 2px; max-width: 100%; padding: 4px 4px 4px 6px; border-radius: 99px;
  background: var(--rubor); border: 1.5px solid var(--pink-line); color: var(--pink-deep); cursor: grab;
  transition: transform .25s var(--curva), box-shadow .25s, opacity .2s, border-color .2s; animation: ad-entra .35s ease both;
}
.pt-cert-item:hover { box-shadow: var(--sombra); }
.pt-cert-item.es-arrastrado { opacity: .45; }
.pt-cert-item.es-destino { border-color: var(--pink); transform: translateY(-2px); }
.pt-cert-asa { display: grid; place-items: center; color: #E7A3A5; }
.pt-cert-texto { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border: 0; background: none; padding: 4px 6px; font: inherit; font-size: 13.5px; font-weight: 800; color: var(--pink-deep); cursor: text; border-radius: 10px; }
.pt-cert-texto:hover { text-decoration: underline dotted; text-underline-offset: 3px; }
.pt-cert-edita { width: 160px; height: 30px; border-radius: 99px; border: 1.5px solid var(--pink); padding: 0 10px; font: inherit; font-size: 13.5px; font-weight: 800; color: var(--ink); background: #fff; outline: none; }
.pt-cert-botones { display: inline-flex; gap: 2px; }
.pt-cert-mini { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; border: 0; background: #fff; color: var(--pink-deep); cursor: pointer; transition: background .2s, color .2s, opacity .2s; }
.pt-cert-mini:hover:not(:disabled) { background: var(--pink-soft); }
.pt-cert-mini:disabled { opacity: .3; cursor: default; }
.pt-cert-mini--x:hover:not(:disabled) { background: var(--pink); color: #fff; }
.pt-cert-vacio { font-size: 13.5px; line-height: 1.55; color: var(--muted); }
.pt-cert-editor > .pt-cert-vacio { padding: 14px 16px; border-radius: 18px; border: 1.5px dashed var(--linea-fuerte); background: var(--crema); }
.pt-cert-vista { display: flex; flex-direction: column; gap: 10px; padding: 16px; border-radius: 22px; background: linear-gradient(150deg, #FFEEDB, #FFFAF4 70%); border: 1px solid #F6D9C6; }
.pt-cert-rotulo { font-size: 13px; font-weight: 800; color: var(--melocoton-deep); }
.pt-cert-maqueta { display: flex; flex-direction: column; gap: 10px; padding: 18px; border-radius: 18px; background: linear-gradient(160deg, #FFF6F1, #FDEBE6); border: 1px solid rgba(217,52,56,.1); }
.pt-cert-maq-linea { height: 8px; width: 82%; border-radius: 99px; background: rgba(176,58,62,.12); }
.pt-cert-maq-linea--corta { width: 54%; }
.pt-cert-maq-linea--media { width: 66%; margin-top: 4px; }
/* Réplica de .about-tags span de la portada (globals.css). */
.pt-cert-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.pt-cert-tags span {
  border: 1px solid rgba(217, 52, 56, 0.18); border-radius: 999px; background: rgba(255, 255, 255, 0.72); color: #D93438;
  font-size: 10.5px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; padding: 5px 9px; animation: ad-entra .35s ease both;
}

/* ── FAQ ── */
.pa-leyenda { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: -4px 0 16px; font-size: 12.5px; font-weight: 700; color: var(--muted); }
.pa-leyenda span { display: inline-flex; align-items: center; gap: 6px; }
.pa-vacio { display: flex; align-items: center; gap: 14px; padding: 18px; border-radius: 20px; background: var(--crema); border: 1.5px dashed var(--linea-fuerte); font-size: 14px; line-height: 1.55; color: var(--muted); }
.pa-faq { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.pa-faq-item {
  position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 14px; align-items: start;
  padding: 18px; border-radius: 24px; border: 1.5px dashed var(--linea-fuerte); background: var(--crema);
  transition: border-color .2s, box-shadow .35s var(--curva), transform .35s var(--curva);
}
.pa-faq-item.es-pub { border-style: solid; border-color: var(--linea); background: #fff; box-shadow: var(--sombra); }
.pa-faq-item:hover { border-color: var(--pink-line); box-shadow: var(--sombra-alta); }
.pa-faq-num { width: 38px; height: 38px; border-radius: 13px; display: grid; place-items: center; background: #fff; border: 1px solid var(--linea); font-weight: 900; font-size: 14px; color: var(--muted); }
.pa-faq-item.es-pub .pa-faq-num { background: var(--rubor); border-color: transparent; color: var(--pink-deep); }
.pa-faq-form { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.pa-pregunta { width: 100%; height: 46px; border-radius: 16px; border: 1.5px solid var(--linea-fuerte); padding: 0 14px; font: inherit; font-size: 15px; font-weight: 800; background: #fff; color: var(--ink); outline: none; transition: border-color .2s, box-shadow .2s; }
.pa-respuesta { width: 100%; border-radius: 16px; border: 1.5px solid var(--linea-fuerte); padding: 12px 14px; font: inherit; font-size: 14px; line-height: 1.6; background: #fff; color: var(--ink); resize: vertical; outline: none; transition: border-color .2s, box-shadow .2s; }
.pa-pregunta::placeholder, .pa-respuesta::placeholder { color: #BFA49C; font-weight: 600; }
.pa-pregunta:focus, .pa-respuesta:focus { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.1); }
.pa-faq-pie { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.pa-estado { display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px; border-radius: 99px; font-size: 12.5px; font-weight: 800; color: var(--melocoton-deep); background: #FFEEDB; }
.pa-estado.es-pub { color: #fff; background: var(--pink); }
.pa-punto { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.pa-guardar {
  height: 38px; padding: 0 18px; border-radius: 99px; cursor: pointer; border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink);
  font: inherit; font-size: 13px; font-weight: 800; transition: background .2s, color .2s, border-color .2s;
}
.pa-guardar:hover { background: var(--pink); border-color: var(--pink); color: #fff; }
.pa-faq-botones { display: flex; flex-direction: column; gap: 6px; }
.pa-faq-botones form { display: contents; }
.pa-icono {
  width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center; border-radius: 13px; cursor: pointer;
  border: 1px solid var(--linea); background: #fff; color: var(--muted); transition: background .2s, color .2s, border-color .2s, transform .25s var(--curva);
}
.pa-icono:hover:not(:disabled) { background: var(--rubor); color: var(--pink-deep); border-color: var(--pink-line); transform: translateY(-1px); }
.pa-icono:disabled { opacity: 0.3; cursor: default; }
.pa-icono--publicar { background: var(--pink); border-color: var(--pink); color: #fff; box-shadow: 0 10px 18px -10px rgba(230,79,85,.85); }
.pa-icono--publicar:hover:not(:disabled) { background: var(--pink-mid); color: #fff; }
.pa-borrar:hover:not(:disabled) { background: var(--rubor); color: var(--pink-deep); border-color: var(--pink-line); }
.pa-nueva { display: flex; flex-direction: column; gap: 12px; margin-top: 18px; padding: 20px; border-radius: 24px; border: 1.5px dashed var(--pink-line); background: linear-gradient(150deg, #FFF6F2, #fff 65%); }
.pa-nueva-titulo { display: flex; align-items: center; gap: 8px; font-family: var(--font-display), sans-serif; font-weight: 900; font-size: 16px; letter-spacing: -0.01em; color: var(--ink); }
.pa-nueva-titulo svg { box-sizing: content-box; padding: 6px; border-radius: 10px; background: var(--pink); color: #fff; }

/* pestañas de idioma (components/admin-portada-faq.tsx) */
.pq { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.pq-tabs { display: inline-flex; align-self: flex-start; gap: 3px; padding: 4px; border-radius: 99px; background: var(--rubor); border: 1px solid var(--linea); }
.pq-tab {
  position: relative; display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 14px; border-radius: 99px; border: 0; cursor: pointer;
  background: transparent; font: inherit; font-size: 13px; font-weight: 900; letter-spacing: .02em; color: var(--muted); transition: background .25s var(--curva), color .2s, box-shadow .25s;
}
.pq-tab:hover { color: var(--pink-deep); }
.pq-tab.es-activa { background: #fff; color: var(--pink-deep); box-shadow: 0 6px 14px -8px rgba(176,58,62,.45); }
.pq-tab:focus-visible { outline: 3px solid var(--pink-soft); outline-offset: 1px; }
.pq-tab-punto { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.pq-tab-punto--tuya { background: var(--pink); }
.pq-tab-punto--automatica { background: #F2A06F; }
.pq-tab-punto--espanol { background: #fff; border: 1.5px solid var(--linea-fuerte); }
.pq-panel { display: flex; flex-direction: column; gap: 8px; animation: pf-aparece .3s ease both; }
.pq-panel[hidden] { display: none; }
.pq-panel-cab { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pq-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 99px; font-size: 12.5px; font-weight: 800; white-space: nowrap; }
.pq-chip--base { background: var(--rubor); color: var(--pink-deep); }
.pq-chip--tuya { background: var(--pink); color: #fff; }
.pq-chip--automatica { background: #FFEEDB; color: var(--melocoton-deep); }
.pq-chip--espanol { background: #fff; border: 1px solid var(--linea-fuerte); color: var(--muted); }
.pq-nota { font-size: 12.5px; line-height: 1.45; color: var(--muted); }
.pq-auto { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border-radius: 16px; background: #FFF4E8; border: 1px solid #F6D9C6; }
.pq-auto-p { font-weight: 800; font-size: 14px; color: var(--ink); }
.pq-auto-r { font-size: 13.5px; line-height: 1.55; color: var(--muted); white-space: pre-line; }
.pq-auto-btn { align-self: flex-start; margin-top: 4px; display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 99px; border: 1px solid #F0C9AE; background: #fff; font: inherit; font-size: 12.5px; font-weight: 800; color: var(--melocoton-deep); cursor: pointer; }
.pq-auto-btn:hover { background: #FFEEDB; }
.pq-falta { font-size: 12.5px; font-weight: 700; color: var(--pink-deep); padding: 6px 12px; border-radius: 12px; background: var(--rubor); width: fit-content; }

@media (max-width: 1100px) {
  .pa-pasos, .pt-cert { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 760px) {
  .pa-faq-item { grid-template-columns: minmax(0, 1fr); padding: 14px; }
  .pa-faq-num { display: none; }
  .pa-faq-botones { flex-direction: row; }
  .pa-bloque-cab { flex-wrap: wrap; }
  .pa-conteo, .pa-ver { margin-left: 0; }
  .pm { padding: 14px; }
  .pm-cab { flex-wrap: wrap; }
  .pm-cab-texto { flex-basis: calc(100% - 50px); }
  .pm-estado { order: 3; margin-left: 50px; }
  .pm-zona { min-height: 200px; }
  .pq-tabs { align-self: stretch; }
  .pq-tab { flex: 1; justify-content: center; padding: 0 8px; }
  .pt-cert-entrada { flex-wrap: wrap; }
  .pt-cert-agregar { width: 100%; justify-content: center; }
  .pa-pie .pf-guardar, .pa-nueva .pf-guardar { width: 100%; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) {
  .pq-panel, .pt-cert-item, .pt-cert-tags span, .pm-vista video, .pm-vista img { animation: none; }
  .pm-zona, .pt-cert-item { transition: none; }
}
`;
