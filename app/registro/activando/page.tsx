import Stripe from "stripe";
import { redirect } from "next/navigation";
import { requireUser } from "@/src/features/auth/guards";
import { getStripeServerEnv, hasStripeServerEnv } from "@/src/lib/env";
import { leerAccesoAlEstudio } from "@/src/features/acceso/servidor";
import { decidirActivando, RUTA_ELEGIR_PLAN } from "@/src/features/acceso/reglas";
import { RegistroMarco } from "@/components/registro-marco";

export const dynamic = "force-dynamic";

/** Cada cuanto se vuelve a mirar, y desde cuando se avisa que tarda. */
const CADA_SEGUNDOS = 2;
const AVISO_DESDE_INTENTO = 15; // ~30 s

/**
 * /registro/activando — la vuelta de Stripe.
 *
 * Stripe redirige al instante, pero el acceso lo escribe el WEBHOOK, que puede
 * tardar unos segundos. Esta pantalla espera, mirando cada 2 s, y en cuanto el
 * acceso aparece la manda al estudio.
 *
 * 🔴 ESTA PANTALLA NO DA ACCESO. Nunca escribe nada. Le pregunta a Stripe por la
 *    sesion SOLO para saber si es de esta alumna y si se completo -- para no
 *    dejar a nadie esperando un pago que no hizo -- y despues mira la base.
 *    Si el webhook no llega, se queda esperando y lo dice; no "arregla" nada.
 *
 * Sin JavaScript: se recarga con <meta http-equiv="refresh">.
 */
type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function ActivandoPage({ searchParams }: Props) {
  const { user } = await requireUser();
  const params = (await searchParams) ?? {};
  const sessionId = typeof params.session_id === "string" ? params.session_id : "";
  const intento = Math.max(0, Math.min(10_000, Number.parseInt(typeof params.n === "string" ? params.n : "0", 10) || 0));

  // Lo primero es la base: si el acceso ya esta, no hace falta ni Stripe.
  const acceso = await leerAccesoAlEstudio(user.id);
  if (acceso?.tieneAcceso) redirect("/dashboard?bienvenida=1" as never);

  let sesionEsSuya = false;
  let pagoCompleto = false;
  if (/^cs_[A-Za-z0-9_]+$/.test(sessionId) && hasStripeServerEnv()) {
    try {
      const stripe = new Stripe(getStripeServerEnv().STRIPE_SECRET_KEY);
      const sesion = await stripe.checkout.sessions.retrieve(sessionId);
      sesionEsSuya = sesion.metadata?.user_id === user.id;
      pagoCompleto = sesion.status === "complete";
    } catch (e) {
      console.error("[activando] no se pudo leer la sesion de Stripe:", e instanceof Error ? e.message : e);
    }
  }

  const decision = decidirActivando({ sesionEsSuya, pagoCompleto, tieneAcceso: !!acceso?.tieneAcceso });
  if (decision === "estudio") redirect("/dashboard?bienvenida=1" as never);
  if (decision === "elegir") redirect(RUTA_ELEGIR_PLAN as never);
  if (decision === "cancelado") redirect(`${RUTA_ELEGIR_PLAN}?cancelado=1` as never);

  const tarda = intento >= AVISO_DESDE_INTENTO;
  const siguiente = `/registro/activando?${new URLSearchParams({ session_id: sessionId, n: String(intento + 1) }).toString()}`;

  return (
    <RegistroMarco ancho={520}>
      <meta httpEquiv="refresh" content={`${tarda ? 5 : CADA_SEGUNDOS};url=${siguiente}`} />
      <div className="act">
        <span className="act-latido" aria-hidden="true">
          <span />
        </span>
        <p className="rm-kicker">Pago recibido</p>
        <h1 className="rm-title">
          Activando<br />
          <span>tu cuenta…</span>
        </h1>
        <p className="rm-sub" role="status" aria-live="polite">
          {tarda
            ? <>Está tardando más de lo normal. Tu pago está registrado; si en un rato no entrás, escribinos a <a href="mailto:info@bruneladance.com">info@bruneladance.com</a> y lo resolvemos.</>
            : "Estamos preparando tu estudio. Son solo unos segundos: no cierres esta página."}
        </p>
        <a className="act-reintentar" href={siguiente}>Volver a mirar</a>
      </div>
      <style>{CSS}</style>
    </RegistroMarco>
  );
}

const CSS = `
.act { display: flex; flex-direction: column; align-items: center; text-align: center; }
.act .rm-title { margin-top: 12px; }
.act .rm-sub a { color: var(--pink-deep); font-weight: 800; }
.act-latido { position: relative; width: 76px; height: 76px; margin: 6px 0 18px; border-radius: 26px; display: grid; place-items: center; background: var(--rubor); }
.act-latido span { width: 26px; height: 26px; border-radius: 50%; background: var(--pink); animation: act-pulso 1.4s ease-in-out infinite; }
.act-reintentar { margin-top: 18px; font-size: 13.5px; font-weight: 800; color: var(--muted); text-decoration: underline; text-underline-offset: 3px; }
.act-reintentar:hover { color: var(--pink-deep); }
@keyframes act-pulso { 0%, 100% { transform: scale(.8); opacity: .65; } 50% { transform: scale(1.1); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .act-latido span { animation: none; } }
`;
