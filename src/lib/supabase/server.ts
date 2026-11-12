import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "@/src/lib/env";
import { fetchConReintento } from "@/src/lib/supabase/reintento";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Creates a Supabase client for server components and server actions.
 */
export async function createSupabaseServerClient() {
  const env = getSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    // Repite el pedido si la base lo rechaza por un desfase de reloj (reintento.ts).
    global: { fetch: fetchConReintento },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Cookie writes can fail during static render phases; server actions still handle auth writes.
        }
      }
    }
  });
}
