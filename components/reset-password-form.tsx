"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { updatePasswordAction } from "@/src/features/auth/actions";

type Props = { error: string | null };

export function ResetPasswordForm({ error }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      updatePasswordAction(formData);
    });
  }

  // Mismas clases que el ingreso y el registro (app/estilos/acceso.css).
  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <div>
        <label className="auth-label" htmlFor="password">
          Nueva contraseña
        </label>
        <div className="auth-password-field">
          <input
            id="password"
            name="password"
            className="auth-input"
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete="new-password"
            type={showPassword ? "text" : "password"}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="auth-eye-button"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div>
        <label className="auth-label" htmlFor="confirmPassword">
          Confirmar contraseña
        </label>
        <div className="auth-password-field">
          <input
            id="confirmPassword"
            name="confirmPassword"
            className="auth-input"
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete="new-password"
            type={showConfirm ? "text" : "password"}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="auth-eye-button"
          >
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {error ? <div className="auth-alert error">{error}</div> : null}

      <button className="auth-submit" type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Guardar contraseña"}
      </button>

      <Link href="/sign-in" className="auth-cancelar">
        Cancelar y volver al ingreso
      </Link>
    </form>
  );
}
