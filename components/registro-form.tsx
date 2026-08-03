"use client";

import { useState } from "react";
import { signUpAction } from "@/src/features/auth/registro";

type Props = {
  error?: string | null;
  plan?: string | null;
  interval?: string | null;
  /** Se devuelve prellenado cuando el alta falla, para no hacerla tipear de nuevo. */
  email?: string | null;
};

export function RegistroForm({ error, plan, interval, email }: Props) {
  const [enviando, setEnviando] = useState(false);
  const [verClave, setVerClave] = useState(false);

  return (
    <form action={signUpAction} onSubmit={() => setEnviando(true)} className="auth-form">
      {/* El plan y el intervalo elegidos en la landing viajan escondidos hasta
          signUpAction, que los guarda en user_metadata. */}
      {plan && <input type="hidden" name="plan" value={plan} />}
      {interval && <input type="hidden" name="interval" value={interval} />}

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
        <span style={{ position: "relative", display: "block" }}>
          <input
            name="password"
            type={verClave ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Al menos 8 caracteres"
            className="auth-input"
            style={{ paddingRight: 76 }}
          />
          <button
            type="button"
            onClick={() => setVerClave((v) => !v)}
            style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 700, color: "var(--pink-deep)",
              letterSpacing: "0.04em",
            }}
          >
            {verClave ? "Ocultar" : "Ver"}
          </button>
        </span>
      </label>

      <button type="submit" className="auth-submit" disabled={enviando}>
        {enviando ? "Creando tu cuenta…" : "Crear cuenta"}
      </button>

      {/* Mismos nombres y valores que el bloque de sign-in-form.tsx: las dos
          pantallas tienen que verse como la misma puerta. Estan duplicados
          porque en este proyecto cada pantalla de auth lleva su propio <style>;
          unificarlos en globals.css es una limpieza aparte. */}
      <style>{`
        .auth-form { display: grid; gap: 1.08rem; width: 100%; }
        .auth-field { display: block; }
        .auth-label {
          display: block; margin-bottom: 0.55rem; color: var(--pink);
          font-size: 0.72rem; font-weight: 900; letter-spacing: 0.1em;
          line-height: 1; text-transform: uppercase;
        }
        .auth-input {
          display: block; width: 100%; min-height: 54px;
          border: 1.5px solid #F4D5DF; border-radius: 14px; background: #fff;
          color: #2A171B; padding: 0.92rem 1rem;
          font-family: var(--font-body), sans-serif; font-size: 0.95rem;
          outline: none; box-shadow: 0 10px 26px rgba(217, 52, 56, 0.035);
          transition: border-color 170ms ease, box-shadow 170ms ease;
        }
        .auth-input:focus {
          border-color: var(--pink);
          box-shadow: 0 0 0 4px rgba(230, 79, 85, 0.1);
        }
        .auth-input::placeholder { color: #B7A4AD; }
        .auth-submit {
          display: inline-flex; align-items: center; justify-content: center;
          width: 100%; min-height: 52px; border: 0; border-radius: 999px;
          background: var(--pink); color: #fff; padding: 0.85rem 1.1rem;
          font-family: var(--font-body), sans-serif; font-size: 0.72rem;
          font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase;
          box-shadow: 0 18px 34px rgba(230, 79, 85, 0.26); cursor: pointer;
        }
        .auth-submit:disabled { opacity: 0.65; cursor: default; }
        .auth-alert {
          border-radius: 14px; padding: 0.85rem 1rem; font-size: 0.82rem;
          font-weight: 700; line-height: 1.4;
        }
        .auth-alert.error {
          border: 1px solid rgba(217, 105, 119, 0.3);
          background: rgba(255, 238, 242, 0.95);
          color: var(--pink-deep);
        }
      `}</style>
    </form>
  );
}
