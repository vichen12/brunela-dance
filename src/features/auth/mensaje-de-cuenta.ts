/**
 * Los errores de Supabase Auth llegan en ingles ("Password should be at least
 * 6 characters", "Email rate limit exceeded"...). Esto los pasa a una frase
 * que una alumna pueda leer (2026-11-12). Lo crudo queda en el registro.
 *
 * Sin dependencias: lo usan las acciones del servidor y las rutas.
 */
export function mensajeDeCuenta(error: { message?: string | null } | null | undefined, porDefecto = "No pudimos completar eso. Probá de nuevo en un momento."): string {
  const m = error?.message ?? "";
  if (m) console.error("[cuenta]", m);
  if (/invalid login credentials/i.test(m)) return "El correo o la contraseña no son correctos. Si no recordás la contraseña, tocá «Olvidé mi contraseña».";
  if (/email not confirmed/i.test(m)) return "Todavía no confirmaste tu correo. Buscá el mail de confirmación (mirá también en Spam).";
  if (/too many|rate limit|security purposes|seconds/i.test(m)) return "Demasiados intentos seguidos. Esperá un minuto y probá de nuevo.";
  if (/already registered|already been registered|user already/i.test(m)) return "Ya hay una cuenta con ese correo. Entrá con tu contraseña o pedí una nueva.";
  if (/password.*(at least|characters|short)|weak password/i.test(m)) return "La contraseña tiene que tener al menos 8 caracteres.";
  if (/same.*password|different from the old/i.test(m)) return "La contraseña nueva tiene que ser distinta de la anterior.";
  if (/invalid.*email|email.*invalid|unable to validate email/i.test(m)) return "Revisá el correo: parece que está mal escrito.";
  if (/expired|invalid.*(token|link|otp)|otp.*(expired|invalid)/i.test(m)) return "Ese enlace ya venció o ya se usó. Pedí uno nuevo y abrilo apenas te llegue.";
  if (/session.*missing|not authenticated|jwt/i.test(m)) return "Tu sesión se cerró. Entrá de nuevo y repetilo.";
  if (/user not found/i.test(m)) return "No encontramos una cuenta con ese correo.";
  return porDefecto;
}
