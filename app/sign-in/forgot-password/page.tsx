import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { requestPasswordResetAction } from "@/src/features/auth/actions";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/*
 * Pedir el enlace para cambiar la contraseña. Los estilos son los de las
 * pantallas de acceso (app/estilos/acceso.css): bloque "Pantallas sueltas" y
 * las clases auth-* del formulario, compartidas con el ingreso y el registro.
 */
export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : null;
  const success = typeof params.success === "string" ? params.success : null;

  return (
    <main className="acc-sola sistema">
      <span className="acc-mancha acc-mancha-1" aria-hidden />
      <span className="acc-mancha acc-mancha-2" aria-hidden />

      <div className="acc-sola-col">
        <Link href="/sign-in" className="acc-sola-volver">
          <ArrowLeft size={15} strokeWidth={2.4} aria-hidden />
          Volver al ingreso
        </Link>

        <div className="acc-sola-card">
          <span className="acc-sola-ico" aria-hidden>
            <Mail size={22} strokeWidth={2.1} />
          </span>

          <p className="acc-sola-kicker">Recuperar acceso</p>
          <h1 className="acc-sola-titulo">Restablecer contraseña</h1>
          <p className="acc-sola-lead">
            Ingresá tu email y te enviamos un enlace seguro. Vence en 60 minutos.
          </p>

          {success ? (
            <div className="auth-alert success acc-sola-ok">
              <p>{success}</p>
              <Link href="/sign-in" className="auth-submit acc-sola-ok-btn">
                Ir al ingreso
              </Link>
            </div>
          ) : (
            <form action={requestPasswordResetAction} className="auth-form">
              <div>
                <label className="auth-label" htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  className="auth-input"
                  placeholder="tu@email.com"
                  required
                  autoComplete="email"
                  type="email"
                />
              </div>

              {error ? <div className="auth-alert error">{error}</div> : null}

              <button className="auth-submit" type="submit">
                Enviar enlace
              </button>
            </form>
          )}
        </div>

        <p className="acc-sola-pie">
          Si la cuenta no existe, el sistema no lo va a revelar, por privacidad.
        </p>
      </div>
    </main>
  );
}
