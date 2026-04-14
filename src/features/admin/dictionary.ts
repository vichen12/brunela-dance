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
      title: "Panel de administracion",
      description: "Centro de control para contenido, configuracion y usuarios.",
      sectionTitle: "Modulos activos",
      cards: {
        videos: "Biblioteca de videos",
        programs: "Programas de 14 dias",
        settings: "Configuracion global",
        users: "Usuarios y accesos"
      }
    },
    videos: {
      title: "Gestion de videos",
      description: "Crea, edita y publica videos con metadata administrable.",
      createTitle: "Nuevo video",
      listTitle: "Videos existentes",
      form: {
        slug: "Slug",
        titleEs: "Titulo ES",
        titleEn: "Titulo EN",
        descriptionEs: "Descripcion ES",
        descriptionEn: "Descripcion EN",
        tier: "Tier requerido",
        status: "Estado",
        duration: "Duracion (segundos)",
        categories: "Categorias (coma separada)",
        equipment: "Materiales (coma separada)",
        thumbnail: "Thumbnail URL",
        playbackId: "Playback ID",
        assetId: "Asset ID",
        featured: "Destacado",
        submitCreate: "Crear video",
        submitUpdate: "Guardar cambios",
        delete: "Eliminar"
      }
    },
    programs: {
      title: "Gestion de programas",
      description: "Administra programas y la secuencia dia por dia con slugs de video.",
      createTitle: "Nuevo programa",
      listTitle: "Programas existentes",
      daysTitle: "Dias del programa",
      form: {
        slug: "Slug",
        titleEs: "Titulo ES",
        titleEn: "Titulo EN",
        descriptionEs: "Descripcion ES",
        descriptionEn: "Descripcion EN",
        tier: "Tier requerido",
        status: "Estado",
        durationDays: "Cantidad de dias",
        coverImage: "Cover image URL",
        featured: "Destacado",
        submitCreate: "Crear programa",
        submitUpdate: "Guardar programa",
        delete: "Eliminar programa",
        dayNumber: "Dia",
        videoSlug: "Slug de video",
        addDay: "Guardar dia",
        deleteDay: "Quitar dia"
      }
    },
    settings: {
      title: "Configuracion global",
      description: "Edita site_settings sin hardcoding en frontend ni backend.",
      newTitle: "Nueva setting",
      listTitle: "Settings existentes",
      form: {
        key: "Setting key",
        category: "Categoria",
        description: "Descripcion",
        public: "Visible para clientes",
        value: "JSON value",
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
        level: "Nivel tecnico",
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
        slug: "Slug",
        titleEs: "Title ES",
        titleEn: "Title EN",
        descriptionEs: "Description ES",
        descriptionEn: "Description EN",
        tier: "Required tier",
        status: "Status",
        duration: "Duration (seconds)",
        categories: "Categories (comma separated)",
        equipment: "Equipment (comma separated)",
        thumbnail: "Thumbnail URL",
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
        slug: "Slug",
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
        value: "JSON value",
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
