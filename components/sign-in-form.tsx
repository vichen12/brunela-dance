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
      </form>

      <style>{`
        .auth-form-wrap {
          width: 100%;
        }

        .auth-divider {
          display: flex;
          align-items: center;
          gap: 0.9rem;
          margin: 1.35rem 0;
        }

        .auth-divider div {
          flex: 1;
          height: 1px;
          background: #F0DDE6;
        }

        .auth-divider span {
          color: #B39EAA;
          font-size: 0.64rem;
          font-weight: 900;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .auth-form {
          display: grid;
          gap: 1.08rem;
          width: 100%;
        }

        .auth-label {
          display: block;
          margin-bottom: 0.55rem;
          color: #E64F55;
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          line-height: 1;
          text-transform: uppercase;
        }

        .auth-input {
          display: block;
          width: 100%;
          min-height: 54px;
          border: 1.5px solid #F4D5DF;
          border-radius: 14px;
          background: #fff;
          color: #2A171B;
          padding: 0.92rem 1rem;
          font-family: var(--font-body), sans-serif;
          font-size: 0.95rem;
          outline: none;
          box-shadow: 0 10px 26px rgba(217, 52, 56, 0.035);
          transition: border-color 170ms ease, box-shadow 170ms ease;
        }

        .auth-input:focus {
          border-color: #E64F55;
          box-shadow: 0 0 0 4px rgba(230, 79, 85, 0.1);
        }

        .auth-input::placeholder {
          color: #B7A4AD;
        }

        .auth-password-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 0.55rem;
        }

        .auth-password-head .auth-label {
          margin-bottom: 0;
        }

        .auth-forgot {
          color: #D92E72;
          font-size: 0.72rem;
          font-weight: 800;
          text-decoration: none;
          white-space: nowrap;
        }

        .auth-password-field {
          position: relative;
        }

        .auth-password-field .auth-input {
          padding-right: 3.1rem;
        }

        .auth-eye-button {
          position: absolute;
          right: 0.95rem;
          top: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2rem;
          height: 2rem;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: #B39EAA;
          cursor: pointer;
          transform: translateY(-50%);
        }

        .auth-submit {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 52px;
          border: 0;
          border-radius: 999px;
          background: #E64F55;
          color: #fff;
          padding: 0.85rem 1.1rem;
          font-family: var(--font-body), sans-serif;
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          box-shadow: 0 18px 34px rgba(230, 79, 85, 0.26);
          cursor: pointer;
          transition: transform 170ms ease, box-shadow 170ms ease, background 170ms ease;
        }

        .auth-submit:hover {
          background: #D93438;
          box-shadow: 0 22px 40px rgba(217, 52, 56, 0.3);
          transform: translateY(-1px);
        }

        .auth-alert {
          border-radius: 14px;
          padding: 0.85rem 1rem;
          font-size: 0.82rem;
          font-weight: 700;
          line-height: 1.4;
        }

        .auth-alert.success {
          border: 1px solid #BBF7D0;
          background: #F0FDF4;
          color: #15803D;
        }

        .auth-alert.error {
          border: 1px solid rgba(217, 105, 119, 0.3);
          background: rgba(255, 238, 242, 0.95);
          color: #B83251;
        }

        @media (max-height: 680px) {
          .auth-divider {
            margin: 0.85rem 0;
          }

          .auth-form {
            gap: 0.82rem;
          }

          .auth-label {
            margin-bottom: 0.42rem;
            font-size: 0.66rem;
          }

          .auth-input {
            min-height: 46px;
            padding-top: 0.72rem;
            padding-bottom: 0.72rem;
          }

          .auth-submit {
            min-height: 46px;
          }

          .auth-password-head {
            margin-bottom: 0.42rem;
          }
        }
      `}</style>
    </div>
  );
}
