"use client";

import { createContext, Fragment, useContext, useEffect, useMemo, useState } from "react";
import {
  defaultPublicLocale,
  localeNames,
  publicLocales,
  publicMessages,
  type PublicLocale,
  type PublicMessageKey,
} from "@/src/i18n/public";

type Replacements = Record<string, string | number>;

type PublicI18nContextValue = {
  locale: PublicLocale;
  setLocale: (locale: PublicLocale) => void;
  t: (key: PublicMessageKey, replacements?: Replacements) => string;
};

const PublicI18nContext = createContext<PublicI18nContextValue | null>(null);

function resolveLocale(value: string | null | undefined): PublicLocale {
  const short = value?.slice(0, 2).toLowerCase();
  return publicLocales.includes(short as PublicLocale) ? (short as PublicLocale) : defaultPublicLocale;
}

export function PublicLanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<PublicLocale>(defaultPublicLocale);

  useEffect(() => {
    const stored = window.localStorage.getItem("brunela-locale");
    setLocaleState(resolveLocale(stored ?? window.navigator.language));
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem("brunela-locale", locale);
  }, [locale]);

  const value = useMemo<PublicI18nContextValue>(
    () => ({
      locale,
      setLocale: setLocaleState,
      t: (key, replacements) => {
        let text = publicMessages[locale][key] ?? publicMessages[defaultPublicLocale][key] ?? key;

        if (replacements) {
          for (const [name, replacement] of Object.entries(replacements)) {
            text = text.replaceAll(`{${name}}`, String(replacement));
          }
        }

        return text;
      },
    }),
    [locale]
  );

  return <PublicI18nContext.Provider value={value}>{children}</PublicI18nContext.Provider>;
}

export function usePublicI18n() {
  const context = useContext(PublicI18nContext);

  if (!context) {
    throw new Error("usePublicI18n must be used inside PublicLanguageProvider");
  }

  return context;
}

export function T({ id, replacements }: { id: PublicMessageKey; replacements?: Replacements }) {
  const { t } = usePublicI18n();
  return <>{t(id, replacements)}</>;
}

export function TLines({ id }: { id: PublicMessageKey }) {
  const { t } = usePublicI18n();
  const lines = t(id).split("\n");

  return (
    <>
      {lines.map((line, index) => (
        <Fragment key={`${line}-${index}`}>
          {line}
          {index < lines.length - 1 ? <br /> : null}
        </Fragment>
      ))}
    </>
  );
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = usePublicI18n();

  return (
    <div
      className={compact ? "language-switcher compact" : "language-switcher"}
      aria-label="Selector de idioma"
      role="group"
    >
      {publicLocales.map((item) => (
        <button
          key={item}
          type="button"
          className={locale === item ? "is-active" : ""}
          aria-pressed={locale === item}
          onClick={() => setLocale(item)}
        >
          {localeNames[item]}
        </button>
      ))}

      <style>{`
        .language-switcher {
          display: inline-flex;
          align-items: center;
          gap: 0.15rem;
          border: 1px solid rgba(230, 79, 85, 0.18);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.82);
          padding: 0.18rem;
          box-shadow: 0 10px 28px rgba(217, 52, 56, 0.08);
          backdrop-filter: blur(14px);
        }

        .language-switcher button {
          min-width: 2.05rem;
          min-height: 2rem;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: #D93438;
          padding: 0 0.48rem;
          font-family: var(--font-body), sans-serif;
          font-size: 0.58rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          cursor: pointer;
          transition: background 160ms ease, color 160ms ease, transform 160ms ease;
        }

        .language-switcher button:hover {
          transform: translateY(-1px);
        }

        .language-switcher button.is-active {
          background: #E64F55;
          color: #fff;
        }

        .language-switcher.compact {
          box-shadow: none;
        }

        .language-switcher.compact button {
          min-width: 1.8rem;
          min-height: 1.8rem;
          font-size: 0.54rem;
          padding-inline: 0.35rem;
        }
      `}</style>
    </div>
  );
}
