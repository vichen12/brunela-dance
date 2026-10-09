import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal } from "@/components/pagina-legal";
import { TITULAR } from "@/src/lib/legal";

export const metadata: Metadata = {
  title: "Política de privacidad · Brunela Dance Trainer",
  description: "Qué datos personales se tratan en bruneladance.com, para qué, con quién y cómo ejercer tus derechos.",
};

/**
 * ⚠️ Esta pagina DESCRIBE el sistema. Si se agrega un proveedor que recibe
 *    datos de alumnas (otro correo, analiticas con cookies, un CRM...), hay que
 *    sumarlo a la tabla de "Con quien se comparten" el mismo dia.
 */
export default function PrivacidadPage() {
  return (
    <PaginaLegal
      href="/legal/privacidad"
      titulo="Política de privacidad"
      bajada="Qué datos tuyos usamos, para qué, con quién se comparten y cómo pedir que los cambiemos o borremos."
    >
      <h2>1. Responsable del tratamiento</h2>
      <dl className="lg-datos">
        <dt>Responsable</dt><dd>{TITULAR.nombre} ({TITULAR.marca})</dd>
        <dt>NIE</dt><dd>{TITULAR.nie}</dd>
        <dt>Domicilio</dt><dd>{TITULAR.domicilio}</dd>
        <dt>Contacto</dt><dd><a href={`mailto:${TITULAR.correo}`}>{TITULAR.correo}</a></dd>
      </dl>

      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li><strong>Datos de cuenta:</strong> nombre, correo electrónico y contraseña (guardada cifrada; nunca la vemos). Si entrás con Google, recibimos tu nombre, tu correo y tu foto de perfil de Google.</li>
        <li><strong>Datos de perfil:</strong> foto, nivel técnico y objetivos de entrenamiento que elegís al registrarte.</li>
        <li><strong>Datos de uso del estudio:</strong> clases vistas y progreso, reservas de clases en vivo, packs comprados y mensajes que escribís en el chat y en la comunidad.</li>
        <li><strong>Datos de pago:</strong> el plan contratado, su estado y el historial de cobros. Los datos de la tarjeta los recibe y guarda directamente Stripe; nosotros no los vemos ni los almacenamos.</li>
        <li><strong>Preferencias de comunicación:</strong> si aceptaste recibir avisos de clases nuevas y cuándo.</li>
        <li><strong>Datos técnicos:</strong> dirección IP, tipo de navegador y registros de acceso, necesarios para el funcionamiento y la seguridad del servicio.</li>
      </ul>
      <p>
        No pedimos datos de salud. Si decidís contarnos alguna lesión o
        condición por el chat para adaptar tu entrenamiento, lo hacés de forma
        voluntaria y solo se usa para eso.
      </p>

      <h2>3. Para qué y con qué base legal</h2>
      <div className="lg-tabla-envoltura">
        <table className="lg-tabla">
          <thead>
            <tr><th>Finalidad</th><th>Base legal</th></tr>
          </thead>
          <tbody>
            <tr><td>Crear y gestionar tu cuenta y darte acceso a las clases, planes, packs y clases en vivo que contrataste</td><td>Ejecución del contrato (art. 6.1.b RGPD)</td></tr>
            <tr><td>Cobrar planes y packs, y emitir los justificantes de pago</td><td>Ejecución del contrato y obligación legal fiscal (art. 6.1.b y 6.1.c RGPD)</td></tr>
            <tr><td>Enviarte correos necesarios del servicio: confirmación de cuenta, cambio de contraseña, recordatorios de clases reservadas, avisos sobre tu plan</td><td>Ejecución del contrato (art. 6.1.b RGPD)</td></tr>
            <tr><td>Avisarte de clases nuevas y novedades del estudio</td><td>Tu consentimiento, que podés retirar cuando quieras (art. 6.1.a RGPD)</td></tr>
            <tr><td>Moderar el chat y la comunidad, y proteger el servicio frente a abusos y accesos indebidos</td><td>Interés legítimo en mantener un espacio seguro (art. 6.1.f RGPD)</td></tr>
            <tr><td>Medir de forma agregada y anónima cuántas visitas recibe el sitio</td><td>Interés legítimo; no se usan cookies ni se identifica a nadie (art. 6.1.f RGPD)</td></tr>
          </tbody>
        </table>
      </div>
      <p>No tomamos decisiones automatizadas ni hacemos perfiles con efectos jurídicos sobre vos.</p>

      <h2>4. Con quién se comparten</h2>
      <p>
        No vendemos ni cedemos tus datos. Para que el estudio funcione, algunos
        proveedores los tratan <strong>por nuestra cuenta</strong> (como
        encargados del tratamiento), con contrato y solo para prestarnos su
        servicio:
      </p>
      <div className="lg-tabla-envoltura">
        <table className="lg-tabla">
          <thead>
            <tr><th>Proveedor</th><th>Para qué</th><th>Dónde</th></tr>
          </thead>
          <tbody>
            <tr><td>Supabase</td><td>Base de datos, cuentas y archivos</td><td>Servidores en Fráncfort (UE)</td></tr>
            <tr><td>Vercel</td><td>Alojamiento del sitio y medición anónima de visitas</td><td>Servidores en Fráncfort (UE); empresa de EE. UU.</td></tr>
            <tr><td>Stripe</td><td>Cobros y gestión de suscripciones</td><td>Stripe Payments Europe (Irlanda)</td></tr>
            <tr><td>Bunny.net</td><td>Alojamiento y emisión de los vídeos</td><td>BunnyWay (Eslovenia, UE)</td></tr>
            <tr><td>Resend</td><td>Envío de correos del estudio</td><td>EE. UU.</td></tr>
            <tr><td>Namecheap</td><td>Buzón de correo {TITULAR.correo}</td><td>EE. UU.</td></tr>
            <tr><td>Google</td><td>Solo si elegís entrar con tu cuenta de Google</td><td>Google Ireland (UE)</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Cuando un proveedor está en Estados Unidos o puede acceder a datos desde
        allí, la transferencia se ampara en el Marco de Privacidad de Datos
        UE-EE. UU. o en las cláusulas contractuales tipo aprobadas por la
        Comisión Europea.
      </p>
      <p>
        Las <strong>clases en vivo</strong> se dan por Zoom o Google Meet. Al
        entrar a la videollamada usás ese servicio con sus propias condiciones y
        su propia política de privacidad.
      </p>
      <p>
        También podemos comunicar datos a las autoridades cuando una ley lo
        exija (por ejemplo, a la Agencia Tributaria).
      </p>

      <h2>5. Cuánto tiempo los guardamos</h2>
      <ul>
        <li><strong>Cuenta, perfil, progreso y mensajes:</strong> mientras tengas la cuenta. Si pedís borrarla, se eliminan.</li>
        <li><strong>Pagos y facturación:</strong> el plazo que exige la ley fiscal y mercantil (hasta seis años), aunque borres la cuenta.</li>
        <li><strong>Avisos de clases nuevas:</strong> hasta que te des de baja.</li>
        <li><strong>Registros técnicos:</strong> el tiempo mínimo que guardan nuestros proveedores por seguridad, normalmente semanas.</li>
      </ul>

      <h2>6. Tus derechos</h2>
      <p>
        Podés pedir en cualquier momento <strong>acceder</strong> a tus datos,
        <strong> rectificarlos</strong>, <strong>suprimirlos</strong>,
        <strong> oponerte</strong> a su tratamiento, <strong>limitarlo</strong>
        o llevártelos en un formato estándar (<strong>portabilidad</strong>), y
        <strong> retirar el consentimiento</strong> que hayas dado, sin que eso
        afecte a lo hecho antes.
      </p>
      <p>
        Escribinos a <a href={`mailto:${TITULAR.correo}`}>{TITULAR.correo}</a>{" "}
        desde el correo de tu cuenta, diciendo qué derecho querés ejercer. Te
        respondemos en un plazo máximo de un mes. Tu nombre y tu foto también
        los podés cambiar vos misma desde tu perfil, y los avisos de clases
        nuevas los apagás desde el enlace que trae cada correo.
      </p>
      <p>
        Si creés que no tratamos bien tus datos, podés reclamar ante la Agencia
        Española de Protección de Datos (
        <a href="https://www.aepd.es" target="_blank" rel="noreferrer">www.aepd.es</a>).
      </p>

      <h2>7. Menores de edad</h2>
      <p>
        Para crear una cuenta hay que tener al menos 14 años. Las personas
        menores de 14 solo pueden usar el estudio con una cuenta creada y
        gestionada por su madre, padre o tutor legal, que es quien da el
        consentimiento. La contratación de planes y packs la tiene que hacer
        una persona mayor de edad.
      </p>

      <h2>8. Seguridad</h2>
      <p>
        Las contraseñas se guardan cifradas, todas las conexiones van por
        HTTPS, el acceso a cada contenido se controla en la propia base de datos
        según tu plan, y los vídeos se sirven con enlaces firmados que caducan.
      </p>

      <h2>9. Cookies</h2>
      <p>
        Usamos solo las cookies técnicas imprescindibles. El detalle está en la{" "}
        <Link href="/legal/cookies">Política de cookies</Link>.
      </p>

      <h2>10. Cambios en esta política</h2>
      <p>
        Si cambia algo importante, lo publicaremos acá con la fecha nueva y, si
        afecta a cómo usamos tus datos, te avisaremos por correo.
      </p>
    </PaginaLegal>
  );
}
