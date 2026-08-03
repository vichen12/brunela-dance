import { cache } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { getProgresoDelUsuario, paraRetomar } from "@/src/features/studio/progress";
import { StudioSidebar } from "@/components/studio-sidebar";
import { MobileDashboardNav } from "@/components/mobile-dashboard-nav";

type MembershipTier = "none" | "corps_de_ballet" | "solista" | "principal";
type MemberProfile = { full_name: string | null; membership_tier: MembershipTier; is_admin: boolean };

// El perfil sale de getCurrentProfile (memoizado por request), no de una
// consulta propia: antes el layout y la pagina pedian la misma fila dos veces.
const getProfile = getCurrentProfile;

/**
 * La clase empezada y sin terminar mas reciente, para el boton principal del
 * menu. Devuelve null cuando no hay ninguna: en ese caso el boton NO lleva a
 * una pantalla vacia, ofrece explorar la biblioteca.
 *
 * Sale del progreso ya memoizado por request, sin consulta propia: antes esta
 * pantalla pedia `user_progress` una tercera vez.
 */
const getSeguirViendo = cache(async (userId: string) => {
  const video = paraRetomar(await getProgresoDelUsuario(userId))?.videos;
  if (!video?.slug) return null;
  return { slug: video.slug, title: video.title_i18n?.es ?? video.title_i18n?.en ?? "tu clase" };
});

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  const [profile, seguirViendo] = await Promise.all([getProfile(user.id), getSeguirViendo(user.id)]);

  // COMPUERTA DE ONBOARDING
  //
  // Va en el layout y no en el flujo de registro a proposito: un parametro en
  // la URL se puede perder o esquivar, una compuerta no. Da igual como haya
  // entrado -- por correo, por Google o por un marcador guardado: si le falta
  // el onboarding, lo hace.
  //
  // Las admin quedan afuera: sus cuentas se crearon a mano o se importaron, y
  // ninguna paso por este flujo. Sin esta excepcion, Brunela entraria a su
  // propio panel y le pediriamos que declare su nivel de ballet.
  if (profile && !profile.is_admin && !profile.onboarding_completed) {
    redirect("/registro/onboarding" as never);
  }

  const userName = profile?.is_admin
    ? "BRUNELA"
    : (profile?.full_name?.split(" ")[0]?.toUpperCase() ??
       (user.email?.split("@")[0] ?? "ALUMNA").toUpperCase());

  const isAdmin = profile?.is_admin ?? false;

  return (
    <>
      <style>{`
        .mobile-dash-nav { display: none; }
        @media (max-width: 767px) {
          .studio-sidebar-wrapper { display: none !important; }
          .mobile-dash-nav { display: block !important; }
          .dashboard-content { padding-bottom: 74px !important; }
          .chat-col-sidebar { display: none !important; }
        }
      `}</style>
      <div style={{ display: "flex", minHeight: "100vh", background: "#fafaf9" }}>
        <div className="studio-sidebar-wrapper">
          <StudioSidebar
            userName={userName}
            membershipTier={profile?.membership_tier ?? "none"}
            isAdmin={isAdmin}
            seguirViendo={seguirViendo}
          />
        </div>
        <div className="dashboard-content" style={{ flex: 1, minWidth: 0, overflowX: "hidden" }}>
          {children}
        </div>
      </div>
      <MobileDashboardNav isAdmin={isAdmin} />
    </>
  );
}
