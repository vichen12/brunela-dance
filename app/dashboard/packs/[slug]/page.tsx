import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Clock, Lock, Play } from "lucide-react";
import { requireUser } from "@/src/features/auth/guards";
import { getClasesDelPack, getPacksTienda, precio } from "@/src/features/studio/packs";
import { ComprarPack } from "@/components/comprar-pack";
import { CSS_PACKS } from "../estilos";

export const dynamic = "force-dynamic";

/**
 * La pagina de un pack: foto, descripcion, precio, que clases trae y el boton
 * de compra. Si ya lo compro, las clases enlazan al reproductor (RLS decide).
 */
export default async function PackPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireUser();
  const { slug } = await params;
  const pack = (await getPacksTienda()).find((p) => p.slug === slug);
  if (!pack) notFound();
  const clases = await getClasesDelPack(pack.id);
  const minutos = clases.reduce((a, c) => a + c.minutos, 0);

  return (
    <main>
      <style>{CSS_PACKS}</style>
      <section className="pk-shell">
        <Link href={"/dashboard/packs" as never} className="pk-volver"><ArrowLeft size={15} strokeWidth={2.4} aria-hidden="true" /> Packs</Link>

        <header className="pk-hero">
          <div className="pk-hero-foto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {pack.portada && <img src={pack.portada} alt="" />}
          </div>
          <div className="pk-hero-txt">
            <span className="pk-eyebrow">Pack de clases · pago único</span>
            <h1 className="pk-titulo">{pack.nombre}</h1>
            {/* La primera linea como bajada; el texto entero va en "De que se trata". */}
            {pack.descripcion && <p className="pk-lede">{pack.descripcion.split(/\n+/)[0]}</p>}
            <div className="pk-datos">
              <span className="pk-dato">{clases.length} {clases.length === 1 ? "clase" : "clases"}</span>
              {minutos > 0 && <span className="pk-dato">{minutos} min en total</span>}
              <span className="pk-dato">Acceso para siempre</span>
            </div>
            <div className="pk-compra">
              {pack.compradoEl ? (
                <span className="pk-tuyo"><Check size={17} strokeWidth={2.8} aria-hidden="true" /> Ya es tuyo</span>
              ) : (
                <>
                  <span className="pk-precio">{precio(pack.precioCentimos, pack.moneda)}</span>
                  <ComprarPack slug={pack.slug} etiqueta="Comprar el pack" />
                </>
              )}
            </div>
            {!pack.compradoEl && <p className="pk-nota">Pagás una sola vez, sin suscripción. Las clases quedan en tu biblioteca.</p>}
          </div>
        </header>

        {pack.descripcion && (
          <section className="pk-sobre" aria-labelledby="pk-sobre">
            <h2 id="pk-sobre" className="pk-h2">De qué se trata</h2>
            <div className="pk-sobre-txt">
              {pack.descripcion.split(/\n+/).filter(Boolean).map((parrafo, i) => <p key={i}>{parrafo}</p>)}
            </div>
            <ul className="pk-sobre-datos">
              <li><b>{clases.length}</b> {clases.length === 1 ? "clase" : "clases"} en orden, de la primera a la última</li>
              <li><b>{minutos}</b> minutos de trabajo en total</li>
              <li>Pagás <b>una sola vez</b> y quedan en tu biblioteca para siempre</li>
            </ul>
          </section>
        )}

        <h2 className="pk-h2">Qué trae</h2>
        <ul className="pk-clases">
          {clases.map((c, i) => {
            const cuerpo = (
              <>
                <span className="pk-clase-foto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.portada && <img src={c.portada} alt="" />}
                  <span className="pk-clase-num">{i + 1}</span>
                </span>
                <span className="pk-clase-txt">
                  <span className="pk-clase-titulo">{c.titulo}</span>
                  {c.descripcion && <span className="pk-clase-desc">{c.descripcion}</span>}
                  <span className="pk-clase-meta">
                    <Clock size={11} strokeWidth={2.4} aria-hidden="true" style={{ display: "inline", verticalAlign: "-1px" }} /> {c.minutos} min
                    {" · "}
                    {pack.compradoEl
                      ? <span className="pk-candado"><Play size={11} strokeWidth={2.6} aria-hidden="true" style={{ display: "inline", verticalAlign: "-1px" }} /> Ver ahora</span>
                      : <span className="pk-candado"><Lock size={11} strokeWidth={2.6} aria-hidden="true" style={{ display: "inline", verticalAlign: "-1px" }} /> Con el pack</span>}
                  </span>
                </span>
              </>
            );
            return (
              <li key={c.slug}>
                {pack.compradoEl
                  ? <Link href={`/dashboard/library/${c.slug}` as never} className="pk-clase">{cuerpo}</Link>
                  : <div className="pk-clase">{cuerpo}</div>}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
