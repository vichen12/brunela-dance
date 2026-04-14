"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { hasSupabaseAuthEnv } from "@/src/lib/env";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

/**
 * Signs a user in with Supabase Auth and redirects to the dashboard.
 */
export async function signInAction(formData: FormData) {
  if (!hasSupabaseAuthEnv()) {
    redirect("/sign-in?error=Faltan%20variables%20de%20entorno%20en%20Vercel");
  }

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    redirect("/sign-in?error=Credenciales%20inv%C3%A1lidas");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

/**
 * Ends the current session and returns the user to the sign-in screen.
 */
export async function signOutAction() {
  if (!hasSupabaseAuthEnv()) {
    redirect("/sign-in");
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
