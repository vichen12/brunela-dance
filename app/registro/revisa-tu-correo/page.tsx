import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { reenviarConfirmacionAction } from "@/src/features/auth/registro";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/*
 * Despues de crear la cuenta, con "Confirm email" encendido: Supabase no da
 * sesion hasta que confirme el correo. Antes se volvia al formulario con el
 * aviso en el recuadro rojo de error y los datos cargados, y parecia que el
 * registro habia fallado. Estilos: app/estilos/acceso.css, "Pantallas sueltas".
 */
export default async function RevisaTuCorreoPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const str = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  const email = str("email");
  const enviado = str("enviado") === "1";
  const error = str("error");

  return (
    <main className="acc-sola sistema">
      <span className="acc-mancha acc-mancha-1" aria-hidden />
      <span className="acc-mancha acc-mancha-2" aria-hidden />

      <div className="acc-sola-col">
        <Link href="/" className="acc-sola-volver">
          <ArrowLeft size={15} strokeWidth={2.4} aria-hidden />
          Volver al inicio
        </Link>

        <div className="acc-sola-card">
          <span className="acc-sola-ico" aria-hidden>
            <MailCheck size={22} strokeWidth={2.1} />
          </span>

          <p className="acc-sola-kicker">Último paso</p>
          <h1 className="acc-sola-titulo">Revisá tu correo</h1>
          <p className="acc-sola-lead">
            Te mandamos un enlace a{" "}
            {email ? <strong style={{ color: "var(--ink)" }}>{email}</strong> : "tu correo"}.
            Tocá <strong style={{ color: "var(--ink)" }}>«Confirmar mi correo»</strong> y
            entrás directo al estudio. Podés abrirlo desde el celular o la compu.
          </p>
          <p className="acc-sola-lead" style={{ marginTop: 10 }}>
            ¿No lo ves? Fijate en <strong style={{ color: "var(--ink)" }}>Spam</strong> o{" "}
            <strong style={{ color: "var(--ink)" }}>Promociones</strong>. Llega desde
            no-responder@bruneladance.com.
          </p>

          {enviado ? <div className="auth-alert success" style={{ marginTop: 18 }}>Listo, te lo mandamos de nuevo.</div> : null}
          {error ? <div className="auth-alert error" style={{ marginTop: 18 }}>{error}</div> : null}

          {email ? (
            <form action={reenviarConfirmacionAction} className="auth-form" style={{ marginTop: 18 }}>
              <input type="hidden" name="email" value={email} />
              <button className="auth-submit" type="submit">Reenviar el correo</button>
            </form>
          ) : null}
        </div>

        <p className="acc-sola-pie">
          ¿Pusiste mal el correo? <Link href="/registro">Creá la cuenta de nuevo</Link>.
        </p>
      </div>
    </main>
  );
}
