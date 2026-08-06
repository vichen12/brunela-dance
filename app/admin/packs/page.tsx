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

const inp: React.CSSProperties = {
  width: "100%", borderRadius: 10, border: "1px solid #e7e5e4",
  background: "#fff", color: "#1c1917", padding: "9px 13px",
  fontSize: 13, outline: "none", fontFamily: "inherit",
};

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", color: "#78716c", textTransform: "uppercase", marginBottom: 5 }}>
      {children}
    </span>
  );
}

/** Un interruptor que es un formulario de una linea. */
function Toggle({ id, campo, valor, activo, inactivo }: {
  id: string; campo: string; valor: boolean; activo: string; inactivo: string;
}) {
  return (
    <form action={togglePackAction} style={{ display: "inline" }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="campo" value={campo} />
      <input type="hidden" name="valor" value={(!valor).toString()} />
      <BotonEnviar pendingLabel="…" style={{
        padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
        border: `1px solid ${valor ? "#bbf7d0" : "#f0eeec"}`,
        background: valor ? "#f0fdf4" : "#fff",
        color: valor ? "#166534" : "#57534e",
        fontSize: 11, fontWeight: 700,
      }}>{valor ? activo : inactivo}</BotonEnviar>
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

  return (
    <main style={{ fontFamily: "inherit" }}>
      <header className="hero-stage">
        <p className="eyebrow">Packs</p>
        <h1 className="display" style={{ fontSize: 34, marginTop: 6 }}>Packs de clases</h1>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", marginTop: 8, maxWidth: 620, lineHeight: 1.6 }}>
          Un pack se paga <strong>una sola vez</strong> y da acceso a esas clases
          <strong> para siempre</strong>, sin suscripción. Sirve para quien no
          quiere un plan mensual.
        </p>
      </header>

      <section style={{ maxWidth: 980, margin: "0 auto", padding: "26px 28px", display: "flex", flexDirection: "column", gap: 18 }}>

        {error && (
          <div style={{
            borderRadius: 14, padding: "11px 16px", fontSize: 13, fontWeight: 600,
            background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", lineHeight: 1.5,
          }}>{error}</div>
        )}

        <form action={createPackAction} style={{
          borderRadius: 22, border: "1.5px solid var(--pink-line)", background: "#fff",
          padding: "22px 24px", display: "grid", gridTemplateColumns: "1.4fr 1fr 120px auto",
          gap: 14, alignItems: "end",
        }}>
          <label>
            <Lbl>Nombre del pack</Lbl>
            <input style={inp} name="nombreEs" required placeholder="Pack Iniciación" />
          </label>
          <AutoDireccion desde="nombreEs" />
          <label>
            <Lbl>Dirección</Lbl>
            <input style={inp} name="slug" required placeholder="pack-iniciacion" />
          </label>
          <label>
            <Lbl>Precio (€)</Lbl>
            <input style={inp} name="precio" required inputMode="decimal" placeholder="24,90" />
          </label>
          <BotonEnviar pendingLabel="Creando…" style={{
            background: "linear-gradient(135deg, var(--pink), var(--pink-mid))",
            color: "#fff", border: "none", borderRadius: 99, padding: "10px 22px",
            fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer", whiteSpace: "nowrap",
          }}>CREAR PACK</BotonEnviar>
        </form>

        {packs.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "var(--ink-soft)", padding: "8px 2px" }}>
            Todavía no hay packs. Creá el primero arriba: después le agregás las
            clases y le cargás el identificador de Stripe en Precios.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {packs.map((p) => (
              <div key={p.id} style={{
                borderRadius: 18, border: "1px solid var(--pink-line)", background: "#fff",
                padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
              }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <p style={{ fontSize: 14.5, fontWeight: 800, color: "#1c1917" }}>
                    {p.name_i18n?.es ?? p.slug}
                  </p>
                  <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#a8a29e", flexWrap: "wrap", marginTop: 4 }}>
                    <span style={{ fontWeight: 700, color: "#1c1917" }}>
                      {(p.price_cents / 100).toLocaleString("es-ES", { minimumFractionDigits: p.price_cents % 100 === 0 ? 0 : 2 })} {p.currency.toUpperCase()}
                    </span>
                    <span>{p.clases.length === 1 ? "1 clase" : `${p.clases.length} clases`}</span>
                    {p.compras > 0 && (
                      <span style={{ color: "var(--pink-mid)", fontWeight: 600 }}>
                        {p.compras === 1 ? "1 vendido" : `${p.compras} vendidos`}
                      </span>
                    )}
                    {/* ⚠️ Se mira el price del MODO ACTIVO, no "alguno de los
                        dos". Con solo el de prueba, en produccion la alumna ve
                        el pack y al comprarlo recibe un error. */}
                    {!(modoEsLive ? p.stripe_price_id_live : p.stripe_price_id_test) && (
                      <span style={{ color: p.is_published ? "#991b1b" : "#92400e", fontWeight: 700 }}>
                        {p.is_published
                          ? `⚠️ publicado y SIN identificador de ${modoEsLive ? "producción" : "prueba"}: no se le muestra a nadie`
                          : `sin identificador de ${modoEsLive ? "producción" : "prueba"}`}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                  <Toggle id={p.id} campo="is_published" valor={p.is_published} activo="Publicado" inactivo="Publicar" />
                  <Toggle id={p.id} campo="show_on_landing" valor={p.show_on_landing} activo="En la portada" inactivo="Mostrar en portada" />
                  <EditarPack pack={p} elegibles={elegibles} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
