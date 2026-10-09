import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight, Eye, KeyRound, Sparkles } from "lucide-react";
import { CuentaRegresiva, FechaDeApertura } from "@/components/cuenta-regresiva";
import { T } from "@/components/language-provider";
import { fechaDeApertura } from "@/src/lib/acceso-anticipado";

/**
 * La puerta del estudio.
 *
 * NO es un cartel de "sitio cerrado": la landing se ve entera. Esta pantalla
 * aparece solo cuando alguien intenta ENTRAR -- iniciar sesion, registrarse, o
 * abrir el estudio o el panel.
 *
 * POR QUE TIENE LA MISMA ARQUITECTURA QUE /sign-in
 *   Es la pantalla que aparece EN LUGAR del login, asi que se lee mejor como una
 *   version del login que como una pagina distinta: mismo reparto en dos
 *   columnas, foto a la izquierda, formulario a la derecha. Quien vuelva el 15
 *   de noviembre va a encontrar la misma composicion con el formulario de
 *   verdad, y eso hace que la espera se sienta parte del producto.
 *
 *   La diferencia con /sign-in es que ahi la columna izquierda es un panel rosa
 *   con una silueta dibujada; aca va una FOTO REAL de Brunela. Es la unica
 *   imagen de la pantalla y tiene que cargar con todo el peso.
 *
 * REDISEÑO "SUAVE Y CALIDO" (2026-10-08)
 *   La foto va en un marco redondeado, el fondo lleva manchas melocoton y rosa,
 *   la fecha va en coral y en la misma letra que el titular (nada de serif ni
 *   italica), y la cuenta regresiva en pastillas pastel. Los textos salen de
 *   t() con las cuatro traducciones: la puerta era la unica pantalla publica
 *   que quedaba solo en castellano.
 *
 * El middleware llega hasta aca por REWRITE, asi que la URL original se conserva
 * en la barra del navegador pero la pagina no la ve: viene en la cabecera
 * `x-destino-original`, y de ahi sale el campo `destino` del formulario.
 */
export const metadata: Metadata = {
  title: "Brunela Dance Trainer — Acceso anticipado",
  description: "El estudio online de Brunela abre el 15 de noviembre de 2026.",
  /**
   * ⚠️ Sin esto, Google indexa esta pantalla. El dia que se abra, el resultado
   *    de busqueda seguiria mostrando "acceso anticipado" durante semanas hasta
   *    que vuelva a rastrear.
   */
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ProximamentePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const fallo = params.error != null;
  const apertura = fechaDeApertura();

  /**
   * A donde queria ir. Se valida igual aca aunque la ponga el middleware: el
   * servidor la vuelve a comprobar antes de redirigir (open redirect), y este
   * default cubre el caso de entrar a /proximamente escribiendola a mano.
   */
  const cabeceras = await headers();
  const pedida = cabeceras.get("x-destino-original") ?? "";
  const destino = /^\/(?!\/)[^\s]*$/.test(pedida) ? pedida : "/sign-in";

  return (
    <main className="pa-page sistema">
      {/* Manchas de color de fondo. Decorativas: el fondo de la pagina sigue
          siendo blanco (pedido explicito) y estas manchas flotan encima. */}
      <span className="pa-mancha pa-mancha-1" aria-hidden />
      <span className="pa-mancha pa-mancha-2" aria-hidden />
      <span className="pa-mancha pa-mancha-3" aria-hidden />

      {/*
        Columna de la foto. `aria-hidden` y sin texto alternativo: no cuenta
        nada que no diga ya la columna de al lado, y describirla obligaria a un
        lector de pantalla a oir una escena que no aporta a la tarea, que es
        escribir una contraseña.
      */}
      <section className="pa-foto" aria-hidden>
        <div className="pa-foto-marca">
          <span className="pa-foto-marca-ico">
            <img src="/brand/isologo-icon.png" alt="" width={40} height={40} />
          </span>
          <span>Brunela</span>
        </div>
        <div className="pa-foto-nota">
          <Sparkles size={15} strokeWidth={2.2} />
          <span><T id="footer.place" /></span>
        </div>
      </section>

      <section className="pa-panel">
        <div className="pa-col">
          <p className="pa-sobre">
            <span className="pa-sobre-punto" />
            <T id="puerta.kicker" />
          </p>

          <h1 className="pa-title">
            <T id="puerta.title" />{" "}
            <span className="pa-fecha">
              <FechaDeApertura objetivoISO={apertura.toISOString()} />
            </span>
          </h1>

          <p className="pa-lead">
            <T id="puerta.lead" />
          </p>

          <CuentaRegresiva objetivoISO={apertura.toISOString()} />

          <form className="pa-form" method="POST" action="/api/acceso">
            {/* La ruta original, para volver adonde iba despues de entrar. El
                rewrite conserva la URL, pero el formulario se postea a otra, asi
                que hay que llevarla a mano. El servidor la valida antes de
                usarla: sin eso seria un open redirect. */}
            <input type="hidden" name="destino" value={destino} />

            <label className="pa-label" htmlFor="password">
              <span className="pa-label-ico">
                <KeyRound size={15} strokeWidth={2.2} />
              </span>
              <T id="puerta.label" />
            </label>

            <div className="pa-row">
              <input
                className="pa-input"
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                aria-describedby={fallo ? "pa-error" : undefined}
              />
              <button className="pa-btn" type="submit">
                <T id="puerta.submit" />
                <ArrowRight size={17} strokeWidth={2.4} aria-hidden />
              </button>
            </div>

            {fallo && (
              <p className="pa-error" id="pa-error" role="alert">
                <T id="puerta.error" />
              </p>
            )}
          </form>

          {/* La landing SI se ve. Sin esta salida, quien toca "Ingresar" por
              curiosidad queda encerrado en una pantalla sin vuelta. */}
          <Link className="pa-volver" href="/">
            <Eye size={16} strokeWidth={2.2} aria-hidden />
            <T id="puerta.back" />
          </Link>
        </div>
      </section>

      {/* Los estilos viven en app/estilos/acceso.css (bloque "La puerta"). */}
    </main>
  );
}
