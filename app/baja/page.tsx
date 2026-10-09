import { BellOff } from "lucide-react";
import { darDeBajaAction } from "@/src/features/auth/baja";

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

/**
 * Baja de los avisos de clase nueva.
 *
 * POR QUE EL ENLACE DEL CORREO NO DA DE BAJA SOLO
 *   Porque un GET no puede cambiar nada. Los antivirus de correo y las vistas
 *   previas de Gmail, Outlook y WhatsApp ABREN los enlaces de un mensaje para
 *   revisarlos, sin que la persona toque nada. Si la baja ocurriera al abrir la
 *   URL, esos robots darian de baja a media lista sola, y nadie entenderia por
 *   que dejaron de llegar los correos.
 *
 *   Por eso el enlace muestra esta pantalla y la baja se confirma con un boton,
 *   que envia un POST. Es un clic mas y es el que evita el desastre.
 */
export default async function BajaPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const token = typeof params.token === "string" ? params.token : "";
  const estado = typeof params.estado === "string" ? params.estado : "";

  const listo = estado === "listo";
  const fallo = estado === "error" || estado === "invalido";

  return (
    <main className="baja-page sistema">
      <span className="acc-mancha acc-mancha-1" aria-hidden />
      <span className="acc-mancha acc-mancha-2" aria-hidden />
      <section className="baja-card">
        <span className="acc-sola-ico baja-ico" aria-hidden>
          <BellOff size={22} strokeWidth={2.1} />
        </span>
        <p className="baja-kicker">Brunela Dance Trainer</p>

        {listo ? (
          <>
            <h1 className="baja-title">Listo<span>.</span></h1>
            <p className="baja-sub">
              No vas a recibir más avisos de clases nuevas. Tu cuenta y tu plan
              siguen exactamente igual: esto sólo apaga los correos.
            </p>
            <p className="baja-nota">
              Si te arrepentís, podés volver a activarlos desde tu perfil.
            </p>
            <a className="baja-btn-sec" href="/dashboard">Ir al estudio</a>
          </>
        ) : fallo ? (
          <>
            <h1 className="baja-title">No pudimos<br /><span>hacerlo.</span></h1>
            <p className="baja-sub">
              El enlace no es válido o ya venció. Escribile a Brunela desde el
              chat del estudio y lo resolvemos.
            </p>
            <a className="baja-btn-sec" href="/dashboard/chat">Abrir el chat</a>
          </>
        ) : !token ? (
          <>
            <h1 className="baja-title">Falta el<br /><span>enlace.</span></h1>
            <p className="baja-sub">
              Esta página se abre desde el enlace que va al final de cada correo.
              Probá entrando de nuevo desde ahí.
            </p>
            <a className="baja-btn-sec" href="/">Volver al inicio</a>
          </>
        ) : (
          <>
            <h1 className="baja-title">¿Dejamos de<br /><span>avisarte?</span></h1>
            <p className="baja-sub">
              Si confirmás, Brunela no te va a escribir más cuando suba una clase
              nueva. Tu cuenta y tu plan no cambian.
            </p>
            <form action={darDeBajaAction}>
              <input type="hidden" name="token" value={token} />
              <button type="submit" className="baja-btn">Sí, darme de baja</button>
            </form>
            <a className="baja-btn-sec" href="/dashboard">No, seguir recibiéndolos</a>
          </>
        )}
      </section>

      {/* Los estilos viven en app/estilos/acceso.css (bloque "Baja"). */}
    </main>
  );
}
