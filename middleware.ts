import { NextResponse, type NextRequest } from "next/server";

/**
 * Minimal middleware – only handles the OAuth code-forwarding edge case.
 * Route protection is enforced in each Server Component (requireAdmin, etc.).
 */
export function middleware(request: NextRequest) {
  // Forward OAuth codes that Supabase may redirect to the site root
  // instead of /auth/callback when "Site URL" is set to the bare domain.
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code && url.pathname !== "/auth/callback") {
    url.pathname = "/auth/callback";
    if (!url.searchParams.has("next")) {
      url.searchParams.set("next", "/dashboard");
    }
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Run on all pages except Next.js internals and static files
export const config = {
  matcher: "/((?!_next|favicon.ico|.*\\.).*)",
};
