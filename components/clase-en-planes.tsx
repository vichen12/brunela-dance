"use client";

import { Desplegable } from "@/components/desplegable";
import { useState } from "react";
import { BotonEnviar } from "@/components/boton-enviar";
import { campoSuave, etiquetaSuave } from "@/components/admin-drawer";
import { CalendarDays, Plus, X } from "lucide-react";
import { agregarClaseAPlanAction, quitarClaseDePlanAction } from "@/src/features/admin/actions";
import type { PlanParaElegir, UbicacionEnPlan } from "@/src/features/admin/planes-de-trabajo";

/**
 * A que planes de trabajo pertenece esta clase, y como agregarla a otro.
 *
 * POR QUE VIVE EN EL PANEL DE LA CLASE Y NO SOLO EN /admin/programs
 *   Porque la pregunta «¿esta clase va en algun plan?» se hace mirando la
 *   clase. Antes habia que salir a la otra pantalla, abrir el plan, acordarse
 *   del titulo de la clase y buscarla en un desplegable de todas.
 *
 * ⚠️ LOS FORMULARIOS VAN SUELTOS, NO ANIDADOS.
 *    Este bloque se renderiza DENTRO del <form> de la clase en el panel de
 *    edicion, asi que no puede traer sus propios <form>: los formularios
 *    anidados son HTML invalido -- el parser descarta el interno y sus botones
 *    terminan enviando el formulario de afuera. Ya paso en este proyecto: el
 *    boton ELIMINAR de una clase terminaba llamando a upsertVideoAction.
 *
 *    Por eso cada boton usa `formAction`, y sus datos viajan o en el `name` /
 *    `value` del propio boton (QUITAR, que necesita saber CUAL) o en hidden del
 *    formulario que lo contiene (AGREGAR, que es uno solo). Al SUBIR una clase
 *    el bloque no se usa: ahi la clase todavia no existe y no tiene id.
 */

const inp = campoSuave;
const lbl = etiquetaSuave;

export function ClaseEnPlanes({
  videoId,
  planes,
  ubicaciones,
}: {
  videoId: string;
  planes: PlanParaElegir[];
  ubicaciones: UbicacionEnPlan[];
}) {
  const [programId, setProgramId] = useState("");
  const [dia, setDia] = useState("");

  const elegido = planes.find((p) => p.id === programId);
  // Ya esta en ese plan y en ese dia exacto: agregar no haria nada.
  const yaEstaAhi = ubicaciones.some((u) => u.programId === programId && String(u.dia) === dia);

  return (
    <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px dashed #E9CFC5" }}>
      <span style={lbl}>Agregar a un plan de trabajo</span>

      {planes.length === 0 ? (
        <p style={{ fontSize: 13, color: "#8A6F68", lineHeight: 1.6, marginTop: 2 }}>
          Todavía no hay ningún plan de trabajo armado. Se crean en{" "}
          <a href="/admin/programs" style={{ color: "var(--pink-deep)", fontWeight: 800 }}>
            Planes de trabajo
          </a>
          .
        </p>
      ) : (
        <>
          {/* Donde ya esta puesta */}
          {ubicaciones.length === 0 ? (
            <p style={{ fontSize: 13, color: "#8A6F68", lineHeight: 1.6, margin: "2px 0 12px" }}>
              Esta clase no está en ningún plan: se ve suelta en la biblioteca.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "4px 0 14px" }}>
              {ubicaciones.map((u) => (
                <div
                  key={u.programDayId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    borderRadius: 18,
                    border: "1px solid #F3E3DC",
                    background: "#fff",
                    padding: "8px 8px 8px 10px",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, fontSize: 13.5, color: "#3B2A2C", lineHeight: 1.4 }}>
                    <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", background: "#FFF2EE", color: "#B03A3E" }}>
                      <CalendarDays size={16} strokeWidth={2} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ fontWeight: 800 }}>{u.titulo}</strong>
                      <span style={{ color: "#8A6F68" }}> · Día {u.dia}</span>
                    </span>
                  </span>
                  {/*
                    🔴 EL ID VA EN EL BOTON, NO EN UN <input type="hidden">.
                       Con un hidden por fila, las tres filas mandarian el mismo
                       `name` y `formData.get()` devolveria SIEMPRE el primero:
                       apretar QUITAR en el dia 7 borraria el dia 1. El
                       name/value del boton que envia es lo unico que viaja.
                  */}
                  <BotonEnviar
                    pendingLabel="Quitando…"
                    formAction={quitarClaseDePlanAction}
                    name="programDayId"
                    value={u.programDayId}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      background: "#fff",
                      color: "var(--pink-deep)",
                      border: "1.5px solid var(--pink-line)",
                      borderRadius: 99,
                      padding: "6px 12px",
                      fontSize: 12.5,
                      fontWeight: 800,
                      fontFamily: "inherit",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <X size={13} strokeWidth={2.4} aria-hidden="true" /> Quitar
                  </BotonEnviar>
                </div>
              ))}
            </div>
          )}

          {/* Agregarla a uno mas */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
            <label style={{ display: "flex", flexDirection: "column", flex: "1 1 220px", minWidth: 0 }}>
              <span style={lbl}>Plan</span>
              <Desplegable
                style={inp}
                value={programId}
                placeholder="Elegí un plan…"
                onChange={(id) => {
                  setProgramId(id);
                  const plan = planes.find((p) => p.id === id);
                  setDia(plan ? String(plan.proximoDia) : "");
                }}
                opciones={planes.map((p) => ({ value: p.id, label: p.titulo }))}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", flex: "0 0 96px" }}>
              <span style={lbl}>Día</span>
              <input
                style={{ ...inp, ...(programId ? null : { background: "#FFF2EE", color: "#B39189", borderColor: "#F3E3DC" }) }}
                type="number"
                min={1}
                value={dia}
                placeholder="—"
                disabled={!programId}
                onChange={(e) => setDia(e.target.value)}
              />
            </label>

            {/*
              Los dos datos viajan en hidden porque el <select> y el <input> de
              arriba NO tienen `name`: si lo tuvieran, sus valores se irian
              tambien en el guardado de la clase, donde no significan nada.
            */}
            <input type="hidden" name="videoId" value={videoId} />
            <input type="hidden" name="programId" value={programId} />
            <input type="hidden" name="dayNumber" value={dia} />

            <BotonEnviar
              pendingLabel="Agregando…"
              formAction={agregarClaseAPlanAction}
              disabled={!programId || !dia || yaEstaAhi}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 46,
                background: !programId || !dia || yaEstaAhi ? "#F3E3DC" : "var(--pink)",
                color: !programId || !dia || yaEstaAhi ? "#B39189" : "#fff",
                border: "none",
                borderRadius: 99,
                padding: "0 20px",
                fontSize: 14,
                fontWeight: 800,
                fontFamily: "inherit",
                boxShadow: !programId || !dia || yaEstaAhi ? "none" : "0 14px 26px -14px rgba(230,79,85,.85)",
                cursor: !programId || !dia || yaEstaAhi ? "default" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <Plus size={15} strokeWidth={2.4} aria-hidden="true" /> Agregar
            </BotonEnviar>
          </div>

          <p style={{ fontSize: 12.5, color: "#8A6F68", marginTop: 10, lineHeight: 1.55 }}>
            {yaEstaAhi
              ? "Esta clase ya está en ese día."
              : elegido
                ? "Si ese día ya tenía otra clase, esta la reemplaza."
                : "Una clase puede estar en varios planes y en varios días."}
          </p>
        </>
      )}
    </div>
  );
}
