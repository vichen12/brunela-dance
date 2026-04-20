"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getAppUrl, hasSupabaseAuthEnv } from "@/src/lib/env";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  callbackUrl: z.string().optional()
});

const emailSchema = z.object({
  email: z.string().email()
});

const newPasswordSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string().min(8)
});

function safeRedirectUrl(raw: string | null | undefined): string {
  if (!raw) return "/dashboard";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/dashboard";
}

export async function signInAction(formData: FormData) {
  if (!hasSupabaseAuthEnv()) {
    redirect("/sign-in?error=Faltan%20variables%20de%20entorno%20en%20Vercel");
  }

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    callbackUrl: formData.get("callbackUrl") ?? undefined
  });

  if (!parsed.success) {
    redirect("/sign-in?error=Credenciales%20inv%C3%A1lidas");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (error) {
    const callbackParam = parsed.data.callbackUrl
      ? `&callbackUrl=${encodeURIComponent(parsed.data.callbackUrl)}`
      : "";
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}${callbackParam}`);
  }

  redirect(safeRedirectUrl(parsed.data.callbackUrl) as never);
}

export async function signOutAction() {
  if (!hasSupabaseAuthEnv()) {
    redirect("/sign-in");
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export async function requestPasswordResetAction(formData: FormData) {
  if (!hasSupabaseAuthEnv()) {
    redirect("/sign-in/forgot-password?error=Configuracion%20pendiente");
  }

  const parsed = emailSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    redirect("/sign-in/forgot-password?error=Email%20inv%C3%A1lido");
  }

  const supabase = await createSupabaseServerClient();
  const appUrl = getAppUrl();

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/sign-in/reset-password`
  });

  if (error) {
    redirect(`/sign-in/forgot-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect(
    "/sign-in/forgot-password?success=Te%20enviamos%20un%20enlace%20para%20restablecer%20tu%20contrase%C3%B1a."
  );
}

export async function updatePasswordAction(formData: FormData) {
  if (!hasSupabaseAuthEnv()) {
    redirect("/sign-in/reset-password?error=Configuracion%20pendiente");
  }

  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword")
  });

  if (!parsed.success) {
    redirect(
      "/sign-in/reset-password?error=La%20contrase%C3%B1a%20debe%20tener%20al%20menos%208%20caracteres"
    );
  }

  if (parsed.data.password !== parsed.data.confirmPassword) {
    redirect("/sign-in/reset-password?error=Las%20contrase%C3%B1as%20no%20coinciden");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    redirect(`/sign-in/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect(
    "/sign-in?success=Contrase%C3%B1a%20actualizada.%20Ya%20pod%C3%A9s%20ingresar."
  );
}
