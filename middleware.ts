import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/admin"];

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // ── 1. Forward OAuth codes that land on the wrong URL ─────────────────────
  // Supabase can redirect ?code= to the site root instead of /auth/callback
  // when the project's "Site URL" is set to the bare domain.
  const code = searchParams.get("code");
  if (code && pathname !== "/auth/callback") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    if (!url.searchParams.has("next")) {
      url.searchParams.set("next", "/dashboard");
    }
    return NextResponse.redirect(url);
  }

  // ── 2. Light cookie-based guard for protected routes ──────────────────────
  // Full session validation (with JWT verification) is done inside each
  // protected Server Component via requireAdmin() / createSupabaseServerClient().
  // Here we just prevent a flash of unauthenticated UI for common cases.
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isProtected) {
    const hasSession = request.cookies
      .getAll()
      .some(
        (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"),
      );

    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
