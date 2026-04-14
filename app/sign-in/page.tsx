import Link from "next/link";
import { signInAction } from "@/src/features/auth/actions";
import { getDictionary } from "@/src/i18n/messages";

const copy = getDictionary("es");

type SignInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <main className="py-16">
      <section className="page-shell grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="panel rounded-[36px] p-8 md:p-10">
          <p className="eyebrow mb-4">{copy.auth.kicker}</p>
          <h1 className="display text-5xl leading-none">{copy.auth.title}</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-ink/70">{copy.auth.description}</p>

          <div className="mt-8 rounded-[28px] border border-black/6 bg-white/75 p-6">
            <p className="text-sm font-semibold text-ink">{copy.auth.adminHintTitle}</p>
            <p className="mt-2 text-sm leading-6 text-ink/68">{copy.auth.adminHintBody}</p>
          </div>
        </div>

        <div className="panel rounded-[36px] p-8 md:p-10">
          <form action={signInAction} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-ink" htmlFor="email">
                {copy.auth.email}
              </label>
              <input
                required
                autoComplete="email"
                className="w-full rounded-2xl border border-black/8 bg-white px-4 py-3 outline-none ring-0"
                id="email"
                name="email"
                placeholder="vichendallape@gmail.com"
                type="email"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-ink" htmlFor="password">
                {copy.auth.password}
              </label>
              <input
                required
                autoComplete="current-password"
                className="w-full rounded-2xl border border-black/8 bg-white px-4 py-3 outline-none ring-0"
                id="password"
                name="password"
                placeholder="••••••••"
                type="password"
              />
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <button className="button-primary w-full" type="submit">
              {copy.auth.submit}
            </button>
          </form>

          <p className="mt-5 text-sm text-ink/65">
            {copy.auth.footer}{" "}
            <Link className="font-semibold underline" href="/">
              {copy.brand.name}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
