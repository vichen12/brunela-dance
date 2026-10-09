import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

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

  // Sin sesion no se puede cambiar la contraseña: se avisa ANTES de que la
  // escriba, en vez de dejarla completar el formulario y fallar al guardar
  // con "Auth session missing!". Pasa si el enlace del correo vencio o ya se
  // uso, o si entro a esta direccion a mano.
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

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

          {user ? (
            <ResetPasswordForm error={error} />
          ) : (
            <>
              <p className="acc-sola-lead" role="alert">
                Este enlace ya venció o ya se usó. Pedí uno nuevo y abrí el
                último correo que te llegue.
              </p>
              <Link href="/sign-in/forgot-password" className="auth-submit" style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", marginTop: 18 }}>
                Pedir un enlace nuevo
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
