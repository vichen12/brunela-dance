/**
 * Single source of truth for the per-language audio tracks.
 *
 * Changing the bitrate here updates the size ceiling, the admin form's
 * validation message and the worker's ffmpeg call together. Nothing else
 * hardcodes these numbers.
 *
 * If a class ever runs longer than maxAudioMinutes(), drop to 64 kbps mono
 * (AUDIO_BITRATE_KBPS = 64, AUDIO_CHANNELS = 1) for ~104 minutes. For a dubbed
 * voice track that is still comfortable quality.
 */

/** Export bitrate we ask the admin for, and that the worker encodes to. */
export const AUDIO_BITRATE_KBPS = 96;

export const AUDIO_CHANNELS = 2;

/**
 * Fixed 50 MiB per-file ceiling of the Supabase Free plan. Not raisable from
 * the bucket -- the project-level limit wins. Mirrors the bucket's
 * file_size_limit in 20260729_audio_storage_and_mux_jobs.sql.
 */
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

export const AUDIO_BUCKET = "class-audio";

/** Locales that ship as separate uploads. Spanish rides inside the video. */
export const AUDIO_LOCALES = [
  { locale: "en", label: "English", ffmpegLang: "eng" },
  { locale: "fr", label: "Francais", ffmpegLang: "fra" },
  { locale: "it", label: "Italiano", ffmpegLang: "ita" }
] as const;

export type AudioLocale = (typeof AUDIO_LOCALES)[number]["locale"];

/** The original language, embedded in the uploaded video file itself. */
export const ORIGINAL_LOCALE = "es";
export const ORIGINAL_LABEL = "Espanol";
export const ORIGINAL_FFMPEG_LANG = "spa";

export function isAudioLocale(value: string): value is AudioLocale {
  return AUDIO_LOCALES.some((entry) => entry.locale === value);
}

export function audioLabel(locale: string): string {
  if (locale === ORIGINAL_LOCALE) return ORIGINAL_LABEL;
  return AUDIO_LOCALES.find((entry) => entry.locale === locale)?.label ?? locale.toUpperCase();
}

/** How many minutes fit under the size ceiling at the configured bitrate. */
export function maxAudioMinutes(): number {
  const bytesPerSecond = (AUDIO_BITRATE_KBPS * 1000) / 8;
  return Math.floor(MAX_AUDIO_BYTES / bytesPerSecond / 60);
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * The message the admin sees when a file is too big. Built here so it always
 * quotes the current bitrate and limit instead of a stale hardcoded number.
 */
export function oversizeMessage(label: string, bytes: number): string {
  return (
    `El audio de ${label} pesa ${formatMegabytes(bytes)} y el maximo es ` +
    `${formatMegabytes(MAX_AUDIO_BYTES)}. Exportalo a ${AUDIO_BITRATE_KBPS} kbps ` +
    `(entran hasta ${maxAudioMinutes()} minutos).`
  );
}

/** Storage path for one language of one class. Stable, so re-uploads replace. */
export function audioObjectPath(bunnyVideoId: string, locale: string): string {
  return `${bunnyVideoId}/${locale}.mp3`;
}
