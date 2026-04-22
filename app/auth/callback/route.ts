import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseAuthEnv } from "@/src/lib/env";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (!hasSupabaseAuthEnv()) {
    return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent("Configuracion pendiente")}`);
  }

  if (errorParam) {
    const desc = searchParams.get("error_description") ?? "Error de autenticacion con Google";
    return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(desc)}`);
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").upsert(
          {
            id: user.id,
            email: user.email ?? "",
            full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
            membership_tier: "none",
            is_admin: false,
            onboarding_completed: false,
          },
          { onConflict: "id", ignoreDuplicates: true }
        );
      }
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error("[auth/callback] exchangeCodeForSession error:", error.message);
    return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent("Error de autenticacion con Google")}`);
  }

  return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent("Error de autenticacion con Google")}`);
}
