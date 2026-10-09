import { requireAdmin } from "@/src/features/auth/guards";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { AdminAviso, AdminCabecera } from "@/components/admin-ui";
import { CSS_MI_PERFIL, MiPerfil } from "@/components/mi-perfil";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function PerfilAdminPage({ searchParams }: { searchParams?: SP }) {
  const { user } = await requireAdmin();
  const sp = (await searchParams) ?? {};
  const perfil = await getCurrentProfile(user.id);
  // La foto no viene en getCurrentProfile: se lee aparte.
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();

  return (
    <main>
      <style>{CSS_MI_PERFIL}</style>
      <AdminCabecera eyebrow="Tu cuenta" titulo="Mi perfil" lede="Tu nombre y tu foto: así te ven las alumnas en el chat y en las clases." />
      <AdminAviso mensaje={typeof sp.success === "string" ? sp.success : null} tono="ok" />
      <AdminAviso mensaje={typeof sp.error === "string" ? sp.error : null} tono="error" />
      <MiPerfil
        nombre={perfil?.full_name ?? ""}
        email={perfil?.email ?? user.email ?? ""}
        foto={data?.avatar_url ?? null}
        plan="Administración"
        volver="/admin/perfil"
      />
    </main>
  );
}
