import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Destino de los botones de los correos de Supabase (emails/supabase/*.html):
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<tipo>
 *
 * POR QUE token_hash Y NO {{ .ConfirmationURL }}
 *   ConfirmationURL usa PKCE: el enlace solo sirve en el MISMO navegador donde
 *   se pidio, porque el "code verifier" quedo en una cookie de ese navegador.
 *   Quien pide el cambio de contraseña en la compu y abre el correo en el
 *   telefono recibia "PKCE code verifier not found". Con token_hash el enlace
 *   se valida solo contra Supabase (verifyOtp) y anda en cualquier dispositivo.
 *
 * ⚠️ Si se cambia una plantilla, el `type` del enlace tiene que ser uno de
 *    DESTINO. Uno desconocido cae al estudio, que es inofensivo.
 */
const DESTINO: Partial<Record<EmailOtpType, string>> = {
  email: "/dashboard", // confirmar cuenta y enlace magico; el layout manda al onboarding si falta
  signup: "/dashboard",
  magiclink: "/dashboard",
  recovery: "/sign-in/reset-password",
  invite: "/sign-in/reset-password", // la invitada elige su contraseña
  email_change: "/dashboard/perfil",
};

const TIPOS = new Set<string>(Object.keys(DESTINO));

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") ?? "";

  const falla = (motivo: string) =>
    NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(motivo)}`);

  if (!tokenHash || !TIPOS.has(tipo)) {
    return falla("El enlace está incompleto. Pedí uno nuevo.");
  }

  const destino = DESTINO[tipo as EmailOtpType] ?? "/dashboard";
  const respuesta = NextResponse.redirect(`${origin}${destino}`);

  /*
   * 🔴 EL ENLACE DEL CORREO REEMPLAZA CUALQUIER SESION QUE HUBIERA.
   *
   * Paso el 2026-10-09: Brunela tenia su sesion abierta, abrio en el mismo
   * navegador la invitacion de una alumna nueva, eligio "la contraseña de la
   * alumna"... y quedo guardada en la cuenta de BRUNELA. La invitada siguio
   * sin contraseña y no podia entrar.
   *
   * Por eso: el cliente no ve las cookies de sesion viejas (getAll las filtra)
   * y la respuesta las borra TODAS, incluidos los pedazos .0/.1 de una sesion
   * larga, antes de escribir la nueva. Quien abre el enlace queda con la
   * sesion de ESE correo y de ninguno mas.
   */
  const esCookieDeSesion = (n: string) => n.startsWith("sb-") && n.includes("-auth-token");
  for (const c of request.cookies.getAll()) {
    if (esCookieDeSesion(c.name)) respuesta.cookies.delete(c.name);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll().filter((c) => !esCookieDeSesion(c.name));
        },
        // Las cookies de sesion van en el MISMO redirect que se devuelve: si se
        // escribieran en otra respuesta, la alumna llegaria sin sesion.
        setAll(cookies: { name: string; value: string; options: CookieOptions }[]) {
          cookies.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({ type: tipo as EmailOtpType, token_hash: tokenHash });
  if (error) {
    console.error("[auth/confirm] verifyOtp:", error.message);
    return falla("El enlace ya se usó o venció. Pedí uno nuevo.");
  }

  return respuesta;
}
