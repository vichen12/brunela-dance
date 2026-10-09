import { redirect } from "next/navigation";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { leerAccesoAlEstudio } from "@/src/features/acceso/servidor";
import { destinoDeElegirPlan, motivoSinAcceso } from "@/src/features/acceso/reglas";
import { cargarEleccionDePlan } from "@/src/features/planes/eleccion";
import { PLAN_LABEL } from "@/src/features/studio/acceso-gratis-reglas";
import { pagarPlanAction } from "@/src/features/auth/registro";
import { signOutAction } from "@/src/features/auth/actions";
import { ElegirPlan } from "@/components/elegir-plan";
import { RegistroMarco } from "@/components/registro-marco";

export const dynamic = "force-dynamic";

/**
 * /registro/plan — a donde manda el estudio a quien no tiene acceso.
 *
 * ⚠️ NO VIVE BAJO /dashboard, y no puede: es el layout del estudio el que
 *    manda aca. La salida de esta pantalla hacia el estudio la decide
 *    destinoDeElegirPlan, que es el espejo exacto de la compuerta del layout
 *    (src/features/acceso/reglas.ts): solo devuelve al estudio a quien el
 *    estudio deja pasar. Asi no hay bucle en ningun estado.
 */
type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function ElegirPlanPage({ searchParams }: Props) {
  const { user } = await requireUser();
  const params = (await searchParams) ?? {};
  const str = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : null);

  const acceso = await leerAccesoAlEstudio(user.id);
  if (!acceso) redirect("/dashboard" as never);

  const destino = destinoDeElegirPlan(acceso);
  if (destino) {
    // Ya tiene acceso pero venia a comprar algo (un pack desde la portada, por
    // ejemplo): eso se hace desde /dashboard/plan, que arranca solo el pago.
    const pack = str("pack");
    const plan = str("plan");
    if (destino === "/dashboard" && !acceso.esAdmin && (pack || plan)) {
      const q = new URLSearchParams();
      if (pack) q.set("pack", pack);
      else if (plan) {
        q.set("plan", plan);
        const interval = str("interval");
        if (interval) q.set("interval", interval);
      }
      q.set("iniciar", "1");
      redirect(`/dashboard/plan?${q.toString()}` as never);
    }
    redirect(destino as never);
  }

  const supabase = await createSupabaseServerClient();
  const { data: ultima } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ status: string }>();

  const meta = user.user_metadata as { pending_tier?: string | null; pending_interval?: string | null; pending_pack?: string | null } | undefined;
  const eleccion = await cargarEleccionDePlan({
    plan: str("plan") ?? meta?.pending_tier ?? null,
    interval: str("interval") ?? meta?.pending_interval ?? null,
    pack: str("pack") ?? meta?.pending_pack ?? null,
    tierActual: acceso.tier,
  });

  const motivo = motivoSinAcceso({ gratisHasta: acceso.gratisHasta, ultimaSuscripcion: ultima?.status ?? null });
  const nombre = acceso.nombre;
  const planGratis = acceso.gratisPlan && acceso.gratisPlan in PLAN_LABEL ? PLAN_LABEL[acceso.gratisPlan as keyof typeof PLAN_LABEL] : null;

  const cancelado = str("cancelado") === "1";
  const error = str("error");

  return (
    <RegistroMarco>
      <div className="rm-pasos" aria-hidden="true">
        <span />
        <span />
        <span className="activo" />
      </div>

      {motivo === "gratis_terminado" ? (
        <>
          <p className="rm-kicker">Tu prueba gratis terminó</p>
          <h1 className="rm-title">
            Gracias por entrenar{nombre ? `, ${nombre}` : ""}.<br />
            <span>¿Seguimos juntas?</span>
          </h1>
          <p className="rm-sub">
            {planGratis ? <>Estos días tuviste <strong>{planGratis}</strong> para vos. </> : null}
            Para seguir con tus clases, elegí un plan. Tu progreso queda guardado: retomás donde lo dejaste.
          </p>
        </>
      ) : motivo === "plan_terminado" ? (
        <>
          <p className="rm-kicker">Tu plan terminó</p>
          <h1 className="rm-title">
            {nombre ? `${nombre}, te` : "Te"} extrañamos<br />
            <span>en el estudio.</span>
          </h1>
          <p className="rm-sub">
            Tu plan terminó. Elegí uno para volver: tu progreso sigue donde lo dejaste.
          </p>
        </>
      ) : (
        <>
          <p className="rm-kicker">Último paso</p>
          <h1 className="rm-title">
            {nombre ? `${nombre}, elegí` : "Elegí"} tu plan<br />
            <span>para entrar.</span>
          </h1>
          <p className="rm-sub">
            {eleccion.pack
              ? "Pagás el pack una sola vez y las clases son tuyas para siempre."
              : "Tu cuenta se abre en cuanto se confirma el pago. Podés cambiar de plan cuando quieras."}
          </p>
        </>
      )}

      {cancelado && <p className="rm-aviso" role="status">No se completó el pago. Podés intentarlo de nuevo.</p>}
      {error && <p className="rm-aviso" role="alert">{error}</p>}

      <form action={pagarPlanAction} className="rm-form">
        <ElegirPlan eleccion={eleccion} />
        <button type="submit" className="rm-submit">
          {eleccion.pack
            ? "Pagar el pack"
            : eleccion.diasPrueba > 0
              ? `Empezar mis ${eleccion.diasPrueba} días gratis`
              : "Ir al pago"}
        </button>
        <p className="rm-nota">Pagás en Stripe, con conexión segura. Al volver, tu cuenta se abre sola.</p>
      </form>

      <form action={signOutAction} className="rm-pie">
        <button type="submit" className="rm-salir">Cerrar sesión</button>
      </form>
    </RegistroMarco>
  );
}
