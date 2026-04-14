import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

type ProfileGuard = {
  id: string;
  email: string;
  is_admin: boolean;
  membership_tier: "none" | "corps_de_ballet" | "solista" | "principal";
};

const getSessionSnapshot = cache(async () => {
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
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, is_admin, membership_tier")
    .eq("id", user.id)
    .single<ProfileGuard>();

  if (!profile?.is_admin) {
    redirect("/dashboard");
  }

  return { user, profile };
}
