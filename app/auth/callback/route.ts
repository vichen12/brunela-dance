import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseAuthEnv } from "@/src/lib/env";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (!hasSupabaseAuthEnv()) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent("Configuracion pendiente")}`
    );
  }

  if (errorParam) {
    const desc =
      searchParams.get("error_description") ?? "Error de autenticacion con Google";
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(desc)}`
    );
  }

  if (code) {
    // Build the success redirect first so we can attach session cookies to it
    const redirectResponse = NextResponse.redirect(`${origin}${next}`);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Write cookies directly onto the redirect response, not onto next()
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            redirectResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

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

      return redirectResponse;
    }

    console.error("[auth/callback] exchangeCodeForSession error:", error.message);
    // Surface the real reason instead of a generic message so failures are
    // diagnosable from the sign-in screen.
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(`Google: ${error.message}`)}`
    );
  }

  return NextResponse.redirect(
    `${origin}/sign-in?error=${encodeURIComponent("Falto el codigo de autorizacion de Google")}`
  );
}
