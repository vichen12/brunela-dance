import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { RegistroForm } from "@/components/registro-form";
import { OAuthButtons } from "@/components/oauth-buttons";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { hasSupabaseAuthEnv } from "@/src/lib/env";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { COOKIE_REFERIDO, normalizarCodigo } from "@/src/features/referidos/reglas";
import { ofertaVigente } from "@/src/features/studio/ofertas";
import { PrecioConOferta } from "@/components/precio-con-oferta";

/**
 * Lo que la visitante ya eligio antes de llegar: el pack (nombre y precio, con
 * la oferta si hay) y quien la invito. Con service_role porque aca todavia no
 * hay sesion y anon no lee tablas; solo se devuelven nombres y precios de un
 * pack PUBLICADO y el nombre de pila de quien invito. Nunca lanza.
 */
async function loQueTrae(pack: string | null, refCrudo: string | undefined) {
  const db = createSupabaseAdminClient();
  let packElegido: { nombre: string; centimos: number; moneda: string; oferta: ReturnType<typeof ofertaVigente> } | null = null;
  let invitadaPor: string | null = null;
  try {
    if (pack) {
      const { data } = await db.from("packs").select("id, name_i18n, price_cents, currency, is_published").eq("slug", pack)
        .maybeSingle<{ id: string; name_i18n: Record<string, string> | null; price_cents: number; currency: string; is_published: boolean }>();
      if (data?.is_published) {
        // Consulta aparte y tolerante: sin la migracion de ofertas no hay oferta.
        const { data: o } = await db.from("packs").select("price_cents, oferta_precio_cents, oferta_hasta").eq("id", data.id)
          .maybeSingle<{ price_cents: number; oferta_precio_cents: number | null; oferta_hasta: string | null }>();
        packElegido = { nombre: data.name_i18n?.es ?? pack, centimos: data.price_cents, moneda: data.currency, oferta: o ? ofertaVigente(o) : null };
      }
    }
    const codigo = normalizarCodigo(refCrudo);
    if (codigo) {
      const { data: c } = await db.from("referidos_codigos").select("user_id").eq("codigo", codigo).maybeSingle<{ user_id: string }>();
      if (c) {
        const { data: p } = await db.from("profiles").select("full_name").eq("id", c.user_id).maybeSingle<{ full_name: string | null }>();
        invitadaPor = p?.full_name?.trim().split(/\s+/)[0] || null;
      }
    }
  } catch {
    // Es solo contexto: sin esto el alta funciona igual.
  }
  return { packElegido, invitadaPor };
}

export const dynamic = "force-dynamic";

const TIERS = ["corps_de_ballet", "solista", "principal"] as const;
type Tier = (typeof TIERS)[number];

const PLAN_LABEL: Record<Tier, { nombre: string; mensual: string; anual: string }> = {
  corps_de_ballet: { nombre: "Corps de Ballet", mensual: "16", anual: "154" },
  solista:         { nombre: "Solista",         mensual: "31", anual: "299" },
  principal:       { nombre: "Principal",       mensual: "59", anual: "559" },
};

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function RegistroPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const str = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : null);

  const planCrudo = str("plan");
  const plan = planCrudo && (TIERS as readonly string[]).includes(planCrudo) ? (planCrudo as Tier) : null;
  const interval = str("interval") === "yearly" ? "yearly" : str("interval") === "monthly" ? "monthly" : null;
  const error = str("error");
  const email = str("email");
  // El slug del pack NO se valida aca contra la base: se valida en el checkout,
  // que es quien resuelve el precio. Aca solo se acota el largo.
  const packCrudo = str("pack");
  const pack = packCrudo && packCrudo.length <= 120 ? packCrudo : null;

  // Ya logueada: no tiene sentido mostrarle un alta. La compuerta del layout de
  // /dashboard la manda al onboarding si le falta.
  // ⚠️ NO SE PIERDE LO QUE VENIA ELIGIENDO.
  //
  //    Antes esto era `redirect("/dashboard")` a secas, y ahi moria la intencion:
  //    una alumna con sesion que tocaba "llevar este pack" en la portada
  //    aterrizaba en su dashboard sin compra y sin explicacion. Como no habia
  //    ningun otro camino, los packs directamente NO EXISTIAN para quien ya
  //    tenia cuenta -- que despues del lanzamiento son todas.
  if (hasSupabaseAuthEnv()) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const q = new URLSearchParams();
      if (pack) q.set("pack", pack);
      else if (plan) {
        q.set("plan", plan);
        if (interval) q.set("interval", interval);
      }
      // ⚠️ A /registro/plan y no directo a /dashboard/plan: desde que el
      //    estudio exige acceso, quien no tiene plan rebotaria en el layout y
      //    perderia el pack en el camino (el layout no ve la URL). Esa pantalla
      //    lo resuelve: sin acceso, muestra el pack para pagar ahi; con acceso,
      //    sigue a /dashboard/plan?...&iniciar=1, que arranca el pago solo.
      if (q.size > 0) {
        redirect(`/registro/plan?${q.toString()}` as never);
      }
      redirect("/dashboard" as never);
    }
  }

  const elegido = plan ? PLAN_LABEL[plan] : null;
  const { packElegido, invitadaPor } = await loQueTrae(pack, (await cookies()).get(COOKIE_REFERIDO)?.value);
  const precio = elegido ? (interval === "yearly" ? elegido.anual : elegido.mensual) : null;

  // El plan viaja tambien por el camino de Google, donde no hay signUp en el
  // que meter metadata: se pasa por la URL de vuelta del callback.
  const partesGoogle = new URLSearchParams();
  if (plan) partesGoogle.set("plan", plan);
  if (interval) partesGoogle.set("interval", interval);
  if (pack) partesGoogle.set("pack", pack);
  const destinoGoogle = `/registro/onboarding${partesGoogle.size > 0 ? `?${partesGoogle.toString()}` : ""}`;

  return (
    <main className="reg-page sistema">
      <span className="reg-mancha reg-mancha-1" aria-hidden />
      <span className="reg-mancha reg-mancha-2" aria-hidden />

      <div className="reg-top">
        <Link href="/" className="reg-top-volver">
          <ArrowLeft size={15} strokeWidth={2.4} aria-hidden />
          Volver
        </Link>
        <Link href="/sign-in">Ya tengo cuenta</Link>
      </div>

      <section className="reg-card">
        <div className="reg-cabeza">
          <span className="reg-burbuja" aria-hidden>
            <Image src="/brand/isologo-icon.png" alt="" width={34} height={34} />
          </span>
          <p className="reg-kicker">
            <Sparkles size={13} strokeWidth={2.4} aria-hidden />
            Crear cuenta
          </p>
        </div>
        <h1 className="reg-title">
          Empezá a entrenar<br />
          <span>con Brunela.</span>
        </h1>

        {invitadaPor && (
          <p className="reg-note"><strong>{invitadaPor}</strong> te invitó al estudio. ¡Qué bueno tenerte!</p>
        )}

        {packElegido ? (
          <div className="reg-plan reg-plan--pack" aria-live="polite">
            <span className="reg-plan-tag">Pack elegido</span>
            <span className="reg-plan-name">{packElegido.nombre}</span>
            <span className="reg-plan-price">
              <PrecioConOferta centimos={packElegido.centimos} moneda={packElegido.moneda} oferta={packElegido.oferta} /> <small>pago único</small>
            </span>
          </div>
        ) : elegido ? (
          <div className="reg-plan" aria-live="polite">
            <span className="reg-plan-tag">Plan elegido</span>
            <span className="reg-plan-name">{elegido.nombre}</span>
            <span className="reg-plan-price">
              {precio} € <small>/ {interval === "yearly" ? "año" : "mes"}</small>
            </span>
            <Link href="/#planes" className="reg-plan-change">Cambiar</Link>
          </div>
        ) : (
          <p className="reg-note">
            Podés elegir tu plan al terminar, o <Link href="/#planes">verlos primero</Link>.
          </p>
        )}

        <RegistroForm error={error} plan={plan} interval={interval} pack={pack} email={email} />

        <div className="reg-divider"><div /><span>o</span><div /></div>

        {/* Mismo componente que el login: una sola implementacion de Google. */}
        <OAuthButtons callbackUrl={destinoGoogle} />

        <p className="reg-legal">
          Al crear la cuenta aceptás las{" "}
          <Link href="/legal/condiciones" target="_blank">Condiciones de contratación</Link>{" "}
          y leíste la{" "}
          <Link href="/legal/privacidad" target="_blank">Política de privacidad</Link>.
          {" "}{packElegido
            ? "El pack se paga una sola vez, después de crear la cuenta."
            : "El plan se cobra después de los 7 días de prueba, y podés cancelarlo cuando quieras."}
        </p>
      </section>

      {/* Los estilos viven en app/estilos/acceso.css (bloque "Registro"). */}
    </main>
  );
}
