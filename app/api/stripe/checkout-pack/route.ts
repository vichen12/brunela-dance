import { NextResponse } from "next/server";
import { z } from "zod";
import { hasStripeServerEnv } from "@/src/lib/env";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { crearCheckoutDePack } from "@/src/lib/stripe/crear-checkout";

/**
 * Compra de un pack: pago UNICO, sin suscripcion.
 *
 * ⚠️ POR QUE ES UNA RUTA APARTE Y NO UNA RAMA DE /api/stripe/checkout
 *   Esa ruta cobra las suscripciones, esta verificada y funciona. Meterle un
 *   `if` que cambie `mode`, el arbol de precios, la metadata Y el destino de
 *   vuelta es tocar el unico camino de cobro que hoy anda, para agregar uno que
 *   todavia no. Separadas, un error aca no puede romper aquello. Por lo mismo
 *   son dos funciones distintas en src/lib/stripe/crear-checkout.ts.
 *
 * ⚠️ EL PRECIO NO VIENE DEL NAVEGADOR
 *   Del cliente llega un SLUG y nada mas. El importe y el price id salen de la
 *   base (crearCheckoutDePack). Si el precio viajara por la request, alguien
 *   podria mandar el slug del pack caro con el price id del barato.
 *
 * ⚠️ LA METADATA VA EN LA SESION, NO EN UNA SUSCRIPCION
 *   En un pago unico NO EXISTE objeto suscripcion. El webhook lee
 *   `session.metadata`; la pone parametrosCheckoutPack. Si se pierde, entra el
 *   pago y la alumna no recibe el acceso (trampa 1 con otro disfraz).
 */

const schema = z.object({ pack: z.string().min(1).max(120) });

export async function POST(request: Request) {
  if (!hasStripeServerEnv()) {
    return NextResponse.json({ error: "Stripe no esta configurado." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const resultado = await crearCheckoutDePack({
    user: { id: user.id, email: user.email },
    packSlug: parsed.data.pack,
  });

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }

  return NextResponse.json({ url: resultado.url });
}
