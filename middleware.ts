import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE_ACCESO,
  RUTA_PUERTA,
  igualEnTiempoConstante,
  puertaActiva,
  rutaConPuerta,
  tokenDeAcceso,
} from "@/src/lib/acceso-anticipado";

export async function middleware(request: NextRequest) {
  const { pathname: ruta } = request.nextUrl;

  /**
   * La puerta de acceso anticipado va PRIMERO, antes de tocar Supabase.
   *
   * POR QUE PRIMERO
   *   Porque quien no tiene la contraseña no tiene por que costar una lectura de
   *   sesion. Y porque una sesion vieja en el navegador no puede saltearla.
   *
   * QUE CIERRA
   *   Solo la entrada al producto (`rutaConPuerta`): iniciar sesion, registro,
   *   estudio y panel. La landing se ve entera, que es el punto de publicarla
   *   antes de abrir.
   *
   * POR QUE REWRITE Y NO REDIRECT
   *   Un redirect le cambia la URL: entra a /sign-in y termina en /proximamente,
   *   perdiendo a donde iba. Con rewrite la URL se conserva, asi que al poner la
   *   contraseña vuelve exactamente ahi.
   */
  if (puertaActiva() && rutaConPuerta(ruta)) {
    const cookie = request.cookies.get(COOKIE_ACCESO)?.value ?? "";
    const esperado = await tokenDeAcceso();

    if (!igualEnTiempoConstante(cookie, esperado)) {
      const url = request.nextUrl.clone();
      url.pathname = RUTA_PUERTA;
      url.search = "";

      /**
       * A donde queria ir, para devolverlo ahi despues de entrar.
       *
       * En un rewrite la pagina NO recibe la URL original -- ve la suya. Sin
       * esto, quien toca "Ingresar" pone la contraseña y aterriza en la portada
       * en vez de en el formulario que estaba buscando.
       *
       * ⚠️ VA EN LA CABECERA DE LA PETICION, NO DE LA RESPUESTA. Puesta en la
       *    respuesta viaja al navegador y la pagina nunca la ve: el rewrite
       *    renderiza del lado del servidor, antes de que exista esa respuesta.
       */
      const cabeceras = new Headers(request.headers);
      cabeceras.set("x-destino-original", ruta);

      return NextResponse.rewrite(url, { request: { headers: cabeceras } });
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Read session from cookie — no network call, keeps middleware fast.
  // Server components call getUser() for actual security verification.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;
  const isPrivate =
    pathname.startsWith("/dashboard") || pathname.startsWith("/admin");

  if (isPrivate && !session) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
