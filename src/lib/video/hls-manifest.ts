/**
 * HLS manifest rewriting for Bunny's token-authenticated CDN.
 *
 * WHY THIS EXISTS
 *   Bunny signs a whole video DIRECTORY, and every request inside it must carry
 *   ?token=...&token_path=...&expires=... But Bunny's manifests reference their
 *   children with bare relative names -- "audio_2/audio.m3u8", "video1.ts" --
 *   and the CDN sets no auth cookie (verified 2026-07-28: no set-cookie header,
 *   and an untokenized segment answers 403). So the token has to be present in
 *   every single URL the player requests.
 *
 *   No player does that on its own. hls.js resolves child URIs against the
 *   manifest URL and DROPS its query string; Safari's native HLS engine behaves
 *   the same and, unlike hls.js, cannot be patched from JavaScript at all --
 *   there is no request hook. Either way the master manifest parses fine and
 *   then every segment comes back 403, so the player stalls on a black frame.
 *
 *   Rewriting the manifests server-side hands the player URLs that are already
 *   absolute and already signed. One mechanism, both playback paths, no
 *   per-browser patching.
 *
 *   Only .m3u8 text passes through our server (tens of KB per class). Media
 *   segments keep going straight from the CDN to the viewer, which is what
 *   makes this safe to run at scale.
 */

export type ManifestRewriteTargets = {
  /** Where a child .m3u8 should point: our own access-gated route. */
  playlist: (relativePath: string) => string;
  /** Where a segment / key / init file should point: Bunny, signed. */
  asset: (relativePath: string) => string;
};

/** #EXT-X-MEDIA, #EXT-X-KEY, #EXT-X-MAP and #EXT-X-I-FRAME-STREAM-INF. */
const URI_ATTRIBUTE = /URI="([^"]*)"/;

/** Anything with a scheme, plus protocol-relative "//host/path". */
const ABSOLUTE_URI = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * Resolves a manifest-relative URI against the manifest's own path, returning a
 * path relative to the video directory root.
 *
 *   currentPath "240p/video.m3u8" + uri "video1.ts"  -> "240p/video1.ts"
 *   currentPath "playlist.m3u8"   + uri "audio_2/audio.m3u8" -> "audio_2/audio.m3u8"
 *
 * Returns null for absolute URIs, which we pass through untouched. Bunny never
 * emits them (verified against the live manifests), and blindly re-signing a
 * URL that points somewhere else would be wrong.
 *
 * Traversal is contained by URL normalization: "../../x" collapses to "x", so a
 * rewritten path can never climb out of the video's own directory.
 */
function resolveChildPath(currentPath: string, uri: string): string | null {
  if (!uri || ABSOLUTE_URI.test(uri)) return null;
  const resolved = new URL(uri, `https://manifest.invalid/${currentPath}`);
  return resolved.pathname.slice(1) + resolved.search;
}

function rewriteUri(
  currentPath: string,
  uri: string,
  targets: ManifestRewriteTargets
): string | null {
  const child = resolveChildPath(currentPath, uri);
  if (child === null) return null;

  // A child playlist must come back through us so it gets rewritten too --
  // pointing it straight at Bunny would just move the 403 one level down.
  return child.split("?")[0].toLowerCase().endsWith(".m3u8")
    ? targets.playlist(child)
    : targets.asset(child);
}

/**
 * Rewrites every URI in an HLS manifest.
 *
 * @param body        raw .m3u8 text as Bunny returned it
 * @param currentPath path of this manifest inside the video directory,
 *                    e.g. "playlist.m3u8" or "audio_2/audio.m3u8"
 */
export function rewriteHlsManifest(
  body: string,
  currentPath: string,
  targets: ManifestRewriteTargets
): string {
  return body
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        const match = trimmed.match(URI_ATTRIBUTE);
        if (!match) return line;
        const rewritten = rewriteUri(currentPath, match[1], targets);
        return rewritten === null ? line : line.replace(URI_ATTRIBUTE, `URI="${rewritten}"`);
      }

      // A bare line is a segment or a variant playlist.
      const rewritten = rewriteUri(currentPath, trimmed, targets);
      return rewritten === null ? line : rewritten;
    })
    .join("\n");
}
