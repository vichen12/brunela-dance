/**
 * Vista previa de todos los correos, con datos de ejemplo. NO ENVIA NADA.
 *
 *   node scripts/vista-previa-mails.mjs [--salida <carpeta>] [--regenerar-supabase]
 *
 * - Genera un .html por correo en la carpeta de salida (por defecto
 *   <tmp>/brunela-mails) y un index.html que los lista.
 * - Las plantillas de Supabase se leen de emails/supabase/ y se les reemplazan
 *   las variables ({{ .ConfirmationURL }}, {{ .Email }}...) por ejemplos.
 * - Con --regenerar-supabase, antes reescribe emails/supabase/*.html desde
 *   src/lib/email/plantilla-base.ts. Es la forma de cambiar su diseño: se
 *   edita la plantilla base (o las definiciones de abajo) y se regenera, asi las
 *   plantillas de Supabase y los correos propios no se separan nunca.
 *
 * Como lee TypeScript: lo transpila con el `typescript` del proyecto a una
 * carpeta temporal. Sin dependencias nuevas.
 */

import { mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const iSalida = args.indexOf("--salida");
const salida = path.resolve(iSalida >= 0 ? args[iSalida + 1] : path.join(tmpdir(), "brunela-mails"));
const regenerar = args.includes("--regenerar-supabase");

// --- 1. Transpilar src/lib/email a .mjs -------------------------------------
const origen = path.join(raiz, "src/lib/email");
const build = path.join(salida, "_build");
mkdirSync(build, { recursive: true });
for (const archivo of readdirSync(origen).filter((f) => f.endsWith(".ts"))) {
  const fuente = readFileSync(path.join(origen, archivo), "utf8");
  const js = ts
    .transpileModule(fuente, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    })
    .outputText.replace(/from "\.\/([\w-]+)"/g, 'from "./$1.mjs"');
  writeFileSync(path.join(build, archivo.replace(/\.ts$/, ".mjs")), js);
}
const base = await import(pathToFileURL(path.join(build, "plantilla-base.mjs")).href);
const mensajes = await import(pathToFileURL(path.join(build, "mensajes.mjs")).href);

// --- 2. Plantillas de Supabase ----------------------------------------------
// asunto -> va en el campo "Subject" de cada casilla (ver emails/supabase/LEEME.md)
const SUPABASE = {
  "confirmar-cuenta": {
    asunto: "Confirmá tu correo para entrar al estudio 💗",
    p: {
      preheader: "Un toque y ya estás adentro. Te esperan las clases.",
      etiqueta: "Tu cuenta",
      titulo: "Confirmá tu correo y empezamos",
      saludo: "¡Hola!",
      parrafos: [
        "Qué alegría que quieras entrenar conmigo. Para terminar de crear tu cuenta solo falta confirmar que **{{ .Email }}** es tu correo.",
      ],
      boton: { texto: "Confirmar mi correo", url: "{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email" },
      nota: "El enlace es personal y sirve una sola vez. Si no creaste una cuenta en Brunela Dance, ignorá este correo y no pasa nada.",
      motivo: "Recibiste este correo porque alguien quiso crear una cuenta en Brunela Dance con esta dirección.",
    },
  },
  "recuperar-contrasena": {
    asunto: "Elegí una contraseña nueva",
    p: {
      preheader: "Tocá el botón para elegir una contraseña nueva. Es rápido.",
      etiqueta: "Tu cuenta",
      titulo: "Elegí una contraseña nueva",
      saludo: "¡Hola!",
      parrafos: [
        "Recibimos un pedido para cambiar la contraseña de **{{ .Email }}**. Tocá el botón y elegí una nueva; vas a volver directo al estudio.",
      ],
      boton: { texto: "Elegir contraseña nueva", url: "{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery" },
      nota: "**¿No fuiste vos?** Ignorá este correo: tu contraseña actual sigue funcionando y nadie puede cambiarla sin este enlace.",
      motivo: "Recibiste este correo porque se pidió cambiar la contraseña de tu cuenta en Brunela Dance.",
    },
  },
  "enlace-magico": {
    asunto: "Tu enlace para entrar",
    p: {
      preheader: "Un toque y entrás al estudio, sin contraseña.",
      etiqueta: "Acceso",
      titulo: "Tu enlace para entrar",
      saludo: "¡Hola!",
      parrafos: ["Tocá el botón para entrar al estudio con **{{ .Email }}**. No hace falta contraseña."],
      boton: { texto: "Entrar al estudio", url: "{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email" },
      nota: "El enlace sirve **una sola vez** y vence en poco tiempo. Si no lo pediste, ignorá este correo.",
      motivo: "Recibiste este correo porque se pidió un enlace de acceso para tu cuenta en Brunela Dance.",
    },
  },
  invitacion: {
    asunto: "Brunela te invitó al estudio",
    p: {
      preheader: "Te guardé un lugar en el estudio online. Activá tu cuenta en un minuto.",
      etiqueta: "Invitación",
      titulo: "Te invito a entrenar conmigo",
      saludo: "¡Hola!",
      parrafos: [
        "Te abrí un lugar en **Brunela Dance**, mi estudio online de ballet y preparación integral. Clases, planes de trabajo y sesiones en vivo, para que entrenes desde donde estés.",
        "Tocá el botón para aceptar la invitación y elegir tu contraseña.",
      ],
      boton: { texto: "Aceptar invitación", url: "{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite" },
      nota: "La invitación es para **{{ .Email }}**. Si no esperabas este correo, podés ignorarlo.",
      motivo: "Recibiste este correo porque Brunela te invitó a su estudio online.",
    },
  },
  "cambio-de-correo": {
    asunto: "Confirmá tu correo nuevo",
    p: {
      preheader: "Confirmá el cambio para empezar a usar tu correo nuevo.",
      etiqueta: "Tu cuenta",
      titulo: "Confirmá tu correo nuevo",
      saludo: "¡Hola!",
      parrafos: ["Pediste cambiar el correo de tu cuenta. Confirmalo y a partir de ahí entrás con el nuevo."],
      detalles: [
        { etiqueta: "Correo actual", valor: "{{ .Email }}" },
        { etiqueta: "Correo nuevo", valor: "{{ .NewEmail }}" },
      ],
      boton: { texto: "Confirmar el cambio", url: "{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change" },
      nota: "**¿No pediste este cambio?** No toques nada y escribinos a info@bruneladance.com: tu cuenta sigue con el correo de siempre.",
      motivo: "Recibiste este correo porque se pidió cambiar el correo de tu cuenta en Brunela Dance.",
    },
  },
  reautenticacion: {
    asunto: "Tu código de verificación",
    p: {
      preheader: "Tu código para confirmar que sos vos: {{ .Token }}",
      etiqueta: "Verificación",
      titulo: "Confirmá que sos vos",
      saludo: "¡Hola!",
      parrafos: ["Para terminar este cambio en tu cuenta, escribí este código en el estudio:"],
      codigo: "{{ .Token }}",
      nota: "El código vence en pocos minutos. **No se lo pases a nadie**: nadie del estudio te lo va a pedir nunca.",
      motivo: "Recibiste este correo porque se pidió un cambio sensible en tu cuenta de Brunela Dance.",
    },
  },
};

const carpetaSupabase = path.join(raiz, "emails/supabase");
if (regenerar) {
  mkdirSync(carpetaSupabase, { recursive: true });
  for (const [nombre, { p }] of Object.entries(SUPABASE)) {
    writeFileSync(path.join(carpetaSupabase, `${nombre}.html`), base.plantillaCorreo(p) + "\n");
    console.log(`regenerada emails/supabase/${nombre}.html`);
  }
}

const EJEMPLO = {
  "{{ .ConfirmationURL }}":
    "https://howtuhfdxgyluskrlkze.supabase.co/auth/v1/verify?token=pkce_3f9a1c&type=signup&redirect_to=https://bruneladance.com/auth/callback",
  "{{ .TokenHash }}": "pkce_3f9a1c7e",
  "{{ .Email }}": "lucia.fernandez@gmail.com",
  "{{ .NewEmail }}": "lucia.baila@gmail.com",
  "{{ .SiteURL }}": "https://bruneladance.com",
  "{{ .Token }}": "482913",
};

// --- 3. Escribir las vistas previas -----------------------------------------
const generados = [];
function guardar(nombre, asunto, html) {
  writeFileSync(path.join(salida, `${nombre}.html`), html);
  generados.push({ nombre, asunto });
}

for (const [nombre, { asunto }] of Object.entries(SUPABASE)) {
  let html = readFileSync(path.join(carpetaSupabase, `${nombre}.html`), "utf8");
  for (const [variable, valor] of Object.entries(EJEMPLO)) html = html.split(variable).join(valor);
  guardar(`supabase-${nombre}`, asunto, html);
}

const clase = {
  nombre: "Lucía Fernández",
  titulo: "Barra a tierra: tobillos y empeines",
  fecha: "Jueves 16 de octubre",
  hora: "19:00 (hora de Barcelona)",
  urlClase: "https://bruneladance.com/dashboard/live",
};
const propios = {
  "bienvenida-alumna": mensajes.bienvenidaAlumna({ nombre: "Lucía Fernández" }),
  "acceso-gratis-por-vencer": mensajes.accesoGratisPorVencer({ nombre: "Lucía", diasRestantes: 3 }),
  "acceso-gratis-terminado": mensajes.accesoGratisTerminado({ nombre: "Lucía" }),
  "recordatorio-clase-en-vivo": mensajes.recordatorioClaseEnVivo(clase),
  "invitacion-a-clase-en-vivo": mensajes.invitacionAClaseEnVivo(clase),
};
for (const [nombre, correo] of Object.entries(propios)) {
  guardar(nombre, correo.asunto, correo.html);
  writeFileSync(path.join(salida, `${nombre}.txt`), correo.texto);
}

const indice = `<!doctype html><meta charset="utf-8"><title>Correos de Brunela Dance</title>
<body style="font-family:system-ui;background:#FFFAF6;color:#3B2A2C;padding:32px">
<h1>Correos de Brunela Dance</h1><ul>${generados
  .map((g) => `<li><a href="${g.nombre}.html">${g.nombre}</a> — ${base.escapar(g.asunto)}</li>`)
  .join("")}</ul></body>`;
writeFileSync(path.join(salida, "index.html"), indice);

console.log(`${generados.length} correos en ${salida}`);
