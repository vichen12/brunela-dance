import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseAuthEnv } from "@/src/lib/env";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  console.log("[auth/callback] full URL:", request.url);
  console.log("[auth/callback] all params:", Object.fromEntries(searchParams));
  console.log("[auth/callback] code:", code ? `present (${code.slice(0, 8)}...)` : "MISSING");

  if (!hasSupabaseAuthEnv()) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent("Configuracion pendiente")}`
    );
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
            full_name:
              user.user_metadata?.full_name ??
              user.user_metadata?.name ??
              null,
            membership_tier: "none",
            is_admin: false,
            onboarding_completed: false,
          },
          { onConflict: "id", ignoreDuplicates: true }
        );
      }

      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error("[auth/callback] exchangeCodeForSession error:", error);
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(error.message ?? "Error de autenticacion con Google")}`
    );
  }

  console.error("[auth/callback] no code param, searchParams:", Object.fromEntries(searchParams));
  return NextResponse.redirect(
    `${origin}/sign-in?error=${encodeURIComponent("No se recibio codigo de Google")}`
  );
}
