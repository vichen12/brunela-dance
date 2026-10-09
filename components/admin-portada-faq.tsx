"use client";

import { useId, useState } from "react";
import { flushSync } from "react-dom";
import { Languages, PenLine, Sparkles, Wand2 } from "lucide-react";

/**
 * Los campos de UNA pregunta del FAQ, en pestañas de idioma.
 *
 * Va DENTRO del <form> de servidor (crear o editar): esto sólo dibuja los
 * campos, el envío sigue siendo la server action. Por eso recibe datos planos
 * y ningún componente por props (trampa 6).
 *
 * ⚠️ LAS CUATRO PESTAÑAS ESTÁN SIEMPRE EN EL DOM.
 *    Las inactivas van con `hidden`, no se desmontan. Un campo desmontado no
 *    viaja en el formulario, y entonces guardar desde la pestaña ES borraría
 *    la traducción al inglés que se escribió hace un minuto.
 *
 * QUÉ SIGNIFICA DEJAR UNA PESTAÑA VACÍA (la regla vive en faq-idiomas.ts)
 *    - había una automática → sigue la automática
 *    - no había → se ve el español
 *    Por eso el campo NO se precompleta con la automática: si se precompletara,
 *    guardar sin tocar nada la convertiría en «tuya» y dejaría de avisar cuando
 *    el español cambie.
 */

export type IdiomaPestana = "en" | "fr" | "it";

export type DatosDeIdioma = {
  /** Lo que escribió Brunela. Vacío si no hay traducción suya. */
  pregunta: string;
  respuesta: string;
  /** La automática vigente, si la hay. */
  autoPregunta: string;
  autoRespuesta: string;
  /** La automática se hizo con un español que ya cambió. */
  desactualizada: boolean;
};

const PESTANAS: { id: "es" | IdiomaPestana; corto: string; largo: string }[] = [
  { id: "es", corto: "ES", largo: "Español" },
  { id: "en", corto: "EN", largo: "Inglés" },
  { id: "fr", corto: "FR", largo: "Francés" },
  { id: "it", corto: "IT", largo: "Italiano" },
];

type Estado = "tuya" | "automatica" | "espanol";

const CHIP: Record<Estado, string> = {
  tuya: "Traducción tuya",
  automatica: "Automática",
  espanol: "Usa el español",
};

export function CamposDePreguntaFaq({
  es,
  idiomas,
  nueva = false,
}: {
  es: { pregunta: string; respuesta: string };
  idiomas: Record<IdiomaPestana, DatosDeIdioma>;
  /** En el alta, el español va con `required`. */
  nueva?: boolean;
}) {
  const base = useId();
  const [activa, setActiva] = useState<"es" | IdiomaPestana>("es");
  const [esP, setEsP] = useState(es.pregunta);
  const [esR, setEsR] = useState(es.respuesta);
  const [txt, setTxt] = useState(() => ({
    en: { p: idiomas.en.pregunta, r: idiomas.en.respuesta },
    fr: { p: idiomas.fr.pregunta, r: idiomas.fr.respuesta },
    it: { p: idiomas.it.pregunta, r: idiomas.it.respuesta },
  }));

  function estado(id: IdiomaPestana): Estado {
    const t = txt[id];
    if (t.p.trim() !== "" || t.r.trim() !== "") return "tuya";
    if (idiomas[id].autoPregunta !== "" && idiomas[id].autoRespuesta !== "") return "automatica";
    return "espanol";
  }

  function escribir(id: IdiomaPestana, campo: "p" | "r", valor: string) {
    setTxt((prev) => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }));
  }

  /**
   * Si el español falta y la pestaña ES está oculta, el navegador no puede
   * mostrar su globito de «completá este campo» y el envío se frena sin decir
   * nada. Se muestra la pestaña de forma SINCRÓNICA para que el globito salga.
   */
  const alInvalido = () => flushSync(() => setActiva("es"));

  return (
    <div className="pq">
      <div className="pq-tabs" role="tablist" aria-label="Idioma">
        {PESTANAS.map((p) => {
          const est = p.id === "es" ? null : estado(p.id);
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              id={`${base}-tab-${p.id}`}
              aria-selected={activa === p.id}
              aria-controls={`${base}-panel-${p.id}`}
              className={"pq-tab" + (activa === p.id ? " es-activa" : "")}
              onClick={() => setActiva(p.id)}
              title={p.id === "es" ? "Español (obligatorio)" : `${p.largo}: ${CHIP[est!]}`}
            >
              {p.corto}
              {est && <span className={`pq-tab-punto pq-tab-punto--${est}`} aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {/* ── Español: obligatorio ── */}
      <div
        role="tabpanel"
        id={`${base}-panel-es`}
        aria-labelledby={`${base}-tab-es`}
        hidden={activa !== "es"}
        className="pq-panel"
      >
        <div className="pq-panel-cab">
          <span className="pq-chip pq-chip--base">Español · obligatorio</span>
          <span className="pq-nota">Es la base: se ve en cualquier idioma que no tenga traducción.</span>
        </div>
        <input
          className="pa-pregunta"
          name="pregunta"
          value={esP}
          onChange={(e) => setEsP(e.target.value)}
          onInvalid={alInvalido}
          placeholder="¿Necesito experiencia previa?"
          aria-label="Pregunta en español"
          required={nueva}
        />
        <textarea
          className="pa-respuesta"
          name="respuesta"
          rows={3}
          value={esR}
          onChange={(e) => setEsR(e.target.value)}
          onInvalid={alInvalido}
          placeholder="La respuesta, en español."
          aria-label="Respuesta en español"
          required={nueva}
        />
      </div>

      {/* ── EN / FR / IT: opcionales ── */}
      {PESTANAS.filter((p) => p.id !== "es").map((p) => {
        const id = p.id as IdiomaPestana;
        const est = estado(id);
        const d = idiomas[id];
        const t = txt[id];
        const incompleta = (t.p.trim() === "") !== (t.r.trim() === "");
        const hayAuto = d.autoPregunta !== "" && d.autoRespuesta !== "";

        return (
          <div
            key={id}
            role="tabpanel"
            id={`${base}-panel-${id}`}
            aria-labelledby={`${base}-tab-${id}`}
            hidden={activa !== id}
            className="pq-panel"
          >
            <div className="pq-panel-cab">
              <span className={`pq-chip pq-chip--${est}`}>
                {est === "tuya" ? <PenLine size={13} strokeWidth={2.4} aria-hidden="true" /> : est === "automatica" ? <Sparkles size={13} strokeWidth={2.4} aria-hidden="true" /> : <Languages size={13} strokeWidth={2.4} aria-hidden="true" />}
                {CHIP[est]}
              </span>
              <span className="pq-nota">
                {est === "tuya"
                  ? `Se ve esta en ${p.largo.toLowerCase()}. Borrala para volver ${hayAuto ? "a la automática" : "al español"}.`
                  : est === "automatica"
                    ? d.desactualizada
                      ? "Ojo: se tradujo antes de tu último cambio en español."
                      : "Si escribís la tuya, reemplaza a la automática."
                    : `Si la dejás vacía, en ${p.largo.toLowerCase()} se ve en español.`}
              </span>
            </div>

            {est === "automatica" && (
              <div className="pq-auto">
                <p className="pq-auto-p">{d.autoPregunta}</p>
                <p className="pq-auto-r">{d.autoRespuesta}</p>
                <button
                  type="button"
                  className="pq-auto-btn"
                  onClick={() => setTxt((prev) => ({ ...prev, [id]: { p: d.autoPregunta, r: d.autoRespuesta } }))}
                >
                  <Wand2 size={14} strokeWidth={2.2} aria-hidden="true" /> Corregirla a mano
                </button>
              </div>
            )}

            <input
              className="pa-pregunta"
              name={`pregunta_${id}`}
              lang={id}
              value={t.p}
              onChange={(e) => escribir(id, "p", e.target.value)}
              placeholder={hayAuto ? d.autoPregunta : esP || "Tu traducción de la pregunta"}
              aria-label={`Pregunta en ${p.largo.toLowerCase()}`}
            />
            <textarea
              className="pa-respuesta"
              name={`respuesta_${id}`}
              lang={id}
              rows={3}
              value={t.r}
              onChange={(e) => escribir(id, "r", e.target.value)}
              placeholder={hayAuto ? d.autoRespuesta : esR || "Tu traducción de la respuesta"}
              aria-label={`Respuesta en ${p.largo.toLowerCase()}`}
            />
            {incompleta && (
              <p className="pq-falta" role="status">
                Falta {t.p.trim() === "" ? "la pregunta" : "la respuesta"}: se guardan las dos juntas, o ninguna.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
