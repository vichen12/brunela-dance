/**
 * Brunela — multi-language audio mux worker.
 *
 * Polls video_mux_jobs, muxes the per-language mp3s into the class video with
 * ffmpeg, uploads the result to Bunny and swaps the catalog row over once the
 * new encode is VERIFIED to expose every requested language.
 *
 * Portable on purpose: Node 20+ and ffmpeg on PATH, zero npm dependencies.
 * Runs identically on a laptop, Railway, Fly, Render or any VPS. It only makes
 * OUTBOUND connections -- no port to open, no certificate, no inbound surface.
 *
 * Run:  node worker/index.mjs
 */

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const env = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    console.error(`[config] falta la variable de entorno ${name}`);
    process.exit(1);
  }
  return value;
};

const SUPABASE_URL = env("SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const BUNNY_API_KEY = env("BUNNY_STREAM_API_KEY");
const BUNNY_LIBRARY_ID = env("BUNNY_STREAM_LIBRARY_ID");
const BUNNY_CDN = env("BUNNY_STREAM_CDN_HOSTNAME");
const BUNNY_TOKEN_KEY = env("BUNNY_STREAM_TOKEN_AUTH_KEY");

const POLL_SECONDS = Number(process.env.POLL_INTERVAL_SECONDS ?? 30);
const AUDIO_BITRATE_KBPS = Number(process.env.AUDIO_BITRATE_KBPS ?? 96);
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS ?? 3);
const ENCODE_TIMEOUT_MS = Number(process.env.ENCODE_TIMEOUT_MINUTES ?? 180) * 60_000;

/** ffmpeg wants ISO 639-2 three letter codes; Bunny maps them back to two. */
const FFMPEG_LANG = { es: "spa", en: "eng", fr: "fra", it: "ita" };

const log = (...args) => console.log(new Date().toISOString(), ...args);

// ---------------------------------------------------------------------------
// Supabase REST (no SDK, keeps the worker dependency-free)
// ---------------------------------------------------------------------------

const sbHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "content-type": "application/json"
};

async function sbRest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...sbHeaders, ...(init.headers ?? {}) }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

/**
 * Claims the oldest pending job. The PATCH re-checks status = pending, so if a
 * second worker grabbed it first we get zero rows back and simply move on.
 */
async function claimJob() {
  const pending = await sbRest(
    "video_mux_jobs?status=eq.pending&select=id&order=created_at.asc&limit=1"
  );
  if (!pending.length) return null;

  const claimed = await sbRest(
    `video_mux_jobs?id=eq.${pending[0].id}&status=eq.pending&select=*`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "processing", claimed_at: new Date().toISOString() })
    }
  );
  return claimed.length ? claimed[0] : null;
}

async function finishJob(job, patch) {
  await sbRest(`video_mux_jobs?id=eq.${job.id}`, {
    method: "PATCH",
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
  });
}

/**
 * A failure goes back to pending so the next tick retries it, until the attempt
 * budget runs out. Bunny's encoder dropped an audio track once in seven test
 * encodes, so retrying is the mechanism that makes this reliable.
 */
async function failJob(job, error) {
  const attempts = (job.attempts ?? 0) + 1;
  const exhausted = attempts >= MAX_ATTEMPTS;
  log(`  job ${job.id}: ${exhausted ? "FALLIDO definitivo" : `reintento ${attempts}/${MAX_ATTEMPTS}`} — ${error}`);
  await finishJob(job, {
    status: exhausted ? "failed" : "pending",
    attempts,
    last_error: String(error).slice(0, 2000),
    claimed_at: null
  });
}

async function signedAudioUrl(path) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/class-audio/${path}`, {
    method: "POST",
    headers: sbHeaders,
    body: JSON.stringify({ expiresIn: 7200 })
  });
  if (!res.ok) throw new Error(`No se pudo firmar ${path}: ${res.status} ${await res.text()}`);
  const { signedURL } = await res.json();
  return `${SUPABASE_URL}/storage/v1${signedURL}`;
}

async function deleteAudioObjects(paths) {
  if (!paths.length) return;
  await fetch(`${SUPABASE_URL}/storage/v1/object/class-audio`, {
    method: "DELETE",
    headers: sbHeaders,
    body: JSON.stringify({ prefixes: paths })
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Bunny
// ---------------------------------------------------------------------------

/** Mirrors signVideoDirectory() in src/lib/video/bunny.ts. */
function signBunnyDir(videoId, ttl = 7200) {
  const expires = Math.floor(Date.now() / 1000) + ttl;
  const tokenPath = `/${videoId}/`;
  const token = createHash("md5")
    .update(BUNNY_TOKEN_KEY + tokenPath + expires, "utf8")
    .digest("base64")
    .replace(/\n/g, "").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return `token=${token}&token_path=${encodeURIComponent(tokenPath)}&expires=${expires}`;
}

async function bunnyApi(path, init = {}) {
  const res = await fetch(`https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}${path}`, {
    ...init,
    headers: { AccessKey: BUNNY_API_KEY, accept: "application/json", ...(init.headers ?? {}) }
  });
  if (!res.ok) throw new Error(`Bunny ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function downloadTo(url, destination) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Descarga fallida (${res.status}) de ${url.split("?")[0]}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destination));
}

/** Same TUS handshake the browser uses; auth headers required on every call. */
async function uploadToBunny(videoId, filePath) {
  const { size } = await stat(filePath);
  const expiration = Math.floor(Date.now() / 1000) + 7200;
  const signature = createHash("sha256")
    .update(`${BUNNY_LIBRARY_ID}${BUNNY_API_KEY}${expiration}${videoId}`, "utf8")
    .digest("hex");
  const auth = {
    AuthorizationSignature: signature,
    AuthorizationExpire: String(expiration),
    VideoId: videoId,
    LibraryId: String(BUNNY_LIBRARY_ID)
  };

  const create = await fetch("https://video.bunnycdn.com/tusupload", {
    method: "POST",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(size),
      "Upload-Metadata": `filetype ${Buffer.from("video/mp4").toString("base64")}`,
      ...auth
    }
  });
  if (create.status !== 201) throw new Error(`TUS create fallo: ${create.status}`);
  const location = new URL(create.headers.get("location"), "https://video.bunnycdn.com").toString();

  const CHUNK = 16 * 1024 * 1024;
  const { readFile } = await import("node:fs/promises");
  const buffer = await readFile(filePath);
  let offset = 0;
  while (offset < buffer.length) {
    const end = Math.min(offset + CHUNK, buffer.length);
    const res = await fetch(location, {
      method: "PATCH",
      headers: {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": String(offset),
        "Content-Type": "application/offset+octet-stream",
        ...auth
      },
      body: buffer.subarray(offset, end)
    });
    if (res.status !== 204) throw new Error(`TUS patch fallo en offset ${offset}: ${res.status}`);
    offset = Number(res.headers.get("upload-offset") ?? end);
  }
}

async function waitForEncode(videoId) {
  const deadline = Date.now() + ENCODE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const video = await bunnyApi(`/videos/${videoId}`);
    if (video.status === 4) return video;
    if (video.status === 5) throw new Error("Bunny reporto error de encode");
    await new Promise((r) => setTimeout(r, 15000));
  }
  throw new Error("Timeout esperando el encode de Bunny");
}

/** Reads which audio languages the finished playlist actually exposes. */
async function playlistLocales(videoId) {
  const url = `https://${BUNNY_CDN}/${videoId}/playlist.m3u8?${signBunnyDir(videoId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo leer el playlist (${res.status})`);
  const body = await res.text();
  return body
    .split("\n")
    .filter((line) => line.includes("TYPE=AUDIO"))
    .map((line) => (line.match(/LANGUAGE="([^"]+)"/) || [])[1])
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// ffmpeg
// ---------------------------------------------------------------------------

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-4000);
    });
    proc.on("error", (err) =>
      reject(new Error(err.code === "ENOENT" ? "ffmpeg no esta instalado o no esta en el PATH" : err.message))
    );
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg salio con codigo ${code}: ${stderr.slice(-600)}`))
    );
  });
}

/**
 * Recipe validated against Bunny across 6 encodes (2026-07-28).
 *
 *  -c:v copy   the video is NOT re-encoded, only remuxed. Fast, lossless, and
 *              the reason this runs fine on a tiny machine.
 *  language    ISO 639-2 tags are the ONLY thing Bunny reads; it ignores the
 *              `title` metadata and derives the display name from the code.
 *  first track becomes DEFAULT=YES, so the original language goes first.
 */
async function muxTracks(videoPath, audioTracks, outputPath) {
  const args = ["-hide_banner", "-loglevel", "error", "-i", videoPath];
  for (const track of audioTracks) args.push("-i", track.file);

  args.push("-map", "0:v:0", "-map", "0:a:0");
  audioTracks.forEach((_, index) => args.push("-map", `${index + 1}:a:0`));

  args.push("-c:v", "copy", "-c:a", "aac", "-b:a", `${AUDIO_BITRATE_KBPS}k`);
  args.push("-metadata:s:a:0", `language=${FFMPEG_LANG.es}`);
  audioTracks.forEach((track, index) => {
    args.push(`-metadata:s:a:${index + 1}`, `language=${FFMPEG_LANG[track.locale] ?? track.locale}`);
  });

  args.push("-movflags", "+faststart", "-y", outputPath);
  await runFfmpeg(args);
}

// ---------------------------------------------------------------------------
// Job
// ---------------------------------------------------------------------------

async function processJob(job) {
  const expected = job.expected_locales ?? [];
  const inputs = job.audio_inputs ?? [];
  log(`job ${job.id}: video ${job.source_bunny_video_id}, idiomas esperados [${expected.join(", ")}]`);

  const dir = await mkdtemp(join(process.env.WORK_DIR || tmpdir(), "brunela-mux-"));
  let newVideoId = null;

  try {
    // 1. The ORIGINAL upload, not a transcode -- no generation loss.
    const sourcePath = join(dir, "source.mp4");
    log("  bajando el original de Bunny...");
    await downloadTo(
      `https://${BUNNY_CDN}/${job.source_bunny_video_id}/original?${signBunnyDir(job.source_bunny_video_id)}`,
      sourcePath
    );

    // 2. The uploaded language tracks.
    const tracks = [];
    for (const input of inputs) {
      const file = join(dir, `${input.locale}.mp3`);
      log(`  bajando audio ${input.locale}...`);
      await downloadTo(await signedAudioUrl(input.path), file);
      tracks.push({ ...input, file });
    }

    // 3. Remux.
    const outputPath = join(dir, "muxed.mp4");
    log("  muxeando con ffmpeg (-c:v copy)...");
    await muxTracks(sourcePath, tracks, outputPath);

    // 4. New Bunny video. The old one keeps serving until the swap, so the
    //    class is never unavailable.
    const created = await bunnyApi("/videos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: `mux ${job.video_id}` })
    });
    newVideoId = created.guid;
    log(`  subiendo el resultado a Bunny (${newVideoId})...`);
    await uploadToBunny(newVideoId, outputPath);

    log("  esperando el encode...");
    await waitForEncode(newVideoId);

    // 5. VERIFY BEFORE SWAP. Bunny dropped a track once in seven test encodes;
    //    without this a class would silently ship missing a language.
    const found = await playlistLocales(newVideoId);
    const missing = expected.filter((locale) => !found.includes(locale));
    if (missing.length) {
      throw new Error(
        `El encode quedo sin los idiomas [${missing.join(", ")}] (el playlist trae [${found.join(", ")}]). No se hace el swap.`
      );
    }
    log(`  verificado: playlist con [${found.join(", ")}]`);

    // 6. Atomic-ish swap, then clean up.
    const oldVideoId = job.source_bunny_video_id;
    await sbRest(`videos?id=eq.${job.video_id}`, {
      method: "PATCH",
      body: JSON.stringify({
        bunny_video_id: newVideoId,
        stream_playback_id: `https://${BUNNY_CDN}/${newVideoId}/playlist.m3u8`,
        thumbnail_url: `https://${BUNNY_CDN}/${newVideoId}/thumbnail.jpg`,
        audio_tracks: inputs.map((input) => ({
          locale: input.locale,
          label: input.label,
          muxed_at: new Date().toISOString()
        }))
      })
    });

    await finishJob(job, { status: "done", result_bunny_video_id: newVideoId, last_error: null });

    await bunnyApi(`/videos/${oldVideoId}`, { method: "DELETE" }).catch(() => {});
    await deleteAudioObjects(inputs.map((input) => input.path));

    log(`  job ${job.id} LISTO — la clase ahora sirve ${newVideoId}`);
  } catch (error) {
    // Never leave a half-encoded asset behind when the job did not swap.
    if (newVideoId) await bunnyApi(`/videos/${newVideoId}`, { method: "DELETE" }).catch(() => {});
    await failJob(job, error instanceof Error ? error.message : error);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    log(`${signal} recibido, cerrando despues del job actual...`);
    stopping = true;
  });
}

async function main() {
  const once = process.argv.includes("--once");
  log(`worker de muxeo iniciado (poll cada ${POLL_SECONDS}s, ${AUDIO_BITRATE_KBPS} kbps, ${MAX_ATTEMPTS} intentos)`);

  // Fail fast and loudly if ffmpeg is missing, instead of on the first job.
  await runFfmpeg(["-hide_banner", "-version"]).catch((err) => {
    console.error(`[arranque] ${err.message}`);
    process.exit(1);
  });

  while (!stopping) {
    try {
      const job = await claimJob();
      if (job) {
        await processJob(job);
      } else if (once) {
        log("no hay jobs pendientes.");
      }
      if (once) break;
      if (!job) await new Promise((r) => setTimeout(r, POLL_SECONDS * 1000));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`error en el bucle: ${message}`);
      // --once is for diagnostics and CI: it must surface the failure and exit,
      // not sit in a retry loop looking like it is working.
      if (once) {
        console.error("--once: terminando por error. Revisa las variables de entorno.");
        // exitCode + break, not process.exit(): lets pending handles unwind
        // cleanly instead of tripping a libuv assertion on Windows.
        process.exitCode = 1;
        break;
      }
      // In continuous mode a transient network blip must not kill the process.
      await new Promise((r) => setTimeout(r, POLL_SECONDS * 1000));
    }
  }
  log("worker detenido.");
}

main();
