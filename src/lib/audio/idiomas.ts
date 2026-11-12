import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { AUDIO_BUCKET, AUDIO_LOCALES, isAudioLocale } from "./config";

/**
 * Idiomas extra y subtitulos de una clase (2026-11-12).
 *
 * POR QUE ASI Y NO DENTRO DEL VIDEO
 *   El plan original metia cada mp3 dentro del video con un programa aparte
 *   (worker/, con ffmpeg) que tenia que correr en otro servidor. Ese programa
 *   nunca se instalo: los audios quedaban en una cola que nadie procesaba y
 *   ninguna clase tuvo jamas un idioma extra.
 *
 *   Ahora el reproductor toca el mp3 SINCRONIZADO con el video (ver
 *   components/video-player.tsx). No hace falta ningun servidor extra, y
 *   agregar o quitar un idioma no toca el video ni lo vuelve a procesar.
 *
 * DONDE ESTAN
 *   Audio:      class-audio/<guid de Bunny>/<idioma>.mp3   (el mismo lugar
 *               donde ya los dejaba la subida de una clase nueva)
 *   Subtitulos: class-subtitles/<guid de Bunny>/<idioma>.vtt
 *
 *   Los dos depositos son privados: la alumna recibe enlaces firmados que
 *   vencen, y solo en la ficha de una clase que ya puede ver.
 *
 * TODO ES OPCIONAL: una clase sin nada de esto se ve como siempre.
 */

export const SUBTITULOS_BUCKET = "class-subtitles";
export const IDIOMAS_SUBTITULOS = ["es", "en", "fr", "it"] as const;
export type IdiomaSubtitulos = (typeof IDIOMAS_SUBTITULOS)[number];

export const NOMBRE_IDIOMA: Record<string, string> = { es: "Español", en: "English", fr: "Français", it: "Italiano" };

export function esIdiomaSubtitulos(v: string): v is IdiomaSubtitulos {
  return (IDIOMAS_SUBTITULOS as readonly string[]).includes(v);
}

export function rutaSubtitulos(bunnyId: string, idioma: string) {
  return `${bunnyId}/${idioma}.vtt`;
}

export type ArchivoDeIdioma = { locale: string; url: string };
export type IdiomasDeClase = { audios: ArchivoDeIdioma[]; subtitulos: ArchivoDeIdioma[] };

/** Un guid de Bunny y nada mas: es parte de una ruta del deposito. */
function guidValido(id: string) {
  return /^[0-9a-f-]{36}$/i.test(id);
}

async function listar(bucket: string, bunnyId: string, extension: string, valido: (l: string) => boolean, ttl: number) {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.storage.from(bucket).list(bunnyId, { limit: 20 });
  if (error || !data?.length) return [];
  const locales = data
    .map((f) => f.name)
    .filter((n) => n.endsWith(extension))
    .map((n) => n.slice(0, -extension.length))
    .filter(valido);
  if (!locales.length) return [];
  const { data: firmados } = await db.storage.from(bucket).createSignedUrls(locales.map((l) => `${bunnyId}/${l}${extension}`), ttl);
  return locales
    .map((locale, i) => ({ locale, url: firmados?.[i]?.signedUrl ?? "" }))
    .filter((a) => a.url);
}

/**
 * Para el reproductor. Nunca lanza: si algo falla, la clase se ve igual, solo
 * que sin idiomas extra. Los enlaces duran 8 horas (una clase larga con pausas).
 */
export async function leerIdiomasDeClase(bunnyId: string | null | undefined): Promise<IdiomasDeClase> {
  if (!bunnyId || !guidValido(bunnyId)) return { audios: [], subtitulos: [] };
  try {
    const ttl = 8 * 3600;
    const [audios, subtitulos] = await Promise.all([
      listar(AUDIO_BUCKET, bunnyId, ".mp3", isAudioLocale, ttl),
      listar(SUBTITULOS_BUCKET, bunnyId, ".vtt", esIdiomaSubtitulos, ttl),
    ]);
    const orden = (l: string) => ["es", ...AUDIO_LOCALES.map((a) => a.locale)].indexOf(l);
    return {
      audios: audios.sort((a, b) => orden(a.locale) - orden(b.locale)),
      subtitulos: subtitulos.sort((a, b) => orden(a.locale) - orden(b.locale)),
    };
  } catch (e) {
    console.error("[idiomas] no se pudieron leer:", e instanceof Error ? e.message : e);
    return { audios: [], subtitulos: [] };
  }
}

/** Para el panel: que idiomas tiene cargados (sin enlaces). */
export async function idiomasCargados(bunnyId: string): Promise<{ audios: string[]; subtitulos: string[] }> {
  if (!guidValido(bunnyId)) return { audios: [], subtitulos: [] };
  const db = createSupabaseAdminClient();
  const [a, s] = await Promise.all([
    db.storage.from(AUDIO_BUCKET).list(bunnyId, { limit: 20 }),
    db.storage.from(SUBTITULOS_BUCKET).list(bunnyId, { limit: 20 }),
  ]);
  return {
    audios: (a.data ?? []).map((f) => f.name).filter((n) => n.endsWith(".mp3")).map((n) => n.slice(0, -4)).filter(isAudioLocale),
    subtitulos: (s.data ?? []).map((f) => f.name).filter((n) => n.endsWith(".vtt")).map((n) => n.slice(0, -4)).filter(esIdiomaSubtitulos),
  };
}

/**
 * SRT -> WebVTT. Los navegadores solo entienden VTT, y casi todos los
 * programas de subtitulos exportan SRT. La diferencia es minima: la cabecera
 * y la coma de los milisegundos.
 */
export function aVtt(texto: string): string | null {
  const limpio = texto.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  if (!limpio) return null;
  if (limpio.startsWith("WEBVTT")) return limpio + "\n";
  if (!/\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->/.test(limpio)) return null;
  const cuerpo = limpio.replace(/(\d{1,2}:\d{2}:\d{2}),(\d{1,3})/g, "$1.$2");
  return `WEBVTT\n\n${cuerpo}\n`;
}
