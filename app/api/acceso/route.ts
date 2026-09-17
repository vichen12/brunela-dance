import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE_ACCESO,
  contrasenaDeAcceso,
  igualEnTiempoConstante,
  tokenDeAcceso,
} from "@/src/lib/acceso-anticipado";

/**
 * Abre la puerta de acceso anticipado.
 *
 * ⚠️ ESTA RUTA ES PUBLICA A PROPOSITO, y es la unica del proyecto que lo es por
 *    diseño en vez de por tener otra forma de autenticar. Es la puerta: quien la
 *    usa, por definicion, todavia no entro. Esta declarada con su motivo en
 *    scripts/verificar-guardas.mjs.
 *
 *    Lo que hay detras no es informacion: es el mismo sitio publico que va a
 *    estar abierto en unas semanas. Todo lo que exige sesion la sigue exigiendo
 *    igual despues de pasar por aca.
 *
 * POR QUE VUELVE CON REDIRECT Y NO CON JSON
 *   El formulario es un <form> normal que funciona sin JavaScript. Si el
 *   navegador no ejecuta nada, escribir la contraseña tiene que seguir abriendo
 *   la puerta.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const enviada = String(form.get("password") ?? "");
  const destino = String(form.get("destino") ?? "/");

  if (!igualEnTiempoConstante(enviada, contrasenaDeAcceso())) {
    /**
     * Espera fija ante el fallo.
     *
     * No es contra un ataque serio -- con una sola contraseña compartida, quien
     * quiera probar a lo bruto lo va a lograr igual. Es para que un formulario
     * publicado en internet no sea un campo de pruebas gratis a mil intentos por
     * segundo.
     */
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.redirect(new URL("/proximamente?error=1", request.url), { status: 303 });
  }

  /**
   * ⚠️ El destino se valida antes de usarlo.
   *
   *    Volcarlo tal cual en un redirect es un open redirect de manual: alguien
   *    manda el enlace .../api/acceso con destino=https://otro-sitio y la puerta
   *    de Brunela termina mandando gente afuera. Solo se aceptan rutas internas
   *    que empiecen con una sola barra.
   */
  const seguro = /^\/(?!\/)[^\s]*$/.test(destino) ? destino : "/";

  const respuesta = NextResponse.redirect(new URL(seguro, request.url), { status: 303 });

  respuesta.cookies.set(COOKIE_ACCESO, await tokenDeAcceso(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // 90 dias: mas que suficiente para llegar a la apertura sin que nadie tenga
    // que volver a escribirla, y no "para siempre".
    maxAge: 60 * 60 * 24 * 90,
  });

  return respuesta;
}
