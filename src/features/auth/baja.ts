"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

/**
 * Baja de los avisos de clase nueva, SIN iniciar sesion.
 *
 * ⚠️ EXCEPCION DELIBERADA A LA REGLA DE requireAdmin()
 *   CLAUDE.md dice que toda server action que use createSupabaseAdminClient()
 *   tiene que llamar requireAdmin(), porque una action es un endpoint POST
 *   publico. Esta no puede: existe justamente para quien NO tiene sesion --
 *   pedirle que entre para dejar de recibir correo es lo que hace que la gente
 *   marque como spam en vez de darse de baja.
 *
 *   Lo que la sostiene en pie es el alcance, no la autenticacion:
 *
 *     - la autorizacion es el token, que es un uuid v4 de un solo proposito
 *     - la unica escritura posible es marketing_opt_in = false
 *     - no lee ni devuelve NADA del perfil, asi que un token robado no filtra
 *       ni el correo ni el nombre de nadie
 *     - el peor caso de un token adivinado es que alguien deje de recibir
 *       publicidad, que es un resultado que el propio sistema ofrece
 *
 *   Cualquier operacion que se agregue aca deja de cumplir esto. Si hace falta
 *   mas, va con sesion.
 */

const esquema = z.object({
  token: z.string().uuid(),
});

export async function darDeBajaAction(formData: FormData) {
  const parsed = esquema.safeParse({ token: String(formData.get("token") ?? "") });

  if (!parsed.success) {
    redirect("/baja?estado=invalido" as never);
  }

  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("profiles")
    .update({ marketing_opt_in: false })
    .eq("unsubscribe_token", parsed.data.token);

  if (error) {
    redirect("/baja?estado=error" as never);
  }

  // Siempre el mismo destino, exista el token o no. Contestar distinto
  // convertiria esta ruta en un oraculo para saber si un token es valido.
  redirect("/baja?estado=listo" as never);
}
