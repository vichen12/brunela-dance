import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { hasSupabaseAuthEnv } from "@/src/lib/env";
import { getCurrentProfile } from "@/src/features/auth/profile";

type ProfileGuard = {
  id: string;
  email: string;
  is_admin: boolean;
  membership_tier: "none" | "corps_de_ballet" | "solista" | "principal";
};

const getSessionSnapshot = cache(async () => {
  if (!hasSupabaseAuthEnv()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user;
});

/**
 * Ensures the current request has an authenticated Supabase user.
 */
export async function requireUser() {
  if (!hasSupabaseAuthEnv()) {
    redirect("/sign-in?error=Configuracion%20pendiente%20en%20Vercel");
  }

  const user = await getSessionSnapshot();

  if (!user) {
    // CON ?error= (2026-11-12). Aca solo llega quien trae una sesion guardada
    // que ya no vale (se cerro desde otro dispositivo, se borro la cuenta): a
    // quien no trae ninguna la frena antes el middleware. Y el middleware, al
    // ver esa sesion guardada en /sign-in, la mandaba de vuelta al estudio:
    // una vuelta sin fin y el navegador mostrando "demasiadas redirecciones".
    // Con ?error= el middleware deja ver el formulario.
    redirect(`/sign-in?error=${encodeURIComponent("Tu sesión se cerró. Entrá de nuevo.")}` as never);
  }

  return { user };
}

/**
 * Lo mismo para una ruta de API: devuelve null en vez de redirigir.
 *
 * requireUser() en una API contesta con una redireccion a la pagina de
 * ingreso; el `fetch` del navegador la sigue, recibe esa pagina con un 200 y
 * cree que todo salio bien ("Foto actualizada" sin haber guardado nada).
 */
export async function usuarioDeApi() {
  if (!hasSupabaseAuthEnv()) return null;
  return getSessionSnapshot();
}

/**
 * Ensures the current request belongs to an authenticated admin profile.
 */
export async function requireAdmin() {
  const { user } = await requireUser();
  // Mismo perfil memoizado que usan las pantallas: sin esto, entrar a /admin
  // consultaba `profiles` una vez aca y otra en cada pagina.
  const profile = await getCurrentProfile(user.id);

  if (!profile?.is_admin) {
    redirect("/dashboard");
  }

  return { user, profile };
}
