import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal } from "@/components/pagina-legal";
import { TITULAR } from "@/src/lib/legal";

export const metadata: Metadata = {
  title: "Condiciones de contratación · Brunela Dance Trainer",
  description: "Cómo funcionan los planes, los packs, el período de prueba, la cancelación y el desistimiento en Brunela Dance Trainer.",
};

/**
 * ⚠️ El texto del desistimiento (punto 7) tiene que coincidir con lo que ve la
 *    alumna en el checkout de Stripe: `custom_text.submit` en
 *    app/api/stripe/checkout/route.ts y checkout-pack/route.ts. Ahi es donde da
 *    el consentimiento expreso que pide el art. 103.m del TRLGDCU; si se cambia
 *    una cosa, se cambia la otra.
 */
export default function CondicionesPage() {
  return (
    <PaginaLegal
      href="/legal/condiciones"
      titulo="Condiciones de contratación"
      bajada="Lo que tenés que saber antes de contratar un plan o comprar un pack: precios, prueba gratis, cancelación y desistimiento."
    >
      <h2>1. Quién te presta el servicio</h2>
      <p>
        {TITULAR.marca} es la actividad de {TITULAR.nombre}, con NIE {TITULAR.nie}{" "}
        y domicilio en {TITULAR.domicilio}. Contacto:{" "}
        <a href={`mailto:${TITULAR.correo}`}>{TITULAR.correo}</a>.
      </p>
      <p>
        Estas condiciones regulan el uso del estudio online de{" "}
        <strong>bruneladance.com</strong> y la contratación de sus planes y
        packs. Al crear una cuenta o al pagar, las aceptás. Los contratos se
        celebran en español.
      </p>

      <h2>2. Qué ofrece el estudio</h2>
      <ul>
        <li><strong>Planes de suscripción</strong> (Corps de Ballet, Solista y Principal), mensuales o anuales. Cada plan da acceso al contenido que se describe en la página de planes del sitio en el momento de contratar: clases grabadas, planes de trabajo, clases en vivo, documentos y comunidad, según el nivel.</li>
        <li><strong>Packs de clases</strong>: un conjunto cerrado de clases que se paga una sola vez, sin suscripción.</li>
        <li><strong>Acceso gratuito</strong>: Brunela puede regalar a una alumna un período de acceso a un plan. No requiere tarjeta y, al terminar, no se cobra nada: la cuenta simplemente pasa a no tener plan.</li>
      </ul>

      <h2>3. Cuenta</h2>
      <p>
        Para usar el estudio necesitás una cuenta. Es <strong>personal e
        intransferible</strong>: no se puede compartir ni prestar. Sos
        responsable de mantener tu contraseña en secreto. Si detectamos que una
        cuenta se comparte o se usa para copiar contenido, podemos suspenderla.
        Los requisitos de edad están en la{" "}
        <Link href="/legal/privacidad">Política de privacidad</Link>; para pagar
        hay que ser mayor de edad.
      </p>

      <h2>4. Precios y pago</h2>
      <p>
        Los precios son los que figuran en el sitio al momento de contratar, en
        euros, y son <strong>precios finales con los impuestos aplicables
        incluidos</strong>. El pago se hace con tarjeta a través de Stripe, en
        su página segura; nosotros no vemos ni guardamos los datos de la
        tarjeta. Recibís el justificante de cada cobro por correo.
      </p>
      <p>
        Si cambiamos el precio de un plan, te avisaremos por correo al menos 30
        días antes de que se aplique a tu próxima renovación, para que puedas
        cancelar si no estás de acuerdo.
      </p>

      <h2>5. Planes: prueba, renovación y cancelación</h2>
      <ul>
        <li><strong>Prueba gratis.</strong> Los planes empiezan con 7 días de prueba sin cargo. Si cancelás antes de que terminen, no se te cobra nada. Si no cancelás, al día 8 se cobra el primer período.</li>
        <li><strong>Renovación automática.</strong> El plan se renueva solo al final de cada período (mes o año) y se cobra a la misma tarjeta, hasta que lo canceles.</li>
        <li><strong>Cancelación.</strong> Podés cancelar cuando quieras desde <em>Tu plan → Gestionar</em> en el estudio, sin dar explicaciones. Desde ahí también cambiás la tarjeta y descargás tus facturas. Seguís teniendo acceso hasta el final del período ya pagado, y no hay más cobros. No se devuelve la parte proporcional del período en curso.</li>
        <li><strong>Cambio de plan.</strong> Si querés pasar a otro plan, escribinos y lo hacemos por vos.</li>
        <li><strong>Cobro fallido.</strong> Si un cobro no se puede hacer, Stripe lo reintenta durante unos días. Si no se resuelve, el plan se cancela y el acceso se cierra.</li>
      </ul>

      <h2>6. Packs</h2>
      <p>
        Un pack se paga <strong>una sola vez</strong> y sus clases quedan
        disponibles en tu biblioteca sin fecha de vencimiento, mientras el
        estudio online siga en funcionamiento. Si algún día el estudio cerrara,
        te avisaríamos con al menos 30 días para que puedas terminar las
        clases. Si una clase de un pack tuviera un error, podemos reemplazarla
        por otra equivalente.
      </p>

      <h2>7. Derecho de desistimiento</h2>
      <p>
        Como consumidor, tenés en general <strong>14 días naturales</strong>{" "}
        desde la contratación para desistir sin dar explicaciones (art. 102 del
        Real Decreto Legislativo 1/2007, TRLGDCU).
      </p>
      <p>
        Pero el estudio es <strong>contenido digital que se te da al
        instante</strong>. Por eso, al pagar, en la página de pago se te pide
        que confirmes que <strong>querés empezar a usarlo ya</strong> y que
        sabés que, una vez que empieza el acceso, <strong>perdés el derecho de
        desistimiento</strong> (art. 103.m del TRLGDCU). Esto vale para los
        planes y para los packs.
      </p>
      <p>
        En los planes, para que puedas probar sin compromiso, tenés los{" "}
        <strong>7 días de prueba gratis</strong>: si el estudio no es para vos,
        cancelás antes y no pagás nada.
      </p>
      <p>
        Si en algún caso el derecho de desistimiento sí te corresponde, podés
        ejercerlo escribiendo a{" "}
        <a href={`mailto:${TITULAR.correo}`}>{TITULAR.correo}</a> con una
        declaración clara o con el formulario del final de esta página. Te
        devolveremos el importe en un máximo de 14 días, por el mismo medio de
        pago.
      </p>

      <h2>8. Clases en vivo</h2>
      <ul>
        <li>Se dan por Zoom o Google Meet. El enlace aparece en el estudio, en la ficha de la clase, para quien la reservó.</li>
        <li>Cada clase indica qué planes pueden reservarla. Las plazas pueden ser limitadas.</li>
        <li>Si no podés ir, cancelá la reserva desde el estudio para liberar tu lugar.</li>
        <li>Si tenemos que cancelar o mover una clase, te avisamos lo antes posible y la reprogramamos.</li>
        <li>Está prohibido grabar las clases en vivo o difundir su enlace.</li>
      </ul>

      <h2>9. Uso del contenido</h2>
      <p>
        Todo el contenido del estudio es para tu <strong>uso personal y no
        comercial</strong>. No podés descargarlo, grabarlo, copiarlo, subirlo a
        otro sitio, venderlo ni usarlo para dar tus propias clases. Lo que
        pagás es el acceso, no la propiedad del contenido.
      </p>

      <h2>10. Chat y comunidad</h2>
      <p>
        El chat y la comunidad son espacios para aprender y acompañarse.
        Pedimos respeto: no se permiten insultos, acoso, discriminación,
        publicidad ni contenido ilegal o sexual. Brunela puede borrar mensajes
        y silenciar o bloquear a quien no respete estas normas.
      </p>

      <h2>11. Salud y práctica segura</h2>
      <p>
        Las clases incluyen ejercicio físico. Antes de empezar, si tenés alguna
        lesión, enfermedad, estás embarazada o hace mucho que no entrenás,
        consultá con un profesional de la salud. Practicá en un espacio seguro,
        con el material indicado, respetá tus límites y pará si sentís dolor.
        Las clases online no sustituyen la supervisión presencial ni el consejo
        médico. Nada de esto limita los derechos que te da la ley como
        consumidor.
      </p>

      <h2>12. Disponibilidad del servicio</h2>
      <p>
        Trabajamos para que el estudio funcione siempre, pero puede haber
        interrupciones breves por mantenimiento o por fallos de proveedores. El
        catálogo de clases puede cambiar: se suman clases nuevas y,
        ocasionalmente, se retiran otras.
      </p>

      <h2>13. Cambios en estas condiciones</h2>
      <p>
        Podemos actualizar estas condiciones. La versión que se aplica es la
        vigente cuando contratás o renovás. Si un cambio te afecta de forma
        importante, te avisamos por correo antes de que entre en vigor.
      </p>

      <h2>14. Ley aplicable y reclamaciones</h2>
      <p>
        Estas condiciones se rigen por la ley española. Si tenés un problema,
        escribinos primero a <a href={`mailto:${TITULAR.correo}`}>{TITULAR.correo}</a>{" "}
        y lo resolvemos. Si no llegamos a un acuerdo, podés acudir a los
        organismos de consumo de tu comunidad autónoma o a los juzgados y
        tribunales de tu domicilio.
      </p>

      <h2 id="formulario-desistimiento">Anexo. Formulario de desistimiento</h2>
      <p className="lg-nota">Solo tenés que completarlo y enviarlo si querés desistir del contrato.</p>
      <div className="lg-formulario">
        <p>
          A la atención de {TITULAR.nombre} ({TITULAR.marca}), {TITULAR.domicilio},{" "}
          {TITULAR.correo}:
        </p>
        <p>
          Por la presente le comunico que desisto del contrato de prestación del
          siguiente servicio / suministro del siguiente contenido digital:
          ______________________________
        </p>
        <p>Contratado el: ______________</p>
        <p>Nombre: ______________________________</p>
        <p>Correo de la cuenta: ______________________________</p>
        <p>Domicilio: ______________________________</p>
        <p>Firma (solo si se envía en papel): ______________</p>
        <p>Fecha: ______________</p>
      </div>
    </PaginaLegal>
  );
}
