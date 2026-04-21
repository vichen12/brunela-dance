"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

const categorySchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  slug: z.string().min(2),
  nameEs: z.string().min(1),
  nameEn: z.string().optional(),
  descriptionEs: z.string().optional(),
  membershipTierRequired: z.enum(["none", "corps_de_ballet", "solista", "principal"]),
  coverImageUrl: z.string().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

function redirectMsg(kind: "success" | "error", msg: string): never {
  redirect(`/admin/categories?${kind}=${encodeURIComponent(msg)}` as never);
}

export async function upsertCategoryAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseAdminClient();

  const parsed = categorySchema.safeParse({
    id: formData.get("id"),
    slug: formData.get("slug"),
    nameEs: formData.get("nameEs"),
    nameEn: formData.get("nameEn"),
    descriptionEs: formData.get("descriptionEs"),
    membershipTierRequired: formData.get("membershipTierRequired"),
    coverImageUrl: formData.get("coverImageUrl"),
    sortOrder: formData.get("sortOrder"),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    redirectMsg("error", "Datos de categoría inválidos.");
  }

  const payload = {
    slug: parsed.data.slug.trim(),
    name_i18n: {
      es: parsed.data.nameEs.trim(),
      ...(parsed.data.nameEn?.trim() ? { en: parsed.data.nameEn.trim() } : {}),
    },
    description_i18n: {
      es: parsed.data.descriptionEs?.trim() ?? "",
    },
    membership_tier_required: parsed.data.membershipTierRequired,
    cover_image_url: parsed.data.coverImageUrl?.trim() || null,
    sort_order: parsed.data.sortOrder,
    is_active: parsed.data.isActive,
  };

  const result = parsed.data.id
    ? await supabase.from("categories").update(payload).eq("id", parsed.data.id)
    : await supabase.from("categories").insert(payload);

  if (result.error) {
    redirectMsg("error", result.error.message);
  }

  revalidatePath("/admin/categories");
  revalidatePath("/dashboard/library");
  redirectMsg("success", "Categoría guardada.");
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseAdminClient();
  const id = String(formData.get("id") ?? "");

  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    redirectMsg("error", error.message);
  }

  revalidatePath("/admin/categories");
  redirectMsg("success", "Categoría eliminada.");
}
