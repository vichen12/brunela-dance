import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { COOKIE_CAMBIO_CLAVE, puedeCambiarClave } from "@/src/features/auth/permiso-cambio-clave";

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

  // 🔴 Y con sesion tampoco alcanza: tiene que ser la sesion que ACABA de
  // validar el enlace del correo (src/features/auth/permiso-cambio-clave.ts).
  // Si no, una admin logueada que abre la invitacion de una alumna le cambiaba
  // la contraseña a su PROPIA cuenta.
  const permiso = (await cookies()).get(COOKIE_CAMBIO_CLAVE)?.value;
  const habilitado = Boolean(user) && puedeCambiarClave(permiso, user?.id);

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

          {user && habilitado ? (
            <>
              {/* De QUE cuenta es la contraseña, a la vista. Si alguien tenia
                  otra sesion abierta, lo ve antes de escribir (ver el
                  comentario de app/auth/confirm/route.ts). */}
              <p className="acc-sola-lead" style={{ marginTop: 10 }}>
                Cuenta: <strong style={{ color: "var(--ink)", overflowWrap: "anywhere" }}>{user.email}</strong>
              </p>
              <ResetPasswordForm error={error} />
            </>
          ) : user ? (
            <>
              <p className="acc-sola-lead" role="alert">
                Para elegir una contraseña nueva tenés que abrir el enlace que te
                llegó por correo. Acá no se puede cambiar la contraseña de la
                cuenta que ya está abierta en este navegador
                (<strong style={{ color: "var(--ink)", overflowWrap: "anywhere" }}>{user.email}</strong>).
              </p>
              <p className="acc-sola-lead">
                Si estás probando una invitación, abrila en una ventana de incógnito.
              </p>
              <Link href="/sign-in/forgot-password" className="auth-submit" style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", marginTop: 18 }}>
                Pedir un enlace por correo
              </Link>
            </>
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
