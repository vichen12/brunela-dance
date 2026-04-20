import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseAuthEnv } from "@/src/lib/env";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (!hasSupabaseAuthEnv()) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent("Configuracion pendiente")}`
    );
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/sign-in?error=${encodeURIComponent("Error de autenticacion con Google")}`
  );
}
