"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { signInAction } from "@/src/features/auth/actions";
import { OAuthButtons } from "@/components/oauth-buttons";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="button-primary w-full"
      type="submit"
      disabled={pending}
      style={{ opacity: pending ? 0.8 : 1 }}
    >
      {pending ? "Ingresando..." : "Iniciar sesion"}
    </button>
  );
}

type Props = {
  error: string | null;
  success: string | null;
  callbackUrl: string | null;
};

export function SignInForm({ error, success, callbackUrl }: Props) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <OAuthButtons callbackUrl={callbackUrl} />

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.9rem", margin: "1.4rem 0" }}>
        <div style={{ flex: 1, height: "1px", background: "#f0e4ee" }} />
        <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#b09aab", whiteSpace: "nowrap" }}>
          o con email
        </span>
        <div style={{ flex: 1, height: "1px", background: "#f0e4ee" }} />
      </div>

      <form action={signInAction} className="form-shell">
        {callbackUrl ? <input name="callbackUrl" type="hidden" value={callbackUrl} /> : null}

        <div>
          <label className="field-label" htmlFor="email">Email</label>
          <input
            id="email" name="email"
            placeholder="tu@email.com"
            required autoComplete="email" type="email"
          />
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.55rem" }}>
            <label className="field-label" style={{ marginBottom: 0 }} htmlFor="password">
              Contrasena
            </label>
            <Link
              href="/sign-in/forgot-password"
              style={{ fontSize: "0.72rem", color: "#be185d", fontWeight: 600, textDecoration: "none" }}
            >
              Olvide mi contrasena
            </Link>
          </div>
          <div style={{ position: "relative" }}>
            <input
              id="password" name="password"
              placeholder="••••••••"
              required autoComplete="current-password"
              type={showPassword ? "text" : "password"}
              style={{ paddingRight: "3rem" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
              style={{
                position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "#b09aab",
                display: "flex", alignItems: "center", padding: "0.25rem",
              }}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {success ? (
          <div style={{ borderRadius: 12, border: "1px solid #bbf7d0", background: "#f0fdf4", padding: "0.85rem 1rem", fontSize: "0.82rem", fontWeight: 600, color: "#15803d" }}>
            {success}
          </div>
        ) : null}

        {error ? (
          <div style={{ borderRadius: 12, border: "1px solid rgba(217,105,119,0.3)", background: "rgba(255,238,242,0.95)", padding: "0.85rem 1rem", fontSize: "0.82rem", fontWeight: 600, color: "#b83251" }}>
            {error}
          </div>
        ) : null}

        <SubmitButton />
      </form>
    </div>
  );
}
