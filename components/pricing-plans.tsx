"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { usePublicI18n } from "@/components/language-provider";
import type { PublicLocale, PublicMessageKey } from "@/src/i18n/public";

type BillingMode = "monthly" | "annual";

type Plan = {
  name: string;
  price: string;
  annual: string;
  badge: string | null;
  featured: boolean;
  oneLine: string;
  includes: readonly string[];
};

type PricingPlansProps = {
  plans: readonly Plan[];
};

const numberLocales: Record<PublicLocale, string> = {
  es: "es-ES",
  en: "en-US",
  fr: "fr-FR",
  it: "it-IT",
};

const formatEuro = (value: number, locale: PublicLocale, maxDigits = 1) =>
  value.toLocaleString(numberLocales[locale], {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: maxDigits,
  });

export function PricingPlans({ plans }: PricingPlansProps) {
  const { locale, t } = usePublicI18n();
  const [billing, setBilling] = useState<BillingMode>("monthly");

  const normalizedPlans = useMemo(
    () =>
      plans.map((plan) => {
        const monthly = Number(plan.price.replace(",", "."));
        const yearly = Number(plan.annual.replace(",", "."));
        const annualMonthly = yearly / 12;
        const savings = Math.max(monthly * 12 - yearly, 0);
        const savingsPercent = monthly > 0 ? Math.round((savings / (monthly * 12)) * 100) : 0;

        return {
          ...plan,
          monthlyLabel: formatEuro(monthly, locale, 0),
          annualMonthlyLabel: formatEuro(annualMonthly, locale, 1),
          yearlyLabel: formatEuro(yearly, locale, 2),
          savingsPercent,
        };
      }),
    [plans, locale]
  );

  return (
    <div className="classic-pricing">
      <div className="pricing-toggle-row">
        <div className="pricing-toggle" role="group" aria-label={t("pricing.aria")}>
          <button
            type="button"
            className={`pricing-toggle-option ${billing === "monthly" ? "is-active" : ""}`}
            aria-pressed={billing === "monthly"}
            onClick={() => setBilling("monthly")}
          >
            {t("pricing.monthly")}
          </button>
          <button
            type="button"
            className="pricing-toggle-switch"
            aria-label={billing === "monthly" ? t("pricing.annual") : t("pricing.monthly")}
            aria-pressed={billing === "annual"}
            onClick={() => setBilling((current) => (current === "monthly" ? "annual" : "monthly"))}
          />
          <button
            type="button"
            className={`pricing-toggle-option ${billing === "annual" ? "is-active" : ""}`}
            aria-pressed={billing === "annual"}
            onClick={() => setBilling("annual")}
          >
            {t("pricing.annual")}
          </button>
        </div>

        <div className="pricing-save-note" aria-hidden="true">
          <svg viewBox="0 0 92 34" fill="none">
            <path
              d="M4 17c15 0 20 11 35 9 17-2 20-21 11-22-8-1-10 15 6 18 11 2 20-2 31-10"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="3"
            />
            <path
              d="M7 13 3 17l5 3"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
            />
          </svg>
          <span>{t("pricing.save")}!</span>
        </div>
      </div>

      <div className="classic-plan-grid">
        {normalizedPlans.map((plan, index) => {
          const price = billing === "monthly" ? plan.monthlyLabel : plan.annualMonthlyLabel;
          const planNumber = index + 1;
          const badge = plan.badge && planNumber > 1 ? t(`plan${planNumber}.badge` as PublicMessageKey) : null;
          const oneLine = t(`plan${planNumber}.oneLine` as PublicMessageKey);
          const includes = [1, 2, 3, 4].map((item) => t(`plan${planNumber}.include${item}` as PublicMessageKey));

          return (
            <div className="classic-plan-stack" key={plan.name}>
              <div className="classic-plan-badge-slot">
                {badge ? <span className="classic-plan-badge">{badge}</span> : null}
              </div>

              <article className={`classic-plan-card ${plan.featured ? "is-featured" : ""}`}>
                <div className="classic-plan-head">
                  <h3>{plan.name}</h3>
                  <p>{oneLine}</p>
                </div>

                <div className="classic-plan-price">
                  <strong>{price}</strong>
                  <span>{t("pricing.perMonth")}</span>
                </div>

                {billing === "annual" ? (
                  <p className="classic-plan-note">
                    {t("pricing.annualNote", { yearly: plan.yearlyLabel, savings: plan.savingsPercent })}
                  </p>
                ) : null}

                <ul className="classic-plan-list">
                  {includes.map((item) => (
                    <li key={item}>
                      <CheckCircle2 size={17} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/sign-in" className="classic-plan-action" suppressHydrationWarning>
                  {t("pricing.action")}
                </Link>
              </article>
            </div>
          );
        })}
      </div>

      <style>{`
        .classic-pricing {
          width: min(1120px, 100%);
          margin: 0 auto;
        }

        .pricing-toggle-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          width: 100%;
          margin: 0 auto 2.5rem;
        }

        .pricing-toggle {
          width: min(560px, 100%);
          margin: 0 auto 2.5rem;
          display: grid;
          grid-template-columns: repeat(2, minmax(128px, 1fr));
          gap: 0.8rem;
        }

        .pricing-toggle button {
          min-height: 74px;
          border: 1px solid rgba(255,218,218,0.92);
          border-radius: 22px;
          background: linear-gradient(135deg, #FEFAF7 0%, #fff 100%);
          color: #D93438;
          padding: 0.82rem 1rem;
          transition: background 180ms ease, color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
          box-shadow: 0 1px 0 rgba(255,218,218,0.5) inset, 0 14px 36px rgba(217, 52, 56, 0.07);
        }

        .pricing-toggle button:hover {
          transform: translateY(-1px);
          border-color: rgba(230, 79, 85, 0.34);
          box-shadow: 0 1px 0 rgba(255,218,218,0.5) inset, 0 20px 46px rgba(217, 52, 56, 0.11);
        }

        .pricing-toggle button.is-active {
          border-color: transparent;
          background: #E64F55;
          color: #fff;
          box-shadow: 0 12px 28px rgba(230, 79, 85, 0.24);
        }

        .pricing-toggle strong {
          display: block;
          font-size: 0.74rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .pricing-toggle span {
          display: block;
          max-width: 18ch;
          margin: 0.28rem auto 0;
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.01em;
          line-height: 1.25;
          opacity: 0.78;
        }

        .pricing-toggle {
          position: relative;
          width: min(460px, 100%);
          display: inline-grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 0.55rem;
          margin: 0;
          border: 1px solid rgba(217, 52, 56, 0.14);
          border-radius: 999px;
          background: linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(255,240,244,0.82) 100%);
          padding: 0.68rem 1rem;
          box-shadow: 0 20px 54px rgba(217, 52, 56, 0.12), inset 0 1px 0 rgba(255,255,255,0.82);
        }

        .pricing-toggle .pricing-toggle-option {
          min-height: 34px;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: #9A6B77;
          padding: 0.3rem;
          box-shadow: none;
          font-size: 0.95rem;
          font-weight: 800;
          line-height: 1;
          transition: color 180ms ease, transform 180ms ease;
        }

        .pricing-toggle .pricing-toggle-option:hover {
          border-color: transparent;
          box-shadow: none;
          transform: translateY(-1px);
        }

        .pricing-toggle .pricing-toggle-option.is-active {
          border-color: transparent;
          background: transparent;
          color: #2A171B;
          box-shadow: none;
        }

        .pricing-toggle .pricing-toggle-switch {
          position: relative;
          width: 58px;
          height: 34px;
          min-height: 34px;
          max-width: none;
          margin: 0;
          border: 1px solid rgba(217, 52, 56, 0.22);
          border-radius: 999px;
          background: rgba(217, 52, 56, 0.08);
          padding: 0;
          box-shadow: inset 0 1px 2px rgba(124,46,58,0.08);
          cursor: pointer;
          opacity: 1;
        }

        .pricing-toggle .pricing-toggle-switch:hover {
          transform: translateY(-1px);
          border-color: rgba(230, 79, 85, 0.34);
          box-shadow: inset 0 1px 2px rgba(124,46,58,0.08), 0 10px 24px rgba(217, 52, 56, 0.12);
        }

        .pricing-toggle .pricing-toggle-switch::after {
          content: "";
          position: absolute;
          top: 4px;
          left: ${billing === "monthly" ? "4px" : "28px"};
          width: 24px;
          height: 24px;
          border-radius: 999px;
          background: #E64F55;
          box-shadow: 0 8px 18px rgba(217, 52, 56, 0.26), inset 0 1px 0 rgba(255,255,255,0.68);
          transition: left 200ms ease;
        }

        .pricing-save-note {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          color: #D93438;
          white-space: nowrap;
        }

        .pricing-save-note svg {
          width: 70px;
          height: 28px;
          color: #E64F55;
          opacity: 0.82;
        }

        .pricing-save-note span {
          max-width: none;
          margin: 0;
          color: #8B5966;
          font-size: 0.9rem;
          font-weight: 900;
          line-height: 1;
          opacity: 1;
        }

        .classic-plan-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1.1rem;
          align-items: stretch;
        }

        .classic-plan-stack {
          display: grid;
          grid-template-rows: 22px 1fr;
          gap: 0;
          min-width: 0;
        }

        .classic-plan-badge-slot {
          display: flex;
          align-items: end;
          justify-content: center;
          min-height: 22px;
          padding-inline: 0.35rem;
          position: relative;
          z-index: 2;
          transform: translateY(50%);
        }

        .classic-plan-card {
          position: relative;
          display: flex;
          min-height: 100%;
          flex-direction: column;
          gap: 1.25rem;
          border: 1px solid rgba(255, 218, 218, 0.8);
          border-radius: 28px;
          background: linear-gradient(155deg, #FEFAF7 0%, #fff 100%);
          color: #D93438;
          padding: clamp(1.15rem, 2.8vw, 1.7rem);
          box-shadow: 0 1px 0 rgba(255,218,218,0.55) inset, 0 20px 54px rgba(217, 52, 56, 0.07);
          transition: transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease;
        }

        .classic-plan-card:hover {
          transform: translateY(-5px);
          border-color: rgba(230, 79, 85, 0.38);
          box-shadow: 0 1px 0 rgba(255,218,218,0.55) inset, 0 32px 72px rgba(217, 52, 56, 0.13);
        }

        .classic-plan-card.is-featured {
          background: linear-gradient(150deg, #E64F55 0%, #C8383E 60%, #B83050 100%);
          border-color: transparent;
          color: #fff;
          box-shadow: 0 32px 90px rgba(200, 56, 62, 0.3), 0 8px 28px rgba(200, 56, 62, 0.18);
        }

        .classic-plan-card.is-featured:hover {
          box-shadow: 0 40px 100px rgba(200, 56, 62, 0.35), 0 12px 32px rgba(200, 56, 62, 0.2);
        }

        .classic-plan-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          max-width: min(100%, 315px);
          border: 1px solid rgba(230, 79, 85, 0.16);
          border-radius: 14px;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,235,238,0.98) 56%, rgba(255,218,224,0.94) 100%);
          color: #D93438;
          padding: 0.48rem 0.92rem;
          font-size: 0.6rem;
          font-weight: 900;
          letter-spacing: 0.085em;
          line-height: 1;
          text-align: center;
          text-transform: uppercase;
          box-shadow:
            0 14px 30px rgba(217, 52, 56, 0.13),
            inset 0 1px 0 rgba(255,255,255,0.92);
          white-space: nowrap;
        }

        .classic-plan-head h3 {
          margin: 0 0 0.55rem;
          font-family: var(--font-display), sans-serif;
          font-size: clamp(1.6rem, 3vw, 2.05rem);
          font-weight: 900;
          line-height: 1;
          letter-spacing: -0.03em;
        }

        .classic-plan-head p,
        .classic-plan-note {
          margin: 0;
          color: currentColor;
          font-size: 0.92rem;
          line-height: 1.55;
          opacity: 0.76;
        }

        .classic-plan-price {
          display: flex;
          align-items: flex-start;
          gap: 0.35rem;
          border-top: 1px solid currentColor;
          border-bottom: 1px solid currentColor;
          padding: 1.15rem 0;
          color: currentColor;
        }

        .classic-plan-price strong {
          font-family: var(--font-display), sans-serif;
          font-size: clamp(3.4rem, 7vw, 4.8rem);
          font-weight: 900;
          line-height: 0.82;
          letter-spacing: -0.08em;
        }

        .classic-plan-price span {
          margin-top: 0.28rem;
          font-size: 0.85rem;
          font-weight: 900;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .classic-plan-list {
          display: grid;
          gap: 0.72rem;
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .classic-plan-list li {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.55rem;
          align-items: start;
          font-size: 0.9rem;
          line-height: 1.42;
        }

        .classic-plan-list svg {
          margin-top: 0.04rem;
          opacity: 0.8;
        }

        .classic-plan-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
          margin-top: auto;
          border-radius: 999px;
          background: #E64F55;
          color: #fff;
          padding: 0.78rem 1rem;
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          line-height: 1.2;
          text-align: center;
          text-decoration: none;
          text-transform: uppercase;
          transition: transform 180ms ease, box-shadow 180ms ease;
        }

        .classic-plan-card.is-featured .classic-plan-action {
          background: #fff;
          color: #D93438;
        }

        .classic-plan-action:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 32px rgba(217, 52, 56, 0.18);
        }

        @media (max-width: 980px) {
          .classic-plan-grid {
            grid-template-columns: 1fr;
            max-width: 520px;
            margin: 0 auto;
          }
        }

        @media (max-width: 560px) {
          .pricing-toggle-row {
            flex-direction: column;
            gap: 0.65rem;
            margin-bottom: 1.2rem;
          }

          .pricing-toggle {
            width: 100%;
            grid-template-columns: 1fr 1fr;
            gap: 0.55rem;
          }

          .pricing-toggle button {
            min-height: 68px;
            min-width: 0;
            padding: 0.68rem 0.55rem;
          }

          .pricing-toggle strong {
            font-size: 0.64rem;
          }

          .pricing-toggle span {
            font-size: 0.52rem;
          }

          .pricing-toggle {
            grid-template-columns: 1fr auto 1fr;
            gap: 0.45rem;
            padding: 0.58rem 0.75rem;
          }

          .pricing-toggle .pricing-toggle-option {
            min-height: 30px;
            min-width: 0;
            padding: 0.28rem;
            font-size: 0.82rem;
          }

          .pricing-toggle .pricing-toggle-switch {
            width: 50px;
            height: 30px;
          }

          .pricing-toggle .pricing-toggle-switch::after {
            top: 4px;
            left: ${billing === "monthly" ? "4px" : "24px"};
            width: 20px;
            height: 20px;
          }

          .pricing-save-note {
            position: static;
            grid-column: 1 / -1;
            justify-content: center;
            transform: none;
            margin-top: 0.25rem;
          }

          .pricing-save-note svg {
            width: 46px;
          }

          .pricing-save-note span {
            font-size: 0.72rem;
          }

          .classic-plan-grid {
            gap: 0.8rem;
          }

          .classic-plan-card {
            gap: 0.95rem;
            border-radius: 22px;
            padding: 1rem;
          }

          .classic-plan-head h3 {
            margin-bottom: 0.42rem;
            font-size: 1.55rem;
          }

          .classic-plan-head p,
          .classic-plan-note {
            font-size: 0.84rem;
            line-height: 1.45;
          }

          .classic-plan-price {
            padding: 0.86rem 0;
          }

          .classic-plan-price strong {
            font-size: clamp(2.7rem, 16vw, 3.6rem);
          }

          .classic-plan-price span {
            font-size: 0.68rem;
          }

          .classic-plan-list {
            gap: 0.55rem;
          }

          .classic-plan-list li {
            font-size: 0.82rem;
          }

          .classic-plan-action {
            min-height: 44px;
            font-size: 0.62rem;
            letter-spacing: 0.06em;
          }
        }
      `}</style>
    </div>
  );
}
