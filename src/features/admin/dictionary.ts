export type AdminLocale = "es" | "en";

const adminMessages = {
  es: {
    nav: {
      overview: "Resumen",
      videos: "Videos",
      programs: "Programas",
      settings: "Settings",
      users: "Usuarios"
    },
    flash: {
      success: "Operacion guardada correctamente.",
      error: "Ocurrio un error al guardar."
    },
    overview: {
      title: "Panel de administración",
      description: "Centro de control para contenido, configuracion y usuarios.",
      sectionTitle: "Modulos activos",
      cards: {
        videos: "Biblioteca de videos",
        programs: "Programas de 14 dias",
        settings: "Configuración del estudio",
        users: "Usuarios y accesos"
      }
    },
    videos: {
      title: "Gestión de clases",
      description: "Crea, edita y publica videos con metadata administrable.",
      createTitle: "Nuevo video",
      listTitle: "Videos existentes",
      form: {
        slug: "Dirección",
        titleEs: "Título en español",
        titleEn: "Título en inglés",
        descriptionEs: "Descripción en español",
        descriptionEn: "Descripción en inglés",
        tier: "Tier requerido",
        status: "Estado",
        duration: "Duración (minutos)",
        categories: "Categorías",
        equipment: "Materiales",
        thumbnail: "Imagen de portada",
        playbackId: "Playback ID",
        assetId: "Asset ID",
        featured: "Destacado",
        submitCreate: "Crear video",
        submitUpdate: "Guardar cambios",
        delete: "Eliminar"
      }
    },
    programs: {
      title: "Gestión de programas",
      description: "Administra programas y la secuencia dia por dia con slugs de video.",
      createTitle: "Nuevo programa",
      listTitle: "Programas existentes",
      daysTitle: "Dias del programa",
      form: {
        slug: "Dirección",
        titleEs: "Título en español",
        titleEn: "Título en inglés",
        descriptionEs: "Descripción en español",
        descriptionEn: "Descripción en inglés",
        tier: "Tier requerido",
        status: "Estado",
        durationDays: "Cantidad de dias",
        coverImage: "Cover image URL",
        featured: "Destacado",
        submitCreate: "Crear programa",
        submitUpdate: "Guardar programa",
        delete: "Eliminar programa",
        dayNumber: "Dia",
        videoSlug: "Clase",
        addDay: "Guardar dia",
        deleteDay: "Quitar dia"
      }
    },
    settings: {
      title: "Configuración del estudio",
      description: "Edita site_settings sin hardcoding en frontend ni backend.",
      newTitle: "Nueva setting",
      listTitle: "Settings existentes",
      form: {
        key: "Setting key",
        category: "Categoria",
        description: "Descripción",
        public: "Visible para clientes",
        value: "Valor",
        submitCreate: "Guardar setting",
        submitUpdate: "Actualizar setting"
      }
    },
    users: {
      title: "Usuarios y accesos",
      description: "Administra nivel tecnico, tier y permisos de administracion.",
      listTitle: "Perfiles",
      form: {
        tier: "Tier",
        level: "Nivel técnico",
        onboarding: "Onboarding completo",
        admin: "Es admin",
        submit: "Guardar usuario"
      }
    },
    labels: {
      email: "Email",
      empty: "Sin datos todavia."
    }
  },
  en: {
    nav: {
      overview: "Overview",
      videos: "Videos",
      programs: "Programs",
      settings: "Settings",
      users: "Users"
    },
    flash: {
      success: "Saved successfully.",
      error: "Something went wrong while saving."
    },
    overview: {
      title: "Admin dashboard",
      description: "Control center for content, configuration and access.",
      sectionTitle: "Active modules",
      cards: {
        videos: "Video library",
        programs: "14-day programs",
        settings: "Global configuration",
        users: "Users and access"
      }
    },
    videos: {
      title: "Video management",
      description: "Create, edit and publish videos with fully managed metadata.",
      createTitle: "New video",
      listTitle: "Existing videos",
      form: {
        slug: "Dirección",
        titleEs: "Title ES",
        titleEn: "Title EN",
        descriptionEs: "Description ES",
        descriptionEn: "Description EN",
        tier: "Required tier",
        status: "Status",
        duration: "Duration (seconds)",
        categories: "Categories (comma separated)",
        equipment: "Equipment (comma separated)",
        thumbnail: "Imagen de portada",
        playbackId: "Playback ID",
        assetId: "Asset ID",
        featured: "Featured",
        submitCreate: "Create video",
        submitUpdate: "Save changes",
        delete: "Delete"
      }
    },
    programs: {
      title: "Program management",
      description: "Manage programs and day-by-day sequencing with video slugs.",
      createTitle: "New program",
      listTitle: "Existing programs",
      daysTitle: "Program days",
      form: {
        slug: "Dirección",
        titleEs: "Title ES",
        titleEn: "Title EN",
        descriptionEs: "Description ES",
        descriptionEn: "Description EN",
        tier: "Required tier",
        status: "Status",
        durationDays: "Days count",
        coverImage: "Cover image URL",
        featured: "Featured",
        submitCreate: "Create program",
        submitUpdate: "Save program",
        delete: "Delete program",
        dayNumber: "Day",
        videoSlug: "Video slug",
        addDay: "Save day",
        deleteDay: "Remove day"
      }
    },
    settings: {
      title: "Global configuration",
      description: "Edit site_settings without hardcoding frontend or backend rules.",
      newTitle: "New setting",
      listTitle: "Existing settings",
      form: {
        key: "Setting key",
        category: "Category",
        description: "Description",
        public: "Visible to clients",
        value: "Valor",
        submitCreate: "Save setting",
        submitUpdate: "Update setting"
      }
    },
    users: {
      title: "Users and access",
      description: "Manage technical level, tier and admin permissions.",
      listTitle: "Profiles",
      form: {
        tier: "Tier",
        level: "Technical level",
        onboarding: "Onboarding complete",
        admin: "Is admin",
        submit: "Save user"
      }
    },
    labels: {
      email: "Email",
      empty: "No data yet."
    }
  }
} as const;

export function getAdminDictionary(locale: AdminLocale = "es") {
  return adminMessages[locale];
}
