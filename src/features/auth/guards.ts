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
    redirect("/sign-in");
  }

  return { user };
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
