import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/src/features/auth/guards";
import {
  crearUrlDeSubida,
  rutaDeDocumento,
  MAX_DOC_BYTES,
  mensajeDemasiadoGrande,
} from "@/src/lib/documents/storage";

const schema = z.object({
  fileName: z.string().min(1).max(200),
  size: z.number().int().positive(),
});

/**
 * Firma una subida de documento. El navegador PONE el archivo directo en
 * Storage: los bytes nunca pasan por este servidor.
 *
 * requireAdmin() va primero, como en toda ruta que usa service_role: sin eso,
 * cualquiera podria pedir una credencial de escritura sobre el bucket.
 */
export async function POST(request: Request) {
  await requireAdmin();

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos." }, { status: 400 });
  }

  // Se chequea aca ademas de en el navegador: el del navegador es una cortesia,
  // este es la regla. Storage lo rechazaria igual, con un mensaje peor.
  if (parsed.data.size > MAX_DOC_BYTES) {
    return NextResponse.json(
      { error: mensajeDemasiadoGrande(parsed.data.fileName, parsed.data.size) },
      { status: 413 }
    );
  }

  try {
    const ticket = await crearUrlDeSubida(rutaDeDocumento(parsed.data.fileName));
    return NextResponse.json(ticket);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo preparar la subida." },
      { status: 500 }
    );
  }
}
