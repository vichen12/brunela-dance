import { cache } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { getProgresoDelUsuario, paraRetomar } from "@/src/features/studio/progress";
import { StudioSidebar } from "@/components/studio-sidebar";
import { MobileDashboardNav } from "@/components/mobile-dashboard-nav";
import { fuenteSistema } from "@/src/lib/fuente-sistema";
import { getNotificaciones } from "@/src/features/studio/notificaciones";
import { Notificaciones } from "@/components/notificaciones";
import { AvisoFinGratis } from "@/components/aviso-fin-gratis";
import { aplicarBajaSiVencio, getAccesoGratis } from "@/src/features/studio/acceso-gratis";
import { PLAN_LABEL, diasRestantes, estaVencido, fechaLarga } from "@/src/features/studio/acceso-gratis-reglas";
import type { Notificacion } from "@/src/features/studio/notificaciones";

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
  const [profile, seguirViendo, { data: fotoData }, acceso] = await Promise.all([
    getProfile(user.id),
    getSeguirViendo(user.id),
    (await createSupabaseServerClient()).from("profiles").select("avatar_url").eq("id", user.id).maybeSingle(),
    // Consulta aparte y tolerante: sin la migracion 20261009 devuelve
    // `disponible: false` y todo lo del acceso gratis se oculta.
    getAccesoGratis(user.id),
  ]);

  // ACCESO GRATIS VENCIDO: baja en el momento, sin esperar al cron.
  //
  // Solo para quien entro (user.id de la sesion), y solo si vencio, tiene un
  // plan, no es admin y no paga una suscripcion -- las condiciones se repiten
  // dentro de la propia escritura. Si la baja se aplico, se recarga el inicio:
  // el perfil memoizado de esta request ya traia el plan viejo, y la pagina
  // pintaria clases abiertas que la base ya no le deja ver. En la recarga el
  // plan ya es 'none' y esta rama no vuelve a entrar.
  //
  // SIN redirect: redirigir desde el layout en medio de la navegacion que viene
  // del login dejaba al navegador recargando en bucle (pantalla en blanco, se
  // vio probandolo). En vez de eso se corrige el perfil de ESTA request: es el
  // mismo objeto memoizado que leen las paginas, asi que el aviso de fin y los
  // candados salen ya en esta carga. Lo que se reproduce lo decide igual la
  // base (RLS), que ya tiene el plan en 'none'.
  if (profile && await aplicarBajaSiVencio(user.id, profile.membership_tier, profile.is_admin, acceso)) {
    profile.membership_tier = "none";
  }

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

  // El nombre de quien entro. Antes cualquier admin leia "BRUNELA", y hay tres.
  const userName = (
    profile?.full_name?.trim().split(/\s+/)[0] ||
    user.email?.split("@")[0] ||
    "alumna"
  );
  // Sin mayusculas: el redisenio suave muestra el nombre como se escribe.

  const isAdmin = profile?.is_admin ?? false;
  const notificaciones = await getNotificaciones(user.id, profile?.membership_tier ?? "none", isAdmin);

  // Recordatorios del acceso gratis en la campanita: a 7 dias, a 1 y el dia
  // que termina. El id cambia con la etapa (y con la fecha, por si se lo
  // extienden): marcar como leido el de 7 dias no apaga el de "hoy".
  const tier = profile?.membership_tier ?? "none";
  const gratisVigente = acceso.disponible && !isAdmin && !!acceso.hasta && !estaVencido(acceso.hasta) && tier !== "none";
  const recordatoriosGratis: Notificacion[] = [];
  if (gratisVigente) {
    const d = diasRestantes(acceso.hasta!);
    const plan = acceso.plan ? PLAN_LABEL[acceso.plan] : "tu plan";
    if (d <= 7) {
      const etapa = d <= 0 ? "hoy" : d === 1 ? "1" : "7";
      recordatoriosGratis.push({
        id: `gratis-${etapa}-${acceso.hasta}`,
        tipo: "recordatorio",
        titulo: d <= 0 ? `Tu acceso gratis a ${plan} termina hoy` : d === 1 ? `Tu acceso gratis a ${plan} termina mañana` : `Te quedan ${d} días de ${plan} gratis`,
        texto: `Hasta el ${fechaLarga(acceso.hasta!)}. Elegí tu plan para seguir con tus clases sin cortes.`,
        cuando: null,
        href: "/dashboard/plan",
      });
    }
  }

  // El aviso grande de fin: una sola vez. Despues queda la franja del inicio.
  const mostrarAvisoFin = acceso.disponible && !isAdmin && tier === "none" && estaVencido(acceso.hasta) && !acceso.avisoVistoAt;

  return (
    <>
      <style>{`
        .mobile-dash-nav { display: none; }
        @media (max-width: 767px) {
          .studio-sidebar-wrapper { display: none !important; }
          .mobile-dash-nav { display: block !important; }
          .dashboard-content { padding-bottom: 96px !important; }
          .chat-col-sidebar { display: none !important; }
        }
      `}</style>
      {/* overflow-x: clip y no hidden: hidden rompe position: sticky de adentro. */}
      <div className={`sistema ${fuenteSistema.variable}`} style={{ display: "flex", minHeight: "100vh", overflowX: "clip" }}>
        <div className="studio-sidebar-wrapper">
          <StudioSidebar
            userName={userName}
            foto={fotoData?.avatar_url ?? null}
            membershipTier={profile?.membership_tier ?? "none"}
            isAdmin={isAdmin}
            seguirViendo={seguirViendo}
          />
        </div>
        <div className="dashboard-content zona-app" style={{ flex: 1, minWidth: 0, overflowX: "hidden", position: "relative" }}>
          {/* Campanita: invitaciones y anuncios, arriba a la derecha. */}
          <div className="nt-barra"><Notificaciones items={[...recordatoriosGratis, ...notificaciones]} /></div>
          {children}
        </div>
        <MobileDashboardNav isAdmin={isAdmin} />
        {mostrarAvisoFin && (
          <AvisoFinGratis plan={acceso.plan ? PLAN_LABEL[acceso.plan] : null} nombre={profile?.full_name?.trim().split(/\s+/)[0] ?? ""} />
        )}
      </div>
    </>
  );
}
