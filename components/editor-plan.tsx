"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, startTransition } from "react";
import {
  ArrowDown, ArrowLeft, ArrowUp, CalendarDays, Check, Clock, CornerDownRight, Eraser, Loader2, Minus,
  Pencil, Plus, Trash2, X, Heart,
} from "lucide-react";
import { SubirPortadaClase } from "@/components/subir-portada-clase";
import { ElegirConBuscador, type OpcionBuscable } from "@/components/elegir-con-buscador";
import { BotonEnviar } from "@/components/boton-enviar";
import { aDireccion } from "@/src/lib/slug";
import {
  borrarPlanAction,
  guardarPlanCompletoAction,
  type EstadoEditorPlan,
} from "@/src/features/admin/dias-de-plan-actions";
import {
  AVISO_FALTA_MIGRACION_DESCANSO,
  MAX_DIAS_PLAN,
  NOTA_DESCANSO_MAX,
  NOTA_DESCANSO_POR_DEFECTO,
  ajustarCantidad,
  borrarDiaYCorrer,
  llevarDiaA,
  moverDia,
  seQuitanConContenido,
  type CasilleroDia,
} from "@/src/features/studio/dias-de-plan";
import type { ClaseElegible, PlanEditable } from "@/src/features/admin/editor-plan-datos";

/**
 * El editor de un plan de trabajo, a PANTALLA COMPLETA.
 *
 * POR QUE NO EL PANEL LATERAL
 *   Pedido de Brunela: «cuando pongo editar solo me aparece chiquitito en un
 *   costado». Un plan son 14 o 28 dias: necesita la pantalla entera. Y crear
 *   un plan era dos pasos (crear, despues bajar a "Editar y días"): ahora se
 *   crea CON sus dias, de una vez.
 *
 * COMO SE GUARDA: TODO JUNTO, CON UN BOTON
 *   Los dias viven en el navegador (un arreglo de casilleros 1..N) hasta
 *   "Guardar". Ver guardarPlanCompletoAction: reordenar con autoguardado por
 *   fila podia dejar el plan a medio mover y visible para las alumnas.
 *   Si se intenta salir con cambios sin guardar, el navegador pregunta.
 *
 * ⚠️ NO SE USA <form action={...}>
 *    React 19 resetea el formulario despues de una server action pasada por
 *    `action`: los campos volverian a sus valores iniciales y los buscadores de
 *    cada dia tambien. Se envia desde onSubmit con startTransition, que no
 *    resetea nada. La validacion del navegador (required) corre igual, antes
 *    del onSubmit.
 */

const VALOR_DESCANSO = "descanso";

export function EditorPlan({
  plan,
  casillerosIniciales,
  clases,
  descansoDisponible,
}: {
  plan: PlanEditable | null;
  casillerosIniciales: CasilleroDia[];
  clases: ClaseElegible[];
  descansoDisponible: boolean;
}) {
  const esNuevo = !plan;
  const [estado, despachar, guardando] = useActionState<EstadoEditorPlan, FormData>(guardarPlanCompletoAction, { tipo: "inicial" });
  const [dias, setDias] = useState<CasilleroDia[]>(casillerosIniciales);
  const [editando, setEditando] = useState<number | null>(null);
  const [recienAgregado, setRecienAgregado] = useState<number | null>(null);
  const [sucio, setSucio] = useState(false);
  const [slug, setSlug] = useState(plan?.slug ?? "");
  const [slugTocado, setSlugTocado] = useState(Boolean(plan));
  const [verOk, setVerOk] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const porId = useMemo(() => new Map(clases.map((c) => [c.id, c])), [clases]);
  const opciones: OpcionBuscable[] = useMemo(
    () => clases.map((c) => ({
      value: c.id,
      label: c.titulo,
      detalle: [c.duracion, c.estado === "draft" ? "borrador" : c.estado === "archived" ? "archivada" : ""].filter(Boolean).join(" · ") || undefined,
      icono: c.portada
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={c.portada} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
        : <CalendarDays size={14} strokeWidth={2} />,
    })),
    [clases]
  );
  const fijas: OpcionBuscable[] = useMemo(
    () => descansoDisponible
      ? [{ value: VALOR_DESCANSO, label: "Descanso", detalle: "Un día sin clase, con un mensaje para ella", icono: <Heart size={15} strokeWidth={0} fill="currentColor" /> }]
      : [],
    [descansoDisponible]
  );

  // Guardado bien: se limpia "sin guardar" y se muestra el tilde un rato.
  useEffect(() => {
    if (estado.tipo !== "ok") return;
    setSucio(false);
    setVerOk(true);
    const t = window.setTimeout(() => setVerOk(false), 3200);
    return () => window.clearTimeout(t);
  }, [estado]);

  // Salir con cambios sin guardar: que el navegador pregunte.
  useEffect(() => {
    if (!sucio) return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sucio]);

  function cambiarDias(nuevo: CasilleroDia[]) {
    setDias(nuevo);
    setSucio(true);
  }

  function ponerCantidad(n: number) {
    const total = Math.max(1, Math.min(MAX_DIAS_PLAN, Math.floor(n) || 1));
    const pierde = seQuitanConContenido(dias, total);
    if (pierde > 0 && !window.confirm(`Al dejarlo en ${total} días se sacan ${pierde} ${pierde === 1 ? "día cargado" : "días cargados"} del final. ¿Seguir?`)) return;
    cambiarDias(ajustarCantidad(dias, total));
    if (editando !== null && editando >= total) setEditando(null);
  }

  function elegirPara(i: number, valor: string) {
    if (!valor) return;
    setRecienAgregado(null);
    const copia = [...dias];
    copia[i] = valor === VALOR_DESCANSO
      ? { tipo: "descanso", nota: dias[i].tipo === "descanso" ? (dias[i] as { nota: string }).nota : NOTA_DESCANSO_POR_DEFECTO }
      : { tipo: "clase", videoId: valor };
    cambiarDias(copia);
    // Un descanso queda abierto para poder escribir el mensaje.
    setEditando(valor === VALOR_DESCANSO ? i : null);
  }

  function agregarDia() {
    if (dias.length >= MAX_DIAS_PLAN) return;
    cambiarDias(ajustarCantidad(dias, dias.length + 1));
    setEditando(dias.length);
    setRecienAgregado(dias.length);
  }

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("dias", JSON.stringify(dias));
    startTransition(() => despachar(fd));
  }

  const cargados = dias.filter((d) => d.tipo !== "vacio").length;
  // Sin portada propia, el plan usa la foto de su primera clase (misma regla que
  // ve la alumna en app/dashboard/programs).
  const primeraClase = dias.find((d) => d.tipo === "clase");
  const portadaPorDefecto = primeraClase && primeraClase.tipo === "clase" ? porId.get(primeraClase.videoId)?.portada ?? null : null;
  // Las fotos de las clases del plan, para elegir una como portada.
  const fotosDelPlan = [...new Set(dias.flatMap((d) => (d.tipo === "clase" ? [d.videoId] : [])))]
    .map((id) => porId.get(id))
    .flatMap((c) => (c?.portada && c.portadaFija ? [{ url: c.portadaFija, vista: c.portada, titulo: c.titulo }] : []));
  const descansos = dias.filter((d) => d.tipo === "descanso").length;
  const vacios = dias.length - cargados;
  const hayDescansoSinMigracion = !descansoDisponible && descansos > 0;

  return (
    <main className="epl">
      <style>{CSS}</style>

      <div className="epl-arriba">
        <Link href="/admin/programs" className="epl-volver">
          <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" /> Planes de trabajo
        </Link>
        {plan && (
          <Link href={`/dashboard/programs/${plan.slug}`} className="epl-volver epl-volver--suave">
            Ver como alumna
          </Link>
        )}
      </div>

      <form ref={formRef} className="epl-grilla" onSubmit={enviar} onChange={() => setSucio(true)}>
        <input type="hidden" name="id" value={plan?.id ?? ""} />

        {/* ── Datos del plan ─────────────────────────────────────────── */}
        <aside className="epl-datos">
          <p className="epl-eyebrow">{esNuevo ? "Plan nuevo" : "Editando el plan"}</p>

          {/* Bloques en el orden en que se piensa un plan: como se ve, que es,
              cuanto dura y para quien, y si ya se publica. Sin scroll propio:
              la caja crece con su contenido y scrollea la pagina (antes era una
              caja con scroll dentro de otra, y la portada quedaba escondida). */}
          <section className="epl-bloque">
            <p className="epl-bloque-tit">Portada</p>
            <div className="epl-campo">
                          <SubirPortadaClase
                name="coverImageUrl"
                defaultValue={plan?.cover_image_url ?? ""}
                porDefecto={portadaPorDefecto}
                opciones={fotosDelPlan}
                ayudaVacio={portadaPorDefecto ? "Si no elegís ninguna, se usa la foto de la primera clase del plan." : "Elegí una foto horizontal. Si no ponés ninguna, se usa la de la primera clase del plan."}
                ayudaLista="Es la imagen que ven las alumnas en la tarjeta del plan y arriba de su ficha."
              />
            </div>
          </section>

          <section className="epl-bloque">
            <p className="epl-bloque-tit">Qué es</p>
            <label className="epl-campo">
              <span className="epl-etq">Título</span>
              <input
                name="titleEs" required defaultValue={plan?.title_i18n?.es ?? ""} placeholder="Trabajo de pies en 14 días"
                onChange={(e) => { if (!slugTocado) setSlug(aDireccion(e.target.value)); }}
              />
            </label>
            <label className="epl-campo">
              <span className="epl-etq">Descripción <small>la lee la alumna antes de empezar</small></span>
              <textarea name="descriptionEs" required rows={4} defaultValue={plan?.description_i18n?.es ?? ""} placeholder="Qué trabaja este plan y para quién es…" />
            </label>
          </section>

          <section className="epl-bloque">
            <p className="epl-bloque-tit">Duración y acceso</p>
            <div className="epl-campo">
              <span className="epl-etq" id="epl-cant">Cuántos días dura</span>
              <div className="epl-cantidad">
                <button type="button" aria-label="Un día menos" disabled={dias.length <= 1} onClick={() => ponerCantidad(dias.length - 1)}>
                  <Minus size={16} strokeWidth={2.2} />
                </button>
                <input
                  aria-labelledby="epl-cant" type="number" min={1} max={MAX_DIAS_PLAN} value={dias.length}
                  onChange={(e) => ponerCantidad(Number(e.target.value))}
                />
                <button type="button" aria-label="Un día más" disabled={dias.length >= MAX_DIAS_PLAN} onClick={() => ponerCantidad(dias.length + 1)}>
                  <Plus size={16} strokeWidth={2.2} />
                </button>
              </div>
              <div className="epl-atajos" role="group" aria-label="Duraciones comunes">
                {[7, 14, 21, 28].map((n) => (
                  <button key={n} type="button" className={dias.length === n ? "es-activo" : ""} onClick={() => ponerCantidad(n)}>{n} días</button>
                ))}
              </div>
            </div>
            <div className="epl-campo">
              <span className="epl-etq">Quién lo ve</span>
              <div className="epl-opciones" role="radiogroup" aria-label="Plan que lo puede ver">
                {[
                  { value: "solista", titulo: "Solista", sub: "Lo ven Solista y Principal" },
                  { value: "principal", titulo: "Principal", sub: "Solo Principal" },
                ].map((o) => (
                  <label key={o.value}>
                    <input type="radio" name="membershipTierRequired" value={o.value} defaultChecked={(plan?.membership_tier_required ?? "solista") === o.value} />
                    <span><strong>{o.titulo}</strong><small>{o.sub}</small></span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="epl-bloque">
            <p className="epl-bloque-tit">Publicación</p>
            <div className="epl-campo">
              <span className="epl-etq">Estado</span>
              <div className="epl-segmento" role="radiogroup" aria-label="Estado">
                {[
                  { value: "draft", label: "Borrador" },
                  { value: "published", label: "Publicado" },
                  { value: "archived", label: "Archivado" },
                ].map((o) => (
                  <label key={o.value}>
                    <input type="radio" name="status" value={o.value} defaultChecked={(plan?.status ?? "draft") === o.value} />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="epl-switch">
              <input type="checkbox" name="isFeatured" defaultChecked={plan?.is_featured ?? false} />
              <span className="epl-switch-pista" aria-hidden="true"><span /></span>
              <span>Destacar <small>aparece primero para las alumnas</small></span>
            </label>
          </section>

          <details className="epl-bloque epl-mas" open={esNuevo ? undefined : false}>
            <summary className="epl-bloque-tit"><span>Inglés y dirección <small>opcional</small></span></summary>
            <div className="epl-mas-cuerpo">
              <label className="epl-campo">
                <span className="epl-etq">Título en inglés <small>opcional</small></span>
                <input name="titleEn" defaultValue={plan?.title_i18n?.en ?? ""} placeholder="Footwork in 14 days" />
              </label>
              <label className="epl-campo">
                <span className="epl-etq">Descripción en inglés <small>opcional</small></span>
                <textarea name="descriptionEn" rows={2} defaultValue={plan?.description_i18n?.en ?? ""} />
              </label>
              <label className="epl-campo">
                <span className="epl-etq">Dirección <small>{esNuevo ? "se completa sola con el título" : "no se cambia: rompería los enlaces ya compartidos"}</small></span>
                <div className="epl-direccion">
                  <span>…/programs/</span>
                  <input
                    name="slug" required readOnly={!esNuevo} value={slug} placeholder="trabajo-de-pies-14-dias"
                    onChange={(e) => { setSlug(e.target.value); setSlugTocado(true); }}
                  />
                </div>
              </label>
            </div>
          </details>
        </aside>

        {/* ── Los dias ───────────────────────────────────────────────── */}
        <section className="epl-dias" aria-label="Días del plan">
          <header className="epl-dias-cabeza">
            <div>
              <h1 className="epl-titulo">Días del plan</h1>
              <p className="epl-resumen">
                {/* Un dia sin clase la alumna lo ve como descanso: se cuenta asi. */}
                <strong>{dias.length - descansos - vacios}</strong> {dias.length - descansos - vacios === 1 ? "clase" : "clases"}
                {descansos + vacios > 0 && <> · {descansos + vacios} {descansos + vacios === 1 ? "día" : "días"} de descanso</>}
              </p>
            </div>
          </header>

          {!descansoDisponible && <p className="epl-nota" role="note">{AVISO_FALTA_MIGRACION_DESCANSO}</p>}

          <ol className="epl-lista">
            {dias.map((d, i) => (
              <FilaDia
                key={i}
                i={i}
                total={dias.length}
                dia={d}
                clase={d.tipo === "clase" ? porId.get(d.videoId) : undefined}
                abierta={editando === i}
                autoFocus={recienAgregado === i}
                opciones={opciones}
                fijas={fijas}
                onAbrir={() => setEditando(editando === i ? null : i)}
                onElegir={(v) => elegirPara(i, v)}
                onNota={(nota) => { const c = [...dias]; c[i] = { tipo: "descanso", nota }; cambiarDias(c); }}
                onVaciar={() => { const c = [...dias]; c[i] = { tipo: "vacio" }; cambiarDias(c); setEditando(i); }}
                onMover={(delta) => { cambiarDias(moverDia(dias, i, delta)); setEditando(editando === i ? i + delta : editando); }}
                onLlevar={(n) => { cambiarDias(llevarDiaA(dias, i, n)); setEditando(null); }}
                onBorrar={() => {
                  if (d.tipo !== "vacio" && !window.confirm(`¿Sacar el día ${i + 1}? Los siguientes se corren un lugar y el plan queda de ${dias.length - 1} días.`)) return;
                  cambiarDias(borrarDiaYCorrer(dias, i));
                  setEditando(null);
                }}
              />
            ))}
          </ol>

          <button type="button" className="epl-agregar" onClick={agregarDia} disabled={dias.length >= MAX_DIAS_PLAN}>
            <Plus size={18} strokeWidth={2.4} aria-hidden="true" /> Agregar día {dias.length + 1}
          </button>

          {/* ── Guardar ──────────────────────────────────────────────── */}
          <div className="epl-barra">
            <div className="epl-barra-txt" aria-live="polite">
              {estado.tipo === "error" && <span className="epl-error">{estado.mensaje}</span>}
              {estado.tipo === "ok" && estado.aviso && <span className="epl-error">{estado.aviso}</span>}
              {estado.tipo !== "error" && !(estado.tipo === "ok" && estado.aviso) && (
                verOk && !sucio
                  ? <span className="epl-ok"><Check size={14} strokeWidth={3} aria-hidden="true" /> Guardado</span>
                  : sucio
                    ? <span className="epl-sucio">Hay cambios sin guardar</span>
                    : <span className="epl-tenue">{esNuevo ? "Completá los datos y los días, y crealo de una vez." : "Todo guardado."}</span>
              )}
              {hayDescansoSinMigracion && <span className="epl-error">Los descansos no se van a poder guardar hasta correr la migración.</span>}
            </div>
            <button type="submit" className="epl-guardar" disabled={guardando}>
              {guardando
                ? <><Loader2 size={16} className="epl-gira" aria-hidden="true" /> Guardando…</>
                : <><Check size={16} strokeWidth={2.6} aria-hidden="true" /> {esNuevo ? "Crear plan con sus días" : "Guardar cambios"}</>}
            </button>
          </div>
        </section>
      </form>

      {/* Fuera del formulario principal: los <form> anidados son HTML invalido. */}
      {plan && (
        <form action={borrarPlanAction} className="epl-borrar">
          <input type="hidden" name="id" value={plan.id} />
          <BotonEnviar
            className="epl-borrar-btn"
            pendingLabel="Borrando…"
            confirmar="¿Borrar este plan de trabajo y todos sus días? No se puede deshacer."
          >
            <Trash2 size={15} strokeWidth={2} aria-hidden="true" /> Borrar este plan
          </BotonEnviar>
        </form>
      )}
    </main>
  );
}

function FilaDia({
  i, total, dia, clase, abierta, autoFocus, opciones, fijas,
  onAbrir, onElegir, onNota, onVaciar, onMover, onLlevar, onBorrar,
}: {
  i: number;
  total: number;
  dia: CasilleroDia;
  clase: ClaseElegible | undefined;
  abierta: boolean;
  autoFocus: boolean;
  opciones: OpcionBuscable[];
  fijas: OpcionBuscable[];
  onAbrir: () => void;
  onElegir: (valor: string) => void;
  onNota: (nota: string) => void;
  onVaciar: () => void;
  onMover: (delta: -1 | 1) => void;
  onLlevar: (numero: number) => void;
  onBorrar: () => void;
}) {
  const n = i + 1;
  const [destino, setDestino] = useState(String(n));
  useEffect(() => setDestino(String(n)), [n]);

  // Un dia sin clase YA es descanso (asi lo ve la alumna): no se muestra la
  // caja de busqueda abierta en cada uno, sino la tarjeta de descanso con dos
  // botones claros. El recien agregado si la trae abierta, para cargarlo ya.
  const mostrarBuscador = abierta || (dia.tipo === "vacio" && autoFocus);
  const esDescanso = dia.tipo === "vacio" || dia.tipo === "descanso";
  const valorActual = dia.tipo === "clase" ? dia.videoId : dia.tipo === "descanso" ? VALOR_DESCANSO : "";

  return (
    <li className={"epl-dia epl-dia--" + dia.tipo + (abierta ? " esta-abierta" : "")}>
      <div className="epl-dia-fila">
        <span className="epl-dia-num" aria-hidden="true"><small>Día</small>{n}</span>

        <div className="epl-dia-cuerpo">
          {dia.tipo === "clase" && (
            <div className="epl-clase">
              <span className="epl-clase-foto" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {clase?.portada && <img src={clase.portada} alt="" loading="lazy" />}
              </span>
              <span className="epl-clase-txt">
                <strong>{clase?.titulo ?? "Clase que ya no existe"}</strong>
                <small>
                  {clase?.duracion && <><Clock size={12} strokeWidth={2.2} aria-hidden="true" /> {clase.duracion}</>}
                  {clase?.estado === "draft" && <em> · borrador: las alumnas todavía no la ven</em>}
                  {clase?.estado === "archived" && <em> · archivada: las alumnas no la ven</em>}
                  {!clase && <em>elegí otra</em>}
                </small>
              </span>
            </div>
          )}
          {esDescanso && !mostrarBuscador && (
            <div className="epl-clase">
              <span className="epl-clase-foto epl-clase-foto--descanso" aria-hidden="true"><Heart size={20} strokeWidth={0} fill="currentColor" /></span>
              <span className="epl-clase-txt">
                <strong>Descanso</strong>
                <small className="epl-nota-corta">«{(dia.tipo === "descanso" && dia.nota.trim()) || NOTA_DESCANSO_POR_DEFECTO}»</small>
              </span>
            </div>
          )}
        </div>

        <div className="epl-dia-acciones">
          <button type="button" className="epl-ico" onClick={() => onMover(-1)} disabled={i === 0} aria-label={`Subir el día ${n}`} title="Subir">
            <ArrowUp size={15} strokeWidth={2.2} />
          </button>
          <button type="button" className="epl-ico" onClick={() => onMover(1)} disabled={i === total - 1} aria-label={`Bajar el día ${n}`} title="Bajar">
            <ArrowDown size={15} strokeWidth={2.2} />
          </button>
          {abierta ? (
            <button type="button" className="epl-btn" onClick={onAbrir} aria-expanded>
              <X size={13} strokeWidth={2.4} aria-hidden="true" /> Listo
            </button>
          ) : dia.tipo === "clase" ? (
            <button type="button" className="epl-btn" onClick={onAbrir} aria-expanded={false}>
              <Pencil size={12} strokeWidth={2.4} aria-hidden="true" /> Cambiar
            </button>
          ) : (
            <>
              {/* Pasa a "descanso" con mensaje propio y abre el texto. */}
              {dia.tipo === "vacio" && fijas.length > 0 && (
                <button type="button" className="epl-btn epl-btn--suave" title="Cambiar el mensaje que lee la alumna ese día" onClick={() => onElegir(VALOR_DESCANSO)}>
                  <Pencil size={12} strokeWidth={2.4} aria-hidden="true" /> Mensaje
                </button>
              )}
              {dia.tipo === "descanso" && (
                <button type="button" className="epl-btn epl-btn--suave" title="Cambiar el mensaje que lee la alumna ese día" onClick={onAbrir}>
                  <Pencil size={12} strokeWidth={2.4} aria-hidden="true" /> Mensaje
                </button>
              )}
              <button type="button" className="epl-btn epl-btn--lleno" onClick={onAbrir}>
                <Plus size={13} strokeWidth={2.6} aria-hidden="true" /> Poner una clase
              </button>
            </>
          )}
        </div>
      </div>

      {mostrarBuscador && (
        <div className="epl-dia-editor">
          <ElegirConBuscador
            key={valorActual}
            etiqueta={`Qué va el día ${n}`}
            placeholder="Buscá la clase por su nombre…"
            opciones={opciones}
            fijas={fijas}
            defaultValue={valorActual}
            autoFocus={autoFocus || (abierta && dia.tipo !== "descanso")}
            onChange={onElegir}
          />

          {dia.tipo === "descanso" && (
            <label className="epl-campo" style={{ marginTop: 10 }}>
              <span className="epl-etq">Mensaje para ese día <small>lo lee la alumna; podés cambiarlo</small></span>
              <textarea rows={3} maxLength={NOTA_DESCANSO_MAX} value={dia.nota} onChange={(e) => onNota(e.target.value)} />
            </label>
          )}

          {abierta && (
            <div className="epl-dia-mas">
              <span className="epl-mover">
                <CornerDownRight size={14} strokeWidth={2.2} aria-hidden="true" /> Llevar al día
                <input
                  type="number" min={1} max={total} value={destino} aria-label={`Llevar el día ${n} al número`}
                  onChange={(e) => setDestino(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onLlevar(Number(destino)); } }}
                />
                <button type="button" className="epl-btn" onClick={() => onLlevar(Number(destino))} disabled={Number(destino) === n}>Mover</button>
              </span>
              {dia.tipo !== "vacio" && (
                <button type="button" className="epl-btn" onClick={onVaciar}><Eraser size={13} strokeWidth={2.2} aria-hidden="true" /> Vaciar</button>
              )}
              {total > 1 && (
                <button type="button" className="epl-btn epl-btn--peligro" onClick={onBorrar}><Trash2 size={13} strokeWidth={2.2} aria-hidden="true" /> Sacar este día</button>
              )}
            </div>
          )}
        </div>
      )}

    </li>
  );
}

const CSS = `
.epl { display: flex; flex-direction: column; gap: 16px; padding-bottom: 40px; }
.epl-arriba { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.epl-volver {
  display: inline-flex; align-items: center; gap: 8px; height: 42px; padding: 0 18px 0 14px; border-radius: 99px;
  background: #fff; border: 1.5px solid var(--linea-fuerte); color: var(--ink); font-size: 14px; font-weight: 800; text-decoration: none;
}
.epl-volver:hover { background: var(--rubor); border-color: var(--pink-line); }
.epl-volver--suave { padding: 0 18px; color: var(--pink-deep); }

.epl-grilla { display: grid; grid-template-columns: minmax(300px, 380px) minmax(0, 1fr); gap: 20px; align-items: start; }
.epl-datos { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.epl-bloque {
  display: flex; flex-direction: column; gap: 14px; padding: 18px;
  border-radius: 24px; background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra);
}
.epl-bloque-tit { margin: 0; font-size: 12.5px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; color: var(--pink-deep); }
.epl-bloque-tit small { font-weight: 700; text-transform: none; letter-spacing: 0; color: var(--muted); margin-left: 6px; }
.epl-mas { gap: 0; }
/* La portada ya va dentro de su bloque: sin el segundo borde punteado. */
.epl-bloque .spc { padding: 0; border: 0; background: transparent; }
/* En la columna angosta, foto arriba y texto abajo SIEMPRE (con o sin fotos para elegir). */
.epl-bloque .spc { grid-template-columns: minmax(0, 1fr); align-items: stretch; }
.epl-mas > summary { cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; }
.epl-mas > summary::-webkit-details-marker { display: none; }
.epl-mas > summary::after { content: "+"; font-size: 20px; font-weight: 600; color: var(--pink-deep); }
.epl-mas[open] > summary::after { content: "–"; }
.epl-mas-cuerpo { display: flex; flex-direction: column; gap: 14px; padding-top: 14px; }
.epl-eyebrow { font-size: 12.5px; font-weight: 800; color: var(--pink-deep); text-transform: uppercase; letter-spacing: .08em; }
.epl-campo { display: flex; flex-direction: column; gap: 6px; }
.epl-etq { font-size: 13px; font-weight: 800; color: var(--ink); }
.epl-etq small { font-weight: 600; color: var(--muted); margin-left: 4px; }
.epl-campo input, .epl-campo textarea, .epl-direccion {
  width: 100%; border: 1.5px solid var(--linea-fuerte); border-radius: 14px; background: #fff; padding: 10px 13px;
  font: inherit; font-size: 15px; color: var(--ink); outline: 0;
}
.epl-campo textarea { resize: vertical; line-height: 1.5; }
.epl-campo input:focus, .epl-campo textarea:focus, .epl-direccion:focus-within { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.12); }
.epl-direccion { display: flex; align-items: center; gap: 4px; padding: 0 0 0 13px; }
.epl-direccion span { font-size: 13px; color: var(--muted); white-space: nowrap; }
.epl-direccion input { border: 0 !important; box-shadow: none !important; padding-left: 0; min-width: 0; }
.epl-direccion input[readonly] { color: var(--muted); }

.epl-cantidad { display: flex; align-items: center; gap: 8px; }
.epl-cantidad button { width: 44px; height: 44px; border-radius: 14px; border: 1.5px solid var(--linea-fuerte); background: #FFFAF6; color: var(--pink-deep); cursor: pointer; display: grid; place-items: center; }
.epl-cantidad button:disabled { opacity: .35; cursor: not-allowed; }
.epl-cantidad input { width: 90px; text-align: center; font-weight: 900; font-size: 18px; }
.epl-atajos { display: flex; gap: 6px; flex-wrap: wrap; }
.epl-atajos button { height: 32px; padding: 0 12px; border-radius: 99px; border: 1.5px solid var(--linea-fuerte); background: #fff; font: inherit; font-size: 12.5px; font-weight: 800; color: var(--ink); cursor: pointer; }
.epl-atajos button.es-activo { background: var(--rubor); border-color: var(--pink-line); color: var(--pink-deep); }

.epl-opciones { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.epl-opciones label, .epl-segmento label { position: relative; cursor: pointer; }
.epl-opciones input, .epl-segmento input, .epl-switch input { position: absolute; opacity: 0; pointer-events: none; }
.epl-opciones span { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 14px; border: 1.5px solid var(--linea-fuerte); background: #fff; }
.epl-opciones strong { font-size: 14px; color: var(--ink); }
.epl-opciones small { font-size: 12px; color: var(--muted); }
.epl-opciones input:checked + span { border-color: var(--pink); background: var(--rubor); }
.epl-opciones input:focus-visible + span, .epl-segmento input:focus-visible + span { box-shadow: 0 0 0 4px rgba(230,79,85,.18); }
.epl-segmento { display: flex; padding: 4px; border-radius: 99px; background: #FFF4EE; gap: 4px; }
.epl-segmento label { flex: 1; }
.epl-segmento span { display: block; text-align: center; padding: 8px 6px; border-radius: 99px; font-size: 13px; font-weight: 800; color: var(--muted); }
.epl-segmento input:checked + span { background: #fff; color: var(--pink-deep); box-shadow: 0 6px 14px -10px rgba(176,70,70,.6); }
.epl-switch { position: relative; display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px; font-weight: 800; color: var(--ink); }
.epl-switch small { display: block; font-weight: 600; font-size: 12px; color: var(--muted); }
.epl-switch-pista { width: 42px; height: 24px; border-radius: 99px; background: #F1DDD5; position: relative; flex-shrink: 0; transition: background .2s; }
.epl-switch-pista span { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform .2s; }
.epl-switch input:checked + .epl-switch-pista { background: var(--pink); }
.epl-switch input:checked + .epl-switch-pista span { transform: translateX(18px); }
.epl-switch input:focus-visible + .epl-switch-pista { box-shadow: 0 0 0 4px rgba(230,79,85,.18); }

.epl-dias { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.epl-dias-cabeza { padding: 20px 22px; border-radius: 28px; background: linear-gradient(120deg, #FFF1EC 0%, #FFF7F3 55%, #FFEFE6 100%); border: 1px solid var(--linea); }
.epl-titulo { font-size: clamp(26px, 3vw, 36px); font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.epl-resumen { margin-top: 4px; font-size: 14px; font-weight: 700; color: var(--muted); }
.epl-resumen strong { color: var(--ink); }
.epl-faltan { color: var(--melocoton-deep); }
.epl-nota { font-size: 13px; font-weight: 700; color: var(--melocoton-deep); background: #FFF4E8; padding: 10px 14px; border-radius: 14px; }

.epl-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.epl-dia { border-radius: 22px; background: #fff; border: 1px solid var(--linea); padding: 10px; transition: border-color .2s, box-shadow .2s; }
.epl-dia.esta-abierta { border-color: var(--pink-line); box-shadow: var(--sombra); }
.epl-dia--vacio { background: linear-gradient(100deg, #FFF4F2 0%, #FFFAF8 80%); border-color: #F6D9D6; }
.epl-dia--descanso { background: linear-gradient(100deg, #FFF4F2 0%, #FFFAF8 80%); border-color: #F6D9D6; }
.epl-btn--lleno { background: var(--pink) !important; border-color: var(--pink) !important; color: #fff !important; }
.epl-btn--lleno:hover { background: var(--pink-mid) !important; }
.epl-btn--suave { background: transparent !important; }
.epl-dia-fila { display: flex; align-items: center; gap: 12px; }
.epl-dia-num {
  flex-shrink: 0; width: 54px; height: 54px; border-radius: 17px; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: #FFF2EE; color: #B03A3E; font-size: 19px; font-weight: 900; line-height: 1;
}
.epl-dia-num small { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 2px; color: inherit; opacity: .75; }
.epl-dia--vacio .epl-dia-num { background: #FFE6E6; color: var(--pink-deep); }
.epl-dia--descanso .epl-dia-num { background: #FFE6E6; color: var(--pink-deep); }
.epl-dia-cuerpo { flex: 1; min-width: 0; }
.epl-clase { display: flex; align-items: center; gap: 12px; min-width: 0; }
.epl-clase-foto { width: 88px; aspect-ratio: 16 / 10; border-radius: 13px; overflow: hidden; flex-shrink: 0; position: relative; background: linear-gradient(135deg, #FFE9DE, #FFDADA); }
.epl-clase-foto img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.epl-clase-foto--descanso { display: grid; place-items: center; color: var(--pink, #E64F55); background: radial-gradient(60px 40px at 70% 20%, #FFE4E4, transparent 70%), #FFF3F2; }
.epl-clase-txt { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.epl-clase-txt strong { font-size: 15.5px; font-weight: 800; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.epl-dia--descanso .epl-clase-txt strong, .epl-dia--vacio .epl-clase-txt strong { color: var(--pink-deep); }
.epl-dia--vacio .epl-nota-corta, .epl-dia--descanso .epl-nota-corta { font-style: italic; }
.epl-dia--vacio .epl-clase-foto--descanso, .epl-dia--descanso .epl-clase-foto--descanso { width: 64px; }
.epl-clase-txt small { display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap; font-size: 12.5px; color: var(--muted); font-weight: 700; }
.epl-clase-txt em { font-style: normal; color: var(--melocoton-deep); }
.epl-nota-corta { display: -webkit-box !important; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-weight: 600 !important; line-height: 1.45; }
.epl-vacio-txt { font-size: 13.5px; font-weight: 700; color: #A88A82; }
.epl-dia-acciones { display: flex; gap: 6px; flex-shrink: 0; }
.epl-ico { width: 36px; height: 36px; border-radius: 12px; border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--pink-deep); display: grid; place-items: center; cursor: pointer; }
.epl-ico:disabled { opacity: .3; cursor: not-allowed; }
.epl-btn {
  display: inline-flex; align-items: center; gap: 5px; height: 36px; padding: 0 13px; border-radius: 99px; cursor: pointer;
  border: 1.5px solid var(--pink-line); background: #fff; color: var(--pink-deep); font: inherit; font-size: 13px; font-weight: 800; white-space: nowrap;
}
.epl-btn:disabled { opacity: .4; cursor: not-allowed; }
.epl-btn--peligro { color: var(--pink-deep); border-color: var(--linea-fuerte); }
.epl-dia-editor { margin-top: 10px; padding: 10px 2px 2px 66px; }
.epl-dia-mas { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
.epl-mover { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 800; color: var(--muted); }
.epl-mover input { width: 64px; height: 36px; border-radius: 12px; border: 1.5px solid var(--linea-fuerte); padding: 0 8px; font: inherit; font-size: 15px; text-align: center; }
.epl-dia-mas-link { margin: 6px 0 0 66px; border: 0; background: none; padding: 0; font: inherit; font-size: 12.5px; font-weight: 800; color: var(--muted); text-decoration: underline; cursor: pointer; }

.epl-agregar {
  display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 60px; border-radius: 22px; cursor: pointer;
  border: 2px dashed var(--pink-line); background: #fff; color: var(--pink-deep); font: inherit; font-size: 16px; font-weight: 900;
}
.epl-agregar:hover { background: var(--rubor); }
.epl-agregar:disabled { opacity: .4; cursor: not-allowed; }

.epl-barra {
  position: sticky; bottom: 12px; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  padding: 12px 12px 12px 20px; border-radius: 99px; background: rgba(255,255,255,.96); border: 1px solid var(--linea-fuerte);
  box-shadow: 0 18px 40px -22px rgba(120,50,40,.55); backdrop-filter: blur(8px);
}
.epl-barra-txt { display: flex; flex-direction: column; gap: 2px; font-size: 13.5px; font-weight: 800; min-width: 0; flex: 1; }
.epl-ok { display: inline-flex; align-items: center; gap: 6px; color: var(--pink-deep); }
.epl-sucio { color: var(--melocoton-deep); }
.epl-tenue { color: var(--muted); font-weight: 700; }
.epl-error { color: var(--pink-deep); }
.epl-guardar {
  display: inline-flex; align-items: center; gap: 8px; height: 50px; padding: 0 26px; border-radius: 99px; border: 0; cursor: pointer;
  background: var(--pink); color: #fff; font: inherit; font-size: 15px; font-weight: 800; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85);
}
.epl-guardar:hover { background: var(--pink-mid); }
.epl-guardar:disabled { opacity: .7; cursor: progress; }
.epl-gira { animation: epl-gira 1s linear infinite; }
@keyframes epl-gira { to { transform: rotate(360deg); } }

.epl-borrar { align-self: flex-start; }
.epl-borrar-btn {
  display: inline-flex; align-items: center; gap: 7px; height: 42px; padding: 0 18px; border-radius: 99px; cursor: pointer;
  border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--pink-deep); font: inherit; font-size: 14px; font-weight: 800;
}

@media (max-width: 1080px) {
  .epl-grilla { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 640px) {
  .epl-bloque { padding: 16px; border-radius: 20px; }
  .epl-dia-fila { flex-wrap: wrap; }
  .epl-dia-cuerpo { flex-basis: calc(100% - 66px); }
  .epl-dia-acciones { width: 100%; justify-content: flex-end; }
  .epl-dia-editor { padding-left: 0; }
  .epl-dia-mas-link { margin-left: 0; }
  .epl-clase-foto { width: 64px; }
  .epl-barra { border-radius: 22px; padding: 12px; }
  .epl-guardar { width: 100%; justify-content: center; }
  .epl-opciones { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) { .epl-gira { animation: none; } }
`;
