"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

const docSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  title: z.string().min(1),
  description: z.string().optional(),
  fileUrl: z.string().min(1),
  fileType: z.string().default("pdf"),
  fileSizeKb: z.coerce.number().optional(),
  membershipTierRequired: z.enum(["none", "corps_de_ballet", "solista", "principal"]),
  categorySlug: z.string().optional(),
  videoSlug: z.string().optional(),
  isPublished: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

function redirectMsg(kind: "success" | "error", msg: string): never {
  redirect(`/admin/documents?${kind}=${encodeURIComponent(msg)}` as never);
}

export async function upsertDocumentAction(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createSupabaseAdminClient();

  const parsed = docSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    description: formData.get("description"),
    fileUrl: formData.get("fileUrl"),
    fileType: formData.get("fileType"),
    fileSizeKb: formData.get("fileSizeKb"),
    membershipTierRequired: formData.get("membershipTierRequired"),
    categorySlug: formData.get("categorySlug"),
    videoSlug: formData.get("videoSlug"),
    isPublished: formData.get("isPublished") === "on",
    sortOrder: formData.get("sortOrder"),
  });

  if (!parsed.success) redirectMsg("error", "Datos inválidos.");

  const payload = {
    title: parsed.data.title.trim(),
    description: parsed.data.description?.trim() || null,
    file_url: parsed.data.fileUrl.trim(),
    file_type: parsed.data.fileType,
    file_size_kb: parsed.data.fileSizeKb ?? null,
    membership_tier_required: parsed.data.membershipTierRequired,
    category_slug: parsed.data.categorySlug?.trim() || null,
    video_slug: parsed.data.videoSlug?.trim() || null,
    is_published: parsed.data.isPublished,
    sort_order: parsed.data.sortOrder,
    created_by: user.id,
  };

  const result = parsed.data.id
    ? await supabase.from("documents").update(payload).eq("id", parsed.data.id)
    : await supabase.from("documents").insert(payload);

  if (result.error) redirectMsg("error", result.error.message);

  revalidatePath("/admin/documents");
  revalidatePath("/dashboard/documents");
  redirectMsg("success", "Documento guardado.");
}

export async function deleteDocumentAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseAdminClient();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) redirectMsg("error", error.message);
  revalidatePath("/admin/documents");
  redirectMsg("success", "Documento eliminado.");
}
