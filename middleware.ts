import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const PROTECTED_PREFIXES = ["/dashboard", "/admin"];

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // ── 1. Forward OAuth codes to the proper callback handler ──────────────────
  // Supabase may redirect the code to the site root instead of /auth/callback
  // (e.g. when the Supabase dashboard "Site URL" is set to the bare domain).
  const code = searchParams.get("code");
  if (code && pathname !== "/auth/callback") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    // Keep ?code= and ?next= (or default to /dashboard)
    if (!url.searchParams.has("next")) {
      url.searchParams.set("next", "/dashboard");
    }
    return NextResponse.redirect(url);
  }

  // ── 2. Skip auth check when Supabase env is not configured ─────────────────
  if (!supabaseUrl || !supabasePublicKey) {
    return NextResponse.next({ request });
  }

  // ── 3. Refresh session cookies & protect routes ────────────────────────────
  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(supabaseUrl, supabasePublicKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

    if (isProtected && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
  } catch {
    // If Supabase is unreachable, let the request through rather than crashing.
    // Protected pages will re-check auth on the server and redirect if needed.
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
