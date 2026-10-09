import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal } from "@/components/pagina-legal";
import { TITULAR } from "@/src/lib/legal";

export const metadata: Metadata = {
  title: "Aviso legal · Brunela Dance Trainer",
  description: "Datos del titular de bruneladance.com y condiciones de uso del sitio.",
};

export default function AvisoLegalPage() {
  return (
    <PaginaLegal
      href="/legal/aviso-legal"
      titulo="Aviso legal"
      bajada="Quién está detrás de este sitio y las reglas básicas para usarlo."
    >
      <h2>1. Titular del sitio</h2>
      <p>
        En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de la
        sociedad de la información y de comercio electrónico (LSSI), se informa
        de los datos del titular de <strong>bruneladance.com</strong>:
      </p>
      <dl className="lg-datos">
        <dt>Titular</dt><dd>{TITULAR.nombre}</dd>
        <dt>NIE</dt><dd>{TITULAR.nie}</dd>
        <dt>Domicilio</dt><dd>{TITULAR.domicilio}</dd>
        <dt>Correo</dt><dd><a href={`mailto:${TITULAR.correo}`}>{TITULAR.correo}</a></dd>
        <dt>Nombre comercial</dt><dd>{TITULAR.marca}</dd>
        <dt>Actividad</dt><dd>Enseñanza de danza, ballet, pilates y preparación física, en línea y presencial.</dd>
      </dl>

      <h2>2. Objeto</h2>
      <p>
        Este sitio presenta la actividad de {TITULAR.marca} y da acceso a un
        estudio online con clases grabadas, planes de trabajo, clases en vivo,
        documentos y una comunidad de alumnas. El uso del área privada y la
        contratación de planes o packs se rigen además por las{" "}
        <Link href="/legal/condiciones">Condiciones de contratación</Link>.
      </p>

      <h2>3. Uso del sitio</h2>
      <p>Quien navega por el sitio se compromete a usarlo de buena fe y, en particular, a no:</p>
      <ul>
        <li>usarlo para fines ilícitos o que perjudiquen a terceros o al propio sitio;</li>
        <li>intentar acceder a áreas, cuentas o contenidos para los que no tiene permiso;</li>
        <li>introducir virus o cualquier código que pueda dañar los sistemas;</li>
        <li>copiar, grabar, descargar o difundir el contenido del estudio fuera de lo permitido.</li>
      </ul>

      <h2>4. Propiedad intelectual</h2>
      <p>
        Las clases, vídeos, textos, fotografías, programas de entrenamiento,
        documentos, el logotipo y el diseño del sitio son de {TITULAR.nombre} o
        se usan con autorización de sus titulares, y están protegidos por la
        normativa de propiedad intelectual e industrial. No se cede ningún
        derecho sobre ellos más allá del uso personal que se describe en las
        Condiciones de contratación. Queda prohibida su reproducción,
        distribución, comunicación pública o transformación sin autorización
        expresa y por escrito.
      </p>

      <h2>5. Enlaces a otros sitios</h2>
      <p>
        El sitio enlaza a redes sociales y a servicios de terceros (por ejemplo,
        la pasarela de pago o la plataforma de videollamada de las clases en
        vivo). Esos sitios tienen sus propias condiciones y políticas, de las
        que {TITULAR.marca} no es responsable.
      </p>

      <h2>6. Responsabilidad</h2>
      <p>
        Se trabaja para que el sitio esté disponible y sin errores, pero no se
        puede garantizar un funcionamiento ininterrumpido. Puede haber pausas
        por mantenimiento o por causas ajenas, como fallos de los proveedores
        técnicos o de la conexión de quien navega. Las indicaciones de salud
        relacionadas con la práctica de las clases están en las Condiciones de
        contratación.
      </p>

      <h2>7. Datos personales y cookies</h2>
      <p>
        El tratamiento de datos personales se explica en la{" "}
        <Link href="/legal/privacidad">Política de privacidad</Link>, y el uso de
        cookies, en la <Link href="/legal/cookies">Política de cookies</Link>.
      </p>

      <h2>8. Ley aplicable</h2>
      <p>
        Este aviso se rige por la legislación española. Si quien usa el sitio es
        consumidor, para cualquier controversia serán competentes los juzgados
        y tribunales de su domicilio.
      </p>
    </PaginaLegal>
  );
}
