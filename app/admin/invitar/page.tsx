import { ArrowRight, Users } from "lucide-react";
import { AdminBoton, AdminCabecera } from "@/components/admin-ui";
import { NuevaAlumnaGratis } from "@/components/nueva-alumna-gratis";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { AVISO_FALTA_MIGRACION, esFaltaDeMigracion } from "@/src/features/studio/acceso-gratis-reglas";

export const dynamic = "force-dynamic";

/**
 * Invitar alumna, con su propia pantalla (2026-11-09).
 *
 * Antes "Invitar alumna" llevaba a la lista de Alumnas con un formulario
 * plegado arriba: el menu marcaba dos cosas a la vez y no se entendia donde
 * estaba. El formulario es el mismo (components/nueva-alumna-gratis.tsx): crea
 * la cuenta, le regala los meses que elija Brunela y le manda el mail.
 */
export default async function InvitarAlumnaPage() {
  await requireAdmin();
  // Sin la migracion de acceso gratis el formulario no puede guardar: se avisa.
  const { error } = await createSupabaseAdminClient().from("profiles").select("acceso_gratis_hasta").limit(1);
  const disponible = !error || !esFaltaDeMigracion(error);

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <AdminCabecera
        eyebrow="Comunidad"
        titulo="Invitar alumna"
        lede="Escribí su nombre y su correo, elegí el plan y cuántos meses le regalás. Le llega un mail para entrar al estudio."
        acciones={<AdminBoton href="/admin/users"><Users size={16} strokeWidth={2.2} aria-hidden="true" /> Ver alumnas <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" /></AdminBoton>}
      />
      <section style={{ padding: "clamp(20px, 2.6vw, 28px)", borderRadius: 28, background: "#fff", border: "1px solid var(--linea)", boxShadow: "var(--sombra)" }}>
        {disponible ? <NuevaAlumnaGratis /> : <div role="status" className="ad-aviso ad-aviso--error">{AVISO_FALTA_MIGRACION}</div>}
      </section>
    </main>
  );
}
