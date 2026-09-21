import { createClient } from "@supabase/supabase-js";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUB  = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const admin = createClient(URL, SVC, { auth: { persistSession: false } });
const anon  = createClient(URL, PUB, { auth: { persistSession: false } });

const r = [];
const ok   = (q, d) => r.push(["ok",   q, d]);
const mal  = (q, d) => r.push(["MAL",  q, d]);

async function existe(cli, tabla, quien) {
  const { error } = await cli.from(tabla).select("*").limit(1);
  return { error };
}

// 1-2. Las tablas existen y service_role las lee
for (const t of ["landing_texts", "landing_faq"]) {
  const { error } = await existe(admin, t);
  error ? mal(`tabla ${t}`, error.message) : ok(`tabla ${t}`, "existe y service_role lee");
}

// 3. Las vistas existen
for (const v of ["landing_textos_publicos", "landing_faq_publico"]) {
  const { error } = await existe(admin, v);
  error ? mal(`vista ${v}`, error.message) : ok(`vista ${v}`, "existe y service_role lee");
}

// 4. anon NO puede leer nada de esto  <-- lo que de verdad importa
for (const t of ["landing_texts", "landing_faq", "landing_textos_publicos", "landing_faq_publico"]) {
  const { data, error } = await anon.from(t).select("*").limit(1);
  if (error) ok(`anon en ${t}`, `rechazado (${error.code || error.message.slice(0, 40)})`);
  else mal(`anon en ${t}`, `LEE! devolvio ${JSON.stringify(data)}`);
}

// 5. El check del FAQ tiene que MORDER: esto debe fallar
{
  const { error } = await admin.from("landing_faq").insert({
    is_published: true,
    question_i18n: { es: "   " },
    answer_i18n: { es: "algo" },
  });
  if (!error) mal("check de FAQ vacia", "ENTRO: una pregunta en blanco puede llegar a la portada");
  else if (String(error.message).includes("landing_faq_publicada_tiene_contenido"))
    ok("check de FAQ vacia", "rechazado por el constraint correcto");
  else mal("check de FAQ vacia", `fallo por otro motivo: ${error.message}`);
}

// 6. El bucket publico
{
  const { data, error } = await admin.storage.getBucket("landing-media");
  if (error) mal("bucket landing-media", error.message);
  else if (data.public) ok("bucket landing-media", `publico, limite ${data.file_size_limit} bytes`);
  else mal("bucket landing-media", "existe pero NO es publico");
}

console.log("");
for (const [e, q, d] of r) console.log(`  ${e === "ok" ? "✅" : "❌"} ${q.padEnd(34)} ${d}`);
const fallos = r.filter(([e]) => e !== "ok").length;
console.log(`\n  ${fallos === 0 ? "✅ la migracion esta aplicada y se comporta bien" : `❌ ${fallos} problema(s)`}\n`);
process.exit(fallos ? 1 : 0);
