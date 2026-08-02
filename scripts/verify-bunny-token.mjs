/**
 * Bunny Token Authentication checker.
 *
 * Proves, against your real Bunny library, that:
 *   1. an UNSIGNED url is rejected  (403)  -> protection is actually on
 *   2. a SIGNED url is accepted     (200)  -> our signature format is right
 *   3. a SEGMENT under the same folder is accepted -> directory scoping works
 *   4. an EXPIRED signature is rejected (403) -> the expiry is enforced
 *
 * Step 3 is the one that catches the classic mistake: the playlist loads, then
 * every video segment 403s and the player stalls on a black screen.
 *
 * Usage (Node 20.6+):
 *   node --env-file=.env.local scripts/verify-bunny-token.mjs <BUNNY_VIDEO_GUID>
 *
 * Get a GUID from Bunny: Stream > your library > any video > the id in the URL.
 */

import { createHash } from "node:crypto";

const CDN = process.env.BUNNY_STREAM_CDN_HOSTNAME;
const KEY = process.env.BUNNY_STREAM_TOKEN_AUTH_KEY;
const guid = process.argv[2];

function die(msg) {
  console.error(`\n  ERROR: ${msg}\n`);
  process.exit(1);
}

if (!CDN) die("BUNNY_STREAM_CDN_HOSTNAME is not set. Did you pass --env-file=.env.local ?");
if (!KEY) die("BUNNY_STREAM_TOKEN_AUTH_KEY is not set. See step 3 of the setup guide.");
if (!guid) die("Pass a video GUID: node --env-file=.env.local scripts/verify-bunny-token.mjs <GUID>");

// ---- this mirrors signVideoDirectory() in src/lib/video/bunny.ts -------------
function sign(videoId, expires) {
  const tokenPath = `/${videoId}/`;
  const token = createHash("md5")
    .update(`${KEY}${tokenPath}${expires}`, "utf8")
    .digest("base64")
    .replace(/\n/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return `token=${token}&token_path=${encodeURIComponent(tokenPath)}&expires=${expires}`;
}
// -----------------------------------------------------------------------------

const now = Math.floor(Date.now() / 1000);
const base = `https://${CDN}/${guid}`;
const validQuery = sign(guid, now + 3600);

async function status(label, url, expected) {
  let code;
  try {
    const res = await fetch(url, { method: "GET", redirect: "manual" });
    code = res.status;
  } catch (err) {
    console.log(`  ?  ${label}: request failed (${err.message})`);
    return { ok: false, code: 0 };
  }
  const ok = expected.includes(code);
  console.log(`  ${ok ? "OK " : "XX "} ${label}: HTTP ${code} (expected ${expected.join(" or ")})`);
  return { ok, code };
}

console.log(`\nBunny token check -- library host ${CDN}, video ${guid}\n`);

const results = [];

// 1. Unsigned must be blocked.
results.push(
  await status("unsigned playlist is blocked", `${base}/playlist.m3u8`, [401, 403])
);

// 2. Signed must work.
const signedPlaylist = `${base}/playlist.m3u8?${validQuery}`;
const playlistRes = await status("signed playlist is served", signedPlaylist, [200]);
results.push(playlistRes);

// 3. A child file under the same folder must inherit the directory token.
if (playlistRes.code === 200) {
  const body = await fetch(signedPlaylist).then((r) => r.text());
  const child = body
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#"));

  if (!child) {
    console.log("  ?  segment check skipped: master playlist listed no child files");
  } else {
    const childUrl = child.startsWith("http")
      ? child
      : `${base}/${child.replace(/^\//, "")}${child.includes("?") ? "&" : "?"}${validQuery}`;
    results.push(await status(`child file inherits token (${child})`, childUrl, [200]));
  }
} else {
  console.log("  -- segment check skipped: the signed playlist did not load");
}

// 4. An already-expired signature must be refused.
results.push(
  await status(
    "expired signature is rejected",
    `${base}/playlist.m3u8?${sign(guid, now - 60)}`,
    [401, 403]
  )
);

const failed = results.filter((r) => !r.ok).length;

if (failed === 0) {
  console.log(`\n  All checks passed. The signature format in src/lib/video/bunny.ts is correct.\n`);
  process.exit(0);
}

console.log(`\n  ${failed} check(s) failed. How to read this:\n`);
console.log("   - unsigned returned 200  -> Token Authentication is still OFF in the library.");
console.log("     Turn it on (setup guide step 3). Nothing else below is meaningful until you do.");
console.log("   - signed returned 403    -> the security key or the hash format is wrong.");
console.log("     Re-copy the key, and if it still fails send me this output: the hash");
console.log("     composition lives in ONE function and I will adjust it.");
console.log("   - playlist 200 but child 403 -> directory scoping is not being applied.");
console.log("     This is the one that produces a black screen with audio-only or a stall.\n");
process.exit(1);
