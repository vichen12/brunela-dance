import Link from "next/link";
import { AlertTriangle, CreditCard, Euro, Home, ListChecks, PlayCircle, Plus, Rocket, ShoppingBag, Star } from "lucide-react";
import { AdminAviso, AdminBoton, AdminCabecera, AdminCifras, AdminGuia, AdminNueva } from "@/components/admin-ui";
import { AutoDireccion } from "@/components/auto-direccion";
import { requireAdmin } from "@/src/features/auth/guards";
import { BotonEnviar } from "@/components/boton-enviar";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { verificarPrecio, leerVerificacion } from "@/src/lib/stripe/verificar-precio";
import { createPackAction, togglePackAction } from "@/src/features/admin/packs-actions";
import { EditarPack, type ClaseElegible, type PackAdmin } from "@/components/admin-pack-drawer";

export const dynamic = "force-dynamic";

/**
 * Packs de clases.
 *
 * Un pack se vende con pago UNICO y da acceso PERMANENTE a las clases que trae,
 * sin suscripcion. Es la unica cosa del sistema, junto con las invitaciones, que
 * da acceso sin mirar el plan.
 *
 * El precio esta en /admin/precios, con la comprobacion contra Stripe.
 */

/** Un interruptor que es un formulario de una linea. */
function Toggle({ id, campo, valor, activo, inactivo, icono }: {
  id: string; campo: string; valor: boolean; activo: string; inactivo: string; icono?: React.ReactNode;
}) {
  return (
    <form action={togglePackAction} style={{ display: "inline" }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="campo" value={campo} />
      <input type="hidden" name="valor" value={(!valor).toString()} />
      <BotonEnviar pendingLabel="…" className={"pk-toggle" + (valor ? " es-on" : "")}>
        {icono}{valor ? activo : inactivo}
      </BotonEnviar>
    </form>
  );
}

type VideoFila = { id: string; title_i18n: Record<string, string>; slug: string };

export default async function AdminPacksPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? decodeURIComponent(params.error) : null;

  const supabase = await createSupabaseServerClient();

  // Todo en paralelo: encadenarlas son cuatro viajes a Fráncfort en serie.
  const [{ data: packsData }, { data: relaciones }, { data: videosData }, { data: comprasData }] =
    await Promise.all([
      supabase
        .from("packs")
        .select("id, slug, name_i18n, description_i18n, price_cents, currency, cover_image_url, display_order, is_published, show_on_landing, is_featured, stripe_price_id_test, stripe_price_id_live")
        .order("display_order"),
      supabase.from("pack_videos").select("pack_id, video_id, display_order"),
      supabase.from("videos").select("id, slug, title_i18n").eq("status", "published").order("published_at", { ascending: false }),
      supabase.from("pack_purchases").select("pack_id"),
    ]);

  const videos = (videosData ?? []) as VideoFila[];
  const tituloDe = new Map(videos.map((v) => [v.id, v.title_i18n?.es ?? v.slug]));

  const elegibles: ClaseElegible[] = videos.map((v) => ({
    id: v.id,
    titulo: v.title_i18n?.es ?? v.slug,
  }));

  const clasesPorPack = new Map<string, { id: string; titulo: string }[]>();
  for (const r of (relaciones ?? []) as { pack_id: string; video_id: string }[]) {
    // Una clase despublicada sigue en el pack pero ya no aparece en la lista de
    // videos. Se muestra igual, con el aviso, para que no desaparezca en
    // silencio de la pantalla de Brunela.
    const lista = clasesPorPack.get(r.pack_id) ?? [];
    lista.push({ id: r.video_id, titulo: tituloDe.get(r.video_id) ?? "(clase despublicada)" });
    clasesPorPack.set(r.pack_id, lista);
  }

  const comprasPorPack = ((comprasData ?? []) as { pack_id: string }[]).reduce<Record<string, number>>(
    (acc, c) => { acc[c.pack_id] = (acc[c.pack_id] ?? 0) + 1; return acc; },
    {}
  );

  // ⚠️ El Omit lista TODO lo que se agrega abajo. Si faltara uno, el `as` le
  //    afirmaria a tsc que el dato ya viene de la base y no habria error: el
  //    aviso quedaria en undefined y simplemente no se dibujaria nunca. Un cast
  //    de mas es una comprobacion de menos.
  type PackCrudo = Omit<PackAdmin, "clases" | "compras" | "avisoTest" | "avisoLive">;

  // Los avisos se resuelven ACA, en el servidor, y bajan como objeto plano.
  // Todos en paralelo: en serie serian dos viajes a Stripe por cada pack.
  // El modo activo sale de la clave, igual que en el checkout.
  const modoEsLive = /^(?:sk|rk)_live_/.test((process.env.STRIPE_SECRET_KEY ?? "").trim());

  const packs: PackAdmin[] = await Promise.all(
    ((packsData ?? []) as PackCrudo[]).map(async (p) => {
      const [test, live] = await Promise.all([
        p.stripe_price_id_test ? verificarPrecio(p.stripe_price_id_test, "test") : null,
        p.stripe_price_id_live ? verificarPrecio(p.stripe_price_id_live, "live") : null,
      ]);
      return {
        ...p,
        clases: clasesPorPack.get(p.id) ?? [],
        compras: comprasPorPack[p.id] ?? 0,
        avisoTest: test ? leerVerificacion(test, p.price_cents, p.currency) : null,
        avisoLive: live ? leerVerificacion(live, p.price_cents, p.currency) : null,
      };
    })
  );

  const abrirNueva = params.nueva === "1";
  const modo = modoEsLive ? "producción" : "prueba";
  const publicados = packs.filter((p) => p.is_published).length;
  const enPortada = packs.filter((p) => p.show_on_landing).length;
  const vendidos = packs.reduce((a, p) => a + p.compras, 0);
  const euros = (c: number) => (c / 100).toLocaleString("es-ES", { minimumFractionDigits: c % 100 === 0 ? 0 : 2 });

  const formNuevo = (
    <form action={createPackAction} className="pk-nuevo">
      <label className="pk-campo">
        <span className="pk-etq">Nombre del pack</span>
        <input name="nombreEs" required placeholder="Pack Iniciación" />
      </label>
      <AutoDireccion desde="nombreEs" />
      <label className="pk-campo">
        <span className="pk-etq">Dirección <small>se completa sola</small></span>
        <input name="slug" required placeholder="pack-iniciacion" />
      </label>
      <label className="pk-campo">
        <span className="pk-etq">Precio</span>
        <span className="pk-precio">
          {/* Solo un numero positivo con hasta dos decimales, con punto o coma:
              "abc" o "-5" no llegan a la accion. */}
          <input name="precio" required inputMode="decimal" pattern={"\\d+([.,]\\d{1,2})?"} title="Un importe como 24,90 (sin signo menos)" placeholder="24,90" />
          <span aria-hidden="true">€</span>
        </span>
      </label>
      <BotonEnviar className="ad-btn ad-btn--lleno pk-crear" pendingLabel="Creando…">
        <Plus size={16} strokeWidth={2.2} aria-hidden="true" /> Crear pack
      </BotonEnviar>
      <p className="pk-nota">Nace sin publicar. Después le elegís las clases y le cargás el identificador de Stripe en <Link href="/admin/precios">Precios</Link>.</p>
    </form>
  );

  return (
    <main className="pk">
      <style>{CSS}</style>

      <AdminCabecera
        eyebrow="Ventas"
        titulo="Packs de clases"
        lede={<>Un pack se paga <strong>una sola vez</strong> y da acceso a sus clases <strong>para siempre</strong>, sin suscripción. Para quien no quiere un plan mensual.</>}
        acciones={<>
          <AdminBoton href="/admin/packs?nueva=1#nueva" lleno><Plus size={16} strokeWidth={2.2} aria-hidden="true" /> Nuevo pack</AdminBoton>
          <AdminBoton href="/admin/precios"><Euro size={15} strokeWidth={2} aria-hidden="true" /> Precios</AdminBoton>
        </>}
      />

      <AdminAviso mensaje={error} tono="error" />

      {packs.length === 0 ? (
        <>
          <AdminGuia
            rotuloEjemplo="Así se ve en la portada"
            ejemplo={
              <div className="ad-guia-flota pk-ejemplo">
                <div className="pk-ejemplo-portada">
                  <span className="pk-ejemplo-clases">5 clases</span>
                </div>
                <div className="pk-ejemplo-cuerpo">
                  <p className="pk-ejemplo-titulo">Pack Iniciación</p>
                  <p className="pk-ejemplo-desc">Las bases de la barra, en cinco clases para hacer a tu ritmo.</p>
                  <div className="pk-ejemplo-pie">
                    <span className="pk-ejemplo-precio">24,90 €<small>pago único · para siempre</small></span>
                    <span className="pk-ejemplo-btn">Comprar</span>
                  </div>
                </div>
              </div>
            }
            eyebrow="Tu primer pack"
            titulo="Listo para vender en tres pasos."
            pasos={[
              { icono: <Plus size={18} strokeWidth={2.2} />, titulo: "Creá el pack", texto: "Nombre y precio. Nace sin publicar, así que nadie lo ve mientras lo armás." },
              { icono: <ListChecks size={18} strokeWidth={2} />, titulo: "Elegí las clases", texto: "Desde «Editar y clases». Quien lo compra las ve para siempre, aunque no tenga plan." },
              { icono: <CreditCard size={18} strokeWidth={2} />, titulo: "Conectalo a Stripe y publicalo", texto: "En Precios pegás su identificador de Stripe. Sin eso no se puede publicar: la alumna no podría pagar." },
            ]}
            cta={<AdminBoton href="/admin/packs?nueva=1#nueva" lleno><Plus size={16} strokeWidth={2.2} aria-hidden="true" /> Crear el primero</AdminBoton>}
          />
          <AdminNueva abierto={abrirNueva} titulo="Crear un pack" sub="Nombre y precio. Las clases y Stripe van después.">
            {formNuevo}
          </AdminNueva>
        </>
      ) : (
        <>
          <AdminCifras items={[
            { label: "Packs", value: packs.length, sub: "creados" },
            { label: "Publicados", value: publicados, sub: "a la venta" },
            { label: "En la portada", value: enPortada, sub: "los ve quien no tiene cuenta" },
            { label: "Vendidos", value: vendidos, sub: "en total" },
          ]} />

          <AdminNueva abierto={abrirNueva} titulo="Crear un pack" sub="Nombre y precio. Las clases y Stripe van después.">
            {formNuevo}
          </AdminNueva>

          <ul className="pk-grilla">
            {packs.map((p) => {
              // ⚠️ Se mira el price del MODO ACTIVO, no "alguno de los dos".
              //    Con solo el de prueba, en produccion la alumna ve el pack y
              //    al comprarlo recibe un error.
              const tieneStripe = Boolean(modoEsLive ? p.stripe_price_id_live : p.stripe_price_id_test);
              const aviso = modoEsLive ? p.avisoLive : p.avisoTest;
              return (
                <li key={p.id} className={"pk-card" + (p.is_published ? "" : " es-borrador")}>
                  <div className="pk-portada">
                    {p.cover_image_url && <img src={p.cover_image_url} alt="" />}
                    <span className="pk-precio-grande">{euros(p.price_cents)} <small>{p.currency.toUpperCase()}</small></span>
                    {p.is_featured && <span className="pk-dest"><Star size={12} strokeWidth={2.4} fill="currentColor" aria-hidden="true" /> Destacado</span>}
                  </div>
                  <div className="pk-cuerpo">
                    <div className="pk-linea">
                      <span className={"pk-estado" + (p.is_published ? " es-pub" : "")}><span className="pk-punto" aria-hidden="true" />{p.is_published ? "A la venta" : "Borrador"}</span>
                      {p.show_on_landing && <span className="pk-tag">En la portada</span>}
                    </div>
                    <h2 className="pk-titulo">{p.name_i18n?.es ?? p.slug}</h2>
                    <ul className="pk-datos">
                      <li><PlayCircle size={14} strokeWidth={2} aria-hidden="true" /> {p.clases.length === 1 ? "1 clase" : `${p.clases.length} clases`}</li>
                      <li><ShoppingBag size={14} strokeWidth={2} aria-hidden="true" /> {p.compras === 1 ? "1 vendido" : `${p.compras} vendidos`}</li>
                    </ul>

                    <p className={"pk-stripe " + (!tieneStripe ? (p.is_published ? "es-mal" : "es-falta") : aviso?.tono === "ok" ? "es-ok" : aviso?.tono === "aviso" ? "es-mal" : "es-falta")}>
                      {!tieneStripe ? (
                        <><AlertTriangle size={14} strokeWidth={2.2} aria-hidden="true" />
                          {p.is_published
                            ? `Publicado sin identificador de ${modo}: no se le muestra a nadie`
                            : `Falta el identificador de ${modo}`}
                          <Link href="/admin/precios">Cargarlo</Link></>
                      ) : (
                        <><CreditCard size={14} strokeWidth={2.2} aria-hidden="true" /> {(aviso?.texto ?? `Stripe (${modo}) cargado`).replace(/^[s✓⚠️]+/u, "")}</>
                      )}
                    </p>
                    {p.clases.length === 0 && (
                      <p className="pk-stripe es-falta"><AlertTriangle size={14} strokeWidth={2.2} aria-hidden="true" /> Todavía no tiene clases</p>
                    )}

                    <div className="pk-pie">
                      <EditarPack pack={p} elegibles={elegibles} />
                      <Toggle id={p.id} campo="is_published" valor={p.is_published} activo="A la venta" inactivo="Publicar" icono={<Rocket size={14} strokeWidth={2} aria-hidden="true" />} />
                      <Toggle id={p.id} campo="show_on_landing" valor={p.show_on_landing} activo="En portada" inactivo="Mostrar en portada" icono={<Home size={14} strokeWidth={2} aria-hidden="true" />} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}

const CSS = `
.pk { display: flex; flex-direction: column; }
.pk-nuevo { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) 160px auto; gap: 14px 16px; align-items: end; padding-top: 18px; }
.pk-campo { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.pk-etq { font-size: 12.5px; font-weight: 800; color: var(--ink); }
.pk-etq small { margin-left: 6px; font-size: 11.5px; font-weight: 800; color: var(--muted); background: var(--rubor); padding: 2px 9px; border-radius: 99px; }
.pk-campo input { border-radius: 16px; border: 1.5px solid var(--linea-fuerte); padding: 0.75rem 0.95rem; font-size: 14px; background: #fff; }
.pk-campo input:focus { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.1); }
.pk-campo input:invalid:not(:placeholder-shown) { border-color: var(--pink-line); background: var(--pink-wash); }
.pk-precio { position: relative; display: block; }
.pk-precio input { width: 100%; padding-right: 2rem; font-weight: 800; }
.pk-precio span { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); font-weight: 800; color: var(--pink-deep); }
.pk-crear { height: 48px; }
.pk-nota { grid-column: 1 / -1; font-size: 13px; color: var(--muted); }
.pk-nota a { color: var(--pink-deep); font-weight: 800; }

.pk-ejemplo-portada { position: relative; aspect-ratio: 16 / 8; background: radial-gradient(180px 120px at 85% 10%, rgba(255,205,185,.95), transparent 70%), linear-gradient(140deg, #FFF1EC 0%, #FDE3E0 55%, #FFC9B8 120%); }
.pk-ejemplo-clases { position: absolute; left: 14px; top: 14px; font-size: 12px; font-weight: 800; color: var(--pink-deep); background: #fff; padding: 4px 11px; border-radius: 99px; }
.pk-ejemplo-cuerpo { padding: 16px 18px 18px; }
.pk-ejemplo-titulo { font-weight: 900; font-size: 20px; letter-spacing: -0.02em; color: var(--ink); }
.pk-ejemplo-desc { margin-top: 4px; font-size: 13px; line-height: 1.5; color: #6E5550; }
.pk-ejemplo-pie { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-top: 14px; }
.pk-ejemplo-precio { display: flex; flex-direction: column; font-weight: 900; font-size: 24px; letter-spacing: -0.02em; color: var(--ink); }
.pk-ejemplo-precio small { font-size: 11.5px; font-weight: 700; letter-spacing: 0; color: var(--muted); }
.pk-ejemplo-btn { padding: 9px 18px; border-radius: 99px; background: var(--pink); color: #fff; font-size: 13px; font-weight: 800; box-shadow: 0 10px 20px -10px rgba(230,79,85,0.85); }

.pk-grilla { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 18px; }
.pk-card {
  display: flex; flex-direction: column; border: 1px solid var(--linea); border-radius: 28px; background: #fff; overflow: hidden;
  box-shadow: var(--sombra);
  transition: transform .35s var(--curva), box-shadow .35s, border-color .25s;
}
.pk-card:hover { transform: translateY(-3px); border-color: var(--linea-fuerte); box-shadow: var(--sombra-alta); }
.pk-portada {
  position: relative; aspect-ratio: 16 / 7; overflow: hidden; margin: 10px 10px 0; border-radius: 20px;
  background: radial-gradient(180px 120px at 85% 10%, rgba(255,205,185,.95), transparent 70%), linear-gradient(140deg, #FFF1EC 0%, #FDE3E0 55%, #FFD3C4 120%);
}
.pk-portada img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .8s var(--curva); }
.pk-card:hover .pk-portada img { transform: scale(1.05); }
.pk-card.es-borrador .pk-portada { filter: saturate(0.55); }
.pk-precio-grande {
  position: absolute; left: 12px; bottom: 12px; padding: 6px 14px; border-radius: 99px; background: rgba(255,255,255,0.94);
  font-weight: 900; font-size: 19px; letter-spacing: -0.02em; color: var(--ink);
}
.pk-precio-grande small { font-size: 11.5px; font-weight: 800; color: var(--pink-deep); letter-spacing: 0; }
.pk-dest { position: absolute; right: 12px; top: 12px; display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 800; color: var(--melocoton-deep); padding: 5px 11px; border-radius: 99px; background: #fff; }
.pk-cuerpo { display: flex; flex-direction: column; flex: 1; padding: 16px 20px 20px; }
.pk-linea { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.pk-estado { display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px 5px 10px; border-radius: 99px; font-size: 12.5px; font-weight: 800; color: var(--melocoton-deep); background: #FFEBDF; }
.pk-estado.es-pub { color: var(--salvia-deep); background: var(--salvia); }
.pk-punto { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.pk-tag { font-size: 12.5px; font-weight: 800; color: #A0472F; padding: 5px 12px; border-radius: 99px; background: #FFF0EA; }
.pk-titulo { font-weight: 900; font-size: 21px; line-height: 1.2; letter-spacing: -0.02em; color: var(--ink); }
.pk-datos { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.pk-datos li { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px 5px 9px; border-radius: 99px; font-size: 13px; font-weight: 700; color: #6E5550; background: var(--crema); border: 1px solid var(--linea); }
.pk-datos svg { color: var(--pink); }
.pk-stripe { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin-top: 10px; padding: 9px 13px; border-radius: 16px; font-size: 13px; font-weight: 700; line-height: 1.45; }
.pk-stripe svg { flex-shrink: 0; }
.pk-stripe a { margin-left: auto; font-weight: 800; color: inherit; background: #fff; padding: 3px 11px; border-radius: 99px; text-decoration: none; }
.pk-stripe.es-ok { background: #FFF4E8; color: var(--salvia-deep); }
.pk-stripe.es-falta { background: #FFF4E8; color: #8A4A2E; }
.pk-stripe.es-mal { background: var(--pink-wash); color: var(--pink-deep); }
.pk-pie { margin-top: auto; padding-top: 16px; display: flex; flex-wrap: wrap; gap: 8px; }
.pk-pie form { display: contents; }
.pk .ad-editar, .pk-toggle {
  display: inline-flex; align-items: center; gap: 7px; height: 42px; padding: 0 16px; border-radius: 99px; cursor: pointer;
  border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); font: inherit; font-size: 13.5px; font-weight: 800; white-space: nowrap;
  transition: border-color .2s, background .2s, color .2s, transform .3s var(--curva);
}
.pk .ad-editar svg { color: var(--pink-deep); }
.pk .ad-editar:hover, .pk-toggle:hover { background: var(--rubor); border-color: var(--pink-line); color: var(--ink); transform: translateY(-2px); }
.pk-toggle.es-on { border-color: #CFE3C9; background: var(--salvia); color: var(--salvia-deep); }
.pk-toggle.es-on:hover { background: #DCEBD6; color: var(--salvia-deep); border-color: #BFD9B8; }

@media (max-width: 820px) {
  .pk-nuevo { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) { .pk-card:hover { transform: none; } }
`;
