import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/src/features/auth/guards";
import {
  crearUrlDeSubida,
  mensajeDemasiadoGrande,
  rutaDeMedia,
  urlPublica,
  MAX_PORTADA_BYTES,
  TIPOS_PORTADA,
} from "@/src/lib/portada-media";

const schema = z.object({
  fileName: z.string().min(1).max(200),
  size: z.number().int().positive(),
  contentType: z.string().min(1).max(100),
});

/**
 * Firma la subida del tráiler o de su imagen. El navegador PONE el archivo
 * directo en Storage: los bytes nunca pasan por este servidor.
 *
 * `requireAdmin()` va primero, como en toda ruta que usa `service_role`. Sin
 * eso, cualquiera podría pedir una credencial de escritura sobre un bucket
 * público — y ahí el daño no es leer, es SERVIR: alguien podría subir lo que
 * quisiera a un dominio de Brunela.
 *
 * Devuelve también la URL pública definitiva, para que el formulario la guarde
 * sin tener que reconstruirla del lado del cliente.
 */
export async function POST(request: Request) {
  await requireAdmin();

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos." }, { status: 400 });
  }

  const { fileName, size, contentType } = parsed.data;

  /**
   * Las dos comprobaciones se hacen acá además de en el navegador: la del
   * navegador es una cortesía para avisar rápido, esta es la regla. Storage las
   * haría igual, pero DESPUÉS de transferir el archivo entero y con un mensaje
   * que no se entiende.
   */
  if (size > MAX_PORTADA_BYTES) {
    return NextResponse.json({ error: mensajeDemasiadoGrande(fileName, size) }, { status: 413 });
  }

  if (!(TIPOS_PORTADA as readonly string[]).includes(contentType)) {
    return NextResponse.json(
      { error: `Ese tipo de archivo no se puede subir acá. Se aceptan: MP4, WebM, JPG, PNG, WebP y AVIF.` },
      { status: 415 }
    );
  }

  try {
    const path = rutaDeMedia(fileName);
    const ticket = await crearUrlDeSubida(path);
    return NextResponse.json({ ...ticket, publicUrl: urlPublica(path) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo preparar la subida." },
      { status: 500 }
    );
  }
}
