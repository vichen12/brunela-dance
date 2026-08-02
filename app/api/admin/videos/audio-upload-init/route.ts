import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/src/features/auth/guards";
import { isAudioLocale, MAX_AUDIO_BYTES, oversizeMessage, audioLabel } from "@/src/lib/audio/config";
import { createAudioUploadUrl } from "@/src/lib/audio/storage";

const schema = z.object({
  bunnyVideoId: z.string().min(1),
  locales: z.array(z.string()).min(1).max(3),
  /** Byte size per locale, so we reject oversize files before any transfer. */
  sizes: z.record(z.string(), z.number().int().positive())
});

/**
 * Mints one signed upload URL per language. The browser then PUTs each file
 * straight to Supabase Storage -- the bytes never reach this server.
 */
export async function POST(request: Request) {
  await requireAdmin();

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos." }, { status: 400 });
  }

  const { bunnyVideoId, locales, sizes } = parsed.data;

  for (const locale of locales) {
    if (!isAudioLocale(locale)) {
      return NextResponse.json({ error: `Idioma no soportado: ${locale}` }, { status: 400 });
    }
    const size = sizes[locale];
    // Checked here as well as in the browser: the client check is a courtesy,
    // this one is the rule. Supabase would reject it anyway, with a far worse
    // message.
    if (size && size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: oversizeMessage(audioLabel(locale), size) }, { status: 413 });
    }
  }

  try {
    const uploads = await Promise.all(locales.map((locale) => createAudioUploadUrl(bunnyVideoId, locale)));
    return NextResponse.json({ uploads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron preparar las subidas de audio.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
