import { NextResponse } from "next/server";
import { usuarioDeApi } from "@/src/features/auth/guards";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { getNotificaciones } from "@/src/features/studio/notificaciones";

export const dynamic = "force-dynamic";

/**
 * Los ANUNCIOS vigentes de quien esta logueada, para que la campanita se
 * entere sin recargar (2026-11-11).
 *
 * POR QUE EXISTE
 *   La campanita se arma en el layout, que no se vuelve a dibujar al navegar:
 *   si Brunela publicaba un anuncio con la alumna ya adentro, no le aparecia
 *   hasta recargar la pagina. La campanita llama aca al volver a la pestaña.
 *
 * Devuelve SOLO los anuncios (ids "an-..."): es lo unico que la campanita
 * reemplaza. Con el cliente de ella, asi que RLS decide que anuncios ve.
 */
export async function GET() {
  // Sin sesion: 401 y no una redireccion (la campanita la tomaria por respuesta buena).
  const user = await usuarioDeApi();
  if (!user) return NextResponse.json({ anuncios: [] }, { status: 401 });
  const profile = await getCurrentProfile(user.id);
  const todas = await getNotificaciones(user.id, profile?.membership_tier ?? "none", profile?.is_admin ?? false);
  return NextResponse.json({ anuncios: todas.filter((n) => n.tipo === "anuncio") }, { headers: { "Cache-Control": "no-store" } });
}
