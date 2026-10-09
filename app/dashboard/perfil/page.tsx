import { requireUser } from "@/src/features/auth/guards";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { AdminAviso, AdminCabecera } from "@/components/admin-ui";
import { CSS_MI_PERFIL, MiPerfil } from "@/components/mi-perfil";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { membershipTierLabel } from "@/src/features/studio/helpers";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function PerfilAlumnaPage({ searchParams }: { searchParams?: SP }) {
  const { user } = await requireUser();
  const sp = (await searchParams) ?? {};
  const perfil = await getCurrentProfile(user.id);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();

  return (
    <main style={{ maxWidth: 1320, margin: "0 auto", padding: "clamp(20px, 3vw, 40px) clamp(16px, 3.4vw, 48px) 80px" }}>
      <style>{CSS_MI_PERFIL}</style>
      <AdminCabecera eyebrow="Tu cuenta" titulo="Mi perfil" lede="Tu nombre y tu foto: así te ven Brunela y tus compañeras en el chat." />
      <AdminAviso mensaje={typeof sp.success === "string" ? sp.success : null} tono="ok" />
      <AdminAviso mensaje={typeof sp.error === "string" ? sp.error : null} tono="error" />
      <MiPerfil
        nombre={perfil?.full_name ?? ""}
        email={perfil?.email ?? user.email ?? ""}
        foto={data?.avatar_url ?? null}
        plan={membershipTierLabel(perfil?.membership_tier ?? "none")}
        volver="/dashboard/perfil"
      />
    </main>
  );
}
