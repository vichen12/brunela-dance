import Link from "next/link";
import { getDictionary } from "@/src/i18n/messages";

const copy = getDictionary("es");

const tierAccent: Record<string, string> = {
  corps_de_ballet: "from-[#f8e9df] to-white",
  solista: "from-[#f4ddd2] to-white",
  principal: "from-[#ead2c7] to-white"
};

export default function HomePage() {
  return (
    <main className="py-12 md:py-20">
      <section className="page-shell grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="panel rounded-[36px] p-8 md:p-12">
          <p className="eyebrow mb-4">{copy.home.kicker}</p>
          <h1 className="display max-w-3xl text-5xl leading-none tracking-tight md:text-7xl">
            {copy.home.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/72">{copy.home.description}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="button-primary" href="/sign-in">
              {copy.home.primaryCta}
            </Link>
            <Link className="button-secondary" href="/admin">
              {copy.home.secondaryCta}
            </Link>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {copy.home.metrics.map((metric) => (
              <div key={metric.label} className="rounded-3xl border border-black/6 bg-mist p-5">
                <div className="display text-3xl">{metric.value}</div>
                <div className="mt-2 text-sm text-ink/68">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel rounded-[36px] p-8 md:p-10">
          <p className="eyebrow mb-4">{copy.home.tiersEyebrow}</p>
          <div className="space-y-4">
            {copy.home.tiers.map((tier) => (
              <article
                key={tier.id}
                className={`rounded-[28px] border border-black/6 bg-gradient-to-br p-6 ${tierAccent[tier.id]}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="display text-2xl">{tier.name}</h2>
                    <p className="mt-2 text-sm leading-6 text-ink/68">{tier.description}</p>
                  </div>
                  <span className="rounded-full border border-black/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink/60">
                    {tier.badge}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
