"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { BotonEnviar } from "@/components/boton-enviar";
import { AdminDrawer, BloqueAvanzado } from "@/components/admin-drawer";
import {
  addVideoToPackAction,
  deletePackAction,
  removeVideoFromPackAction,
  updatePackAction,
} from "@/src/features/admin/packs-actions";

/**
 * Edicion de un pack, en panel lateral.
 *
 * El precio y los identificadores de Stripe SI estan aca, junto al resto:
 * obligar a crear el pack en una pantalla y cargarle el identificador en otra
 * era un ida y vuelta sin motivo. En /admin/precios siguen viendose todos
 * juntos para revisar de un vistazo.
 *
 * Las dos pantallas guardan con el MISMO interprete
 * (src/features/admin/precio-de-pack.ts), asi que no pueden mostrar numeros
 * distintos -- que era el riesgo real de tener dos formularios.
 */

export type PackAdmin = {
  id: string;
  slug: string;
  name_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  price_cents: number;
  currency: string;
  cover_image_url: string | null;
  display_order: number;
  is_published: boolean;
  show_on_landing: boolean;
  is_featured: boolean;
  stripe_price_id_test: string | null;
  stripe_price_id_live: string | null;
  clases: { id: string; titulo: string }[];
  compras: number;
  /**
   * Lo que dice Stripe de cada identificador, YA RESUELTO en el servidor.
   *
   * ⚠️ Viaja como objeto plano `{tono, texto}` y no como funcion: por la
   *    frontera servidor->cliente no cruzan funciones, y eso ya reventó una vez
   *    en produccion con los iconos de lucide (trampa 6).
   */
  avisoTest: { tono: "ok" | "aviso" | "gris"; texto: string } | null;
  avisoLive: { tono: "ok" | "aviso" | "gris"; texto: string } | null;
};

export type ClaseElegible = { id: string; titulo: string };

const inp: React.CSSProperties = {
  width: "100%", borderRadius: 10, border: "1px solid #e7e5e4",
  background: "#fff", color: "#1c1917", padding: "9px 13px",
  fontSize: 13, outline: "none", fontFamily: "inherit",
};

const sel: React.CSSProperties = {
  ...inp, appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23a8a29e' strokeWidth='1.5' strokeLinecap='round' fill='none'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 34,
};

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", color: "#78716c", textTransform: "uppercase", marginBottom: 5 }}>
      {children}
    </span>
  );
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column" }}>
      <Lbl>{label}</Lbl>
      {children}
    </label>
  );
}

/** El aviso de Stripe debajo de un identificador. */
function Aviso({ tono, texto }: { tono: "ok" | "aviso" | "gris"; texto: string }) {
  const c =
    tono === "ok" ? { fg: "#166534", bg: "#f0fdf4", bd: "#bbf7d0" }
    : tono === "aviso" ? { fg: "#92400e", bg: "#fffbeb", bd: "#fde68a" }
    : { fg: "#78716c", bg: "#fafaf9", bd: "#f0eeec" };
  return (
    <p style={{
      marginTop: 6, fontSize: 11.5, lineHeight: 1.45, fontWeight: 600,
      color: c.fg, background: c.bg, border: `1px solid ${c.bd}`,
      borderRadius: 9, padding: "6px 10px",
    }}>{texto}</p>
  );
}

/** Cierra el panel cuando el guardado termino bien. TIENE que estar dentro del <form>. */
function CerrarAlGuardar({ onExito }: { onExito: () => void }) {
  const { pending } = useFormStatus();
  const enviando = useRef(false);
  useEffect(() => {
    if (enviando.current && !pending) onExito();
    enviando.current = pending;
  }, [pending, onExito]);
  return null;
}

/**
 * Las clases del pack.
 *
 * ⚠️ VA FUERA del <form> de datos. Un <form> dentro de otro lo descarta el
 *    parser de HTML, y en admin-live-drawer eso ya hizo que ELIMINAR llamara a
 *    la accion de guardar.
 */
function ClasesDelPack({ pack, elegibles }: { pack: PackAdmin; elegibles: ClaseElegible[] }) {
  const yaEstan = new Set(pack.clases.map((c) => c.id));
  const disponibles = elegibles.filter((c) => !yaEstan.has(c.id));

  return (
    <section style={{ marginTop: 22, borderTop: "1px solid #f0eeec", paddingTop: 20 }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#78716c", textTransform: "uppercase", marginBottom: 6 }}>
        Clases del pack ({pack.clases.length})
      </p>
      <p style={{ fontSize: 12, color: "#78716c", lineHeight: 1.5, marginBottom: 14 }}>
        Quien compre este pack va a poder ver estas clases para siempre, tenga el
        plan que tenga.
      </p>

      {disponibles.length > 0 && (
        <form action={addVideoToPackAction} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end", marginBottom: 14 }}>
          <input type="hidden" name="packId" value={pack.id} />
          <F label="Agregar una clase">
            <select style={sel} name="videoId" defaultValue="">
              <option value="" disabled>Elegí una clase…</option>
              {disponibles.map((c) => (
                <option key={c.id} value={c.id}>{c.titulo}</option>
              ))}
            </select>
          </F>
          <BotonEnviar pendingLabel="Agregando…" style={{
            background: "#1c1917", color: "#fff", border: "none", borderRadius: 99,
            padding: "10px 20px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
            cursor: "pointer", whiteSpace: "nowrap",
          }}>AGREGAR</BotonEnviar>
        </form>
      )}

      {pack.clases.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "#a8a29e" }}>
          Todavía no tiene ninguna clase. Sin al menos una, no se puede publicar.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {pack.clases.map((c) => (
            <li key={c.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              background: "#fafaf9", border: "1px solid #f0eeec", borderRadius: 10, padding: "8px 12px",
            }}>
              <span style={{ fontSize: 12.5, color: "#1c1917", minWidth: 0 }}>{c.titulo}</span>
              <form action={removeVideoFromPackAction}>
                <input type="hidden" name="packId" value={pack.id} />
                <input type="hidden" name="videoId" value={c.id} />
                <BotonEnviar pendingLabel="…" style={{
                  background: "transparent", border: "none", color: "#a8a29e",
                  fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: "4px 6px",
                }}>Quitar</BotonEnviar>
              </form>
            </li>
          ))}
        </ul>
      )}

      {pack.compras > 0 && (
        <p style={{
          marginTop: 12, fontSize: 11.5, lineHeight: 1.5, fontWeight: 600,
          color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a",
          borderRadius: 9, padding: "8px 11px",
        }}>
          ⚠️ {pack.compras === 1 ? "Una alumna ya compró" : `${pack.compras} alumnas ya compraron`} este
          pack. Si quitás una clase, también deja de verla quien ya lo pagó.
        </p>
      )}
    </section>
  );
}

export function EditarPack({ pack, elegibles }: { pack: PackAdmin; elegibles: ClaseElegible[] }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        style={{
          padding: "6px 14px", borderRadius: 8, cursor: "pointer",
          border: "1px solid #f0eeec", background: "#fff",
          color: "#57534e", fontSize: 11, fontWeight: 700, fontFamily: "inherit",
        }}
      >Editar y clases</button>

      <AdminDrawer
        abierto={abierto}
        titulo={pack.name_i18n?.es ?? pack.slug}
        subtitulo={`/${pack.slug}`}
        onCerrar={() => setAbierto(false)}
      >
        <form action={updatePackAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <CerrarAlGuardar onExito={() => setAbierto(false)} />
          <input type="hidden" name="id" value={pack.id} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <F label="Nombre">
              <input style={inp} name="nombreEs" required defaultValue={pack.name_i18n?.es ?? ""} />
            </F>
            <F label="Dirección">
              <input style={inp} name="slug" required defaultValue={pack.slug} />
            </F>
          </div>

          <F label="Descripción">
            <textarea style={{ ...inp, minHeight: 72, resize: "vertical" }} name="descripcionEs"
              defaultValue={pack.description_i18n?.es ?? ""}
              placeholder="Qué incluye y para quién es…" />
          </F>

          {/* ── Precio y cobro ─────────────────────────────────────────
              Antes esto era solo lectura y mandaba a /admin/precios. Crear el
              pack en un lado y cargarle el identificador en otro era un ida y
              vuelta sin motivo: se carga donde se crea. En /admin/precios
              siguen viendose todos juntos para revisar de un vistazo, y las dos
              pantallas guardan con el MISMO interprete. */}
          <div style={{ borderRadius: 12, border: "1px solid #f0eeec", padding: "16px 18px", background: "#fafaf9" }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#78716c", textTransform: "uppercase", marginBottom: 4 }}>
              Precio y cobro
            </p>
            <p style={{ fontSize: 12, color: "#78716c", lineHeight: 1.5, marginBottom: 14 }}>
              El importe es lo que se anuncia. El identificador es lo que cobra
              Stripe. Abajo de cada uno te digo cuánto vale ahí de verdad.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 1fr", gap: 14, alignItems: "start" }}>
              <F label={`Precio (${pack.currency.toUpperCase()})`}>
                <input style={inp} name="precio" required inputMode="decimal"
                  defaultValue={(pack.price_cents / 100).toString()} />
              </F>

              <label style={{ display: "block" }}>
                <Lbl>Identificador — prueba</Lbl>
                <input style={inp} name="priceTest" defaultValue={pack.stripe_price_id_test ?? ""}
                  placeholder="price_1AbC…" autoComplete="off" spellCheck={false} />
                {pack.avisoTest && <Aviso {...pack.avisoTest} />}
              </label>

              <label style={{ display: "block" }}>
                <Lbl>Identificador — producción</Lbl>
                <input style={inp} name="priceLive" defaultValue={pack.stripe_price_id_live ?? ""}
                  placeholder="price_1AbC…" autoComplete="off" spellCheck={false} />
                {pack.avisoLive && <Aviso {...pack.avisoLive} />}
              </label>
            </div>

            <p style={{ fontSize: 11.5, color: "#a8a29e", lineHeight: 1.5, marginTop: 12 }}>
              Un identificador de Stripe no se edita: se reemplaza. Para cambiar
              el precio, en Stripe se crea uno nuevo y se pega acá.
            </p>
          </div>

          <BloqueAvanzado titulo="Traducción al inglés" cantidad={2}>
            <F label="Nombre en inglés">
              <input style={inp} name="nombreEn" defaultValue={pack.name_i18n?.en ?? ""} />
            </F>
            <F label="Descripción en inglés">
              <textarea style={{ ...inp, minHeight: 72, resize: "vertical" }} name="descripcionEn"
                defaultValue={pack.description_i18n?.en ?? ""} />
            </F>
          </BloqueAvanzado>

          <BloqueAvanzado titulo="Portada y orden" cantidad={2}>
            <F label="URL de portada">
              <input style={inp} name="portada" type="url" defaultValue={pack.cover_image_url ?? ""} placeholder="https://…" />
            </F>
            <F label="Orden en la portada">
              <input style={inp} name="orden" type="number" defaultValue={pack.display_order} />
            </F>
          </BloqueAvanzado>

          <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
            <button type="submit" style={{
              background: "#1c1917", color: "#fff", border: "none", borderRadius: 99,
              padding: "10px 24px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer",
            }}>GUARDAR CAMBIOS</button>

            {/* Sin compras se puede borrar; con compras la accion lo frena con un
                mensaje legible antes de que Postgres devuelva un error de clave
                foranea en crudo. */}
            <BotonEnviar pendingLabel="Borrando…" formAction={deletePackAction} style={{
              background: "transparent", color: "#ef4444", border: "1px solid #fecaca",
              borderRadius: 99, padding: "10px 22px", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.1em", cursor: "pointer",
            }}>ELIMINAR</BotonEnviar>
          </div>
        </form>

        <ClasesDelPack pack={pack} elegibles={elegibles} />
      </AdminDrawer>
    </>
  );
}
