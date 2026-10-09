import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal } from "@/components/pagina-legal";
import { TITULAR } from "@/src/lib/legal";

export const metadata: Metadata = {
  title: "Política de cookies · Brunela Dance Trainer",
  description: "Qué cookies y almacenamiento local usa bruneladance.com. Solo técnicos: sin publicidad ni seguimiento.",
};

/**
 * POR QUE NO HAY BANNER DE COOKIES
 *   Todo lo que el sitio guarda en el navegador es tecnico: la sesion, la llave
 *   de la puerta de acceso anticipado, el idioma y las notificaciones leidas.
 *   El art. 22.2 de la LSSI exime de consentimiento a lo "estrictamente
 *   necesario" para un servicio que la persona pidio. Las analiticas son las de
 *   Vercel, que no usan cookies, y el trailer va por youtube-nocookie.
 *
 * ⚠️ El dia que se agregue algo de terceros con cookies (Meta Pixel, Google
 *    Analytics, un chat externo...) esta pagina deja de ser cierta y HACE FALTA
 *    un banner con consentimiento previo. Se agregan las dos cosas juntas.
 */
export default function CookiesPage() {
  return (
    <PaginaLegal
      href="/legal/cookies"
      titulo="Política de cookies"
      bajada="Solo usamos lo imprescindible para que el sitio funcione. Sin publicidad y sin seguimiento."
    >
      <h2>1. Qué son</h2>
      <p>
        Las cookies y el almacenamiento local son pequeños datos que un sitio
        guarda en tu navegador para recordar algo entre una página y otra, como
        que ya iniciaste sesión.
      </p>

      <h2>2. Cuáles usamos</h2>
      <p>
        Todas son <strong>técnicas</strong>: sin ellas no podrías iniciar
        sesión ni usar el estudio. Por eso, según el artículo 22.2 de la LSSI,
        no necesitan tu consentimiento y no te mostramos un aviso para
        aceptarlas.
      </p>
      <div className="lg-tabla-envoltura">
        <table className="lg-tabla">
          <thead>
            <tr><th>Nombre</th><th>Para qué</th><th>Duración</th></tr>
          </thead>
          <tbody>
            <tr><td><code>sb-…-auth-token</code></td><td>Mantener tu sesión iniciada de forma segura</td><td>Mientras dure la sesión, hasta que cierres sesión</td></tr>
            <tr><td><code>brunela_acceso</code></td><td>Recordar que ya pasaste la puerta de acceso anticipado, antes de la apertura</td><td>90 días</td></tr>
            <tr><td><code>brunela-locale</code> (almacenamiento local)</td><td>Recordar el idioma que elegiste</td><td>Hasta que lo borres</td></tr>
            <tr><td>Notificaciones leídas (almacenamiento local)</td><td>No volver a marcarte como nuevos los avisos que ya viste</td><td>Hasta que lo borres</td></tr>
          </tbody>
        </table>
      </div>

      <h2>3. Lo que NO usamos</h2>
      <ul>
        <li>No usamos cookies de publicidad ni de redes sociales.</li>
        <li>
          Para contar visitas usamos la medición de Vercel, que <strong>no usa
          cookies</strong> ni identifica a nadie: solo da totales anónimos.
        </li>
        <li>
          Si el tráiler de la portada es un vídeo de YouTube, se carga desde{" "}
          <code>youtube-nocookie.com</code>, el modo de privacidad mejorada de
          YouTube, que no guarda cookies mientras no lo reproduzcas.
        </li>
      </ul>

      <h2>4. Servicios externos</h2>
      <p>
        Cuando pagás, lo hacés en la página segura de Stripe, y cuando entrás a
        una clase en vivo, en Zoom o Google Meet. Esos sitios usan sus propias
        cookies, que se rigen por sus políticas.
      </p>

      <h2>5. Cómo borrarlas</h2>
      <p>
        Podés borrar o bloquear las cookies desde la configuración de tu
        navegador. Si bloqueás las de este sitio, no vas a poder iniciar sesión.
      </p>

      <h2>6. Más información</h2>
      <p>
        Para cualquier duda escribinos a{" "}
        <a href={`mailto:${TITULAR.correo}`}>{TITULAR.correo}</a>. Cómo tratamos
        tus datos está en la <Link href="/legal/privacidad">Política de privacidad</Link>.
      </p>
    </PaginaLegal>
  );
}
