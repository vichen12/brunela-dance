"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, GripVertical, Plus, X } from "lucide-react";

/**
 * Los certificados de «Sobre mí», como chips editables, con la vista previa de
 * cómo salen en la portada.
 *
 * ⚠️ VIAJA IGUAL QUE ANTES: UNA CADENA CON UN CERTIFICADO POR LÍNEA, con el
 *    mismo `name`, en un input oculto. La acción (campos.ts → validar, tipo
 *    "lista") parte por "\n", recorta y descarta vacíos, así que no cambia nada
 *    del lado del servidor. El tope de 12 también lo impone la acción; acá sólo
 *    se avisa antes.
 *
 * ⚠️ Lo que quedó escrito sin apretar Enter TAMBIÉN viaja. Si no, alguien
 *    escribe «Barre à terre», toca Guardar, y el certificado desaparece sin
 *    aviso.
 *
 * ⚠️ Enter en el campo NO envía el formulario de la portada: lo frena
 *    `preventDefault`. Sin eso, agregar un chip guardaría todo a medias.
 */
const MAXIMO = 12;

export function CertificadosDePortada({ name, valorActual }: { name: string; valorActual: string }) {
  const [items, setItems] = useState<string[]>(() =>
    valorActual.split("\n").map((t) => t.trim()).filter(Boolean)
  );
  const [borrador, setBorrador] = useState("");
  const [editando, setEditando] = useState<number | null>(null);
  const [textoEdicion, setTextoEdicion] = useState("");
  const [arrastrado, setArrastrado] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  const pendiente = borrador.trim();
  const todos = pendiente !== "" ? [...items, pendiente] : items;
  const lleno = items.length >= MAXIMO;

  function agregar(texto: string = borrador) {
    // Pegar varias líneas de una vez agrega varios.
    const nuevos = texto.split("\n").map((t) => t.trim()).filter(Boolean);
    if (nuevos.length === 0) return;
    setItems((prev) => [...prev, ...nuevos.filter((n) => !prev.includes(n))].slice(0, MAXIMO));
    setBorrador("");
  }

  function mover(desde: number, hasta: number) {
    if (hasta < 0 || hasta >= items.length || desde === hasta) return;
    setItems((prev) => {
      const copia = [...prev];
      const [x] = copia.splice(desde, 1);
      copia.splice(hasta, 0, x);
      return copia;
    });
  }

  function confirmarEdicion() {
    if (editando === null) return;
    const t = textoEdicion.trim();
    setItems((prev) => (t === "" ? prev.filter((_, i) => i !== editando) : prev.map((x, i) => (i === editando ? t : x))));
    setEditando(null);
  }

  return (
    <div className="pt-cert">
      <input type="hidden" name={name} value={todos.join("\n")} />

      <div className="pt-cert-editor">
        <div className="pt-cert-entrada">
          <input
            ref={campo}
            className="pt-cert-campo"
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregar();
              }
            }}
            onPaste={(e) => {
              const pegado = e.clipboardData.getData("text");
              if (pegado.includes("\n")) {
                e.preventDefault();
                agregar(borrador + pegado);
              }
            }}
            placeholder={lleno ? "Llegaste al máximo de 12" : "Escribí uno y apretá Enter"}
            disabled={lleno}
            aria-label="Agregar un certificado"
          />
          <button type="button" className="pt-cert-agregar" onClick={() => agregar()} disabled={pendiente === "" || lleno}>
            <Plus size={15} strokeWidth={2.4} aria-hidden="true" /> Agregar
          </button>
        </div>

        <div className="pt-cert-meta">
          <span>{items.length} de {MAXIMO}</span>
          <span>Tocá uno para corregirlo · arrastralo o usá las flechas para ordenar</span>
        </div>

        {items.length === 0 ? (
          <p className="pt-cert-vacio">
            Todavía no cargaste ninguno. Mientras la lista esté vacía, la portada muestra los certificados de siempre.
          </p>
        ) : (
          <ul className="pt-cert-lista">
            {items.map((t, i) => (
              <li
                key={t + i}
                className={"pt-cert-item" + (arrastrado === i ? " es-arrastrado" : "") + (sobre === i && arrastrado !== i ? " es-destino" : "")}
                draggable={editando === null}
                onDragStart={(e) => { setArrastrado(i); e.dataTransfer.effectAllowed = "move"; }}
                onDragOver={(e) => { e.preventDefault(); setSobre(i); }}
                onDragLeave={() => setSobre((s) => (s === i ? null : s))}
                onDrop={(e) => { e.preventDefault(); if (arrastrado !== null) mover(arrastrado, i); setArrastrado(null); setSobre(null); }}
                onDragEnd={() => { setArrastrado(null); setSobre(null); }}
              >
                <span className="pt-cert-asa" aria-hidden="true"><GripVertical size={14} /></span>
                {editando === i ? (
                  <input
                    className="pt-cert-edita"
                    value={textoEdicion}
                    autoFocus
                    onChange={(e) => setTextoEdicion(e.target.value)}
                    onBlur={confirmarEdicion}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); confirmarEdicion(); }
                      if (e.key === "Escape") { e.preventDefault(); setEditando(null); }
                    }}
                    aria-label={`Corregir «${t}»`}
                  />
                ) : (
                  <button type="button" className="pt-cert-texto" onClick={() => { setEditando(i); setTextoEdicion(t); }} title="Corregir">
                    {t}
                  </button>
                )}
                <span className="pt-cert-botones">
                  <button type="button" className="pt-cert-mini" onClick={() => mover(i, i - 1)} disabled={i === 0} aria-label={`Mover «${t}» antes`}>
                    <ArrowLeft size={13} strokeWidth={2.4} />
                  </button>
                  <button type="button" className="pt-cert-mini" onClick={() => mover(i, i + 1)} disabled={i === items.length - 1} aria-label={`Mover «${t}» después`}>
                    <ArrowRight size={13} strokeWidth={2.4} />
                  </button>
                  <button type="button" className="pt-cert-mini pt-cert-mini--x" onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))} aria-label={`Quitar «${t}»`}>
                    <X size={13} strokeWidth={2.6} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Réplica de .about-tags de la portada: mismas proporciones y color. */}
      <div className="pt-cert-vista" aria-label="Así se ven en «Sobre mí»">
        <span className="pt-cert-rotulo">Así se ve en «Sobre mí»</span>
        <div className="pt-cert-maqueta">
          <span className="pt-cert-maq-linea" aria-hidden="true" />
          <span className="pt-cert-maq-linea pt-cert-maq-linea--corta" aria-hidden="true" />
          {todos.length === 0 ? (
            <span className="pt-cert-vacio">Sin certificados propios: se ven los de siempre.</span>
          ) : (
            <div className="pt-cert-tags">
              {todos.map((t, i) => (
                <span key={t + i} style={{ animationDelay: `${i * 0.04}s` }}>{t}</span>
              ))}
            </div>
          )}
          <span className="pt-cert-maq-linea pt-cert-maq-linea--media" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
