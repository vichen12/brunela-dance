import { LockKeyhole } from "lucide-react";
import { ResetPasswordForm } from "@/components/reset-password-form";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/*
 * Elegir la contraseña nueva (se llega desde el enlace del correo). Estilos en
 * app/estilos/acceso.css, bloque "Pantallas sueltas".
 */
export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <main className="acc-sola sistema">
      <span className="acc-mancha acc-mancha-1" aria-hidden />
      <span className="acc-mancha acc-mancha-2" aria-hidden />

      <div className="acc-sola-col">
        <div className="acc-sola-card">
          <span className="acc-sola-ico" aria-hidden>
            <LockKeyhole size={22} strokeWidth={2.1} />
          </span>

          <p className="acc-sola-kicker">Nueva contraseña</p>
          <h1 className="acc-sola-titulo">Acceso renovado</h1>
          <p className="acc-sola-lead">
            Elegí una contraseña segura: mínimo 8 caracteres, con letras y números.
          </p>

          <ResetPasswordForm error={error} />
        </div>
      </div>
    </main>
  );
}
