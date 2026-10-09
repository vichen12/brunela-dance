import Link from "next/link";
import { ArrowRight, Check, Lock, Package } from "lucide-react";
import { requireUser } from "@/src/features/auth/guards";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { getPacksTienda, precio } from "@/src/features/studio/packs";
import { AdminCabecera, AdminGuia, AdminBoton } from "@/components/admin-ui";
import { CSS_PACKS } from "./estilos";

export const dynamic = "force-dynamic";

/**
 * La tienda de packs: clases sueltas con pago unico y acceso para siempre.
 * Antes los packs solo aparecian al fondo de Mi plan, y nadie los encontraba.
 */
export default async function PacksPage() {
  const { user } = await requireUser();
  const profile = await getCurrentProfile(user.id);
  // Su plan de HOY decide el candado de los packs "solo para ...". La que
  // manda de verdad es crearCheckoutDePack; esto es para no ofrecer lo que no
  // le vamos a cobrar.
  const packs = await getPacksTienda(profile?.membership_tier ?? "none");

  return (
    <main>
      <style>{CSS_PACKS}</style>
      <section className="pk-shell">
        <AdminCabecera
          eyebrow="Packs de clases"
          titulo="Packs de clases"
          lede="Un grupo de clases sobre un tema, con pago único y para siempre. No necesitás suscripción: las compraste, son tuyas."
        />
        {packs.length === 0 ? (
          <AdminGuia
            rotuloEjemplo="Así se ve un pack"
            ejemplo={<div className="ad-guia-flota" style={{ padding: 24, borderRadius: 24, background: "#fff" }}><b>Pack Pies perfectos</b><br />5 clases · 29 €</div>}
            eyebrow="Todavía no hay packs a la venta"
            titulo="Muy pronto."
            pasos={[
              { icono: <Package size={18} strokeWidth={2} />, titulo: "Elegís un pack", texto: "Cada uno junta clases sobre un tema: pies, giros, flexibilidad." },
              { icono: <Check size={18} strokeWidth={2.4} />, titulo: "Pagás una sola vez", texto: "Sin suscripción. Las clases quedan tuyas para siempre." },
            ]}
            cta={<AdminBoton href="/dashboard/library" lleno>Mientras tanto, ver clases <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" /></AdminBoton>}
          />
        ) : (
          <ul className="pk-grilla">
            {packs.map((p) => (
              <li key={p.slug}>
                <Link href={`/dashboard/packs/${p.slug}` as never} className="pk-card">
                  <div className="pk-portada">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.portada && <img src={p.portada} alt="" />}
                    {p.compradoEl ? <span className="pk-cinta es-tuyo">Ya es tuyo</span>
                      : !p.puedeComprar ? <span className="pk-cinta es-candado"><Lock size={12} strokeWidth={2.6} aria-hidden="true" /> Con otro plan</span>
                      : p.destacado ? <span className="pk-cinta">Destacado</span> : null}
                    <span className="pk-cuantas">{p.clases} {p.clases === 1 ? "clase" : "clases"}</span>
                  </div>
                  <div className="pk-cuerpo">
                    <p className="pk-nombre">{p.nombre}</p>
                    {p.soloPara && !p.compradoEl && <span className="pk-solo">{!p.puedeComprar && <Lock size={12} strokeWidth={2.6} aria-hidden="true" />}{p.soloPara}</span>}
                    {p.descripcion && <p className="pk-desc">{p.descripcion}</p>}
                    <div className="pk-pie">
                      {p.compradoEl ? <span /> : <span className="pk-precio">{precio(p.precioCentimos, p.moneda)}<small>pago único</small></span>}
                      <span className={"pk-ver" + (p.compradoEl ? " es-suave" : !p.puedeComprar ? " es-plan" : "")}>
                        {p.compradoEl ? "Ver mis clases" : "Ver el pack"} <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
