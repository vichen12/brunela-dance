import { mensajeDeCuenta } from "@/src/features/auth/mensaje-de-cuenta";
import { rutaPropia } from "@/src/lib/ruta-propia";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseAuthEnv } from "@/src/lib/env";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rutaPropia(rawNext, "/dashboard");

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
    // "PKCE code verifier not found": el enlace se abrio en otro navegador que
    // el que lo pidio (tipico: se pide en Safari y el correo lo abre la app de
    // Gmail). El texto crudo en ingles no le decia nada a nadie.
    const otroNavegador = /code verifier/i.test(error.message);
    const motivo = otroNavegador
      ? "Ese enlace se abrió en un navegador distinto al que lo pidió. Pedí uno nuevo y abrilo en el mismo navegador, o entrá con tu contraseña."
      : mensajeDeCuenta(error, "No se pudo entrar con ese enlace. Si venía de un correo, pedí uno nuevo.");
    return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(motivo)}`);
  }

  return NextResponse.redirect(
    `${origin}/sign-in?error=${encodeURIComponent("Falto el codigo de autorizacion de Google")}`
  );
}
