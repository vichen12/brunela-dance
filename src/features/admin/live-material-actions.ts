"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { idsMaterial } from "@/src/features/studio/material-sesion";

/**
 * Material de una clase en vivo: documentos adjuntos a UNA sesion.
 *
 * DONDE VIVE, SIN MIGRACION
 *   `live_sessions.metadata.documentos`: un array de uuid de `documents`. La
 *   columna ya existe (jsonb not null, check de objeto) y nadie mas la usaba.
 *   Adjuntar NO copia el documento ni cambia su plan: la alumna lo lee con SU
 *   cliente, asi que RLS de `documents` sigue decidiendo si lo ve.
 *
 * ⚠️ MERGE, NO REEMPLAZO
 *   Se lee el metadata entero, se cambia SOLO `documentos` y se escribe. Un
 *   `update({ metadata: { documentos } })` borraria cualquier otra clave que
 *   alguien guarde ahi mas adelante, sin ningun error.
 *
 * ⚠️ Cada una es un endpoint POST publico y usa service_role: requireAdmin()
 *    va PRIMERO (trampa 4 del CLAUDE.md).
 */

const uuid = z.string().uuid();

function perfil(sessionId: string, tipo: "success" | "error", msg: string): never {
  redirect(`/admin/live/${sessionId}?${tipo}=${encodeURIComponent(msg)}#material` as never);
}

/** Lee metadata, aplica el cambio a `documentos` y escribe el objeto entero. */
async function cambiarMaterial(
  sessionId: string,
  cambio: (ids: string[]) => string[]
): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("live_sessions")
    .select("metadata")
    .eq("id", sessionId)
    .maybeSingle<{ metadata: Record<string, unknown> | null }>();
  if (error) return error.message;
  if (!data) return "Esa sesión no existe.";

  const actual = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata) ? data.metadata : {};
  const ids = cambio(idsMaterial(actual));
  const { error: e2 } = await supabase
    .from("live_sessions")
    .update({ metadata: { ...actual, documentos: ids } })
    .eq("id", sessionId);
  return e2 ? e2.message : null;
}

function refrescar() {
  revalidatePath("/admin/live", "layout");
  revalidatePath("/dashboard/live", "layout");
}

/** Adjunta un documento que ya existe. */
export async function adjuntarDocumentoASesionAction(fd: FormData) {
  await requireAdmin();
  const sessionId = String(fd.get("sessionId") ?? "");
  const documentId = String(fd.get("documentId") ?? "");
  if (!uuid.safeParse(sessionId).success) redirect("/admin/live?error=Sesi%C3%B3n+inv%C3%A1lida" as never);
  if (!uuid.safeParse(documentId).success) perfil(sessionId, "error", "Elegí un documento de la lista.");

  // Que exista: un id inventado en el metadata seria un adjunto fantasma.
  const { data: doc } = await createSupabaseAdminClient()
    .from("documents").select("id").eq("id", documentId).maybeSingle();
  if (!doc) perfil(sessionId, "error", "Ese documento ya no existe.");

  const fallo = await cambiarMaterial(sessionId, (ids) => (ids.includes(documentId) ? ids : [...ids, documentId]));
  if (fallo) perfil(sessionId, "error", fallo);
  refrescar();
  perfil(sessionId, "success", "Material adjuntado.");
}

/** Lo desvincula de la sesion. El documento NO se borra. */
export async function quitarDocumentoDeSesionAction(fd: FormData) {
  await requireAdmin();
  const sessionId = String(fd.get("sessionId") ?? "");
  const documentId = String(fd.get("documentId") ?? "");
  if (!uuid.safeParse(sessionId).success) redirect("/admin/live?error=Sesi%C3%B3n+inv%C3%A1lida" as never);

  const fallo = await cambiarMaterial(sessionId, (ids) => ids.filter((x) => x !== documentId));
  if (fallo) perfil(sessionId, "error", fallo);
  refrescar();
  perfil(sessionId, "success", "Material quitado de la clase. El documento sigue en Documentos.");
}

const nuevoSchema = z.object({
  sessionId: uuid,
  title: z.string().trim().min(1),
  fileUrl: z.string().trim().min(1),
  fileType: z.enum(["pdf", "image", "video", "audio", "doc", "other"]).default("other"),
  fileSizeKb: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  membershipTierRequired: z.enum(["none", "corps_de_ballet", "solista", "principal"]),
});

/**
 * Sube un documento nuevo (el archivo ya viajo a Storage con la credencial de
 * /api/admin/documents/upload-init) y lo adjunta a la sesion.
 *
 * Se crea PUBLICADO: la alumna lo lee con su cliente y la policy de
 * `documents` solo devuelve los publicados. Por eso tambien aparece en
 * /dashboard/documents para quien tenga el plan, y el formulario lo avisa.
 */
export async function subirMaterialDeSesionAction(fd: FormData) {
  const { user } = await requireAdmin();
  const parsed = nuevoSchema.safeParse({
    sessionId: fd.get("sessionId"),
    title: fd.get("title"),
    fileUrl: fd.get("fileUrl"),
    fileType: fd.get("fileType") || undefined,
    fileSizeKb: fd.get("fileSizeKb") ?? "",
    membershipTierRequired: fd.get("membershipTierRequired"),
  });
  const sessionId = String(fd.get("sessionId") ?? "");
  if (!uuid.safeParse(sessionId).success) redirect("/admin/live?error=Sesi%C3%B3n+inv%C3%A1lida" as never);
  if (!parsed.success) {
    perfil(sessionId, "error", fd.get("fileUrl") ? "Falta el título del documento." : "Primero subí el archivo.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: creado, error } = await supabase
    .from("documents")
    .insert({
      title: parsed.data.title,
      file_url: parsed.data.fileUrl,
      file_type: parsed.data.fileType,
      file_size_kb: parsed.data.fileSizeKb ?? null,
      membership_tier_required: parsed.data.membershipTierRequired,
      is_published: true,
      sort_order: 0,
      created_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !creado) perfil(sessionId, "error", error?.message ?? "No se pudo crear el documento.");

  const fallo = await cambiarMaterial(sessionId, (ids) => [...ids, creado.id]);
  // El documento ya existe: si falla el enganche se avisa, no se borra.
  if (fallo) perfil(sessionId, "error", `El documento se creó pero no se pudo adjuntar: ${fallo}`);

  revalidatePath("/admin/documents");
  revalidatePath("/dashboard/documents");
  refrescar();
  perfil(sessionId, "success", "Documento subido y adjuntado a la clase.");
}
