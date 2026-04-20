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

  return (
    <form onSubmit={handleSubmit} className="form-shell mt-8">
      <div>
        <label className="field-label" htmlFor="password">
          Nueva contrasena
        </label>
        <div style={{ position: "relative" }}>
          <input
            id="password"
            name="password"
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete="new-password"
            type={showPassword ? "text" : "password"}
            style={{ paddingRight: "3rem" }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
            style={{
              position: "absolute", right: "1rem", top: "50%",
              transform: "translateY(-50%)", background: "none",
              border: "none", cursor: "pointer", color: "var(--muted)",
              display: "flex", alignItems: "center", padding: "0.25rem"
            }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="confirmPassword">
          Confirmar contrasena
        </label>
        <div style={{ position: "relative" }}>
          <input
            id="confirmPassword"
            name="confirmPassword"
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete="new-password"
            type={showConfirm ? "text" : "password"}
            style={{ paddingRight: "3rem" }}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? "Ocultar contrasena" : "Mostrar contrasena"}
            style={{
              position: "absolute", right: "1rem", top: "50%",
              transform: "translateY(-50%)", background: "none",
              border: "none", cursor: "pointer", color: "var(--muted)",
              display: "flex", alignItems: "center", padding: "0.25rem"
            }}
          >
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ borderRadius: 12, border: "1px solid rgba(217,105,119,0.3)", background: "rgba(255,238,242,0.95)", padding: "0.85rem 1rem", fontSize: "0.82rem", fontWeight: 600, color: "#b83251" }}>
          {error}
        </div>
      ) : null}

      <button
        className="button-primary w-full"
        type="submit"
        disabled={pending}
        style={{ opacity: pending ? 0.8 : 1 }}
      >
        {pending ? "Guardando..." : "Guardar contrasena"}
      </button>

      <Link href="/sign-in" style={{ display: "block", textAlign: "center", fontSize: "0.78rem", color: "#9d8a98", marginTop: "0.25rem", textDecoration: "none" }}>
        Cancelar y volver al ingreso
      </Link>
    </form>
  );
}
