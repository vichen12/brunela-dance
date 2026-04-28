export type Locale = "es" | "en";

const messages = {
  es: {
    brand: {
      name: "Brunela"
    },
    meta: {
      title: "Brunela Dance Trainer",
      description: "Pilates para bailarines con una experiencia editorial, elegante y pensada para escalar."
    },
    nav: {
      signIn: "Ingresar",
      dashboard: "Estudio",
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
        "Brunela Dance Trainer une biblioteca a demanda, programas estructurados y una experiencia de estudio online elegante.",
      primaryCta: "Entrar al estudio",
      secondaryCta: "Ver panel admin",
      tiersEyebrow: "Membresias",
      metrics: [
        { value: "14 dias", label: "Programas secuenciados y medibles" },
        { value: "15 clases", label: "Sistema de retencion y recompensa" },
        { value: "3 niveles", label: "Acceso jerarquico sin hardcoding" }
      ],
      tiers: [
        {
          id: "corps_de_ballet",
          name: "Corps de Ballet",
          badge: "On-demand",
          description: "Acceso a biblioteca base, reanudacion de clases y progreso diario."
        },
        {
          id: "solista",
          name: "Solista",
          badge: "Programas",
          description: "Suma programas de 14 dias y una experiencia mas estructurada."
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
      title: "Ingresa a tu estudio.",
      description:
        "Accede a tu espacio privado para continuar clases, revisar progreso y moverte dentro del estudio de Brunela.",
      adminHintTitle: "Nota de acceso",
      adminHintBody:
        "Si tu cuenta todavia no esta habilitada, primero debe existir en Auth para activar permisos especiales en la base.",
      email: "Email",
      password: "Contrasena",
      submit: "Iniciar sesion",
      footer: "Si todavia no tienes usuario, crea tu acceso primero y luego vuelve para entrar al estudio."
    },
    dashboard: {
      kicker: "Zona privada",
      greeting: (name: string) => `Hola, ${name}.`,
      description:
        "Tu zona privada combina continuidad, estetica de estudio y una base lista para clases, programas y crecimiento.",
      defaultName: "bailarin",
      signOut: "Cerrar sesion",
      membershipLabel: "Membresia actual",
      membershipHint: "Tu acceso define que contenido ves dentro del estudio.",
      subscriptionLabel: "Estado de suscripcion",
      subscriptionHint: "Cuando el checkout este activo, aqui veras tu estado en tiempo real.",
      noSubscription: "sin suscripcion",
      renewsAt: (date: string) => `Renueva o vence el ${new Date(date).toLocaleDateString("es-AR")}`,
      onboardingLabel: "Onboarding",
      onboardingHint: "Aqui se mostrara si tu perfil tecnico ya esta completo con nivel, objetivos y contexto fisico.",
      resumeEyebrow: "Continuidad",
      resumeTitle: "Reanudar clase",
      resumeFallback: "Clase en progreso",
      resumeMeta: (seconds: number, percent: number) => `${seconds}s guardados · ${percent}% completado`,
      resumeButton: "Reanudar entrenamiento",
      resumeEmpty:
        "Todavia no hay una clase en progreso. Cuando empieces a practicar, aqui aparecera tu ultima sesion pausada.",
      quickAccessEyebrow: "Accesos rapidos",
      quickAccessTitle: "Siguiente capa",
      quickAccessAdmin: "Panel de administracion",
      quickAccessAdminBody: "Gestiona contenido, settings globales y accesos desde una experiencia backstage ordenada.",
      quickAccessLibrary: "Biblioteca y player",
      quickAccessLibraryBody: "La siguiente fase natural es convertir esto en una experiencia completa de catalogo, filtros y reproduccion."
    },
    admin: {
      kicker: "Centro de mando",
      title: "Panel de administracion base",
      subtitle: (email: string) => `Sesion administrativa activa para ${email}.`,
      settingsEyebrow: "Configuracion global",
      settingsTitle: "Settings iniciales cargados",
      nextStepsEyebrow: "Roadmap inmediato",
      nextStepsTitle: "Que conviene construir ahora",
      cards: {
        videos: "Videos",
        programs: "Programas",
        users: "Usuarios",
        liveSessions: "Clases en vivo"
      },
      nextSteps: [
        "Crear CRUD admin para videos con slug, metadata, tier y publicacion.",
        "Crear CRUD admin para programas y program_days con validacion de secuencia.",
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
      description: "Pilates for dancers with an editorial, elegant experience built to scale."
    },
    nav: {
      signIn: "Sign in",
      dashboard: "Studio",
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
        "Brunela Dance Trainer blends on-demand training, structured programs and an elegant online studio experience.",
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
        "Access your private space to continue classes, review progress and move through Brunela's full studio experience.",
      adminHintTitle: "Access note",
      adminHintBody:
        "If your account is not enabled yet, it must exist in Auth before special permissions can be activated in the database.",
      email: "Email",
      password: "Password",
      submit: "Sign in",
      footer: "If you do not have a user yet, create your access first and then come back to enter the studio."
    },
    dashboard: {
      kicker: "Private zone",
      greeting: (name: string) => `Hi, ${name}.`,
      description:
        "Your private area blends continuity, studio-like aesthetics and a foundation ready for classes, programs and growth.",
      defaultName: "dancer",
      signOut: "Sign out",
      membershipLabel: "Current membership",
      membershipHint: "Your membership determines which parts of the studio you can access.",
      subscriptionLabel: "Subscription status",
      subscriptionHint: "Once checkout is live, your billing status will appear here in real time.",
      noSubscription: "no subscription",
      renewsAt: (date: string) => `Renews or ends on ${new Date(date).toLocaleDateString("en-US")}`,
      onboardingLabel: "Onboarding",
      onboardingHint: "This area will show whether your technical profile is fully completed.",
      resumeEyebrow: "Continuity",
      resumeTitle: "Resume class",
      resumeFallback: "In-progress class",
      resumeMeta: (seconds: number, percent: number) => `${seconds}s saved · ${percent}% completed`,
      resumeButton: "Resume training",
      resumeEmpty:
        "There is no class in progress yet. As soon as practice begins, this module will surface the latest paused session.",
      quickAccessEyebrow: "Quick access",
      quickAccessTitle: "Next layer",
      quickAccessAdmin: "Admin dashboard",
      quickAccessAdminBody: "Manage content, global settings and access from a cleaner backstage experience.",
      quickAccessLibrary: "Library and player",
      quickAccessLibraryBody: "The next natural phase is a complete catalog, filtering and playback experience."
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
