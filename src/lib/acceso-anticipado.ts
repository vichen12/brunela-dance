/**
 * La puerta de acceso anticipado.
 *
 * QUE ES
 *   Mientras el estudio no abre al publico, el sitio entero queda detras de una
 *   contraseña compartida y una cuenta regresiva. Quien la sabe entra y usa la
 *   web normal; quien no, ve la pantalla de proximamente.
 *
 * 🔴 ESTO NO ES AUTENTICACION. ES UN CARTEL CON LLAVE.
 *
 *    La contraseña es UNA SOLA y la comparte todo el mundo que la reciba. No
 *    identifica a nadie, no tiene sesion, no expira por persona y va a terminar
 *    en algun WhatsApp. La autenticacion de verdad sigue siendo Supabase, detras
 *    de esta puerta y sin cambios.
 *
 *    Lo que esta puerta protege es la PRIMERA IMPRESION: que nadie llegue de
 *    casualidad a un estudio sin clases cargadas. No protege datos. Todo lo que
 *    hoy exige sesion la sigue exigiendo igual.
 *
 * POR QUE LA COOKIE NO GUARDA LA CONTRASEÑA
 *   Guardaria el secreto compartido en el navegador de cualquiera que entre, en
 *   texto plano, listo para copiar de las herramientas de desarrollo. La cookie
 *   guarda un derivado SHA-256, que sirve para abrir pero no dice cual es la
 *   contraseña.
 *
 * POR QUE WEB CRYPTO Y NO node:crypto
 *   Esto lo usa el middleware, que corre en el runtime Edge. `node:crypto` no
 *   existe ahi. `crypto.subtle` existe en los dos, asi que el mismo archivo vale
 *   para el middleware y para la ruta que abre la puerta.
 */

/** El nombre de la cookie que recuerda que ya entro. */
export const COOKIE_ACCESO = "brunela_acceso";

/** La pantalla que se muestra a quien todavia no entro. */
export const RUTA_PUERTA = "/proximamente";

/**
 * La contraseña compartida.
 *
 * Viene con valor por defecto a proposito: si la variable no llega a Vercel, la
 * puerta tiene que seguir abriendose con la contraseña que se repartio, no
 * quedarse trabada dejando a todos afuera -- incluida Brunela.
 */
export function contrasenaDeAcceso(): string {
  return process.env.ACCESO_ANTICIPADO_PASSWORD?.trim() || "brunedance2026";
}

/**
 * ¿La puerta esta puesta?
 *
 * ⚠️ POR DEFECTO SI. Se apaga poniendo ACCESO_ANTICIPADO_ACTIVO en "0", "false"
 *    o "no". Es deliberado que el default sea cerrado: el dia que se quiera
 *    abrir al publico eso es una decision explicita que alguien toma, no algo
 *    que pasa porque una variable no llego al deploy.
 */
export function puertaActiva(): boolean {
  const v = process.env.ACCESO_ANTICIPADO_ACTIVO?.trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "no" || v === "off");
}

/**
 * La fecha de apertura que muestra el contador.
 *
 * ⚠️ CON HUSO HORARIO EXPLICITO. Sin el, `new Date("2026-11-15")` se interpreta
 *    como UTC y el contador llegaria a cero una hora antes en España, que es
 *    donde esta el estudio. Noviembre es CET (+01:00).
 *
 * ⚠️ Y ES SOLO PARA MOSTRAR: que el contador llegue a cero NO abre el sitio.
 *    Ver la nota de `puertaActiva` -- abrir es apagar la variable a mano. Un
 *    sitio que se destapa solo a medianoche es un sitio que se destapa aunque
 *    ese dia no este listo.
 */
export function fechaDeApertura(): Date {
  const crudo = process.env.ACCESO_ANTICIPADO_FECHA?.trim();
  if (crudo) {
    const d = new Date(crudo);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date("2026-11-15T00:00:00+01:00");
}

/** El valor que lleva la cookie: un derivado de la contraseña, no la contraseña. */
export async function tokenDeAcceso(): Promise<string> {
  const material = `brunela-dance::acceso-anticipado::${contrasenaDeAcceso()}`;
  const datos = new TextEncoder().encode(material);
  const hash = await crypto.subtle.digest("SHA-256", datos);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Comparacion en tiempo constante.
 *
 * Para una puerta blanda como esta el ataque de temporizacion es teorico, pero
 * escribirlo bien cuesta cuatro lineas y evita que alguien copie el patron
 * `===` a un lugar donde si importa.
 */
export function igualEnTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i += 1) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/**
 * Que hay detras de la puerta.
 *
 * 🔴 LA LISTA ES DE LO QUE SE CIERRA, NO DE LO QUE SE DEJA PASAR.
 *
 *    Es al reves de como estaba escrito primero, y el cambio no es cosmetico.
 *    Con una lista de exenciones, TODO nace cerrado y cada cosa que no puede
 *    romperse hay que acordarse de exceptuarla. Olvidarse de una no da error:
 *    simplemente esa cosa deja de funcionar.
 *
 *    Dos de esas cosas fallan en silencio y caro:
 *
 *      · /api/stripe/webhooks — Stripe recibiria HTML con un 200 en vez de que
 *        se procese el pago. La alumna paga, el webhook "responde bien", y el
 *        acceso no llega nunca.
 *      · /api/cron/keepalive — el cron dejaria de tocar la base, y Supabase
 *        pausa el proyecto a los 7 dias. Un proyecto pausado no da un error
 *        legible: la aplicacion entera deja de responder.
 *
 *    Con la lista invertida las dos estan a salvo POR CONSTRUCCION, no porque
 *    alguien se acordo de nombrarlas. Nada de /api entra aca, y no puede entrar
 *    por descuido: habria que escribirlo a proposito.
 *
 * QUE SE CIERRA
 *   Solo la entrada al producto: iniciar sesion, registrarse, el estudio y el
 *   panel. La landing, los planes y los packs se ven completos -- que es el
 *   punto de publicarla antes de abrir.
 *
 * ⚠️ /dashboard y /admin ya exigen sesion por su cuenta. Estan aca igual para
 *    que quien tenga una sesion vieja en el navegador tampoco entre antes de
 *    tiempo; la puerta va ANTES que la comprobacion de sesion.
 */
export function rutaConPuerta(pathname: string): boolean {
  return (
    pathname === "/sign-in" ||
    pathname.startsWith("/sign-in/") ||
    pathname === "/registro" ||
    pathname.startsWith("/registro/") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin")
  );
}
