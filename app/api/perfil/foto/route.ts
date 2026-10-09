import { NextResponse } from "next/server";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

/**
 * Sube la foto de perfil de QUIEN ESTA LOGUEADA y la guarda en su perfil.
 *
 * - requireUser() primero: sin sesion no hay a quien ponerle la foto.
 * - La fila que se toca es SIEMPRE la de user.id, nunca un id que venga del
 *   formulario: con service_role, aceptar un id seria dejar cambiarle la foto
 *   a cualquiera.
 * - Va al bucket publico `landing-media` (ya existe, acepta imagenes), bajo
 *   avatares/<id>/: una foto de perfil se muestra, no es privada. El nombre
 *   lleva la hora, asi que cambiar de foto no queda tapado por la cache.
 * - El navegador la achica a 512 px antes de mandarla (components/mi-perfil.tsx),
 *   asi que el limite de 3 MB es holgado.
 */
const TIPOS = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX = 3 * 1024 * 1024;

export async function POST(request: Request) {
  const { user } = await requireUser();

  const fd = await request.formData().catch(() => null);
  const archivo = fd?.get("foto");
  if (!(archivo instanceof File)) {
    return NextResponse.json({ error: "No llegó ninguna imagen." }, { status: 400 });
  }
  if (!(TIPOS as readonly string[]).includes(archivo.type)) {
    return NextResponse.json({ error: "La foto tiene que ser JPG, PNG o WebP." }, { status: 415 });
  }
  if (archivo.size > MAX) {
    return NextResponse.json({ error: "La foto pesa demasiado (máximo 3 MB)." }, { status: 413 });
  }

  const db = createSupabaseAdminClient();
  const ext = archivo.type === "image/png" ? "png" : archivo.type === "image/webp" ? "webp" : "jpg";
  const ruta = `avatares/${user.id}/${Date.now()}.${ext}`;

  const { error: errSubida } = await db.storage
    .from("landing-media")
    .upload(ruta, Buffer.from(await archivo.arrayBuffer()), { contentType: archivo.type, upsert: false });
  if (errSubida) {
    return NextResponse.json({ error: "No se pudo subir la foto: " + errSubida.message }, { status: 500 });
  }

  const url = db.storage.from("landing-media").getPublicUrl(ruta).data.publicUrl;
  const { error } = await db.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  if (error) {
    return NextResponse.json({ error: "Se subió la foto pero no se pudo guardar: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ url });
}

/** Quitar la foto: vuelve a la inicial. */
export async function DELETE() {
  const { user } = await requireUser();
  const db = createSupabaseAdminClient();
  const { error } = await db.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
