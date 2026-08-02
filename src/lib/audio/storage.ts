import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { AUDIO_BUCKET, audioObjectPath } from "./config";

/**
 * Server-side helpers for the per-language audio files.
 *
 * Same shape as the Bunny video path: the server mints a short-lived, scoped
 * credential and the BROWSER does the transfer. Audio files run ~50 MB, well
 * past both the 1 MB Server Action body limit and Vercel's function body limit,
 * so they can never be proxied through us.
 */

export type SignedAudioUpload = {
  locale: string;
  path: string;
  /** Absolute URL the browser PUTs the file to. */
  signedUrl: string;
  token: string;
};

/**
 * One-shot upload credential per language. The URL is bound to a single object
 * path and expires, so it cannot be reused to write anywhere else in the bucket.
 */
export async function createAudioUploadUrl(
  bunnyVideoId: string,
  locale: string
): Promise<SignedAudioUpload> {
  const supabase = createSupabaseAdminClient();
  const path = audioObjectPath(bunnyVideoId, locale);

  // upsert lets an admin replace one language without deleting it first.
  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear la URL de subida de audio.");
  }

  return { locale, path, signedUrl: data.signedUrl, token: data.token };
}

/**
 * Short-lived download URL. Only the mux worker uses this -- members never read
 * from the bucket, because the audio ends up inside the Bunny video.
 */
export async function createAudioDownloadUrl(path: string, ttlSeconds = 3600): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(AUDIO_BUCKET).createSignedUrl(path, ttlSeconds);

  if (error || !data) {
    throw new Error(error?.message ?? `No se pudo firmar la descarga de ${path}.`);
  }

  return data.signedUrl;
}

/**
 * Removes audio inputs once they are muxed into the video. Keeps the bucket
 * near zero so the Free plan's 1 GB is never a constraint.
 *
 * Best-effort: a failed cleanup must not fail the job that already succeeded.
 */
export async function deleteAudioObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.storage.from(AUDIO_BUCKET).remove(paths);
  } catch {
    // Orphaned input files are acceptable; a broken admin flow is not.
  }
}

/** Lists which languages currently have an audio file for a class. */
export async function listAudioObjects(bunnyVideoId: string): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.storage.from(AUDIO_BUCKET).list(bunnyVideoId);
  return (data ?? []).map((entry) => `${bunnyVideoId}/${entry.name}`);
}
