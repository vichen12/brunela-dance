import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  const supabase = await createSupabaseServerClient();

  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
  console.log("[api/auth/google] redirectTo:", redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  console.log("[api/auth/google] oauth url:", data?.url ?? "NONE");
  console.log("[api/auth/google] error:", error ?? "none");

  if (error || !data.url) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent("Error iniciando Google")}`
    );
  }

  return NextResponse.redirect(data.url);
}
