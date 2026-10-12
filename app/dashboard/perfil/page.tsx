import { requireUser } from "@/src/features/auth/guards";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { AdminAviso, AdminCabecera } from "@/components/admin-ui";
import { CSS_MI_PERFIL, MiPerfil } from "@/components/mi-perfil";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { membershipTierLabel } from "@/src/features/studio/helpers";
import { CSS_MIS_CORREOS, MisCorreos } from "@/components/mis-correos";
import { dioDeBajaClasesNuevas, esColumnaAusente, INTERRUPTORES_DE_CORREO, tipoDesactivado } from "@/src/features/correos/reglas";

type Preferencias = {
  marketing_opt_in: boolean | null;
  marketing_opt_out_at: string | null;
  correos_desactivados?: string[] | null;
};

/** Que interruptores estan encendidos. Sin la columna (falta la migracion) = todos los demas encendidos. */
function interruptoresEncendidos(p: Preferencias | null): Set<string> {
  const out = new Set<string>();
  for (const i of INTERRUPTORES_DE_CORREO) {
    if (i.campo === "clase_nueva") {
      if (!p || !dioDeBajaClasesNuevas(p)) out.add(i.campo);
    } else if (!i.tipos.some((t) => tipoDesactivado(p?.correos_desactivados, t))) {
      out.add(i.campo);
    }
  }
  return out;
}

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function PerfilAlumnaPage({ searchParams }: { searchParams?: SP }) {
  const { user } = await requireUser();
  const sp = (await searchParams) ?? {};
  const perfil = await getCurrentProfile(user.id);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();
  // Con el cliente de ella: RLS le devuelve solo su fila.
  let prefs = await supabase
    .from("profiles")
    .select("marketing_opt_in, marketing_opt_out_at, correos_desactivados")
    .eq("id", user.id)
    .maybeSingle<Preferencias>();
  if (prefs.error && esColumnaAusente(prefs.error)) {
    prefs = await supabase.from("profiles").select("marketing_opt_in, marketing_opt_out_at").eq("id", user.id).maybeSingle<Preferencias>();
  }

  return (
    <main style={{ maxWidth: 1320, margin: "0 auto", padding: "clamp(20px, 3vw, 40px) clamp(16px, 3.4vw, 48px) 80px" }}>
      <style>{CSS_MI_PERFIL + CSS_MIS_CORREOS}</style>
      <AdminCabecera eyebrow="Tu cuenta" titulo="Mi perfil" lede="Tu nombre y tu foto (así te ven Brunela y tus compañeras en el chat), y qué correos querés recibir." />
      <AdminAviso mensaje={typeof sp.success === "string" ? sp.success : null} tono="ok" />
      <AdminAviso mensaje={typeof sp.error === "string" ? sp.error : null} tono="error" />
      <MiPerfil
        nombre={perfil?.full_name ?? ""}
        email={perfil?.email ?? user.email ?? ""}
        foto={data?.avatar_url ?? null}
        plan={membershipTierLabel(perfil?.membership_tier ?? "none")}
        volver="/dashboard/perfil"
      />
      <MisCorreos encendidos={interruptoresEncendidos(prefs.data ?? null)} />
    </main>
  );
}
