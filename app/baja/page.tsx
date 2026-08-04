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
    <main className="baja-page">
      <section className="baja-card">
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

      <style>{`
        .baja-page {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          padding: 28px 20px;
          background:
            radial-gradient(1100px 520px at 12% -8%, var(--pink-wash) 0%, transparent 60%),
            radial-gradient(900px 480px at 105% 108%, var(--pink-soft) 0%, transparent 62%),
            #fffdfd;
        }
        .baja-card {
          width: min(480px, 100%);
          background: rgba(255,255,255,0.95);
          border: 1.5px solid var(--pink-soft);
          border-radius: 28px; padding: 36px 32px 30px;
          box-shadow: 0 26px 70px rgba(28,25,23,0.09);
          text-align: center;
        }
        .baja-kicker {
          font-size: 10px; font-weight: 900; letter-spacing: 0.2em;
          text-transform: uppercase; color: var(--pink);
        }
        .baja-title {
          font-family: var(--font-display), sans-serif;
          font-size: 34px; line-height: 1.12; font-weight: 800;
          color: var(--ink); margin: 14px 0 0;
        }
        .baja-title span { color: var(--pink); font-style: italic; }
        .baja-sub {
          margin: 14px 0 0; font-size: 13.5px; color: var(--muted); line-height: 1.7;
        }
        .baja-nota {
          margin: 10px 0 0; font-size: 12px; color: var(--pink-muted); line-height: 1.6;
        }
        .baja-btn {
          width: 100%; min-height: 52px; margin-top: 24px;
          border: 0; border-radius: 999px;
          background: var(--pink); color: #fff; cursor: pointer;
          font-family: var(--font-body), sans-serif; font-size: 0.72rem;
          font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase;
          box-shadow: 0 18px 34px rgba(230, 79, 85, 0.26);
        }
        .baja-btn-sec {
          display: inline-flex; align-items: center; justify-content: center;
          min-height: 44px; margin-top: 12px;
          color: var(--pink-deep); font-size: 13px; font-weight: 700;
          text-decoration: none;
        }
        @media (max-width: 520px) {
          .baja-card { padding: 28px 20px 24px; border-radius: 22px; }
          .baja-title { font-size: 28px; }
        }
      `}</style>
    </main>
  );
}
