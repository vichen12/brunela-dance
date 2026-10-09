"use client";
import { AlertTriangle, Check, CreditCard, PlayCircle, Plus, Pencil, Trash2, X } from "lucide-react";

import { Desplegable } from "@/components/desplegable";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { BotonEnviar } from "@/components/boton-enviar";
import { AdminDrawer, BloqueAvanzado, botonBorrar, botonPrincipal, campoSuave, etiquetaSuave } from "@/components/admin-drawer";
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

/** Numero positivo con hasta dos decimales, con punto o coma. */
const PATRON_PRECIO = "\\d+([.,]\\d{1,2})?";

const inp = campoSuave;

function Lbl({ children }: { children: React.ReactNode }) {
  return <span style={etiquetaSuave}>{children}</span>;
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
    tono === "ok" ? { fg: "#3F7A45", bg: "#FFF4E8", bd: "#CFE3C9" }
    : tono === "aviso" ? { fg: "#8A4A2E", bg: "#FFF4E8", bd: "#FFE2D3" }
    : { fg: "#8A6F68", bg: "#FFFAF6", bd: "#F3E3DC" };
  return (
    <p style={{
      marginTop: 8, fontSize: 12.5, lineHeight: 1.45, fontWeight: 700,
      color: c.fg, background: c.bg, border: `1px solid ${c.bd}`,
      borderRadius: 14, padding: "8px 12px",
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
    <section className="adr-caja" style={{ marginTop: 24 }}>
      <p style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16, fontWeight: 900, color: "#3B2A2C", margin: "0 0 6px" }}>
        <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 12, display: "grid", placeItems: "center", background: "#FFE2D3", color: "#C25E3A" }}>
          <PlayCircle size={17} strokeWidth={2} />
        </span>
        Clases del pack
        <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 800, color: "#8A6F68", background: "#fff", padding: "4px 11px", borderRadius: 99 }}>
          {pack.clases.length}
        </span>
      </p>
      <p style={{ fontSize: 13, color: "#8A6F68", lineHeight: 1.55, marginBottom: 14 }}>
        Quien compre este pack va a poder ver estas clases para siempre, tenga el
        plan que tenga.
      </p>

      {disponibles.length > 0 && (
        <form action={addVideoToPackAction} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: 14 }}>
          <input type="hidden" name="packId" value={pack.id} />
          <div style={{ flex: "1 1 220px", minWidth: 0 }}><F label="Agregar una clase">
            <Desplegable
              style={inp}
              name="videoId"
              defaultValue=""
              placeholder="Elegí una clase…"
              opciones={disponibles.map((c) => ({ value: c.id, label: c.titulo }))}
            />
          </F></div>
          <BotonEnviar pendingLabel="Agregando…" style={{ ...botonPrincipal, height: 46, padding: "0 20px" }}>
            <Plus size={15} strokeWidth={2.4} aria-hidden="true" /> Agregar
          </BotonEnviar>
        </form>
      )}

      {pack.clases.length === 0 ? (
        <p style={{ fontSize: 13, color: "#8A6F68" }}>
          Todavía no tiene ninguna clase. Sin al menos una, no se puede publicar.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {pack.clases.map((c) => (
            <li key={c.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              background: "#fff", border: "1px solid #F3E3DC", borderRadius: 18, padding: "8px 8px 8px 14px",
            }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "#3B2A2C", minWidth: 0 }}>{c.titulo}</span>
              <form action={removeVideoFromPackAction}>
                <input type="hidden" name="packId" value={pack.id} />
                <input type="hidden" name="videoId" value={c.id} />
                <BotonEnviar pendingLabel="…" style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  background: "#fff", color: "var(--pink-deep)", border: "1.5px solid var(--pink-line)",
                  borderRadius: 99, padding: "6px 12px", fontSize: 12.5, fontWeight: 800,
                  fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
                }}><X size={13} strokeWidth={2.4} aria-hidden="true" /> Quitar</BotonEnviar>
              </form>
            </li>
          ))}
        </ul>
      )}

      {pack.compras > 0 && (
        <p style={{
          display: "flex", gap: 8, alignItems: "flex-start",
          marginTop: 12, fontSize: 13, lineHeight: 1.5, fontWeight: 700,
          color: "#8A4A2E", background: "#FFF4E8", border: "1px solid #FFE2D3",
          borderRadius: 16, padding: "10px 13px",
        }}>
          <AlertTriangle size={15} strokeWidth={2.2} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, color: "#C25E3A" }} />
          <span>{pack.compras === 1 ? "Una alumna ya compró" : `${pack.compras} alumnas ya compraron`} este
          pack. Si quitás una clase, también deja de verla quien ya lo pagó.</span>
        </p>
      )}
    </section>
  );
}

export function EditarPack({ pack, elegibles }: { pack: PackAdmin; elegibles: ClaseElegible[] }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className="ad-editar">
        <Pencil size={14} strokeWidth={2} aria-hidden="true" /> Editar y clases
      </button>

      <AdminDrawer
        abierto={abierto}
        titulo={pack.name_i18n?.es ?? pack.slug}
        subtitulo={`/${pack.slug}`}
        onCerrar={() => setAbierto(false)}
      >
        <form action={updatePackAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <CerrarAlGuardar onExito={() => setAbierto(false)} />
          <input type="hidden" name="id" value={pack.id} />

          <div className="adr-g2">
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
          <div className="adr-caja">
            <p style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16, fontWeight: 900, color: "#3B2A2C", margin: "0 0 6px" }}>
              <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 12, display: "grid", placeItems: "center", background: "#FFF2EE", color: "#B03A3E" }}>
                <CreditCard size={17} strokeWidth={2} />
              </span>
              Precio y cobro
            </p>
            <p style={{ fontSize: 13, color: "#8A6F68", lineHeight: 1.55, marginBottom: 14 }}>
              El importe es lo que se anuncia. El identificador es lo que cobra
              Stripe. Abajo de cada uno te digo cuánto vale ahí de verdad.
            </p>

            <div className="adr-g3">
              <F label={`Precio (${pack.currency.toUpperCase()})`}>
                {/* pattern: solo un numero positivo con hasta dos decimales, con
                    punto o coma. "abc" o "-5" no llegan a la accion. Se queda
                    como texto (no type=number) porque se escribe "24,90". */}
                <input style={inp} name="precio" required inputMode="decimal"
                  pattern={PATRON_PRECIO} title="Un importe como 24,90 (sin signo menos)"
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

            <p style={{ fontSize: 12.5, color: "#8A6F68", lineHeight: 1.5, marginTop: 12 }}>
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

          <div className="adr-acciones" style={{ paddingTop: 6 }}>
            <button type="submit" style={botonPrincipal}>
              <Check size={16} strokeWidth={2.4} aria-hidden="true" /> Guardar cambios
            </button>

            {/* Sin compras se puede borrar; con compras la accion lo frena con un
                mensaje legible antes de que Postgres devuelva un error de clave
                foranea en crudo. */}
            <BotonEnviar pendingLabel="Borrando…" confirmar="¿Borrar este pack? No se puede deshacer." formAction={deletePackAction} style={{ ...botonBorrar, marginLeft: "auto" }}>
              <Trash2 size={15} strokeWidth={2} aria-hidden="true" /> Eliminar
            </BotonEnviar>
          </div>
        </form>

        <ClasesDelPack pack={pack} elegibles={elegibles} />
      </AdminDrawer>
    </>
  );
}
