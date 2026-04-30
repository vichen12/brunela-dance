"use client";

import { useState } from "react";
import { ArrowRight, Clock, Layers, Target, X } from "lucide-react";

type StudioTab = "classes" | "courses" | "focus";

type StudioItem = {
  id: string;
  type: StudioTab;
  eyebrow: string;
  title: string;
  meta: string;
  image: string;
  imagePosition?: string;
  description: string;
  details: string[];
};

const tabs: Array<{ id: StudioTab; label: string }> = [
  { id: "classes", label: "Clases" },
  { id: "courses", label: "Cursos" },
  { id: "focus", label: "Objetivos" },
];

const studioItems: StudioItem[] = [
  {
    id: "ballet",
    type: "classes",
    eyebrow: "Clase",
    title: "Ballet técnico",
    meta: "32 min · Técnica",
    image: "/fotos-landing/Ballet.jpg",
    imagePosition: "center top",
    description:
      "Una clase para trabajar postura, control, coordinación y calidad de movimiento desde la base del ballet.",
    details: [
      "Barra, centro y trabajo técnico progresivo.",
      "Enfoque en alineación, musicalidad y presencia.",
      "Ideal para sostener una práctica constante desde casa.",
    ],
  },
  {
    id: "pbt",
    type: "classes",
    eyebrow: "Clase",
    title: "Progressing Ballet Technique",
    meta: "28 min · PBT",
    image: "/fotos-landing/Progressing Ballet Technique.jpg",
    imagePosition: "center",
    description:
      "Entrenamiento de memoria muscular para mejorar la técnica, activar correctamente el cuerpo y bailar con más seguridad.",
    details: [
      "Trabajo de fuerza profunda y control postural.",
      "Ejercicios específicos para transferencia técnica al ballet.",
      "Acompaña el progreso sin sobrecargar articulaciones.",
    ],
  },
  {
    id: "stretching",
    type: "classes",
    eyebrow: "Clase",
    title: "Flexibilidad consciente",
    meta: "24 min · Stretching",
    image: "/fotos-landing/Stretching.jpg",
    imagePosition: "center top",
    description:
      "Una práctica de movilidad y elongación para ganar rango sin forzar, cuidando la activación y la respiración.",
    details: [
      "Rutinas para piernas, espalda y apertura de cadera.",
      "Progresión clara para mejorar sin apurar el cuerpo.",
      "Complemento ideal para ballet, PBT y entrenamiento diario.",
    ],
  },
  {
    id: "feet-rotation",
    type: "courses",
    eyebrow: "Curso",
    title: "Pies, rotación y estabilidad",
    meta: "14 días · Objetivo específico",
    image: "/fotos-landing/pbt.jpg",
    imagePosition: "center",
    description:
      "Un recorrido guiado para trabajar bases técnicas que sostienen el rendimiento del bailarín.",
    details: [
      "Secuencia organizada día por día.",
      "Foco en pies, rotación externa y control de eje.",
      "Pensado para entrenar con más claridad y continuidad.",
    ],
  },
  {
    id: "mobility",
    type: "courses",
    eyebrow: "Curso",
    title: "Movilidad para splits",
    meta: "14 días · Flexibilidad",
    image: "/fotos-landing/stretching1.jpg",
    imagePosition: "center",
    description:
      "Recorrido estructurado para avanzar en flexibilidad con técnica, fuerza activa y cuidado corporal.",
    details: [
      "Trabajo progresivo de cadera, isquios y líneas.",
      "Ejercicios de activación para no depender solo de estirar.",
      "Guía paso a paso para medir avances reales.",
    ],
  },
  {
    id: "contemporary",
    type: "courses",
    eyebrow: "Curso",
    title: "Contemporary Technique",
    meta: "Series · PCT",
    image: "/fotos-landing/Progressing Contemporary Technique.jpg",
    imagePosition: "center",
    description:
      "Un recorrido para explorar articulación, transferencia de peso, conexión con el suelo y libertad de movimiento.",
    details: [
      "Ejercicios funcionales para danza contemporánea.",
      "Mayor conciencia de columna, peso y expansión.",
      "Complementa el entrenamiento técnico del bailarín.",
    ],
  },
  {
    id: "corps",
    type: "focus",
    eyebrow: "Objetivo",
    title: "Técnica base",
    meta: "Biblioteca completa",
    image: "/fotos-landing/Pilates Mat.png",
    imagePosition: "center",
    description:
      "Un punto de partida para ordenar tu entrenamiento, sostener constancia y mejorar con una base técnica clara.",
    details: [
      "Clases disponibles para entrenar cuando quieras.",
      "Trabajo de ballet, flexibilidad y técnica aplicada.",
      "Contenido pensado para progresar sin perder calidad.",
    ],
  },
  {
    id: "solista",
    type: "focus",
    eyebrow: "Objetivo",
    title: "Progreso guiado",
    meta: "Recorridos estructurados",
    image: "/fotos-landing/pilates.jpg",
    imagePosition: "center",
    description:
      "Recorridos de trabajo con objetivos específicos para entrenar con más profundidad, orden y precisión.",
    details: [
      "Foco en pies, rotación, flexibilidad y control.",
      "Secuencias paso a paso para mantener continuidad.",
      "Mayor claridad sobre qué trabajar y cómo avanzar.",
    ],
  },
  {
    id: "principal",
    type: "focus",
    eyebrow: "Objetivo",
    title: "Acompañamiento",
    meta: "Clases en vivo y seguimiento",
    image: "/fotos-landing/about-2.jpg",
    imagePosition: "center top",
    description:
      "Una experiencia más cercana para revisar tu proceso, resolver dudas y ajustar el entrenamiento a tus necesidades.",
    details: [
      "Espacio para seguimiento y correcciones más concretas.",
      "Clases en vivo con reserva previa.",
      "Acompañamiento para sostener tu progreso con dirección.",
    ],
  },
];

export function InteractiveSelector() {
  const [activeTab, setActiveTab] = useState<StudioTab>("classes");
  const [selectedItem, setSelectedItem] = useState<StudioItem | null>(null);
  const visibleItems = studioItems.filter((item) => item.type === activeTab);

  return (
    <>
      <div className="studio-browser">
        <div className="studio-browser-top">
          <h3>
            Último del <span>estudio online.</span>
          </h3>

          <div className="studio-tabs" role="tablist" aria-label="Contenido del estudio">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={activeTab === tab.id ? "is-active" : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="studio-card-grid">
          {visibleItems.map((item) => (
            <button className="studio-card" key={item.id} type="button" onClick={() => setSelectedItem(item)}>
              <img src={item.image} alt="" style={{ objectPosition: item.imagePosition ?? "center" }} draggable={false} />
              <span className="studio-card-shade" />
              <span className="studio-card-level">{item.eyebrow}</span>
              <span className="studio-card-type">{item.type === "classes" ? "Clase" : item.type === "courses" ? "Curso" : "Objetivo"}</span>
              <strong>{item.title}</strong>
              <small>{item.meta}</small>
              <span className="studio-card-action">
                Ver detalle <ArrowRight size={17} />
              </span>
            </button>
          ))}
        </div>
      </div>

      {selectedItem ? (
        <div className="studio-modal-backdrop" role="presentation" onClick={() => setSelectedItem(null)}>
          <article
            className="studio-modal"
            role="dialog"
            aria-modal="true"
            aria-label={selectedItem.title}
            onClick={(event) => event.stopPropagation()}
          >
            <button className="studio-modal-close" type="button" aria-label="Cerrar" onClick={() => setSelectedItem(null)}>
              <X size={19} />
            </button>

            <div className="studio-modal-image">
              <img src={selectedItem.image} alt="" style={{ objectPosition: selectedItem.imagePosition ?? "center" }} />
            </div>

            <div className="studio-modal-copy">
              <span>{selectedItem.eyebrow}</span>
              <h3>{selectedItem.title}</h3>
              <p>{selectedItem.description}</p>

              <div className="studio-modal-meta">
                <div>
                  <Clock size={17} />
                  {selectedItem.meta}
                </div>
                <div>
                  <Target size={17} />
                  Técnica consciente
                </div>
                <div>
                  <Layers size={17} />
                  Progresivo
                </div>
              </div>

              <ul>
                {selectedItem.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>

              <a className="studio-modal-cta" href="/#clases" onClick={() => setSelectedItem(null)}>
                Ver contenido del estudio <ArrowRight size={17} />
              </a>
            </div>
          </article>
        </div>
      ) : null}

      <style>{`
        .studio-browser {
          width: min(1160px, calc(100vw - 2rem));
          margin: 0 auto;
          border: 1px solid rgba(230, 79, 85, 0.16);
          border-radius: 30px;
          background:
            radial-gradient(circle at 88% 18%, rgba(230, 79, 85, 0.13), transparent 22%),
            radial-gradient(circle at 12% 88%, rgba(255, 218, 224, 0.58), transparent 28%),
            linear-gradient(135deg, #FFF9F9 0%, #FFECEF 58%, #F9C5D0 100%);
          padding: clamp(1.25rem, 2.2vw, 1.75rem);
          box-shadow: 0 34px 100px rgba(166, 49, 75, 0.18);
        }

        .studio-browser-top {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: clamp(1rem, 2.2vw, 1.8rem);
          margin-bottom: clamp(1rem, 2.2vw, 1.45rem);
        }

        .studio-browser h3 {
          max-width: 16ch;
          margin: 0;
          color: #2A171B;
          font-family: var(--font-display), sans-serif;
          font-size: clamp(2.1rem, 3.7vw, 3.35rem);
          font-style: italic;
          font-weight: 700;
          letter-spacing: -0.045em;
          line-height: 0.98;
        }

        .studio-browser h3 span {
          color: #D93455;
        }

        .studio-tabs {
          display: inline-flex;
          gap: 0.24rem;
          justify-self: end;
          margin-top: 0;
          border: 1px solid rgba(230, 79, 85, 0.18);
          border-radius: 999px;
          background: rgba(255,255,255,0.56);
          padding: 0.28rem;
          box-shadow: 0 18px 45px rgba(166, 49, 75, 0.12);
        }

        .studio-tabs button {
          min-height: 42px;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: #7D5562;
          padding: 0.55rem 1rem;
          font-weight: 900;
          transition: background 180ms ease, color 180ms ease, transform 180ms ease;
        }

        .studio-tabs button.is-active {
          background: #E64F55;
          color: #fff;
          box-shadow: 0 14px 32px rgba(230, 79, 85, 0.25);
        }

        .studio-card-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: clamp(0.8rem, 1.45vw, 1.05rem);
        }

        .studio-card {
          position: relative;
          display: grid;
          align-content: end;
          min-height: clamp(235px, 18vw, 260px);
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.24);
          border-radius: 22px;
          background: #1A1018;
          padding: clamp(0.95rem, 1.45vw, 1.18rem);
          color: #fff;
          text-align: left;
          box-shadow: 0 24px 70px rgba(134, 37, 61, 0.2);
          transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .studio-card:hover {
          transform: translateY(-5px);
          border-color: rgba(230, 79, 85, 0.5);
          box-shadow: 0 32px 90px rgba(134, 37, 61, 0.28);
        }

        .studio-card img,
        .studio-card-shade {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }

        .studio-card img {
          object-fit: cover;
          filter: saturate(0.9) contrast(1.02);
          transform: scale(1.02);
        }

        .studio-card-shade {
          background:
            linear-gradient(180deg, rgba(42,23,27,0.08) 0%, rgba(42,23,27,0.22) 42%, rgba(42,23,27,0.78) 100%),
            linear-gradient(90deg, rgba(42,23,27,0.3), transparent);
          z-index: 1;
        }

        .studio-card-level,
        .studio-card-type,
        .studio-card strong,
        .studio-card small,
        .studio-card-action {
          position: relative;
          z-index: 2;
        }

        .studio-card-level {
          position: absolute;
          top: 1.2rem;
          left: 1.2rem;
          border-radius: 999px;
          background: #E64F55;
          color: #fff;
          padding: 0.42rem 0.75rem;
          font-size: 0.72rem;
          font-weight: 900;
        }

        .studio-card-type {
          width: fit-content;
          border: 1px solid rgba(255,255,255,0.72);
          border-radius: 999px;
          padding: 0.3rem 0.68rem;
          font-size: 0.72rem;
          font-weight: 800;
        }

        .studio-card strong {
          display: block;
          max-width: 16ch;
          margin-top: 0.72rem;
          font-size: clamp(1.25rem, 1.75vw, 1.62rem);
          line-height: 1.02;
          letter-spacing: -0.04em;
        }

        .studio-card small {
          margin-top: 0.45rem;
          color: rgba(255, 248, 248, 0.74);
          font-size: 0.9rem;
        }

        .studio-card-action {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          margin-top: 1.1rem;
          color: #fff;
          font-weight: 800;
        }

        .studio-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: grid;
          place-items: center;
          background: rgba(8, 10, 18, 0.72);
          padding: 1rem;
          backdrop-filter: blur(12px);
        }

        .studio-modal {
          position: relative;
          display: grid;
          grid-template-columns: minmax(260px, 0.86fr) minmax(0, 1fr);
          width: min(980px, 100%);
          max-height: min(720px, 92vh);
          overflow: hidden;
          border: 1px solid rgba(255, 218, 224, 0.42);
          border-radius: 30px;
          background: linear-gradient(135deg, #FFF8F8 0%, #FFF0F2 100%);
          box-shadow: 0 36px 120px rgba(0,0,0,0.42);
        }

        .studio-modal-close {
          position: absolute;
          top: 0.9rem;
          right: 0.9rem;
          z-index: 4;
          display: inline-grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border: 0;
          border-radius: 999px;
          background: #E64F55;
          color: #fff;
        }

        .studio-modal-image {
          position: relative;
          min-height: 100%;
          background: #1A1018;
        }

        .studio-modal-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: saturate(0.95);
        }

        .studio-modal-copy {
          overflow: auto;
          padding: clamp(1.4rem, 4vw, 3rem);
        }

        .studio-modal-copy > span {
          color: #E64F55;
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .studio-modal-copy h3 {
          max-width: 13ch;
          margin: 0.55rem 0 0;
          color: #2A171B;
          font-family: var(--font-display), sans-serif;
          font-size: clamp(2.2rem, 5vw, 4rem);
          font-style: italic;
          letter-spacing: -0.06em;
          line-height: 0.95;
        }

        .studio-modal-copy p {
          margin: 1rem 0 0;
          color: #8E4A56;
          font-size: 1rem;
          line-height: 1.7;
        }

        .studio-modal-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
          margin: 1.3rem 0;
        }

        .studio-modal-meta div {
          display: inline-flex;
          align-items: center;
          gap: 0.38rem;
          border: 1px solid rgba(230, 79, 85, 0.2);
          border-radius: 999px;
          color: #D93438;
          padding: 0.46rem 0.7rem;
          font-size: 0.76rem;
          font-weight: 900;
        }

        .studio-modal-copy ul {
          display: grid;
          gap: 0.72rem;
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .studio-modal-copy li {
          position: relative;
          color: #7D5562;
          line-height: 1.5;
          padding-left: 1.15rem;
        }

        .studio-modal-copy li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0.62em;
          width: 0.42rem;
          height: 0.42rem;
          border-radius: 999px;
          background: #E64F55;
        }

        .studio-modal-cta {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          margin-top: 1.6rem;
          border-radius: 999px;
          background: #E64F55;
          color: #fff;
          padding: 0.86rem 1.1rem;
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-decoration: none;
          text-transform: uppercase;
        }

        @media (max-width: 900px) {
          .studio-browser-top {
            grid-template-columns: 1fr;
          }

          .studio-tabs {
            justify-self: start;
          }

          .studio-card-grid {
            grid-template-columns: 1fr;
          }

          .studio-modal {
            grid-template-columns: 1fr;
            overflow: auto;
          }

          .studio-modal-image {
            min-height: 260px;
          }
        }

        @media (max-width: 560px) {
          .studio-browser {
            border-radius: 24px;
            padding: 0.75rem;
          }

          .studio-tabs {
            width: 100%;
            justify-content: space-between;
          }

          .studio-tabs button {
            padding: 0.48rem 0.72rem;
          }

          .studio-card {
            min-height: 310px;
            border-radius: 22px;
            padding: 1rem;
          }

          .studio-modal-copy {
            padding: 1.2rem;
          }
        }
      `}</style>
    </>
  );
}
