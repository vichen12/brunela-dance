import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { CuentaRegresiva } from "@/components/cuenta-regresiva";
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

  const fmt = (opciones: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("es-ES", { ...opciones, timeZone: "Europe/Madrid" }).format(apertura);

  return (
    <main className="pa-page">
      {/*
        Columna de la foto. `aria-hidden` y sin texto alternativo: no cuenta
        nada que no diga ya la columna de al lado, y describirla obligaria a un
        lector de pantalla a oir una escena que no aporta a la tarea, que es
        escribir una contraseña.
      */}
      <section className="pa-foto" aria-hidden>
        <div className="pa-foto-marca">
          <img src="/brand/isologo-icon.png" alt="" width={40} height={40} />
          <span>Brunela Dance Trainer</span>
        </div>
      </section>

      <section className="pa-panel">
        <div className="pa-col">
          <p className="pa-sobre">Acceso anticipado</p>

          <h1 className="pa-title">
            El estudio abre el{" "}
            <em>
              {fmt({ day: "numeric" })} de {fmt({ month: "long" })}
            </em>
          </h1>

          <p className="pa-lead">
            Estamos cargando las clases y preparando todo. Si tenés la contraseña,
            podés entrar ahora.
          </p>

          <CuentaRegresiva objetivoISO={apertura.toISOString()} />

          <form className="pa-form" method="POST" action="/api/acceso">
            {/* La ruta original, para volver adonde iba despues de entrar. El
                rewrite conserva la URL, pero el formulario se postea a otra, asi
                que hay que llevarla a mano. El servidor la valida antes de
                usarla: sin eso seria un open redirect. */}
            <input type="hidden" name="destino" value={destino} />

            <label className="pa-label" htmlFor="password">
              Contraseña de acceso anticipado
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
                Entrar
              </button>
            </div>

            {fallo && (
              <p className="pa-error" id="pa-error" role="alert">
                Esa contraseña no es. Probá de nuevo.
              </p>
            )}
          </form>

          {/* La landing SI se ve. Sin esta salida, quien toca "Ingresar" por
              curiosidad queda encerrado en una pantalla sin vuelta. */}
          <Link className="pa-volver" href="/">
            Mirar el estudio por dentro
          </Link>
        </div>
      </section>

      <style>{`
        /* ────────────────────────────────────────────────────────────────
           El reparto. Mismo esqueleto que /sign-in a proposito: esta
           pantalla aparece EN LUGAR del login y conviene que se lea como
           una version suya, no como otra pagina.
           ──────────────────────────────────────────────────────────────── */
        .pa-page {
          min-height: 100dvh;
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(430px, 1.1fr);
          background: #FFF8F8;
        }

        /* ── La foto ── */
        .pa-foto {
          position: relative;
          overflow: hidden;
          background:
            linear-gradient(180deg, rgba(255,240,242,0.10) 0%, rgba(176,58,62,0.16) 100%),
            url("/fotos-landing/puerta.avif") center 28% / cover no-repeat,
            var(--pink-wash, #FDECEC);
        }

        /*
          Vineta hacia el borde interior. La foto es muy clara y el panel de al
          lado tambien: sin esto los dos blancos se tocan y la union desaparece.
        */
        .pa-foto::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(120,40,44,0.14) 0%, transparent 34%, rgba(255,248,248,0.42) 100%);
        }

        .pa-foto-marca {
          position: absolute;
          z-index: 1;
          top: clamp(1.4rem, 3vw, 2.4rem);
          left: clamp(1.4rem, 3vw, 2.4rem);
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.5rem 0.95rem 0.5rem 0.55rem;
          border-radius: 999px;
          background: rgba(255, 248, 248, 0.9);
          box-shadow: 0 10px 30px rgba(120, 40, 44, 0.14);
        }

        .pa-foto-marca img { width: 26px; height: auto; }

        .pa-foto-marca span {
          font-family: var(--font-display), sans-serif;
          font-size: 0.66rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--pink-deep, #B03A3E);
        }

        /* ── El panel ── */
        .pa-panel {
          display: grid;
          align-content: center;
          padding: clamp(2rem, 5vw, 4.5rem) clamp(1.5rem, 5vw, 5rem);
        }

        .pa-col { width: min(30rem, 100%); }

        /*
          Entrada escalonada. Es UN momento en la carga, no un efecto por
          elemento: el estado base de cada hijo es VISIBLE y la animacion parte
          de oculto con fill backwards, asi que si las animaciones no corren
          -- pestaña en segundo plano, captura headless -- la pantalla se ve
          entera igual. Lo contrario (ocultar por defecto y revelar con una
          clase) es como se termina publicando una pagina en blanco.
        */
        .pa-col > * { animation: pa-entra 620ms cubic-bezier(0.22, 1, 0.36, 1) backwards; }
        .pa-col > :nth-child(1) { animation-delay: 40ms; }
        .pa-col > :nth-child(2) { animation-delay: 90ms; }
        .pa-col > :nth-child(3) { animation-delay: 140ms; }
        .pa-col > :nth-child(4) { animation-delay: 190ms; }
        .pa-col > :nth-child(5) { animation-delay: 250ms; }
        .pa-col > :nth-child(6) { animation-delay: 300ms; }

        @keyframes pa-entra {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: none; }
        }

        .pa-sobre {
          margin: 0 0 0.9rem;
          font-family: var(--font-body), sans-serif;
          font-size: 0.68rem;
          font-weight: 900;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--pink-deep, #B03A3E);
        }

        .pa-title {
          margin: 0;
          font-family: var(--font-display), sans-serif;
          /* Tope en 3.6rem: por encima de eso, "noviembre" desborda la columna
             de 30rem en portatiles de 1280. */
          font-size: clamp(2rem, 3.6vw, 3.6rem);
          font-weight: 900;
          line-height: 1.02;
          letter-spacing: -0.035em;
          color: var(--ink, #1c1917);
          text-wrap: balance;
        }

        .pa-title em {
          display: block;
          font-family: var(--font-serif), Georgia, serif;
          font-style: italic;
          font-weight: 500;
          letter-spacing: -0.02em;
          color: var(--pink-deep, #B03A3E);
        }

        .pa-lead {
          margin: 1.05rem 0 0;
          max-width: 34ch;
          font-size: 0.95rem;
          line-height: 1.65;
          /* --pink-muted da 5.36:1 sobre blanco. El gris claro "elegante" es
             justo lo que vuelve ilegible este tipo de pantalla. */
          color: var(--pink-muted, #8C5F5F);
          text-wrap: pretty;
        }

        /* ── El formulario ── */
        .pa-form {
          display: grid;
          gap: 0.5rem;
          margin-top: 1.9rem;
          padding-top: 1.7rem;
          border-top: 1px solid var(--pink-line, #F2C6C6);
        }

        .pa-label {
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--pink-deep, #B03A3E);
        }

        .pa-row { display: flex; gap: 0.5rem; }

        .pa-input {
          flex: 1 1 auto;
          min-width: 0;
          min-height: 48px;
          padding: 0 1rem;
          border-radius: 13px;
          border: 1px solid var(--pink-line, #F2C6C6);
          background: #fff;
          font-family: var(--font-body), sans-serif;
          font-size: 0.95rem;
          letter-spacing: 0.08em;
          color: var(--ink, #1c1917);
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }

        .pa-input::placeholder { color: #C9A6A6; letter-spacing: 0.14em; }

        .pa-input:focus-visible {
          outline: none;
          border-color: var(--pink-deep, #B03A3E);
          box-shadow: 0 0 0 3px rgba(176, 58, 62, 0.14);
        }

        .pa-btn {
          flex: 0 0 auto;
          min-height: 48px;
          padding: 0 1.4rem;
          border: 0;
          border-radius: 13px;
          /* Fondo --pink con texto blanco da 3.78:1, por debajo de AA. Es la
             excepcion de marca ya documentada en CLAUDE.md: --pink es superficie
             glanceable, y "Entrar" es una etiqueta que se mira de reojo, no
             texto de lectura sostenida. */
          background: var(--pink, #E64F55);
          color: #fff;
          font-family: var(--font-body), sans-serif;
          font-size: 0.78rem;
          font-weight: 900;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 180ms ease, transform 180ms cubic-bezier(0.22,1,0.36,1),
                      box-shadow 180ms ease;
        }

        .pa-btn:hover {
          background: var(--pink-mid, #D93438);
          transform: translateY(-1px);
          box-shadow: 0 12px 26px rgba(217, 52, 56, 0.24);
        }

        .pa-btn:focus-visible { outline: 2px solid var(--pink-deep, #B03A3E); outline-offset: 2px; }

        .pa-error {
          margin: 0.15rem 0 0;
          font-size: 0.8rem;
          font-weight: 700;
          /* --pink-deep y no --pink: es un mensaje que hay que LEER. 5.96:1. */
          color: var(--pink-deep, #B03A3E);
        }

        .pa-volver {
          display: inline-block;
          margin-top: 1.5rem;
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--pink-muted, #8C5F5F);
          text-decoration: underline;
          text-underline-offset: 4px;
          text-decoration-color: var(--pink-line, #F2C6C6);
          transition: color 160ms ease, text-decoration-color 160ms ease;
        }

        .pa-volver:hover {
          color: var(--pink-deep, #B03A3E);
          text-decoration-color: currentColor;
        }

        .pa-volver:focus-visible {
          outline: 2px solid var(--pink-deep, #B03A3E);
          outline-offset: 3px;
          border-radius: 3px;
        }

        /* ── Angosto: la foto pasa a ser una banda arriba ──
           Por debajo de 900px una columna de 430px no entra al lado de nada. La
           foto no se esconde: es la unica imagen de la pantalla y es lo que hace
           que esto parezca un estudio de danza y no un formulario. */
        @media (max-width: 900px) {
          .pa-page { grid-template-columns: 1fr; }

          .pa-foto {
            min-height: clamp(190px, 34vh, 300px);
            background-position: center 22%;
          }

          .pa-foto::after {
            background: linear-gradient(180deg, transparent 40%, rgba(255,248,248,0.55) 100%);
          }

          .pa-panel { padding-top: clamp(1.6rem, 6vw, 2.4rem); }
          .pa-col { width: 100%; }
        }

        @media (max-width: 430px) {
          .pa-row { flex-direction: column; }
          .pa-btn { width: 100%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .pa-col > * { animation: none; }
          .pa-btn { transition: none; }
          .pa-btn:hover { transform: none; }
        }
      `}</style>
    </main>
  );
}
