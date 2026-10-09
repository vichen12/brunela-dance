/**
 * Datos de DEMO para probar el sistema entero: clases, planes de trabajo,
 * sesiones en vivo, packs, documentos, chat, anuncios, progreso y cuentas de
 * cada tipo.
 *
 *   node --env-file=.env.local scripts/sembrar-demo.mjs
 *   node --env-file=.env.local scripts/borrar-demo.mjs     (lo saca TODO)
 *
 * QUE NO TOCA
 *   Solo INSERTA o actualiza filas propias, todas marcadas:
 *     - contenido con slug `demo-...`
 *     - cuentas con correo `...@brunela.test`
 *     - salas de chat con nombre que empieza en "Demo · "
 *     - documentos y anuncios con titulo que empieza en "Demo · "
 *   Nunca actualiza ni borra una fila que no sea demo. Es idempotente: correrlo
 *   dos veces refresca, no duplica (las fechas de las sesiones vuelven a caer
 *   en el futuro).
 *
 * LIMITES, A PROPOSITO
 *   - Los videos NO reproducen: no hay archivo en Bunny. Es para probar
 *     tarjetas, filtros, accesos, planes y progreso, no el reproductor.
 *   - Los packs NO se pueden comprar: no tienen price id de Stripe. Uno sale
 *     publicado (se ve en Mi plan) pero con show_on_landing = false, para que
 *     la portada publica de produccion no muestre nada inventado.
 *   - Las cuentas tienen el plan puesto a mano, sin suscripcion en Stripe:
 *     "Gestionar suscripcion" no va a tener nada que abrir.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const ahora = Date.now();
const DIA = 86400000;
const iso = (ms) => new Date(ms).toISOString();
const ok = (r, que) => { if (r.error) throw new Error(`${que}: ${r.error.message} (${r.error.code ?? ""})`); return r.data; };

// ── 1. Cuentas ────────────────────────────────────────────────────────────
// Una por cada caso que vale la pena probar, mas relleno para que las listas,
// el panel y las analiticas tengan volumen.
const CLAVE = process.env.DEMO_PASSWORD || "Demo-" + randomBytes(6).toString("base64url") + "-26";

const PRINCIPALES = [
  { email: "demo.principal@brunela.test", nombre: "Lucía Principal", tier: "principal", nivel: "avanzado", metas: ["rendimiento_escenico", "fuerza_centro"] },
  { email: "demo.solista@brunela.test", nombre: "Sofía Solista", tier: "solista", nivel: "intermedio", metas: ["alineacion_postural", "flexibilidad"] },
  { email: "demo.corps@brunela.test", nombre: "Carla Corps", tier: "corps_de_ballet", nivel: "principiante", metas: ["movilidad", "bienestar_general"] },
  { email: "demo.sinplan@brunela.test", nombre: "Nina Sin Plan", tier: "none", nivel: "principiante", metas: ["bienestar_general"] },
  { email: "demo.pack@brunela.test", nombre: "Paula Pack", tier: "none", nivel: "intermedio", metas: ["flexibilidad"] },
  { email: "demo.invitada@brunela.test", nombre: "Inés Invitada", tier: "corps_de_ballet", nivel: "intermedio", metas: ["resistencia"] },
  // Sin onboarding: al entrar tiene que caer en el formulario de bienvenida.
  { email: "demo.nueva@brunela.test", nombre: null, tier: "none", nivel: "principiante", metas: [], sinOnboarding: true },
];

const NOMBRES = ["Valentina Ruiz", "Martina López", "Camila Torres", "Julia Romero", "Emma García", "Olivia Martín", "Alba Navarro", "Daniela Gil", "Elena Ortega", "Irene Molina", "Laura Castro", "Marta Ramos", "Noa Delgado", "Clara Vidal", "Aitana Ferrer", "Lola Serrano", "Vera Blanco", "Mía Iglesias", "Chloé Bernard", "Giulia Rossi", "Sara Prieto", "Ana Medina"];
const TIERS = ["principal", "solista", "corps_de_ballet", "none"];
const NIVELES = ["principiante", "intermedio", "avanzado", "profesional"];
const METAS = ["movilidad", "fuerza_centro", "flexibilidad", "recuperacion", "resistencia", "alineacion_postural", "rendimiento_escenico", "bienestar_general"];
const RELLENO = NOMBRES.map((n, i) => ({
  email: `demo.alumna${String(i + 1).padStart(2, "0")}@brunela.test`,
  nombre: n,
  tier: TIERS[i % 4],
  nivel: NIVELES[i % 4],
  metas: [METAS[i % 8], METAS[(i + 3) % 8]],
  altaHaceDias: 2 + i * 6,
}));

async function todasLasCuentas() {
  const mapa = new Map();
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) mapa.set(u.email?.toLowerCase(), u.id);
    if (data.users.length < 200) break;
  }
  return mapa;
}

async function asegurarCuenta(c, existentes, clave) {
  let id = existentes.get(c.email);
  if (!id) {
    const r = await db.auth.admin.createUser({ email: c.email, password: clave, email_confirm: true, user_metadata: c.nombre ? { full_name: c.nombre } : {} });
    if (r.error) throw new Error(`crear ${c.email}: ${r.error.message}`);
    id = r.data.user.id;
  } else if (clave) {
    await db.auth.admin.updateUserById(id, { password: clave });
  }
  const perfil = {
    full_name: c.nombre,
    membership_tier: c.tier,
    technical_level: c.nivel,
    training_goals: c.metas,
    onboarding_completed: !c.sinOnboarding,
    country_code: ["ES", "AR", "FR", "IT", "MX"][c.email.length % 5],
  };
  if (c.altaHaceDias) perfil.created_at = iso(ahora - c.altaHaceDias * DIA);
  ok(await db.from("profiles").update(perfil).eq("id", id).like("email", "%@brunela.test"), "perfil " + c.email);
  return id;
}

// ── 2. Vocabulario (el mismo de src/features/studio/catalogo-clases.ts) ──
const NIVEL = { inicial: ["principiante", "principiante"], intermedio: ["intermedio", "intermedio"], avanzado: ["avanzado", "maestro"], todos: ["principiante", "maestro"] };
const FOTOS = ["c-barra", "c-barra2", "c-cambre", "c-cintas", "c-cou", "c-mermaid", "c-pelota", "c-pies", "c-pike", "c-piso", "c-retrato", "c-split", "c-suelo", "c-tul"];
const foto = (i) => `/fotos-landing/${FOTOS[i % FOTOS.length]}.jpg`;
const ORDEN_TIER = ["corps_de_ballet", "solista", "principal"];
const masBajo = (planes) => ORDEN_TIER.find((t) => planes.includes(t));
const C = ["corps_de_ballet"], S = ["solista"], P = ["principal"];
const CSP = [...C, ...S, ...P], SP = [...S, ...P];

// slug, titulo es, titulo en, descripcion, tipo, categoria, nivel, minutos, materiales, planes, estado, destacada
const CLASES = [
  ["barra-de-suelo-esencial", "Barra de suelo esencial", "Essential floor barre", "La barra clásica llevada al suelo: sin carga en las articulaciones, con toda la atención en la colocación.", "clase", "ballet", "inicial", 32, ["mat"], CSP, "published", true],
  ["port-de-bras-suave", "Port de bras suave", "Gentle port de bras", "Brazos que respiran: coordinación de cabeza, mirada y espalda alta.", "clase", "ballet", "todos", 22, ["sin-material"], CSP, "published", false],
  ["adagio-en-el-centro", "Adagio en el centro", "Centre adagio", "Desarrollés lentos y equilibrios sostenidos para ganar control en el centro.", "clase", "ballet", "intermedio", 44, ["barra-de-ballet"], SP, "published", false],
  ["allegro-pequeno", "Allegro pequeño", "Petit allegro", "Saltos chicos y rápidos con foco en el plié y el empeine.", "clase", "ballet", "avanzado", 38, ["sin-material"], P, "published", false],
  ["tecnica-de-barra-completa", "Técnica de barra completa", "Full barre technique", "Una barra entera de principio a fin, con correcciones de colocación.", "clase", "tecnica", "intermedio", 55, ["barra-de-ballet"], SP, "published", true],
  ["tendus-y-jetes", "Tendus y jetés", "Tendus and jetés", "El trabajo de pie que sostiene todo lo demás, a tempo lento y rápido.", "mini_training", "tecnica", "todos", 12, ["barra-de-ballet"], CSP, "published", false],
  ["en-dehors-desde-la-cadera", "En dehors desde la cadera", "Turnout from the hip", "Activar los rotadores profundos para un dehors que no castigue la rodilla.", "clase", "dehors", "intermedio", 30, ["theraband", "mat"], CSP, "published", false],
  ["dehors-con-theraloop", "Dehors con TheraLoop", "Turnout with TheraLoop", "Resistencia elástica para sentir y fortalecer la rotación.", "mini_training", "dehors", "inicial", 14, ["theraloop"], C, "published", false],
  ["movilidad-de-columna", "Movilidad de columna", "Spine mobility", "Ondas, rotaciones y cambrés progresivos para una espalda que se mueve entera.", "clase", "movilidad", "todos", 26, ["mat", "foam-roller-con-pinchos"], CSP, "published", false],
  ["caderas-libres", "Caderas libres", "Free hips", "Movilidad de cadera en todos los planos, sin forzar el rango.", "clase", "movilidad", "inicial", 24, ["mat", "cojin"], CSP, "published", false],
  ["despertar-articular", "Despertar articular", "Joint wake-up", "Diez minutos para empezar el día moviendo todo.", "mini_training", "movilidad", "todos", 10, ["sin-material"], CSP, "published", true],
  ["isquios-y-espalda-baja", "Isquios y espalda baja", "Hamstrings and lower back", "Elongación progresiva con banda y con pared.", "clase", "stretching", "inicial", 28, ["theraband", "pared"], CSP, "published", false],
  ["split-progresivo", "Split progresivo", "Progressive split", "Camino al split en tres fases, con bloques y paciencia.", "clase", "stretching", "avanzado", 40, ["bloque-de-yoga", "mat"], SP, "published", false],
  ["estiramiento-post-clase", "Estiramiento post clase", "Post-class stretch", "El cierre ideal después de cualquier clase.", "mini_training", "stretching", "todos", 15, ["mat"], CSP, "published", false],
  ["pies-que-hablan", "Pies que hablan", "Talking feet", "Articulación del pie, metatarsos y empeine, uno por uno.", "clase", "pies-y-tobillos", "inicial", 20, ["theraband"], CSP, "published", true],
  ["tobillos-fuertes", "Tobillos fuertes", "Strong ankles", "Estabilidad de tobillo para relevés seguros y sin dolor.", "clase", "pies-y-tobillos", "intermedio", 25, ["theraband", "pelota-pequena-rigida"], SP, "published", false],
  ["empeine-con-pelota", "Empeine con pelota", "Instep with a ball", "Liberar la fascia plantar y despertar el empeine.", "mini_training", "pies-y-tobillos", "todos", 8, ["pelota-pequena-rigida"], C, "published", false],
  ["equilibrio-en-releve", "Equilibrio en relevé", "Balance on relevé", "Encontrar el eje y quedarse ahí: propiocepción y centro.", "clase", "equilibrio", "intermedio", 30, ["fusion-ball"], SP, "published", false],
  ["passe-estable", "Passé estable", "Stable passé", "Equilibrios en passé con ojos abiertos, cerrados y sobre superficie inestable.", "mini_training", "equilibrio", "avanzado", 16, ["fit-ball"], P, "published", false],
  ["centro-para-bailarinas", "Centro para bailarinas", "Core for dancers", "El abdominal que sostiene la línea, sin comprometer la zona lumbar.", "clase", "abdominales-para-bailarines", "intermedio", 30, ["mat"], CSP, "published", true],
  ["abdominales-en-fit-ball", "Abdominales en Fit Ball", "Fit ball core", "Inestabilidad controlada para un centro profundo.", "clase", "abdominales-para-bailarines", "avanzado", 35, ["fit-ball", "mat"], P, "published", false],
  ["core-express", "Core express", "Express core", "Doce minutos de centro, intensos y precisos.", "mini_training", "abdominales-para-bailarines", "todos", 12, ["mat"], CSP, "published", false],
  ["linea-larga", "Línea larga", "Long line", "Alargar desde el centro hacia las puntas: control de la línea en el espacio.", "clase", "linea-y-control", "intermedio", 36, ["barra-de-ballet"], SP, "published", false],
  ["control-del-developpe", "Control del développé", "Développé control", "Fuerza y control para subir la pierna sin compensar.", "clase", "linea-y-control", "avanzado", 42, ["tobilleras", "barra-de-ballet"], P, "published", false],
  ["preparacion-de-giros", "Preparación de giros", "Turn preparation", "Spot, eje y preparación: todo lo que pasa antes de girar.", "clase", "giros", "inicial", 25, ["sin-material"], CSP, "published", false],
  ["pirouettes-dobles", "Pirouettes dobles", "Double pirouettes", "Del giro simple al doble, con progresiones seguras.", "clase", "giros", "avanzado", 40, ["sin-material"], SP, "published", true],
  ["fouettes-sin-miedo", "Fouettés sin miedo", "Fearless fouettés", "Un taller para entender la mecánica del fouetté.", "clase", "giros", "avanzado", 45, ["sin-material"], P, "published", false],
  ["fuerza-para-el-salto", "Fuerza para el salto", "Strength for jumps", "Pliométrico adaptado a bailarinas: potencia sin impacto innecesario.", "clase", "preparacion-fisica", "intermedio", 38, ["pesas", "silla"], SP, "published", false],
  ["resistencia-de-escena", "Resistencia de escena", "Stage stamina", "Circuito para aguantar una variación entera con calidad.", "clase", "preparacion-fisica", "avanzado", 48, ["kettlebell", "tobilleras"], P, "published", false],
  ["gluteos-y-piernas", "Glúteos y piernas", "Glutes and legs", "Fuerza de tren inferior con muñequeras y tobilleras.", "clase", "preparacion-fisica", "todos", 34, ["tobilleras", "munequeras", "mat"], CSP, "published", false],
  // Exclusivas y combinaciones raras, para probar la lista de planes.
  ["bienvenida-al-estudio", "Bienvenida al estudio", "Welcome to the studio", "Solo para quien recién empieza: cómo usar el estudio y por dónde arrancar.", "mini_training", "tecnica", "todos", 6, ["sin-material"], C, "published", false],
  ["masterclass-corps-y-principal", "Masterclass Corps y Principal", "Corps and Principal masterclass", "Clase publicada para Corps y Principal, sin Solista: prueba de la lista de planes.", "clase", "ballet", "todos", 50, ["barra-de-ballet"], ["corps_de_ballet", "principal"], "published", false],
  // Borradores y archivada: solo los ve la admin.
  ["borrador-variacion-kitri", "Variación de Kitri (borrador)", "Kitri variation (draft)", "Todavía sin publicar.", "clase", "ballet", "avanzado", 30, ["sin-material"], P, "draft", false],
  ["borrador-pilates-barre", "Barre pilates (borrador)", "Barre pilates (draft)", "", "clase", "preparacion-fisica", "intermedio", 20, ["sin-material"], CSP, "draft", false],
  ["archivada-vieja-barra", "Barra vieja (archivada)", "Old barre (archived)", "Clase retirada del catálogo.", "clase", "ballet", "inicial", 30, ["barra-de-ballet"], CSP, "archived", false],
];

// ── 3. Planes de trabajo ─────────────────────────────────────────────────
// slug, titulo, descripcion, tier, dias, destacado, clases por dia (null = hueco)
const PLANES = [
  ["trabajo-de-pies-14-dias", "Trabajo de pies, 14 días", "Dos semanas para pies fuertes, articulados y estables.", "solista", 14, true,
    ["pies-que-hablan", "empeine-con-pelota", "tobillos-fuertes", "despertar-articular", "pies-que-hablan", "equilibrio-en-releve", "estiramiento-post-clase", "tobillos-fuertes", "empeine-con-pelota", "passe-estable", "pies-que-hablan", "tendus-y-jetes", "tobillos-fuertes", "estiramiento-post-clase"]],
  ["base-en-7-dias", "Base en 7 días", "Una semana para ordenar la colocación desde cero.", "corps_de_ballet", 7, false,
    ["bienvenida-al-estudio", "barra-de-suelo-esencial", "caderas-libres", "centro-para-bailarinas", "port-de-bras-suave", "isquios-y-espalda-baja", "estiramiento-post-clase"]],
  ["giros-en-10-dias", "Giros en 10 días", "Del eje al doble pirouette, paso a paso.", "principal", 10, true,
    ["preparacion-de-giros", "equilibrio-en-releve", "centro-para-bailarinas", "preparacion-de-giros", "passe-estable", "pirouettes-dobles", "core-express", "pirouettes-dobles", "fouettes-sin-miedo", "estiramiento-post-clase"]],
  // Le falta el dia 4 a proposito: el formulario tiene que ofrecer el 4 como primer hueco.
  ["flexibilidad-21-dias", "Flexibilidad en 21 días", "Tres semanas de elongación progresiva, sin forzar.", "solista", 21, false,
    ["isquios-y-espalda-baja", "caderas-libres", "movilidad-de-columna", null, "split-progresivo", "estiramiento-post-clase", "despertar-articular"]],
  ["preparacion-de-temporada", "Preparación de temporada", "Fuerza, resistencia y línea para llegar a escena en forma.", "principal", 5, false,
    ["fuerza-para-el-salto", "resistencia-de-escena", "control-del-developpe", "gluteos-y-piernas", "linea-larga"]],
];

// ── 4. Sesiones en vivo ──────────────────────────────────────────────────
// slug, titulo, descripcion, estado, tier, dentro de (dias, puede ser negativo), hora UTC, minutos, cupo, zoom
const SESIONES = [
  ["live-barra-abierta", "Barra abierta", "Barra completa en directo, con correcciones al momento.", "scheduled", "corps_de_ballet", 1, 17, 60, 25, true],
  ["live-pies-y-tobillos", "Pies y tobillos en vivo", "Sesión práctica con theraband: traé la tuya.", "scheduled", "solista", 3, 18, 45, 15, true],
  ["live-taller-de-giros", "Taller de giros", "Taller intensivo de pirouettes y fouettés.", "scheduled", "principal", 6, 16, 90, 8, true],
  ["live-stretching-del-domingo", "Stretching del domingo", "Elongación tranquila para cerrar la semana.", "scheduled", "corps_de_ballet", 9, 9, 40, 40, false],
  ["live-masterclass-invitada", "Masterclass con invitada", "Clase especial de Principal, con invitaciones puntuales.", "scheduled", "principal", 12, 17, 75, 12, true],
  ["live-casi-llena", "Centro avanzado (casi llena)", "Quedan pocos lugares.", "scheduled", "solista", 4, 19, 60, 3, true],
  ["live-barra-pasada", "Barra de la semana pasada", "Ya ocurrió.", "completed", "corps_de_ballet", -5, 17, 60, 25, false],
  ["live-taller-pasado", "Taller de adagio (pasado)", "Ya ocurrió.", "completed", "solista", -12, 18, 60, 15, false],
  ["live-cancelada", "Sesión cancelada", "Se canceló por enfermedad.", "canceled", "corps_de_ballet", 2, 18, 60, 20, false],
];

// ── 5. Documentos, anuncios, packs, chat ─────────────────────────────────
const PDF = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
const DOCS = [
  ["Guía de colocación básica", "Los diez puntos que revisamos en cada clase.", "none", "tecnica", null],
  ["Rutina de pies para cada día", "Hoja imprimible con la rutina de 10 minutos.", "corps_de_ballet", "pies-y-tobillos", "pies-que-hablan"],
  ["Plan de estiramientos semanal", "Qué estirar cada día de la semana.", "corps_de_ballet", "stretching", "isquios-y-espalda-baja"],
  ["Ejercicios de dehors con banda", "Progresión de cuatro semanas.", "solista", "dehors", "en-dehors-desde-la-cadera"],
  ["Diario de giros", "Para anotar tus progresos en pirouettes.", "solista", "giros", "pirouettes-dobles"],
  ["Preparación física de temporada", "El plan completo de fuerza y resistencia.", "principal", "preparacion-fisica", "resistencia-de-escena"],
  ["Alimentación para bailarinas", "Recomendaciones generales, no reemplaza a una nutricionista.", "principal", null, null],
  ["Glosario de ballet", "Términos en francés con su explicación.", "none", "ballet", null],
];
const ANUNCIOS = [
  ["Nuevo plan: Trabajo de pies", "Ya está disponible el plan de 14 días para pies fuertes. ¡A darle!", "all", 0, null],
  ["Taller de giros este sábado", "Quedan pocos lugares para el taller de Principal.", "principal", 1, 6],
  ["Clases nuevas de stretching", "Subimos tres clases nuevas de elongación.", "corps_de_ballet", 3, null],
];
const PACKS = [
  ["pack-pies-perfectos", "Pack Pies perfectos", "Cinco clases para trabajar pies y tobillos a fondo.", 2900, true, ["pies-que-hablan", "tobillos-fuertes", "empeine-con-pelota", "equilibrio-en-releve", "passe-estable"]],
  ["pack-giros", "Pack Giros", "Todo lo necesario para girar con confianza.", 3900, false, ["preparacion-de-giros", "pirouettes-dobles", "fouettes-sin-miedo"]],
];
const SALAS = [
  ["Demo · Comunidad general", "community", "none", null],
  ["Demo · Ballet", "tier", "corps_de_ballet", "ballet"],
  ["Demo · Solistas", "tier", "solista", null],
  ["Demo · Principales", "tier", "principal", null],
];
const FRASES = [
  "¡Hola a todas! Hoy hice la barra de suelo y me encantó 💗",
  "¿Alguien más siente los tobillos más estables después del plan de pies?",
  "Brunela, ¿el theraband tiene que ser de resistencia media?",
  "Hoy por fin me salió el doble sin caerme del eje 🎉",
  "Les recomiendo el estiramiento post clase, es otra cosa.",
  "¿A qué hora es la sesión del sábado en España?",
  "Gracias por las correcciones de ayer, me sirvieron muchísimo.",
  "Mi gata se subió al mat en pleno adagio jajaja",
  "¿Cuántas veces por semana hacen el plan de flexibilidad?",
  "Me encanta la nueva clase de port de bras.",
];
const RESPUESTAS = [
  "¡Qué lindo leer eso! Seguí así 💪",
  "Sí, la media es la ideal para empezar.",
  "Es a las 18 h hora de Madrid. ¡Nos vemos!",
  "Tres veces por semana alcanza, el resto descansá.",
];

// ── Ejecucion ────────────────────────────────────────────────────────────
console.log("Sembrando datos de demo en", URL);
const existentes = await todasLasCuentas();
const cuentas = {};
for (const c of PRINCIPALES) cuentas[c.email] = await asegurarCuenta(c, existentes, CLAVE);
for (const c of RELLENO) cuentas[c.email] = await asegurarCuenta(c, existentes, existentes.has(c.email) ? null : "R-" + randomBytes(12).toString("base64url"));
console.log("cuentas:", Object.keys(cuentas).length);

const brunela = ok(await db.from("profiles").select("id, full_name").eq("is_studio_owner", true).maybeSingle(), "duena")
  ?? ok(await db.from("profiles").select("id, full_name").eq("is_admin", true).order("created_at").limit(1).maybeSingle(), "admin");

// Clases
const filasClases = CLASES.map(([slug, tEs, tEn, desc, tipo, cat, nivel, min, mats, planes, estado, dest], i) => ({
  slug: "demo-" + slug,
  title_i18n: { es: tEs, en: tEn },
  description_i18n: desc ? { es: desc, en: desc } : {},
  content_type: tipo,
  category_slugs: [cat],
  recommended_min_level: NIVEL[nivel][0],
  recommended_max_level: NIVEL[nivel][1],
  duration_seconds: min * 60,
  equipment: mats,
  planes_permitidos: planes,
  membership_tier_required: masBajo(planes),
  status: estado,
  is_featured: dest,
  sort_order: i + 1,
  thumbnail_url: slug.startsWith("borrador-pilates") ? null : foto(i),
  published_at: estado === "published" ? iso(ahora - (i + 1) * DIA) : null,
}));
ok(await db.from("videos").upsert(filasClases, { onConflict: "slug" }), "clases");
const clases = Object.fromEntries(ok(await db.from("videos").select("id, slug").like("slug", "demo-%"), "leer clases").map((v) => [v.slug.slice(5), v.id]));
console.log("clases:", Object.keys(clases).length);

// Planes de trabajo y sus dias
ok(await db.from("programs").upsert(PLANES.map(([slug, t, d, tier, dias, dest], i) => ({
  slug: "demo-" + slug, title_i18n: { es: t, en: t }, description_i18n: { es: d, en: d },
  status: "published", membership_tier_required: tier, duration_days: dias, is_featured: dest,
  cover_image_url: foto(i + 5), published_at: iso(ahora - (i + 2) * DIA),
})), { onConflict: "slug" }), "planes");
const planes = Object.fromEntries(ok(await db.from("programs").select("id, slug").like("slug", "demo-%"), "leer planes").map((p) => [p.slug.slice(5), p.id]));
ok(await db.from("program_days").delete().in("program_id", Object.values(planes)), "limpiar dias demo");
const dias = PLANES.flatMap(([slug, , , , , , lista]) => lista.map((c, i) => c && ({ program_id: planes[slug], day_number: i + 1, video_id: clases[c] })).filter(Boolean));
ok(await db.from("program_days").insert(dias), "dias");
console.log("planes:", Object.keys(planes).length, "dias:", dias.length);

// Sesiones en vivo
const hoy0 = new Date(); hoy0.setUTCHours(0, 0, 0, 0);
ok(await db.from("live_sessions").upsert(SESIONES.map(([slug, t, d, estado, tier, enDias, hora, min, cupo], i) => {
  const inicio = hoy0.getTime() + enDias * DIA + hora * 3600000;
  return {
    slug: "demo-" + slug, title_i18n: { es: t, en: t }, description_i18n: { es: d, en: d },
    // Todas nacen programadas: la base solo deja reservar sesiones programadas,
    // y las pasadas necesitan sus reservas. El estado real se pone despues.
    status: "scheduled", membership_tier_required: tier, instructor_profile_id: brunela?.id ?? null,
    starts_at: iso(inicio), ends_at: iso(inicio + min * 60000), session_timezone: "Europe/Madrid",
    capacity: cupo, booking_opens_at: iso(ahora - 14 * DIA), booking_closes_at: iso(Math.max(inicio - 2 * 3600000, ahora + DIA)),
    cover_image_url: foto(i + 2), published_at: iso(ahora - 7 * DIA), metadata: {},
  };
}), { onConflict: "slug" }), "sesiones");
const sesiones = Object.fromEntries(ok(await db.from("live_sessions").select("id, slug").like("slug", "demo-%"), "leer sesiones").map((s) => [s.slug.slice(5), s.id]));
ok(await db.from("live_session_access_links").upsert(
  SESIONES.filter((s) => s[9]).map(([slug]) => ({ live_session_id: sesiones[slug], provider: "zoom", join_url: "https://zoom.us/j/1234567890?demo=" + slug, passcode: "danza", metadata: {} })),
  { onConflict: "live_session_id" }), "zoom");

// Reservas: las de demo se recrean. Respeta el cupo y la regla de plan.
const idsDemo = Object.values(cuentas);
ok(await db.from("live_session_bookings").delete().in("user_id", idsDemo), "limpiar reservas demo");
ok(await db.from("live_session_invitations").delete().in("user_id", idsDemo), "limpiar invitaciones demo");
const sesionDe = (s) => sesiones[s];
const reservas = [];
const reservar = (sesion, email, estado = "reserved", extra = {}) => reservas.push({ live_session_id: sesionDe(sesion), user_id: cuentas[email], status: estado, reserved_at: iso(ahora - 2 * DIA), ...extra });
reservar("live-barra-abierta", "demo.principal@brunela.test");
reservar("live-barra-abierta", "demo.corps@brunela.test");
reservar("live-pies-y-tobillos", "demo.solista@brunela.test");
reservar("live-taller-de-giros", "demo.principal@brunela.test");
RELLENO.filter((c) => c.tier === "solista" || c.tier === "principal").slice(0, 3).forEach((c) => reservar("live-casi-llena", c.email));
RELLENO.filter((c) => c.tier !== "none").slice(0, 6).forEach((c) => reservar("live-barra-abierta", c.email));
reservar("live-barra-pasada", "demo.corps@brunela.test", "attended", { attended_at: iso(ahora - 5 * DIA) });
reservar("live-barra-pasada", "demo.principal@brunela.test", "missed");
reservar("live-taller-pasado", "demo.solista@brunela.test", "attended", { attended_at: iso(ahora - 12 * DIA) });
for (const r of reservas) {
  const res = await db.from("live_session_bookings").insert(r);
  if (res.error) console.warn("  reserva salteada:", res.error.message);
}
// Ahora si, el estado real de las pasadas y la cancelada.
for (const [slug, , , estado] of SESIONES) if (estado !== "scheduled") {
  const s = ok(await db.from("live_sessions").select("starts_at").eq("id", sesiones[slug]).single(), "leer " + slug);
  ok(await db.from("live_sessions").update({ status: estado, booking_closes_at: iso(Date.parse(s.starts_at) - 2 * 3600000) }).eq("id", sesiones[slug]), "estado " + slug);
}
// Invitada: Corps invitada a una sesion de Principal.
ok(await db.from("live_session_invitations").insert({ live_session_id: sesiones["live-masterclass-invitada"], user_id: cuentas["demo.invitada@brunela.test"], invited_by: brunela?.id ?? null, note: "Te invito a esta masterclass 💗" }), "invitacion");
console.log("reservas:", reservas.length);

// Packs
ok(await db.from("packs").upsert(PACKS.map(([slug, n, d, precio, publicado], i) => ({
  slug: "demo-" + slug, name_i18n: { es: n, en: n }, description_i18n: { es: d, en: d },
  price_cents: precio, currency: "eur", is_published: publicado, show_on_landing: false,
  is_featured: i === 0, display_order: i + 1, cover_image_url: foto(i + 7),
})), { onConflict: "slug" }), "packs");
const packs = Object.fromEntries(ok(await db.from("packs").select("id, slug").like("slug", "demo-%"), "leer packs").map((p) => [p.slug.slice(5), p.id]));
ok(await db.from("pack_videos").delete().in("pack_id", Object.values(packs)), "limpiar pack_videos demo");
ok(await db.from("pack_videos").insert(PACKS.flatMap(([slug, , , , , lista]) => lista.map((c, i) => ({ pack_id: packs[slug], video_id: clases[c], display_order: i + 1 })))), "pack_videos");
ok(await db.from("pack_purchases").upsert({
  user_id: cuentas["demo.pack@brunela.test"], pack_id: packs["pack-pies-perfectos"],
  stripe_checkout_session_id: "demo_cs_pack_pies", amount_total_cents: 2900, currency: "eur",
  purchased_at: iso(ahora - 3 * DIA),
}, { onConflict: "stripe_checkout_session_id" }), "compra pack");
console.log("packs:", Object.keys(packs).length);

// Documentos y anuncios: se recrean por titulo "Demo · ".
ok(await db.from("documents").delete().like("title", "Demo · %"), "limpiar documentos demo");
ok(await db.from("documents").insert(DOCS.map(([t, d, tier, cat, clase], i) => ({
  title: "Demo · " + t, description: d, file_url: PDF, file_type: "pdf", file_size_kb: 13,
  membership_tier_required: tier, category_slug: cat, video_slug: clase ? "demo-" + clase : null,
  is_published: true, sort_order: i + 1, created_by: brunela?.id ?? null,
}))), "documentos");
ok(await db.from("studio_announcements").delete().like("title", "Demo · %"), "limpiar anuncios demo");
ok(await db.from("studio_announcements").insert(ANUNCIOS.map(([t, c, tier, haceDias, venceEn]) => ({
  title: "Demo · " + t, content: c, tier_target: tier, is_active: true,
  published_at: iso(ahora - haceDias * DIA), expires_at: venceEn ? iso(ahora + venceEn * DIA) : null, created_by: brunela?.id ?? null,
}))), "anuncios");

// Chat: salas "Demo · ", mensajes con fecha en el pasado (el limite de
// velocidad mira los ultimos 10 segundos por created_at).
const salasViejas = ok(await db.from("chat_rooms").select("id").like("name", "Demo · %"), "leer salas");
if (salasViejas.length) {
  ok(await db.from("chat_messages").delete().in("room_id", salasViejas.map((s) => s.id)), "limpiar mensajes demo");
  ok(await db.from("chat_rooms").delete().in("id", salasViejas.map((s) => s.id)), "limpiar salas demo");
}
const salas = ok(await db.from("chat_rooms").insert(SALAS.map(([name, type, tier, cat]) => ({ name, type, tier_required: tier, category_slug: cat, participant_ids: [], is_archived: false }))).select("id, name, tier_required"), "salas");
const quienesPueden = (tier) => {
  const orden = ["none", "corps_de_ballet", "solista", "principal"];
  return [...PRINCIPALES, ...RELLENO].filter((c) => c.tier !== "none" && orden.indexOf(c.tier) >= orden.indexOf(tier === "none" ? "corps_de_ballet" : tier));
};
const mensajes = [];
salas.forEach((sala, si) => {
  const gente = quienesPueden(sala.tier_required);
  for (let k = 0; k < 9; k++) {
    const autora = gente[(k + si) % gente.length];
    const cuando = ahora - (9 - k) * 3 * 3600000 - si * 600000;
    mensajes.push({ room_id: sala.id, user_id: cuentas[autora.email], content: FRASES[(k + si * 3) % FRASES.length], author_name: autora.nombre, author_is_admin: false, created_at: iso(cuando) });
    if (k % 3 === 2 && brunela) mensajes.push({ room_id: sala.id, user_id: brunela.id, content: RESPUESTAS[(k + si) % RESPUESTAS.length], author_name: brunela.full_name ?? "Brunela", author_is_admin: true, created_at: iso(cuando + 20 * 60000) });
  }
});
// DM de Brunela con la alumna Principal (la unica que puede iniciar un DM).
if (brunela) {
  const dm = ok(await db.from("chat_rooms").insert({ name: "Demo · DM Brunela — Lucía", type: "dm", tier_required: "none", participant_ids: [brunela.id, cuentas["demo.principal@brunela.test"]], is_archived: false }).select("id").single(), "dm");
  const conv = [["a", "Hola Brunela! Tengo una duda con el plan de giros, ¿puedo hacer dos días seguidos?"], ["b", "¡Hola Lucía! Sí, pero dejá un día de descanso cada tres."], ["a", "Perfecto, gracias 💗"], ["b", "A vos. Contame cómo te va con el doble."]];
  conv.forEach(([q, t], i) => mensajes.push({ room_id: dm.id, user_id: q === "a" ? cuentas["demo.principal@brunela.test"] : brunela.id, content: t, author_name: q === "a" ? "Lucía Principal" : brunela.full_name ?? "Brunela", author_is_admin: q === "b", created_at: iso(ahora - (4 - i) * 3600000) }));
}
for (const m of mensajes) {
  const r = await db.from("chat_messages").insert(m);
  if (r.error) console.warn("  mensaje salteado:", r.error.message);
}
console.log("salas:", salas.length + 1, "mensajes:", mensajes.length);

// Progreso: lo que hace que el inicio, los planes y las analiticas tengan algo.
ok(await db.from("user_progress").delete().in("user_id", idsDemo), "limpiar progreso demo");
const progreso = [];
const avanzar = (email, clase, pct, haceDias, plan = null, dia = null) => {
  const dur = (CLASES.find((c) => c[0] === clase)?.[7] ?? 20) * 60;
  const pos = Math.round((dur * pct) / 100);
  progreso.push({
    user_id: cuentas[email], video_id: clases[clase], program_id: plan ? planes[plan] : null, program_day_number: dia,
    last_position_seconds: pos, max_position_seconds: pos, completion_percent: pct, is_completed: pct >= 90,
    completed_at: pct >= 90 ? iso(ahora - haceDias * DIA) : null, counted_toward_reward: false, completion_source: "player",
    updated_at: iso(ahora - haceDias * DIA),
  });
};
// Lucia: va por el dia 4 de giros y tiene una clase a medias.
["preparacion-de-giros", "equilibrio-en-releve", "centro-para-bailarinas"].forEach((c, i) => avanzar("demo.principal@brunela.test", c, 100, 6 - i, "giros-en-10-dias", i + 1));
avanzar("demo.principal@brunela.test", "control-del-developpe", 45, 0);
avanzar("demo.principal@brunela.test", "barra-de-suelo-esencial", 100, 9);
// Sofia: arranco el plan de pies.
["pies-que-hablan", "empeine-con-pelota"].forEach((c, i) => avanzar("demo.solista@brunela.test", c, 100, 2 - i, "trabajo-de-pies-14-dias", i + 1));
avanzar("demo.solista@brunela.test", "adagio-en-el-centro", 60, 0);
// Carla: dos clases sueltas y una a medias.
avanzar("demo.corps@brunela.test", "bienvenida-al-estudio", 100, 4);
avanzar("demo.corps@brunela.test", "despertar-articular", 100, 1);
avanzar("demo.corps@brunela.test", "caderas-libres", 30, 0);
// Paula: una del pack.
avanzar("demo.pack@brunela.test", "pies-que-hablan", 70, 1);
// Relleno: actividad variada, algunas sin entrar hace semanas.
const sueltas = CLASES.filter((c) => c[10] === "published").map((c) => c[0]);
RELLENO.forEach((c, i) => {
  if (c.tier === "none") return;
  const cuantas = (i % 5) + 1;
  for (let k = 0; k < cuantas; k++) avanzar(c.email, sueltas[(i * 3 + k) % sueltas.length], k === cuantas - 1 ? 40 : 100, i % 4 === 0 ? 20 + k : k * 2);
});
for (const p of progreso) {
  const r = await db.from("user_progress").insert(p);
  if (r.error) console.warn("  progreso salteado:", r.error.message);
}
console.log("progreso:", progreso.length);

console.log("\n══════════════════════════════════════════════");
console.log("LISTO. Cuentas para probar (todas con la misma contraseña):");
console.log("  contraseña:", CLAVE);
for (const c of PRINCIPALES) console.log("  " + c.email.padEnd(32), c.tier.padEnd(16), c.sinOnboarding ? "(sin onboarding)" : "");
console.log("  + " + RELLENO.length + " alumnas de relleno (demo.alumnaNN@brunela.test, sin contraseña conocida)");
console.log("Para borrar todo: node --env-file=.env.local scripts/borrar-demo.mjs");
