"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { signInAction } from "@/src/features/auth/actions";
import { OAuthButtons } from "@/components/oauth-buttons";
import { usePublicI18n } from "@/components/language-provider";

function SubmitButton() {
  const { pending } = useFormStatus();
  const { t } = usePublicI18n();

  return (
    <button className="auth-submit" type="submit" disabled={pending} style={{ opacity: pending ? 0.8 : 1 }}>
      {pending ? t("auth.pending") : t("auth.submit")}
    </button>
  );
}

type Props = {
  error: string | null;
  success: string | null;
  callbackUrl: string | null;
};

export function SignInForm({ error, success, callbackUrl }: Props) {
  const { t } = usePublicI18n();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="auth-form-wrap">
      <OAuthButtons callbackUrl={callbackUrl} />

      <div className="auth-divider">
        <div />
        <span>{t("auth.divider")}</span>
        <div />
      </div>

      <form action={signInAction} className="auth-form">
        {callbackUrl ? <input name="callbackUrl" type="hidden" value={callbackUrl} /> : null}

        <div>
          <label className="auth-label" htmlFor="email">
            {t("auth.email")}
          </label>
          <input
            id="email"
            name="email"
            className="auth-input"
            placeholder={t("auth.emailPlaceholder")}
            required
            autoComplete="email"
            type="email"
          />
        </div>

        <div>
          <div className="auth-password-head">
            <label className="auth-label" htmlFor="password">
              {t("auth.password")}
            </label>
            <Link href="/sign-in/forgot-password" className="auth-forgot">
              {t("auth.forgot")}
            </Link>
          </div>

          <div className="auth-password-field">
            <input
              id="password"
              name="password"
              className="auth-input"
              placeholder="********"
              required
              autoComplete="current-password"
              type={showPassword ? "text" : "password"}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              className="auth-eye-button"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {success ? <div className="auth-alert success">{success}</div> : null}
        {error ? <div className="auth-alert error">{error}</div> : null}

        <SubmitButton />

          {/* ⚠️ SIN ESTO NO HABIA FORMA DE REGISTRARSE DESDE ACA.
              El alta solo se alcanzaba eligiendo un plan en la portada. Quien
              llegaba directo a /sign-in -- enlace guardado, URL escrita a mano,
              o el link que le pasaron -- se quedaba sin salida.

              /registro ya funciona sin plan: muestra "podes elegir tu plan al
              terminar" y el onboarding termina en /dashboard/plan. */}
          <p className="auth-alt">
            {t("auth.noAccount")}{" "}
            <Link href="/registro" className="auth-alt-link">{t("auth.register")}</Link>
          </p>
        </form>

      {/* Estilos compartidos con /registro en app/estilos/acceso.css. */}
    </div>
  );
}
