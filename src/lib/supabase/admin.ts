import { createClient } from "@supabase/supabase-js";
import { fetchConReintento } from "@/src/lib/supabase/reintento";

/**
 * Service-role Supabase client — bypasses RLS entirely.
 * Only use inside server actions or API routes after verifying is_admin.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  // fetchConReintento: repite el pedido si la base lo rechaza por un desfase de reloj.
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchConReintento } });
}
