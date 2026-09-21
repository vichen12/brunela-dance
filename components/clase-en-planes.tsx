"use client";

import { useState } from "react";
import { BotonEnviar } from "@/components/boton-enviar";
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

const inp: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid #e7e5e4",
  background: "#fff",
  color: "#1c1917",
  padding: "9px 13px",
  fontSize: 13,
  outline: "none",
  fontFamily: "inherit",
};

const sel: React.CSSProperties = { ...inp, appearance: "auto" };

const lbl: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.09em",
  color: "#78716c",
  textTransform: "uppercase",
  marginBottom: 5,
};

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
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e7e5e4" }}>
      <span style={lbl}>Agregar a un plan de trabajo</span>

      {planes.length === 0 ? (
        <p style={{ fontSize: 11.5, color: "#78716c", lineHeight: 1.7, marginTop: 6 }}>
          Todavía no hay ningún plan de trabajo armado. Se crean en{" "}
          <a href="/admin/programs" style={{ color: "var(--pink-mid)", fontWeight: 700 }}>
            Planes de trabajo
          </a>
          .
        </p>
      ) : (
        <>
          {/* Donde ya esta puesta */}
          {ubicaciones.length === 0 ? (
            <p style={{ fontSize: 11.5, color: "#a8a29e", lineHeight: 1.7, margin: "4px 0 12px" }}>
              Esta clase no está en ningún plan: se ve suelta en la biblioteca.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "8px 0 14px" }}>
              {ubicaciones.map((u) => (
                <div
                  key={u.programDayId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    borderRadius: 10,
                    border: "1px solid #e7e5e4",
                    background: "#fff",
                    padding: "8px 12px",
                  }}
                >
                  <span style={{ fontSize: 12.5, color: "#1c1917", lineHeight: 1.5 }}>
                    <strong style={{ fontWeight: 700 }}>{u.titulo}</strong>
                    <span style={{ color: "#78716c" }}> — Día {u.dia}</span>
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
                      background: "transparent",
                      color: "#ef4444",
                      border: "1px solid #fecaca",
                      borderRadius: 99,
                      padding: "4px 12px",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    QUITAR
                  </BotonEnviar>
                </div>
              ))}
            </div>
          )}

          {/* Agregarla a uno mas */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 110px auto", gap: 10, alignItems: "end" }}>
            <label style={{ display: "flex", flexDirection: "column" }}>
              <span style={lbl}>Plan</span>
              <select
                style={sel}
                value={programId}
                onChange={(e) => {
                  const id = e.target.value;
                  setProgramId(id);
                  const plan = planes.find((p) => p.id === id);
                  setDia(plan ? String(plan.proximoDia) : "");
                }}
              >
                <option value="">Elegí un plan…</option>
                {planes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.titulo}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column" }}>
              <span style={lbl}>Día</span>
              <input
                style={{ ...inp, ...(programId ? null : { background: "#f5f5f4", color: "#a8a29e" }) }}
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
                background: !programId || !dia || yaEstaAhi ? "#d6d3d1" : "var(--pink)",
                color: "#fff",
                border: "none",
                borderRadius: 99,
                padding: "9px 18px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                cursor: !programId || !dia || yaEstaAhi ? "default" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              AGREGAR
            </BotonEnviar>
          </div>

          <p style={{ fontSize: 11, color: "#a8a29e", marginTop: 8, lineHeight: 1.6 }}>
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
