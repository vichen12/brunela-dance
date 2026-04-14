export type Locale = "es" | "en";

const messages = {
  es: {
    brand: {
      name: "Brunela"
    },
    meta: {
      title: "Brunela Dance Trainer",
      description: "Pilates para bailarines con una arquitectura pensada para escalar."
    },
    nav: {
      signIn: "Ingresar",
      dashboard: "Dashboard",
      admin: "Admin"
    },
    common: {
      ready: "Listo",
      pending: "Pendiente"
    },
    home: {
      kicker: "Pilates para bailarines",
      title: "Una plataforma premium para entrenar, reservar y crecer con control total.",
      description:
        "Brunela Dance Trainer combina biblioteca on-demand, programas estructurados, progreso auditable y administración full control desde Supabase.",
      primaryCta: "Entrar al estudio",
      secondaryCta: "Ver panel admin",
      tiersEyebrow: "Membresías",
      metrics: [
        { value: "14 días", label: "Programas secuenciados y medibles" },
        { value: "15 clases", label: "Sistema de retención y recompensa" },
        { value: "3 niveles", label: "Acceso jerárquico sin hardcoding" }
      ],
      tiers: [
        {
          id: "corps_de_ballet",
          name: "Corps de Ballet",
          badge: "On-demand",
          description: "Acceso a biblioteca base, reanudación de clases y progreso diario."
        },
        {
          id: "solista",
          name: "Solista",
          badge: "Programas",
          description: "Suma programas de 14 días y una experiencia más estructurada."
        },
        {
          id: "principal",
          name: "Principal",
          badge: "En vivo",
          description: "Incluye clases en vivo, reservas y acceso controlado a Zoom."
        }
      ]
    },
    auth: {
      kicker: "Acceso seguro",
      title: "Ingresá a tu estudio.",
      description:
        "Este scaffold ya está preparado para trabajar con Supabase Auth, rutas protegidas y paneles diferenciados por rol.",
      adminHintTitle: "Tip de bootstrap",
      adminHintBody:
        "Tu cuenta tiene que existir en Supabase Auth antes de ejecutar bootstrap_admin_by_email en la base.",
      email: "Email",
      password: "Contraseña",
      submit: "Iniciar sesión",
      footer: "Si todavía no tenés usuario, crealo primero desde Supabase Auth o desde el signup de la app."
    },
    dashboard: {
      kicker: "Zona privada",
      greeting: (name: string) => `Hola, ${name}.`,
      description:
        "Este dashboard ya consulta Supabase en server components y queda listo para evolucionar hacia player, onboarding y biblioteca filtrada.",
      defaultName: "bailarín",
      signOut: "Cerrar sesión",
      membershipLabel: "Membresía actual",
      membershipHint: "La membresía se sincroniza desde la tabla subscriptions vía webhook.",
      subscriptionLabel: "Estado de suscripción",
      subscriptionHint: "Todavía no hay checkout conectado a Stripe.",
      noSubscription: "sin suscripción",
      renewsAt: (date: string) => `Renueva o vence el ${new Date(date).toLocaleDateString("es-AR")}`,
      onboardingLabel: "Onboarding",
      onboardingHint: "Luego sumamos el flujo con edad, lesiones, nivel técnico y objetivos.",
      resumeEyebrow: "Continuidad",
      resumeTitle: "Reanudar clase",
      resumeFallback: "Clase en progreso",
      resumeMeta: (seconds: number, percent: number) => `${seconds}s guardados · ${percent}% completado`,
      resumeButton: "Reanudar entrenamiento",
      resumeEmpty:
        "Todavía no hay una clase en progreso. Cuando agreguemos el player, este módulo mostrará la última sesión pausada.",
      quickAccessEyebrow: "Accesos rápidos",
      quickAccessTitle: "Siguiente capa",
      quickAccessAdmin: "Panel de administración",
      quickAccessAdminBody: "Revisá métricas iniciales, settings globales y próximos módulos CRUD.",
      quickAccessLibrary: "Biblioteca y player",
      quickAccessLibraryBody: "El siguiente paso funcional será construir el catálogo filtrable y el reproductor con progreso."
    },
    admin: {
      kicker: "Centro de mando",
      title: "Panel de administración base",
      subtitle: (email: string) => `Sesión administrativa activa para ${email}.`,
      settingsEyebrow: "Configuración global",
      settingsTitle: "Settings iniciales cargados",
      nextStepsEyebrow: "Roadmap inmediato",
      nextStepsTitle: "Qué conviene construir ahora",
      cards: {
        videos: "Videos",
        programs: "Programas",
        users: "Usuarios",
        liveSessions: "Clases en vivo"
      },
      nextSteps: [
        "Crear CRUD admin para videos con slug, metadata, tier y publicación.",
        "Crear CRUD admin para programas y program_days con validación de secuencia.",
        "Exponer un editor seguro para site_settings sin hardcoding en frontend.",
        "Conectar checkout de Stripe y alimentar subscriptions con metadata.user_id."
      ]
    }
  },
  en: {
    brand: {
      name: "Brunela"
    },
    meta: {
      title: "Brunela Dance Trainer",
      description: "Pilates for dancers with an architecture built to scale."
    },
    nav: {
      signIn: "Sign in",
      dashboard: "Dashboard",
      admin: "Admin"
    },
    common: {
      ready: "Ready",
      pending: "Pending"
    },
    home: {
      kicker: "Pilates for dancers",
      title: "A premium platform to train, book and grow with total control.",
      description:
        "Brunela Dance Trainer blends on-demand video, structured programs, auditable progress and an admin-first architecture.",
      primaryCta: "Enter studio",
      secondaryCta: "Open admin",
      tiersEyebrow: "Memberships",
      metrics: [
        { value: "14 days", label: "Sequenced and measurable programs" },
        { value: "15 classes", label: "Retention and rewards system" },
        { value: "3 tiers", label: "Hierarchical access without hardcoding" }
      ],
      tiers: [
        {
          id: "corps_de_ballet",
          name: "Corps de Ballet",
          badge: "On-demand",
          description: "Access to the base library, class resume and daily progress."
        },
        {
          id: "solista",
          name: "Soloist",
          badge: "Programs",
          description: "Adds 14-day programs and a more guided experience."
        },
        {
          id: "principal",
          name: "Principal",
          badge: "Live",
          description: "Includes live classes, booking and controlled Zoom access."
        }
      ]
    },
    auth: {
      kicker: "Secure access",
      title: "Enter your studio.",
      description:
        "This scaffold is already wired for Supabase Auth, protected routes and role-aware dashboards.",
      adminHintTitle: "Bootstrap tip",
      adminHintBody:
        "Your account must exist in Supabase Auth before running bootstrap_admin_by_email in the database.",
      email: "Email",
      password: "Password",
      submit: "Sign in",
      footer: "If you do not have a user yet, create it first in Supabase Auth or through the app signup flow."
    },
    dashboard: {
      kicker: "Private zone",
      greeting: (name: string) => `Hi, ${name}.`,
      description:
        "This dashboard already reads Supabase in server components and is ready for player, onboarding and filtered library work.",
      defaultName: "dancer",
      signOut: "Sign out",
      membershipLabel: "Current membership",
      membershipHint: "Membership syncs from the subscriptions table through Stripe webhooks.",
      subscriptionLabel: "Subscription status",
      subscriptionHint: "Stripe checkout is not connected yet.",
      noSubscription: "no subscription",
      renewsAt: (date: string) => `Renews or ends on ${new Date(date).toLocaleDateString("en-US")}`,
      onboardingLabel: "Onboarding",
      onboardingHint: "We will add age, injuries, technical level and goals next.",
      resumeEyebrow: "Continuity",
      resumeTitle: "Resume class",
      resumeFallback: "In-progress class",
      resumeMeta: (seconds: number, percent: number) => `${seconds}s saved · ${percent}% completed`,
      resumeButton: "Resume training",
      resumeEmpty:
        "There is no class in progress yet. Once the player is added, this module will surface the last paused session.",
      quickAccessEyebrow: "Quick access",
      quickAccessTitle: "Next layer",
      quickAccessAdmin: "Admin dashboard",
      quickAccessAdminBody: "Review seed metrics, global settings and the next CRUD modules.",
      quickAccessLibrary: "Library and player",
      quickAccessLibraryBody: "The next functional milestone is the filterable catalog and the progress-aware player."
    },
    admin: {
      kicker: "Control center",
      title: "Base admin dashboard",
      subtitle: (email: string) => `Administrative session active for ${email}.`,
      settingsEyebrow: "Global configuration",
      settingsTitle: "Seed settings loaded",
      nextStepsEyebrow: "Immediate roadmap",
      nextStepsTitle: "What to build next",
      cards: {
        videos: "Videos",
        programs: "Programs",
        users: "Users",
        liveSessions: "Live sessions"
      },
      nextSteps: [
        "Create admin CRUD for videos with slug, metadata, tier and publishing state.",
        "Create admin CRUD for programs and program_days with sequence validation.",
        "Expose a safe editor for site_settings with no frontend hardcoding.",
        "Connect Stripe checkout and feed subscriptions with metadata.user_id."
      ]
    }
  }
} satisfies Record<Locale, unknown>;

export function getDictionary(locale: Locale = "es") {
  return messages[locale];
}
