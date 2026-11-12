"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * El boton lee el estado del formulario (2026-11-12). Antes un useState se
 * prendia al enviar y nunca se apagaba: si el alta volvia con un error, el
 * boton quedaba en "Creando tu cuenta..." y no se podia reintentar.
 */
function BotonCrear() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="auth-submit" disabled={pending}>
      {pending ? "Creando tu cuenta…" : "Crear cuenta"}
    </button>
  );
}
import { signUpAction } from "@/src/features/auth/registro";

type Props = {
  error?: string | null;
  plan?: string | null;
  interval?: string | null;
  pack?: string | null;
  /** Se devuelve prellenado cuando el alta falla, para no hacerla tipear de nuevo. */
  email?: string | null;
};

export function RegistroForm({ error, plan, interval, pack, email }: Props) {
  const [verClave, setVerClave] = useState(false);

  return (
    <form action={signUpAction} className="auth-form">
      {/* El plan y el intervalo elegidos en la landing viajan escondidos hasta
          signUpAction, que los guarda en user_metadata. */}
      {plan && <input type="hidden" name="plan" value={plan} />}
      {interval && <input type="hidden" name="interval" value={interval} />}
      {/* Un pack se compra sin plan: viaja solo, por su cuenta. */}
      {pack && <input type="hidden" name="pack" value={pack} />}

      {error && (
        <p className="auth-alert error" role="alert">
          {error}
        </p>
      )}

      <label className="auth-field">
        <span className="auth-label">Nombre</span>
        <input
          name="fullName"
          type="text"
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
          placeholder="Como querés que te llamemos"
          className="auth-input"
        />
      </label>

      <label className="auth-field">
        <span className="auth-label">Correo</span>
        <input
          name="email"
          type="email"
          required
          defaultValue={email ?? ""}
          autoComplete="email"
          placeholder="vos@correo.com"
          className="auth-input"
        />
      </label>

      <label className="auth-field">
        <span className="auth-label">Contraseña</span>
        <span className="auth-password-field">
          <input
            name="password"
            type={verClave ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Al menos 8 caracteres"
            className="auth-input auth-input-con-boton"
          />
          <button
            type="button"
            onClick={() => setVerClave((v) => !v)}
            className="auth-ver-clave"
          >
            {verClave ? "Ocultar" : "Ver"}
          </button>
        </span>
      </label>

      <BotonCrear />

      {/* Mismas clases que sign-in-form.tsx: las dos pantallas tienen que
          verse como la misma puerta. El CSS antes estaba duplicado en los dos
          archivos (deuda anotada en CLAUDE.md); desde el rediseño vive una
          sola vez en app/estilos/acceso.css. */}
    </form>
  );
}
