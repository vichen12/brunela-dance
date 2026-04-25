"use client";

import { Lock, PlayCircle } from "lucide-react";

const previews = [
  {
    title: "Clase de ballet",
    detail: "Nivel inicial/intermedio",
    img: "/fotos-landing/Ballet.jpg",
    pos: "center top",
  },
  {
    title: "Rotacion externa",
    detail: "Control y activacion",
    img: "/fotos-landing/Progressing Ballet Technique.jpg",
    pos: "center",
  },
  {
    title: "Conseguir el split",
    detail: "Flexibilidad progresiva",
    img: "/fotos-landing/Stretching.jpg",
    pos: "center top",
  },
];

export function InteractiveSelector() {
  return (
    <div className="preview-grid-root">
      {previews.map((item) => (
        <a key={item.title} href="/#planes" className="preview-card" aria-label={`${item.title}. Acceso restringido`}>
          <div className="preview-image-wrap">
            <img src={item.img} alt="" className="preview-card-img" style={{ objectPosition: item.pos }} draggable={false} />
            <span className="preview-play">
              <PlayCircle size={30} strokeWidth={1.7} />
            </span>
          </div>

          <div className="preview-copy">
            <span className="preview-lock">
              <Lock size={13} />
              Acceso con suscripcion
            </span>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
          </div>
        </a>
      ))}
    </div>
  );
}
