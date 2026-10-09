/**
 * Permiso para elegir contraseña en /sign-in/reset-password.
 *
 * 🔴 POR QUE EXISTE (2026-10-09)
 *   Esa pantalla cambiaba la contraseña de "la sesion que estuviera abierta".
 *   Brunela, logueada como admin, invito a una alumna y abrio la invitacion en
 *   el mismo navegador. El enlace era de la plantilla vieja (no pasaba por
 *   /auth/confirm), asi que la sesion de la alumna nunca llego a la web y la
 *   pantalla mostro "Cuenta: brunela.dance@gmail.com": la contraseña nueva se
 *   iba a guardar en la cuenta de la ADMIN.
 *
 * LA REGLA
 *   Solo se puede elegir contraseña si se acaba de llegar por un enlace de
 *   correo (cambio de contraseña o invitacion) de ESA misma cuenta.
 *   /auth/confirm, al validar el enlace, deja esta cookie con el id de la
 *   cuenta validada. La pantalla y la action exigen que coincida con la sesion.
 *   Cualquier otro caso -- una sesion que ya estaba abierta, un enlace viejo,
 *   alguien que escribe la direccion a mano -- ve "abrí el enlace del correo".
 *
 * La sesion sigue siendo la autenticacion de verdad: esta cookie no da acceso a
 * nada por si sola, solo evita cambiarle la contraseña a la cuenta equivocada.
 */
export const COOKIE_CAMBIO_CLAVE = "brunela_cambio_clave";

/** 30 minutos: el tiempo razonable entre abrir el enlace y guardar la contraseña. */
export const DURACION_CAMBIO_CLAVE = 60 * 30;

export function puedeCambiarClave(cookie: string | undefined | null, userId: string | undefined | null): boolean {
  return Boolean(cookie && userId && cookie === userId);
}
