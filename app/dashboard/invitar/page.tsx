import { Gift, Heart, MessageCircle, Send, Sparkles, UserPlus } from "lucide-react";
import { requireUser } from "@/src/features/auth/guards";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { getAppUrl } from "@/src/lib/env";
import { leerMisReferidas, obtenerMiCodigo } from "@/src/features/referidos/servidor";
import { enlaceDeInvitacion } from "@/src/features/referidos/reglas";
import { CopiarEnlace } from "@/components/copiar-enlace";

export const dynamic = "force-dynamic";

/**
 * "Invitá a una amiga" (programa de referidos, 20261026_4_referidos.sql).
 *
 * Su enlace, como compartirlo y que amigas ya se sumaron. La regla del premio
 * (un mes gratis cuando la amiga paga por primera vez) vive en
 * src/features/referidos/servidor.ts. Con service_role: el codigo se crea la
 * primera vez que entra, y la alumna no tiene permiso de escribir esa tabla.
 */
export default async function InvitarPage() {
  const { user } = await requireUser();
  const profile = await getCurrentProfile(user.id);
  const db = createSupabaseAdminClient();
  const [codigo, referidas] = await Promise.all([
    obtenerMiCodigo(db, user.id, profile?.full_name ?? null),
    leerMisReferidas(db, user.id),
  ]);
  const enlace = codigo ? enlaceDeInvitacion(getAppUrl(), codigo) : null;
  const ganados = (referidas ?? []).filter((r) => r.estado === "otorgado").length;
  const mensajeWhatsApp = enlace
    ? `¡Hola! Entreno con Brunela en su estudio online de ballet y me encanta. Te dejo mi enlace para que lo pruebes: ${enlace}`
    : "";

  return (
    <main className="inv">
      <style>{CSS}</style>
      <section className="inv-hero">
        <span className="inv-ico" aria-hidden="true"><Gift size={28} strokeWidth={1.9} /></span>
        <p className="inv-eyebrow">Invitá a una amiga</p>
        <h1 className="inv-titulo">Bailar acompañada <em>es mejor.</em></h1>
        <p className="inv-lede">
          Compartí tu enlace. Cuando una amiga se suma al estudio y paga su primer mes, <strong>vos ganás un mes gratis</strong>.
          Sin límite: un mes por cada amiga.
        </p>
      </section>

      {!enlace ? (
        <p className="inv-aviso">El programa de invitaciones todavía no está activo. Volvé a mirar en unos días.</p>
      ) : (
        <>
          <section className="inv-caja">
            <p className="inv-caja-titulo">Tu enlace</p>
            <CopiarEnlace enlace={enlace} />
            <div className="inv-compartir">
              <a className="inv-btn inv-btn--wa" href={`https://wa.me/?text=${encodeURIComponent(mensajeWhatsApp)}`} target="_blank" rel="noreferrer">
                <MessageCircle size={16} strokeWidth={2.2} aria-hidden="true" /> Mandarlo por WhatsApp
              </a>
              <a className="inv-btn" href={`mailto:?subject=${encodeURIComponent("Te invito al estudio de Brunela")}&body=${encodeURIComponent(mensajeWhatsApp)}`}>
                <Send size={16} strokeWidth={2.2} aria-hidden="true" /> Por mail
              </a>
            </div>
          </section>

          <ol className="inv-pasos">
            <li><span><UserPlus size={18} strokeWidth={2} aria-hidden="true" /></span><strong>Tu amiga entra con tu enlace</strong><small>y se crea su cuenta.</small></li>
            <li><span><Sparkles size={18} strokeWidth={2} aria-hidden="true" /></span><strong>Empieza su plan</strong><small>con su prueba gratis, como todas.</small></li>
            <li><span><Heart size={18} strokeWidth={0} fill="currentColor" aria-hidden="true" /></span><strong>Cuando paga su primer mes</strong><small>a vos se te descuenta un mes entero de tu próximo cobro.</small></li>
          </ol>

          <section className="inv-caja">
            <p className="inv-caja-titulo">
              Tus amigas <span>{(referidas ?? []).length}</span>
              {ganados > 0 && <em className="inv-ganados">{ganados === 1 ? "1 mes gratis ganado" : `${ganados} meses gratis ganados`}</em>}
            </p>
            {(referidas ?? []).length === 0 ? (
              <p className="inv-vacio">Todavía no se sumó nadie con tu enlace. ¡Mandáselo a quien quieras!</p>
            ) : (
              <ul className="inv-lista">
                {(referidas ?? []).map((r, i) => (
                  <li key={i}>
                    <span className="inv-ini">{r.nombre[0]?.toUpperCase()}</span>
                    <span className="inv-quien"><strong>{r.nombre}</strong><small>se sumó el {new Date(r.desde).toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "Europe/Madrid" })}</small></span>
                    <span className={"inv-estado inv-estado--" + r.estado}>
                      {r.estado === "otorgado" ? "Ganaste 1 mes gratis" : "Esperando su primer pago"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}

const CSS = `
.inv { max-width: 860px; margin: 0 auto; padding: clamp(20px, 3vw, 40px) clamp(16px, 3vw, 32px) 80px; display: flex; flex-direction: column; gap: 16px; }
.inv-hero { position: relative; overflow: hidden; padding: clamp(26px, 4vw, 44px); border-radius: 32px; background: linear-gradient(130deg, #FFE9E4 0%, #FFF6F2 60%, #FFEFE6 100%); border: 1px solid var(--linea); }
.inv-hero::after { content: ""; position: absolute; width: 260px; height: 260px; right: -70px; top: -110px; border-radius: 50%; background: radial-gradient(circle, rgba(255,190,170,.6), transparent 70%); }
.inv-ico { position: relative; z-index: 1; width: 58px; height: 58px; border-radius: 20px; display: grid; place-items: center; background: var(--pink); color: #fff; box-shadow: 0 16px 28px -14px rgba(230,79,85,.9); margin-bottom: 14px; }
.inv-eyebrow { position: relative; margin: 0 0 6px; font-size: 12.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--pink-deep); }
.inv-titulo { position: relative; margin: 0; font-size: clamp(2rem, 4.4vw, 3rem); line-height: 1.08; color: #1E1418; }
.inv-titulo em { font-style: italic; color: var(--pink); }
.inv-lede { position: relative; margin: 14px 0 0; max-width: 54ch; font-size: 16px; line-height: 1.7; color: var(--muted); }
.inv-lede strong { color: var(--ink); }
.inv-aviso { margin: 0; padding: 16px 18px; border-radius: 18px; background: #FFF4E8; color: var(--melocoton-deep); font-weight: 700; }
.inv-caja { padding: 20px; border-radius: 26px; background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra); display: flex; flex-direction: column; gap: 14px; }
.inv-caja-titulo { margin: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 15px; font-weight: 900; color: var(--ink); }
.inv-caja-titulo span { padding: 2px 9px; border-radius: 99px; background: var(--rubor); font-size: 12px; color: var(--pink-deep); }
.inv-ganados { margin-left: auto; font-style: normal; font-size: 12.5px; font-weight: 800; padding: 4px 11px; border-radius: 99px; background: var(--pink); color: #fff; }
.inv-enlace { display: flex; gap: 8px; }
.inv-enlace input { flex: 1; min-width: 0; height: 50px; padding: 0 16px; border-radius: 16px; border: 1.5px solid var(--linea-fuerte); background: #FFFAF8; font: inherit; font-size: 15px; font-weight: 700; color: var(--pink-deep); outline: none; }
.inv-enlace button { display: inline-flex; align-items: center; gap: 7px; height: 50px; padding: 0 20px; border: 0; border-radius: 16px; cursor: pointer; background: var(--pink); color: #fff; font: inherit; font-size: 14.5px; font-weight: 800; transition: background .2s; }
.inv-enlace button:hover { background: var(--pink-mid); }
.inv-enlace button.es-copiado { background: var(--pink-deep); }
.inv-compartir { display: flex; gap: 8px; flex-wrap: wrap; }
.inv-btn { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px; border-radius: 99px; text-decoration: none; font-size: 14px; font-weight: 800; color: var(--ink); background: #fff; border: 1.5px solid var(--linea-fuerte); }
.inv-btn:hover { background: var(--rubor); border-color: var(--pink-line); }
.inv-btn--wa { background: var(--rubor); border-color: var(--pink-line); color: var(--pink-deep); }
.inv-pasos { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.inv-pasos li { display: flex; flex-direction: column; gap: 4px; padding: 18px; border-radius: 22px; background: #fff; border: 1px solid var(--linea); }
.inv-pasos li span { width: 38px; height: 38px; border-radius: 13px; display: grid; place-items: center; background: var(--rubor); color: var(--pink); margin-bottom: 6px; }
.inv-pasos strong { font-size: 14.5px; color: var(--ink); }
.inv-pasos small { font-size: 13px; line-height: 1.5; color: var(--muted); }
.inv-vacio { margin: 0; font-size: 14px; color: var(--muted); }
.inv-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.inv-lista li { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 18px; border: 1px solid var(--linea); }
.inv-ini { width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; background: linear-gradient(135deg, var(--melocoton), var(--pink-soft)); color: var(--pink-deep); font-weight: 900; }
.inv-quien { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.inv-quien strong { font-size: 14.5px; color: var(--ink); }
.inv-quien small { font-size: 12.5px; color: var(--muted); }
.inv-estado { font-size: 12px; font-weight: 800; padding: 4px 11px; border-radius: 99px; white-space: nowrap; background: #FFF4E8; color: var(--melocoton-deep); }
.inv-estado--otorgado { background: var(--pink); color: #fff; }
@media (max-width: 680px) {
  .inv-pasos { grid-template-columns: minmax(0, 1fr); }
  .inv-enlace { flex-direction: column; }
  .inv-lista li { flex-wrap: wrap; }
}
`;
