import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { aplicarBajasVencidas } from "@/src/features/studio/acceso-gratis";
import { correosDelCron } from "@/src/features/correos/disparadores";

/**
 * Mantiene despierto el proyecto de Supabase.
 *
 * POR QUE EXISTE
 *   En el plan Free, Supabase PAUSA el proyecto tras 7 dias sin peticiones a la
 *   API. Un proyecto pausado no se cae con un error legible: la aplicacion entera
 *   deja de responder hasta que alguien entra al panel y lo reactiva a mano. Con
 *   alumnas pagando, eso son horas de caida sin aviso.
 *
 *   Basta con UNA peticion cada tanto para reiniciar el contador.
 *
 * ⚠️ ESTO ES UN PARCHE, NO LA SOLUCION
 *   La solucion de verdad es el plan Pro: ademas de no pausar, trae copias de
 *   seguridad diarias. Hoy este proyecto cobra dinero real sobre una base SIN
 *   NINGUNA COPIA -- un borrado accidental no se puede deshacer. Ver la nota en
 *   CLAUDE.md.
 *
 * ⚠️ POR QUE service_role Y NO anon
 *   Desde `20260801_data_api_grants.sql`, el rol `anon` no tiene NINGUN
 *   privilegio de tabla: una consulta suya devolveria 42501. Serviria igual para
 *   despertar el proyecto -- es una peticion a la API -- pero dejaria un error en
 *   los registros cada tres dias, y un error recurrente que "es normal" es
 *   exactamente como se aprende a ignorar los registros.
 */

// Sin cache: una respuesta cacheada no llega a Supabase, que es justamente lo
// unico que este endpoint tiene que hacer.
export const dynamic = "force-dynamic";

// Los correos del estudio van con pausa entre envio y envio (Resend limita a 2
// por segundo) y cortan solos a los 45 s (src/features/correos/disparadores.ts).
export const maxDuration = 60;

export async function GET(request: Request) {
  /**
   * ⚠️ LA GUARDA ES OBLIGATORIA, NO OPCIONAL.
   *
   *    Sin `CRON_SECRET` cargada, esto seria una ruta publica que consulta la
   *    base con `service_role`. No filtra datos -- solo devuelve un numero --
   *    pero es un endpoint que cualquiera puede golpear en bucle.
   *
   *    Vercel manda `Authorization: Bearer <CRON_SECRET>` automaticamente en sus
   *    invocaciones de cron cuando la variable existe. Si NO existe, se responde
   *    503 en vez de quedar abierto: fallar hacia el lado cerrado.
   */
  const esperado = process.env.CRON_SECRET;
  if (!esperado) {
    return NextResponse.json(
      { error: "CRON_SECRET no esta configurada. Sin ella esta ruta queda cerrada." },
      { status: 503 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${esperado}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const empezo = Date.now();

  try {
    /**
     * La consulta mas barata posible que igual toque Postgres:
     *
     *   - `categories` tiene 7 filas y no crece
     *   - `head: true` NO devuelve filas, solo la cabecera con el conteo
     *   - `count: "estimated"` y no `"exact"`: el estimado sale de las
     *     estadisticas del planificador, sin recorrer la tabla
     *
     * Es un `EXPLAIN`-como-mucho contra una tabla de siete filas. No suma carga
     * de forma apreciable.
     */
    const supabase = createSupabaseAdminClient();
    const { count, error } = await supabase
      .from("categories")
      .select("id", { count: "estimated", head: true });

    if (error) throw new Error(error.message);

    /**
     * SEGUNDO PASO: el acceso gratis que vencio (20261009_acceso_gratis.sql).
     *
     * Pasa a 'none' a quien tenia un regalo vencido, no es admin y no tiene una
     * suscripcion que de acceso. Va DESPUES del keepalive a proposito: si esto
     * falla, la base ya se desperto igual. Y el fallo devuelve 500 (abajo), asi
     * que se ve en el panel de Vercel en vez de perderse.
     *
     * Sin la migracion devuelve `omitido` y no falla: el codigo se despliega
     * antes de que la duena la corra.
     */
    const accesoGratis = await aplicarBajasVencidas(supabase);

    /**
     * TERCER PASO: los correos del dia (src/features/correos/disparadores.ts).
     *
     *   - recordatorio de las clases en vivo de HOY (Madrid) a quien reservo
     *   - "te quedan N dias" del acceso gratis (1 a 3 dias antes)
     *   - "termino tu acceso gratis" (hasta 7 dias despues)
     *
     * Va al final: las bajas ya se aplicaron y el keepalive ya desperto la base.
     * NUNCA LANZA -- un correo que falla no puede marcar el keepalive como
     * caido -- y sin 20261009_3_correos_enviados.sql no manda nada.
     */
    const correos = await correosDelCron(supabase);

    return NextResponse.json({
      ok: true,
      // Se devuelve el conteo para que se vea en los registros de Vercel que la
      // consulta llego de verdad a la base, y no solo que la ruta respondio.
      categorias: count,
      accesoGratis,
      correos,
      ms: Date.now() - empezo,
    });
  } catch (e) {
    // 500 a proposito: Vercel marca la ejecucion como fallida y queda visible en
    // el panel. Un keepalive que falla en silencio no mantiene nada despierto y
    // nadie se entera hasta que el proyecto ya se pauso.
    const mensaje = e instanceof Error ? e.message : "fallo desconocido";
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  }
}
