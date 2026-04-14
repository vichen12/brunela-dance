import Link from "next/link";
import { signInAction } from "@/src/features/auth/actions";
import { getDictionary } from "@/src/i18n/messages";

const copy = getDictionary("es");

const studioNotes = [
  "Acceso privado para alumnas y administracion.",
  "Continuidad de entrenamiento con progreso guardado.",
  "Panel premium pensado para una practica elegante y clara."
];

type SignInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell grid gap-6 lg:grid-cols-[1fr_0.96fr]">
        <div className="hero-stage min-h-[34rem]">
          <span className="studio-chip">{copy.auth.kicker}</span>
          <h1 className="display mt-8 max-w-2xl text-5xl leading-none md:text-7xl">{copy.auth.title}</h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-[color:var(--ink-soft)] md:text-lg">
            Una entrada suave a un estudio online con identidad editorial, pensado para bailarinas que practican con
            foco, estructura y una sensacion premium desde el primer click.
          </p>

          <div className="mt-10 grid gap-3">
            {studioNotes.map((note) => (
              <div key={note} className="editorial-card px-5 py-4">
                <p className="text-sm font-semibold leading-6 text-[color:var(--ink)]">{note}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[2rem] border border-[rgba(118,92,113,0.08)] bg-[rgba(255,255,255,0.66)] p-6">
            <p className="eyebrow">{copy.auth.adminHintTitle}</p>
            <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">{copy.auth.adminHintBody}</p>
          </div>
        </div>

        <div className="panel rounded-[2.6rem] p-7 md:p-9">
          <div className="max-w-xl">
            <p className="eyebrow">Member sign in</p>
            <h2 className="display mt-4 text-4xl md:text-5xl">Volver al estudio.</h2>
            <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">
              {copy.auth.description}
            </p>
          </div>

          <form action={signInAction} className="form-shell mt-8">
            <div>
              <label className="field-label" htmlFor="email">
                {copy.auth.email}
              </label>
              <input id="email" name="email" placeholder="vichendallape@gmail.com" required autoComplete="email" type="email" />
            </div>

            <div>
              <label className="field-label" htmlFor="password">
                {copy.auth.password}
              </label>
              <input
                id="password"
                name="password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                type="password"
              />
            </div>

            {error ? (
              <div className="rounded-[1.5rem] border border-[rgba(217,105,119,0.2)] bg-[rgba(255,238,242,0.88)] px-4 py-4 text-sm font-semibold text-[color:var(--rose-deep)]">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button className="button-primary flex-1" type="submit">
                {copy.auth.submit}
              </button>
              <Link className="button-secondary flex-1" href="/">
                Volver al home
              </Link>
            </div>
          </form>

          <p className="mt-7 text-sm leading-7 text-[color:var(--ink-soft)]">
            {copy.auth.footer}{" "}
            <Link className="font-semibold text-[color:var(--rose-deep)] underline" href="/">
              {copy.brand.name}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
