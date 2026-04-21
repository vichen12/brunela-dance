import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "@/src/lib/env";

export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  const env = getSupabasePublicEnv();
  const cookieStore = await cookies();

  // Collect cookies Supabase wants to set (PKCE code_verifier) so we can
  // attach them to the redirect response — NextResponse.redirect creates a
  // new response object and doesn't inherit cookies set via cookies().set().
  const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        pendingCookies.push(...cookiesToSet);
      },
    },
  });

  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    console.error("[api/auth/google] error:", error);
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent("Error iniciando Google")}`
    );
  }

  const response = NextResponse.redirect(data.url);

  // Copy PKCE verifier cookies onto the redirect response
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
  }

  return response;
}
