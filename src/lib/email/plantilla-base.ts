/**
 * La plantilla de todos los correos de Brunela Dance.
 *
 * QUE ARMA
 *   Encabezado (logo + etiqueta + titulo sobre el degrade rubor), cuerpo
 *   (saludo, parrafos, bloque de detalles, codigo, boton y enlace de respaldo,
 *   nota), firma con el isologo y pie. Devuelve HTML de correo de verdad:
 *   tablas, estilos inline, 600 px de ancho maximo.
 *
 * CLIENTES
 *   - Outlook de escritorio no entiende border-radius ni gradientes: el boton
 *     es una tabla con `mso-padding-alt` (ver `boton()`) y el encabezado cae al
 *     color solido de `bgcolor`. Tampoco sabe usar Nunito y, sin la regla
 *     `mso` del <head>, caeria a Times.
 *   - Los comentarios condicionales (`<!--[if mso]>`) son una MEJORA, no una
 *     dependencia: Supabase puede borrarlos. Sin ellos, Outlook pierde el
 *     limite de 600 px y la regla de fuente, pero el correo se sigue leyendo y
 *     el boton sigue siendo un boton.
 *   - Gmail no carga fuentes web: cae a Segoe UI / Helvetica / Arial, que es
 *     lo previsto. Ignora <style> en algunas cuentas, por eso todo va inline y
 *     el <style> solo agrega el responsive y el modo oscuro.
 *   - Apple Mail respeta `color-scheme` y la media query de modo oscuro.
 *
 * TEXTO
 *   Todo lo que entra se escapa. La unica marca permitida es **negrita**.
 *   Las variables de plantilla de Supabase (`{{ .ConfirmationURL }}`) no llevan
 *   caracteres que el escape toque, asi que pasan intactas.
 */

export const COLORES = {
  crema: "#FFFAF6",
  blanco: "#FFFFFF",
  borde: "#F3E3DC",
  rubor: "#FFF1EC",
  melocoton: "#FFE9DE",
  coral: "#E64F55",
  coralProfundo: "#B03A3E",
  ciruela: "#3B2A2C",
  secundario: "#8A6F68",
  nota: "#FFF7F3",
  bordeNota: "#F6E2DA",
} as const;

export const SITIO = "https://bruneladance.com";
export const CORREO_CONTACTO = "info@bruneladance.com";
const LOGO = `${SITIO}/brand/brunela-dance-trainer-wordmark.png`;
const ISOLOGO = `${SITIO}/brand/isologo-icon.png`;

const FUENTE = "'Nunito', 'Segoe UI', Helvetica, Arial, sans-serif";

export interface DetalleCorreo {
  etiqueta: string;
  valor: string;
}

export interface PlantillaCorreo {
  /** Texto que se ve al lado del asunto en la bandeja. No se muestra en el cuerpo. */
  preheader: string;
  /** Rotulo chico arriba del titulo: "Tu cuenta", "Clase en vivo"... */
  etiqueta?: string;
  titulo: string;
  /** "Hola, Lucia". Si falta, el cuerpo arranca directo en los parrafos. */
  saludo?: string;
  /** Admite **negrita**. */
  parrafos: string[];
  /** Bloque de datos: fecha, hora, correo nuevo... */
  detalles?: DetalleCorreo[];
  /** Codigo grande para copiar (reautenticacion). */
  codigo?: string;
  boton?: { texto: string; url: string };
  /** Recuadro suave al final. Admite **negrita**. */
  nota?: string;
  /** Firma "Con cariño, Brunela" con el isologo. Por defecto si. */
  firma?: boolean;
  /** Frase completa: "Recibiste este correo porque...". */
  motivo: string;
}

export function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escapa y despues convierte **x** en negrita con el color de acento. */
function enriquecer(texto: string): string {
  return escapar(texto).replace(
    /\*\*(.+?)\*\*/g,
    `<strong class="bd-acento" style="color:${COLORES.ciruela};font-weight:800;">$1</strong>`,
  );
}

function sinMarcas(texto: string): string {
  return texto.replace(/\*\*(.+?)\*\*/g, "$1");
}

/**
 * Boton "a prueba de balas" SIN comentarios condicionales: el html/template de
 * Go (el que usa Supabase para sus plantillas) borra los comentarios HTML, y un
 * boton VML envuelto en `<!--[if mso]>` desapareceria. Asi funciona igual en
 * los dos caminos:
 *   - Outlook ignora el padding del <a>, pero respeta `mso-padding-alt` y el
 *     `bgcolor` de la celda: ve una pildora de esquinas rectas, del mismo tamaño.
 *   - El resto ignora `mso-padding-alt` y usa el padding del <a>, que deja toda
 *     la pildora clicable, no solo el texto.
 */
function boton(texto: string, url: string): string {
  const href = escapar(url);
  const t = escapar(texto);
  return `
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
  <tr>
    <td align="center" style="padding:10px 0 6px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="bd-boton-tabla" style="border-collapse:separate;">
        <tr>
          <td align="center" bgcolor="${COLORES.coral}" style="background-color:${COLORES.coral};border-radius:999px;mso-padding-alt:18px 44px;box-shadow:0 8px 20px rgba(230,79,85,0.28);">
            <a href="${href}" target="_blank" class="bd-boton" style="display:inline-block;color:#ffffff;font-family:${FUENTE};font-size:19px;font-weight:800;line-height:24px;letter-spacing:0.2px;text-decoration:none;padding:18px 44px;border-radius:999px;">${t}&nbsp;&nbsp;&rarr;</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td align="center" class="bd-tenue" style="padding:22px 0 0 0;font-family:${FUENTE};font-size:13px;line-height:20px;color:${COLORES.secundario};">
      Si el botón no funciona, copiá este enlace:<br>
      <a href="${href}" target="_blank" class="bd-enlace" style="color:${COLORES.coralProfundo};text-decoration:underline;word-break:break-all;">${href}</a>
    </td>
  </tr>
</table>`;
}

function detalles(lista: DetalleCorreo[]): string {
  const filas = lista
    .map(
      (d, i) => `
  <tr>
    <td class="bd-detalle-fila" style="padding:${i === 0 ? "18px" : "14px"} 24px ${i === lista.length - 1 ? "18px" : "14px"} 24px;${i > 0 ? `border-top:1px solid ${COLORES.bordeNota};` : ""}">
      <div class="bd-tenue" style="font-family:${FUENTE};font-size:11px;line-height:16px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:${COLORES.secundario};">${escapar(d.etiqueta)}</div>
      <div class="bd-texto" style="font-family:${FUENTE};font-size:17px;line-height:24px;font-weight:800;color:${COLORES.ciruela};padding-top:3px;word-break:break-word;">${escapar(d.valor)}</div>
    </td>
  </tr>`,
    )
    .join("");
  return `
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="bd-nota" style="background-color:${COLORES.nota};border:1px solid ${COLORES.bordeNota};border-radius:18px;margin:6px 0 26px 0;">${filas}
</table>`;
}

function codigo(valor: string): string {
  return `
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:4px 0 26px 0;">
  <tr>
    <td align="center" class="bd-codigo" bgcolor="${COLORES.rubor}" style="background-color:${COLORES.rubor};border:2px dashed #F2C4BC;border-radius:20px;padding:26px 16px;">
      <div class="bd-tenue" style="font-family:${FUENTE};font-size:11px;line-height:16px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:${COLORES.secundario};padding-bottom:8px;">Tu código</div>
      <div class="bd-acento bd-codigo-num" style="font-family:${FUENTE};font-size:42px;line-height:50px;font-weight:900;letter-spacing:10px;padding-left:10px;color:${COLORES.coralProfundo};mso-line-height-rule:exactly;">${escapar(valor)}</div>
    </td>
  </tr>
</table>`;
}

function nota(texto: string): string {
  return `
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:30px 0 0 0;">
  <tr>
    <td class="bd-nota" style="background-color:${COLORES.nota};border:1px solid ${COLORES.bordeNota};border-radius:16px;padding:16px 20px;font-family:${FUENTE};font-size:14px;line-height:22px;color:${COLORES.secundario};">
      <span class="bd-tenue">${enriquecer(texto)}</span>
    </td>
  </tr>
</table>`;
}

function firma(): string {
  return `
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:32px 0 0 0;">
  <tr>
    <td valign="middle" style="padding-right:10px;">
      <img src="${ISOLOGO}" width="58" height="58" alt="" style="display:block;width:58px;height:58px;border:0;outline:none;">
    </td>
    <td valign="middle" style="font-family:${FUENTE};">
      <div class="bd-tenue" style="font-size:14px;line-height:20px;color:${COLORES.secundario};">Con cariño,</div>
      <div class="bd-acento" style="font-size:18px;line-height:24px;font-weight:900;color:${COLORES.coralProfundo};">Brunela</div>
    </td>
  </tr>
</table>`;
}

const ESTILOS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;800;900&display=swap');
:root { color-scheme: light dark; supported-color-schemes: light dark; }
body { margin:0 !important; padding:0 !important; width:100% !important; }
a { text-decoration-skip-ink:auto; }
img { -ms-interpolation-mode:bicubic; }
@media only screen and (max-width:480px) {
  .bd-marco { padding:16px 10px !important; }
  .bd-tarjeta { border-radius:22px !important; }
  .bd-cabeza { padding:30px 22px 26px 22px !important; border-radius:22px 22px 0 0 !important; }
  .bd-cuerpo { padding:28px 24px 30px 24px !important; }
  .bd-titulo { font-size:26px !important; line-height:32px !important; }
  .bd-logo { width:168px !important; height:auto !important; }
  .bd-parrafo { font-size:16px !important; line-height:25px !important; }
  .bd-boton-tabla { width:100% !important; }
  .bd-boton { display:block !important; padding:17px 20px !important; font-size:18px !important; }
  .bd-codigo-num { font-size:34px !important; letter-spacing:7px !important; padding-left:7px !important; }
  .bd-pie { padding:24px 18px 8px 18px !important; }
}
@media (prefers-color-scheme: dark) {
  .bd-fondo { background-color:#1C1415 !important; }
  .bd-tarjeta { background-color:#281D1F !important; border-color:#3E2C2F !important; }
  .bd-cabeza { background-color:#33221F !important; background-image:linear-gradient(160deg,#3A2624 0%,#3F2A24 100%) !important; }
  .bd-texto, .bd-titulo, .bd-parrafo { color:#F8ECE7 !important; }
  .bd-acento { color:#FF9A9C !important; }
  .bd-tenue { color:#CDB3AC !important; }
  .bd-enlace, .bd-pie a { color:#FF9A9C !important; }
  .bd-nota { background-color:#33252A !important; border-color:#4A3438 !important; }
  .bd-detalle-fila { border-top-color:#4A3438 !important; }
  .bd-codigo { background-color:#3A2626 !important; border-color:#6A3E40 !important; }
  .bd-etiqueta { background-color:#4A2B2D !important; color:#FFB7B4 !important; }
  .bd-cabeza { border-bottom-color:#3E2C2F !important; }
}
[data-ogsc] .bd-texto, [data-ogsc] .bd-titulo, [data-ogsc] .bd-parrafo { color:#F8ECE7 !important; }
[data-ogsc] .bd-acento, [data-ogsc] .bd-enlace { color:#FF9A9C !important; }
[data-ogsc] .bd-tenue { color:#CDB3AC !important; }
`;

/** Arma el HTML completo del correo. */
export function plantillaCorreo(p: PlantillaCorreo): string {
  const preheaderRelleno = "&#847;&zwnj;&nbsp;".repeat(60);

  const etiqueta = p.etiqueta
    ? `<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 14px auto;">
          <tr>
            <td class="bd-etiqueta" style="background-color:#FFFFFF;border:1px solid #F6D3CB;border-radius:999px;padding:6px 14px;font-family:${FUENTE};font-size:11px;line-height:14px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:${COLORES.coralProfundo};">${escapar(p.etiqueta)}</td>
          </tr>
        </table>`
    : "";

  const saludo = p.saludo
    ? `<p class="bd-texto" style="margin:0 0 14px 0;font-family:${FUENTE};font-size:19px;line-height:28px;font-weight:800;color:${COLORES.ciruela};">${escapar(p.saludo)}</p>`
    : "";

  const parrafos = p.parrafos
    .map(
      (t) =>
        `<p class="bd-parrafo" style="margin:0 0 18px 0;font-family:${FUENTE};font-size:16px;line-height:26px;color:${COLORES.ciruela};">${enriquecer(t)}</p>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="es" dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapar(p.titulo)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>* { font-family:'Segoe UI', Arial, sans-serif !important; }</style>
<![endif]-->
<!--[if !mso]><!-->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;800;900&display=swap" rel="stylesheet">
<!--<![endif]-->
<style>${ESTILOS}</style>
</head>
<body class="bd-fondo" style="margin:0;padding:0;width:100%;background-color:${COLORES.crema};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapar(p.preheader)}${preheaderRelleno}</div>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="bd-fondo" bgcolor="${COLORES.crema}" style="background-color:${COLORES.crema};">
  <tr>
    <td align="center" class="bd-marco" style="padding:36px 16px;">
      <!--[if mso]><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" align="center"><tr><td><![endif]-->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;">
        <tr>
          <td>
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="bd-tarjeta" bgcolor="${COLORES.blanco}" style="background-color:${COLORES.blanco};border:1px solid ${COLORES.borde};border-radius:28px;border-collapse:separate;box-shadow:0 18px 40px rgba(176,58,62,0.07);">
              <tr>
                <td align="center" class="bd-cabeza" bgcolor="${COLORES.rubor}" style="background-color:${COLORES.rubor};background-image:linear-gradient(160deg, ${COLORES.rubor} 0%, ${COLORES.melocoton} 100%);border-radius:28px 28px 0 0;border-bottom:1px solid ${COLORES.borde};padding:40px 40px 32px 40px;">
                  <a href="${SITIO}" target="_blank" style="text-decoration:none;">
                    <img src="${LOGO}" width="200" height="58" alt="Brunela Dance Trainer" class="bd-logo" style="display:block;width:200px;height:auto;max-width:200px;border:0;outline:none;margin:0 auto;color:${COLORES.coral};font-family:${FUENTE};font-size:22px;font-weight:900;">
                  </a>
                  <div style="height:26px;line-height:26px;font-size:1px;">&nbsp;</div>
                  ${etiqueta}
                  <h1 class="bd-titulo" style="margin:0;font-family:${FUENTE};font-size:30px;line-height:37px;font-weight:900;letter-spacing:-0.3px;color:${COLORES.ciruela};mso-line-height-rule:exactly;text-wrap:balance;">${escapar(p.titulo)}</h1>
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin:18px auto 0 auto;">
                    <tr><td class="bd-trazo" width="40" height="4" bgcolor="${COLORES.coral}" style="width:40px;height:4px;line-height:4px;font-size:1px;background-color:${COLORES.coral};border-radius:4px;">&nbsp;</td></tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td class="bd-cuerpo" style="padding:38px 46px 40px 46px;">
                  ${saludo}
                  ${parrafos}
                  ${p.detalles && p.detalles.length > 0 ? detalles(p.detalles) : ""}
                  ${p.codigo ? codigo(p.codigo) : ""}
                  ${p.boton ? boton(p.boton.texto, p.boton.url) : ""}
                  ${p.nota ? nota(p.nota) : ""}
                  ${p.firma === false ? "" : firma()}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" class="bd-pie" style="padding:30px 32px 8px 32px;font-family:${FUENTE};">
            <p class="bd-texto" style="margin:0 0 6px 0;font-size:13px;line-height:20px;font-weight:800;color:${COLORES.ciruela};">Brunela Dance</p>
            <p class="bd-tenue" style="margin:0 0 12px 0;font-size:13px;line-height:20px;color:${COLORES.secundario};">Ballet y preparación integral para bailarines<br>Barcelona y online</p>
            <p style="margin:0 0 18px 0;font-size:13px;line-height:20px;">
              <a href="${SITIO}" target="_blank" style="color:${COLORES.coralProfundo};font-weight:800;text-decoration:none;">bruneladance.com</a>
              <span class="bd-tenue" style="color:#D9BFB7;">&nbsp;&nbsp;·&nbsp;&nbsp;</span>
              <a href="mailto:${CORREO_CONTACTO}" style="color:${COLORES.coralProfundo};font-weight:800;text-decoration:none;">${CORREO_CONTACTO}</a>
            </p>
            <p class="bd-tenue" style="margin:0;font-size:12px;line-height:18px;color:${COLORES.secundario};">${escapar(p.motivo)}</p>
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Version en texto plano, con la misma informacion que el HTML. */
export function textoPlano(p: PlantillaCorreo): string {
  const partes: string[] = [];
  partes.push(p.titulo.toUpperCase(), "");
  if (p.saludo) partes.push(p.saludo, "");
  for (const t of p.parrafos) partes.push(sinMarcas(t), "");
  if (p.detalles) {
    for (const d of p.detalles) partes.push(`${d.etiqueta}: ${d.valor}`);
    partes.push("");
  }
  if (p.codigo) partes.push(`Tu código: ${p.codigo}`, "");
  if (p.boton) partes.push(`${p.boton.texto}:`, p.boton.url, "");
  if (p.nota) partes.push(sinMarcas(p.nota), "");
  if (p.firma !== false) partes.push("Con cariño,", "Brunela", "");
  partes.push(
    "—",
    "Brunela Dance · Ballet y preparación integral para bailarines · Barcelona y online",
    `${SITIO} · ${CORREO_CONTACTO}`,
    p.motivo,
  );
  return partes.join("\n");
}
