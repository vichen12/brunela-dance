/**
 * Reads the real configuration of the Bunny Video Library.
 *
 * Why: the library-level API key cannot read library settings. Only an
 * ACCOUNT-level key can. Without this we are guessing at dashboard menu labels.
 *
 * Setup:
 *   1. Bunny dashboard > click your account (top right) > Account Settings > API
 *   2. Copy the "API Key" there (this is the ACCOUNT key, different from the
 *      Stream library key already in .env.local)
 *   3. Add a temporary line to .env.local:
 *        BUNNY_ACCOUNT_API_KEY=...
 *
 * Run:
 *   node --env-file=.env.local scripts/bunny-library-settings.mjs
 *
 * You can delete BUNNY_ACCOUNT_API_KEY again afterwards; the app never uses it.
 */

const LIB = process.env.BUNNY_STREAM_LIBRARY_ID;
const ACCOUNT_KEY = process.env.BUNNY_ACCOUNT_API_KEY;

if (!ACCOUNT_KEY) {
  console.error("\n  Falta BUNNY_ACCOUNT_API_KEY en .env.local. Ver las instrucciones arriba.\n");
  process.exit(1);
}

const res = await fetch(`https://api.bunny.net/videolibrary/${LIB}`, {
  headers: { AccessKey: ACCOUNT_KEY, accept: "application/json" }
});

if (res.status !== 200) {
  console.error(`\n  HTTP ${res.status} -- ${(await res.text()).slice(0, 300)}\n`);
  process.exit(1);
}

const lib = await res.json();

// The fields that decide whether direct CDN playback is even possible.
const INTERESTING = [
  "Name",
  "PullZoneId",
  "PullZoneType",
  "AllowDirectPlay",
  "EnableDRM",
  "EnableMP4Fallback",
  "BlockNoneReferrer",
  "AllowedReferrers",
  "BlockedReferrers",
  "PlayerTokenAuthenticationEnabled",
  "EnableTokenAuthentication",
  "TokenAuthenticationEnabled",
  "EnabledResolutions",
  "ApiKey"
];

console.log(`\n=== Library ${LIB} ===\n`);
for (const field of INTERESTING) {
  if (field in lib) {
    const value = field === "ApiKey" ? "(oculta)" : JSON.stringify(lib[field]);
    console.log(`  ${field.padEnd(34)} ${value}`);
  }
}

// Anything token / security / direct related that we did not list above.
console.log(`\n=== Otros campos relacionados a seguridad ===\n`);
for (const [k, v] of Object.entries(lib)) {
  if (INTERESTING.includes(k)) continue;
  if (!/token|secur|direct|drm|referr|block|allow|widevine|playready/i.test(k)) continue;
  const value = /key|token/i.test(k) && typeof v === "string" && v.length > 8 ? "(valor oculto)" : JSON.stringify(v);
  console.log(`  ${k.padEnd(34)} ${value}`);
}

console.log(`\n=== Todos los nombres de campo devueltos ===\n`);
console.log("  " + Object.keys(lib).join(", ") + "\n");
