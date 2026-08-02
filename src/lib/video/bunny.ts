import { createHash } from "node:crypto";
import { getBunnyStreamEnv, getBunnyTokenAuthKey, hasBunnyStreamEnv } from "@/src/lib/env";

/**
 * Bunny Stream integration.
 *
 * Flow we support:
 *  1. Admin creates a video object in the Bunny library  -> createBunnyVideo()
 *  2. Browser uploads the file straight to Bunny via TUS -> createBunnyUploadTicket()
 *  3. Member plays the HLS master playlist through a signed, expiring URL.
 *
 * NOTE: Bunny Stream has no API for attaching extra audio tracks. Verified
 * against the live API on 2026-07-28: /videos/{guid}/audiotracks, /audiotrack
 * and /audio all return 404, and the video object exposes no audio-track
 * fields (only "captions"). Multi-language audio is therefore handled outside
 * Bunny Stream -- see the audio_tracks column and the player.
 *
 * Docs: https://docs.bunny.net/reference/video_createvideo
 *       https://docs.bunny.net/reference/video_uploadvideo
 */

const BASE_URL = "https://video.bunnycdn.com";

export type BunnyAudioTrack = {
  locale: string;
  label: string;
  track_id: string;
};

function bunnyHeaders(extra?: Record<string, string>) {
  const { BUNNY_STREAM_API_KEY } = getBunnyStreamEnv();
  return {
    AccessKey: BUNNY_STREAM_API_KEY,
    accept: "application/json",
    ...extra
  };
}

function libraryUrl(path: string) {
  const { BUNNY_STREAM_LIBRARY_ID } = getBunnyStreamEnv();
  return `${BASE_URL}/library/${BUNNY_STREAM_LIBRARY_ID}${path}`;
}

export { hasBunnyStreamEnv };

// -----------------------------------------------------------------------------
// Token Authentication (signed, expiring playback URLs)
// -----------------------------------------------------------------------------

/** How long a signed playback URL stays valid. Longer than any single class. */
const DEFAULT_URL_TTL_SECONDS = 4 * 60 * 60;

/**
 * TTL for the segment URLs baked into a rewritten media playlist.
 *
 * This one cannot be short. For VOD, both hls.js and Safari fetch a media
 * playlist ONCE and then pull segments from it for the rest of playback -- there
 * is no periodic reload to refresh the token on. So the TTL has to outlast the
 * whole viewing SESSION, not just the class: someone pauses at minute five,
 * leaves the tab open through dinner, comes back and seeks forward. With a
 * 4 hour token those later segments would 403 and the class would die mid-play.
 *
 * 12 hours covers any realistic session. The window is not a hole in access
 * control: you have to be an authenticated member with the right tier to get a
 * playlist at all (see app/api/video/[videoId]/[...path]/route.ts), and the
 * player recovers on its own if a token does expire (see video-player.tsx).
 */
export const SEGMENT_URL_TTL_SECONDS = 12 * 60 * 60;

export type SignedBunnyUrls = {
  /** HLS master playlist, signed when Token Authentication is configured. */
  hls: string;
  /** Still image for the same video, covered by the same token. */
  thumbnail: string;
  /** Unix seconds the token stops working, or null when unsigned. */
  expiresAt: number | null;
};

function toUrlSafeBase64(digest: Buffer): string {
  return digest
    .toString("base64")
    .replace(/\n/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Bunny CDN Token Authentication, directory-scoped.
 *
 * We sign the video's DIRECTORY ("/<videoId>/"), not a single file. That is a
 * hard requirement for HLS: the player first fetches playlist.m3u8 and then
 * pulls dozens of sub-playlists and .ts segments from the same folder. A token
 * bound to one file would authorize the playlist and 403 every segment.
 *
 * Signing the directory also covers thumbnail.jpg with the same token.
 *
 * IMPORTANT: a directory-scoped token authorizes those child requests but does
 * NOT travel with them. Bunny's manifests reference children by bare relative
 * name and the CDN sets no auth cookie, so every child URL has to carry the
 * query itself. Players do not do this (hls.js drops the query when resolving,
 * Safari's native engine gives us no hook at all), which is why manifests are
 * rewritten server-side -- see src/lib/video/hls-manifest.ts. Handing a raw
 * Bunny playlist URL straight to a player looks like it works and then stalls
 * on the first segment.
 *
 *   hashable = securityKey + tokenPath + expires
 *   token    = url-safe base64( md5_raw(hashable) )
 *   query    = ?token=<token>&token_path=<urlencoded tokenPath>&expires=<unix>
 *
 * NOTE: verify this composition against your library's Token Authentication
 * settings with scripts/verify-bunny-token.mjs BEFORE relying on it. If Bunny
 * expects a different variant, this is the only function that changes.
 */
function signVideoDirectory(
  bunnyVideoId: string,
  ttlSeconds: number
): { token: string; tokenPath: string; expires: number } | null {
  const securityKey = getBunnyTokenAuthKey();
  if (!securityKey) return null;

  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const tokenPath = `/${bunnyVideoId}/`;
  const hashable = `${securityKey}${tokenPath}${expires}`;
  const token = toUrlSafeBase64(createHash("md5").update(hashable, "utf8").digest());

  return { token, tokenPath, expires };
}

/** The `?token=...&token_path=...&expires=...` query, or null when unsigned. */
function directoryQuery(bunnyVideoId: string, ttlSeconds: number) {
  const signed = signVideoDirectory(bunnyVideoId, ttlSeconds);
  if (!signed) return null;
  return {
    query:
      `token=${signed.token}` +
      `&token_path=${encodeURIComponent(signed.tokenPath)}` +
      `&expires=${signed.expires}`,
    expires: signed.expires
  };
}

/**
 * Builds the playback + thumbnail URLs for a Bunny video.
 *
 * These are generated per request and MUST NOT be persisted: a stored signed
 * URL would expire and start returning 403. Call this at render time from the
 * stored bunny_video_id instead.
 *
 * `hls` points at our own manifest route, not at Bunny. The thumbnail is a
 * plain <img> and needs no rewriting, so it keeps a direct signed CDN URL.
 */
export function bunnySignedUrls(
  bunnyVideoId: string,
  ttlSeconds: number = DEFAULT_URL_TTL_SECONDS
): SignedBunnyUrls {
  const { BUNNY_STREAM_CDN_HOSTNAME } = getBunnyStreamEnv();
  const base = `https://${BUNNY_STREAM_CDN_HOSTNAME}/${bunnyVideoId}`;
  const signed = directoryQuery(bunnyVideoId, ttlSeconds);

  return {
    hls: bunnyManifestUrl(bunnyVideoId),
    thumbnail: signed ? `${base}/thumbnail.jpg?${signed.query}` : `${base}/thumbnail.jpg`,
    expiresAt: signed?.expires ?? null
  };
}

/**
 * The URL a player should load: our access-gated manifest route, which returns
 * Bunny's playlist with every child URI rewritten and signed.
 */
export function bunnyManifestUrl(bunnyVideoId: string): string {
  return `/api/video/${bunnyVideoId}/playlist.m3u8`;
}

/**
 * Builds signed direct-CDN URLs for files inside one video's directory.
 *
 * Returns a builder rather than a plain function so the token is computed once
 * per manifest instead of once per segment -- a 90 minute class is ~900
 * segments, and every URL in a given playlist should share one expiry.
 */
export function bunnyAssetUrlFactory(
  bunnyVideoId: string,
  ttlSeconds: number = SEGMENT_URL_TTL_SECONDS
): (assetPath: string) => string {
  const { BUNNY_STREAM_CDN_HOSTNAME } = getBunnyStreamEnv();
  const base = `https://${BUNNY_STREAM_CDN_HOSTNAME}/${bunnyVideoId}`;
  const signed = directoryQuery(bunnyVideoId, ttlSeconds);

  return (assetPath: string) => {
    const url = `${base}/${assetPath}`;
    if (!signed) return url;
    return `${url}${assetPath.includes("?") ? "&" : "?"}${signed.query}`;
  };
}

/**
 * Recovers the Bunny GUID from a stored playback URL.
 *
 * Videos created through the admin upload flow have bunny_video_id populated, but
 * rows added earlier by pasting a URL into the admin form only carry the full
 * URL in stream_playback_id. This keeps those playable.
 */
export function bunnyVideoIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/^https?:\/\/[^/]+\/([0-9a-fA-F-]{36})\//);
  return match?.[1] ?? null;
}

/**
 * Canonical unsigned URLs. Kept ONLY so the finalize route can record which
 * Bunny asset a catalog row points at. Never render these: with Token
 * Authentication enabled Bunny answers 403. Use bunnySignedUrls() instead.
 */
export function bunnyHlsUrl(bunnyVideoId: string): string {
  const { BUNNY_STREAM_CDN_HOSTNAME } = getBunnyStreamEnv();
  return `https://${BUNNY_STREAM_CDN_HOSTNAME}/${bunnyVideoId}/playlist.m3u8`;
}

export function bunnyThumbnailUrl(bunnyVideoId: string): string {
  const { BUNNY_STREAM_CDN_HOSTNAME } = getBunnyStreamEnv();
  return `https://${BUNNY_STREAM_CDN_HOSTNAME}/${bunnyVideoId}/thumbnail.jpg`;
}

/**
 * Step 1 — create the video object and get its GUID.
 */
export async function createBunnyVideo(title: string): Promise<{ guid: string }> {
  const res = await fetch(libraryUrl("/videos"), {
    method: "POST",
    headers: bunnyHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ title })
  });

  if (!res.ok) {
    throw new Error(`Bunny createVideo failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { guid: string };
  return { guid: data.guid };
}

// -----------------------------------------------------------------------------
// Browser-direct upload (TUS)
// -----------------------------------------------------------------------------

/** Bunny's TUS endpoint. Returns a RELATIVE Location header on create. */
export const BUNNY_TUS_ENDPOINT = "https://video.bunnycdn.com/tusupload";

export type BunnyUploadTicket = {
  endpoint: string;
  videoId: string;
  libraryId: string;
  /** Unix SECONDS. Verified against the live API; milliseconds are rejected. */
  expiration: number;
  signature: string;
};

/**
 * Mints short-lived credentials that let a BROWSER upload straight to Bunny,
 * so class videos never travel through our server (Next caps Server Action
 * bodies at 1 MB and Vercel caps function bodies at a few MB).
 *
 * The API key is never exposed: the browser only receives a SHA-256 signature
 * that is bound to one specific videoId and expires. It cannot be replayed
 * against any other video.
 *
 *   signature = sha256(libraryId + apiKey + expiration + videoId)
 *
 * These headers are required on EVERY TUS request (POST create, PATCH chunks
 * and HEAD offset checks). Omitting them on PATCH returns
 * "Library ID missing or invalid."
 */
export function createBunnyUploadTicket(
  bunnyVideoId: string,
  ttlSeconds = 6 * 60 * 60
): BunnyUploadTicket {
  const { BUNNY_STREAM_API_KEY, BUNNY_STREAM_LIBRARY_ID } = getBunnyStreamEnv();
  const expiration = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = createHash("sha256")
    .update(`${BUNNY_STREAM_LIBRARY_ID}${BUNNY_STREAM_API_KEY}${expiration}${bunnyVideoId}`, "utf8")
    .digest("hex");

  return {
    endpoint: BUNNY_TUS_ENDPOINT,
    videoId: bunnyVideoId,
    libraryId: BUNNY_STREAM_LIBRARY_ID,
    expiration,
    signature
  };
}

/**
 * Step 2 — upload the main video file bytes to an existing Bunny video.
 *
 * SERVER-SIDE ONLY, and no longer used by the admin upload flow: it buffers the
 * whole file in memory and hits the Server Action body limit. Kept for scripts
 * and one-off migrations. The browser path is createBunnyUploadTicket().
 */
export async function uploadBunnyVideoFile(guid: string, file: Blob): Promise<void> {
  const res = await fetch(libraryUrl(`/videos/${guid}`), {
    method: "PUT",
    headers: bunnyHeaders({ "content-type": "application/octet-stream" }),
    body: file
  });

  if (!res.ok) {
    throw new Error(`Bunny uploadVideo failed (${res.status}): ${await res.text()}`);
  }
}

/**
 * Deletes a Bunny video (used when an admin deletes a catalog video).
 * Best-effort: never throws so DB deletion is not blocked by a CDN hiccup.
 */
export async function deleteBunnyVideo(guid: string): Promise<void> {
  try {
    await fetch(libraryUrl(`/videos/${guid}`), {
      method: "DELETE",
      headers: bunnyHeaders()
    });
  } catch {
    // swallow: orphaned CDN asset is acceptable, blocking the admin is not.
  }
}
