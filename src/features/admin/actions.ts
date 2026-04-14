"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const videoSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  slug: z.string().min(3),
  titleEs: z.string().min(1),
  titleEn: z.string().optional(),
  descriptionEs: z.string().min(1),
  descriptionEn: z.string().optional(),
  membershipTierRequired: z.enum(["corps_de_ballet", "solista", "principal"]),
  status: z.enum(["draft", "published", "archived"]),
  durationSeconds: z.coerce.number().int().positive(),
  categories: z.string().optional(),
  equipment: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  streamPlaybackId: z.string().optional(),
  streamAssetId: z.string().optional(),
  isFeatured: z.boolean().default(false)
});

const programSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  slug: z.string().min(3),
  titleEs: z.string().min(1),
  titleEn: z.string().optional(),
  descriptionEs: z.string().min(1),
  descriptionEn: z.string().optional(),
  membershipTierRequired: z.enum(["solista", "principal"]),
  status: z.enum(["draft", "published", "archived"]),
  durationDays: z.coerce.number().int().positive(),
  coverImageUrl: z.string().optional(),
  isFeatured: z.boolean().default(false)
});

const programDaySchema = z.object({
  programId: z.string().uuid(),
  dayNumber: z.coerce.number().int().positive(),
  videoSlug: z.string().min(1)
});

const siteSettingSchema = z.object({
  settingKey: z.string().min(3),
  category: z.string().min(1),
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
  value: z.string().min(1)
});

const profileSchema = z.object({
  profileId: z.string().uuid(),
  membershipTier: z.enum(["none", "corps_de_ballet", "solista", "principal"]),
  technicalLevel: z.enum(["principiante", "intermedio", "avanzado", "profesional", "maestro"]),
  onboardingCompleted: z.boolean().default(false),
  isAdmin: z.boolean().default(false)
});

function parseCsv(input: string | undefined) {
  return (input ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildI18n(es: string, en?: string) {
  return {
    es,
    ...(en?.trim() ? { en: en.trim() } : {})
  };
}

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function redirectWithMessage(path: string, kind: "success" | "error", message: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message)}` as never);
}

function refreshAdminRoutes() {
  revalidatePath("/admin");
  revalidatePath("/admin/videos");
  revalidatePath("/admin/programs");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/users");
}

export async function upsertVideoAction(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const parsed = videoSchema.safeParse({
    id: formData.get("id"),
    slug: formData.get("slug"),
    titleEs: formData.get("titleEs"),
    titleEn: formData.get("titleEn"),
    descriptionEs: formData.get("descriptionEs"),
    descriptionEn: formData.get("descriptionEn"),
    membershipTierRequired: formData.get("membershipTierRequired"),
    status: formData.get("status"),
    durationSeconds: formData.get("durationSeconds"),
    categories: formData.get("categories"),
    equipment: formData.get("equipment"),
    thumbnailUrl: formData.get("thumbnailUrl"),
    streamPlaybackId: formData.get("streamPlaybackId"),
    streamAssetId: formData.get("streamAssetId"),
    isFeatured: checkboxValue(formData, "isFeatured")
  });

  if (!parsed.success) {
    redirectWithMessage("/admin/videos", "error", "Datos de video invalidos.");
  }

  const payload = {
    slug: parsed.data.slug.trim(),
    title_i18n: buildI18n(parsed.data.titleEs.trim(), parsed.data.titleEn),
    description_i18n: buildI18n(parsed.data.descriptionEs.trim(), parsed.data.descriptionEn),
    membership_tier_required: parsed.data.membershipTierRequired,
    status: parsed.data.status,
    duration_seconds: parsed.data.durationSeconds,
    category_slugs: parseCsv(parsed.data.categories),
    equipment: parseCsv(parsed.data.equipment),
    thumbnail_url: parsed.data.thumbnailUrl?.trim() || null,
    stream_playback_id: parsed.data.streamPlaybackId?.trim() || null,
    stream_asset_id: parsed.data.streamAssetId?.trim() || null,
    is_featured: parsed.data.isFeatured,
    published_at: parsed.data.status === "published" ? new Date().toISOString() : null,
    updated_by: user.id
  };

  const result = parsed.data.id
    ? await supabase.from("videos").update(payload).eq("id", parsed.data.id)
    : await supabase.from("videos").insert({ ...payload, created_by: user.id });

  if (result.error) {
    redirectWithMessage("/admin/videos", "error", result.error.message);
  }

  refreshAdminRoutes();
  redirectWithMessage("/admin/videos", "success", "Video guardado.");
}

export async function deleteVideoAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id") ?? "");

  const { error } = await supabase.from("videos").delete().eq("id", id);

  if (error) {
    redirectWithMessage("/admin/videos", "error", error.message);
  }

  refreshAdminRoutes();
  redirectWithMessage("/admin/videos", "success", "Video eliminado.");
}

export async function upsertProgramAction(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const parsed = programSchema.safeParse({
    id: formData.get("id"),
    slug: formData.get("slug"),
    titleEs: formData.get("titleEs"),
    titleEn: formData.get("titleEn"),
    descriptionEs: formData.get("descriptionEs"),
    descriptionEn: formData.get("descriptionEn"),
    membershipTierRequired: formData.get("membershipTierRequired"),
    status: formData.get("status"),
    durationDays: formData.get("durationDays"),
    coverImageUrl: formData.get("coverImageUrl"),
    isFeatured: checkboxValue(formData, "isFeatured")
  });

  if (!parsed.success) {
    redirectWithMessage("/admin/programs", "error", "Datos de programa invalidos.");
  }

  const payload = {
    slug: parsed.data.slug.trim(),
    title_i18n: buildI18n(parsed.data.titleEs.trim(), parsed.data.titleEn),
    description_i18n: buildI18n(parsed.data.descriptionEs.trim(), parsed.data.descriptionEn),
    membership_tier_required: parsed.data.membershipTierRequired,
    status: parsed.data.status,
    duration_days: parsed.data.durationDays,
    cover_image_url: parsed.data.coverImageUrl?.trim() || null,
    is_featured: parsed.data.isFeatured,
    published_at: parsed.data.status === "published" ? new Date().toISOString() : null,
    updated_by: user.id
  };

  const result = parsed.data.id
    ? await supabase.from("programs").update(payload).eq("id", parsed.data.id)
    : await supabase.from("programs").insert({ ...payload, created_by: user.id });

  if (result.error) {
    redirectWithMessage("/admin/programs", "error", result.error.message);
  }

  refreshAdminRoutes();
  redirectWithMessage("/admin/programs", "success", "Programa guardado.");
}

export async function deleteProgramAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id") ?? "");

  const { error } = await supabase.from("programs").delete().eq("id", id);

  if (error) {
    redirectWithMessage("/admin/programs", "error", error.message);
  }

  refreshAdminRoutes();
  redirectWithMessage("/admin/programs", "success", "Programa eliminado.");
}

export async function upsertProgramDayAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const parsed = programDaySchema.safeParse({
    programId: formData.get("programId"),
    dayNumber: formData.get("dayNumber"),
    videoSlug: formData.get("videoSlug")
  });

  if (!parsed.success) {
    redirectWithMessage("/admin/programs", "error", "Dia de programa invalido.");
  }

  const { data: video, error: videoError } = await supabase
    .from("videos")
    .select("id")
    .eq("slug", parsed.data.videoSlug.trim())
    .single<{ id: string }>();

  if (videoError || !video) {
    redirectWithMessage("/admin/programs", "error", "No existe un video con ese slug.");
  }

  const { error } = await supabase.from("program_days").upsert(
    {
      program_id: parsed.data.programId,
      day_number: parsed.data.dayNumber,
      video_id: video.id
    },
    {
      onConflict: "program_id,day_number"
    }
  );

  if (error) {
    redirectWithMessage("/admin/programs", "error", error.message);
  }

  refreshAdminRoutes();
  redirectWithMessage("/admin/programs", "success", "Dia guardado.");
}

export async function deleteProgramDayAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id") ?? "");

  const { error } = await supabase.from("program_days").delete().eq("id", id);

  if (error) {
    redirectWithMessage("/admin/programs", "error", error.message);
  }

  refreshAdminRoutes();
  redirectWithMessage("/admin/programs", "success", "Dia eliminado.");
}

export async function upsertSiteSettingAction(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const parsed = siteSettingSchema.safeParse({
    settingKey: formData.get("settingKey"),
    category: formData.get("category"),
    description: formData.get("description"),
    isPublic: checkboxValue(formData, "isPublic"),
    value: formData.get("value")
  });

  if (!parsed.success) {
    redirectWithMessage("/admin/settings", "error", "Setting invalida.");
  }

  let parsedValue: unknown = null;

  try {
    parsedValue = JSON.parse(parsed.data.value);
  } catch {
    redirectWithMessage("/admin/settings", "error", "El JSON no es valido.");
  }

  const { error } = await supabase.from("site_settings").upsert(
    {
      setting_key: parsed.data.settingKey.trim(),
      category: parsed.data.category.trim(),
      description: parsed.data.description?.trim() || null,
      is_public: parsed.data.isPublic,
      value: parsedValue,
      updated_by: user.id
    },
    {
      onConflict: "setting_key"
    }
  );

  if (error) {
    redirectWithMessage("/admin/settings", "error", error.message);
  }

  refreshAdminRoutes();
  redirectWithMessage("/admin/settings", "success", "Setting guardada.");
}

export async function updateProfileAdminAction(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const parsed = profileSchema.safeParse({
    profileId: formData.get("profileId"),
    membershipTier: formData.get("membershipTier"),
    technicalLevel: formData.get("technicalLevel"),
    onboardingCompleted: checkboxValue(formData, "onboardingCompleted"),
    isAdmin: checkboxValue(formData, "isAdmin")
  });

  if (!parsed.success) {
    redirectWithMessage("/admin/users", "error", "Perfil invalido.");
  }

  if (parsed.data.profileId === user.id && !parsed.data.isAdmin) {
    redirectWithMessage("/admin/users", "error", "No podes quitarte el rol admin desde esta pantalla.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      membership_tier: parsed.data.membershipTier,
      technical_level: parsed.data.technicalLevel,
      onboarding_completed: parsed.data.onboardingCompleted,
      is_admin: parsed.data.isAdmin
    })
    .eq("id", parsed.data.profileId);

  if (error) {
    redirectWithMessage("/admin/users", "error", error.message);
  }

  refreshAdminRoutes();
  redirectWithMessage("/admin/users", "success", "Usuario actualizado.");
}
