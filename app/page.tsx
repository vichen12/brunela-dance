import Link from "next/link";
import { getDictionary } from "@/src/i18n/messages";

const copy = getDictionary("es");

const studioPillars = [
  {
    number: "01",
    title: "Biblioteca on-demand",
    body: "Clases con foco en fuerza, movilidad, control y acondicionamiento para bailarinas que practican desde casa."
  },
  {
    number: "02",
    title: "Programas guiados",
    body: "Recorridos de 14 dias con una secuencia pensada para sostener consistencia, progreso y seguridad tecnica."
  },
  {
    number: "03",
    title: "Clases en vivo",
    body: "Reservas, cupos y acompanamiento en tiempo real para una experiencia de estudio mas cercana y premium."
  }
];

const studioRhythm = [
  "Desktop-first para practicar en pantalla grande con presencia visual.",
  "Retoma exacta de la ultima clase para no perder continuidad.",
  "Acceso por membresia sin hardcoding y con gestion total desde admin."
];

const tierDetails: Record<string, { accent: string; note: string }> = {
  corps_de_ballet: {
    accent: "from-[#fff7f8] via-[#ffecef] to-[#f9d7df]",
    note: "Movimiento diario"
  },
  solista: {
    accent: "from-[#fff5f7] via-[#ffe8ee] to-[#f7ccd7]",
    note: "Metodo guiado"
  },
  principal: {
    accent: "from-[#fff3f6] via-[#ffe2e9] to-[#f5c1cf]",
    note: "Acceso total"
  }
};

export default function HomePage() {
  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell">
        <div className="grid gap-6 lg:grid-cols-[1.18fr_0.82fr]">
          <div className="hero-stage">
            <div className="max-w-3xl">
              <span className="studio-chip">{copy.home.kicker}</span>
              <h1 className="hero-wordmark mt-8">{copy.brand.name}</h1>
              <span className="hero-submark">Dance Trainer</span>
              <p className="mt-8 max-w-2xl text-lg leading-8 text-[color:var(--ink-soft)] md:text-xl">
                Un estudio digital para bailarinas que quieren entrenar con estructura, elegancia y una experiencia
                premium en cada clase.
              </p>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link className="button-primary" href="/sign-in">
                {copy.home.primaryCta}
              </Link>
              <Link className="button-secondary" href="/dashboard">
                Ver experiencia privada
              </Link>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {copy.home.metrics.map((metric) => (
                <div key={metric.label} className="soft-stat p-5">
                  <div className="eyebrow mb-3">Studio metric</div>
                  <div className="display text-4xl leading-none">{metric.value}</div>
                  <p className="mt-3 text-sm leading-6 text-[color:var(--ink-soft)]">{metric.label}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="panel rounded-[2.4rem] p-6 md:p-8">
            <div className="rounded-[2rem] bg-gradient-to-br from-[#ffffff] via-[#fff2f5] to-[#ffd8e2] p-6 shadow-[0_20px_50px_rgba(229,128,150,0.18)]">
              <p className="eyebrow">Inside the studio</p>
              <h2 className="display mt-4 text-4xl leading-none">Entrena como si estuvieras en un espacio privado.</h2>
              <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                La experiencia combina clases elegantes, progresion visible y una arquitectura pensada para crecer sin
                perder calidez.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              {studioRhythm.map((item) => (
                <div key={item} className="editorial-card px-5 py-4">
                  <p className="text-sm font-semibold leading-6 text-[color:var(--ink)]">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[2rem] border border-[rgba(118,92,113,0.08)] bg-[rgba(255,255,255,0.62)] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="eyebrow">Trial</p>
                  <p className="mt-2 text-3xl font-semibold text-[color:var(--rose-deep)]">7 dias</p>
                </div>
                <span className="studio-chip">Premium access</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-[color:var(--ink-soft)]">
                Entra con metodo de pago, prueba el nivel elegido y deja que el progreso haga el resto.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="page-shell mt-8 md:mt-12">
        <div className="section-frame panel">
          <div className="max-w-2xl">
            <p className="eyebrow">Studio rhythm</p>
            <h2 className="display mt-4 text-4xl md:text-5xl">La plataforma se mueve como un estudio online real.</h2>
            <p className="mt-5 text-base leading-7 text-[color:var(--ink-soft)] md:text-lg">
              Inspirada en una experiencia editorial, con foco en clases, planes y membresias antes que en una
              interfaz tecnica.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {studioPillars.map((pillar) => (
              <article key={pillar.number} className="feature-tile">
                <div className="feature-number">{pillar.number}</div>
                <h3 className="display mt-6 text-3xl">{pillar.title}</h3>
                <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">{pillar.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="page-shell mt-8 md:mt-12">
        <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="panel rounded-[2.4rem] p-7 md:p-9">
            <p className="eyebrow">Membership design</p>
            <h2 className="display mt-4 text-4xl md:text-5xl">Cada nivel tiene una atmosfera propia.</h2>
            <p className="mt-5 text-base leading-7 text-[color:var(--ink-soft)]">
              Desde una practica diaria flexible hasta sesiones en vivo con acceso reservado, Brunela ordena la
              experiencia para que la alumna sepa exactamente que recibe.
            </p>
            <div className="mt-8 grid gap-3">
              <div className="editorial-card p-5">
                <p className="eyebrow">For dancers</p>
                <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">
                  La estetica es suave, refinada y femenina; la arquitectura por debajo esta preparada para escalar.
                </p>
              </div>
              <div className="editorial-card p-5">
                <p className="eyebrow">For retention</p>
                <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">
                  Reanudar clase, progreso visible, hitos y recompensas convierten el entrenamiento en un habito.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {copy.home.tiers.map((tier) => (
              <article
                key={tier.id}
                className={`rounded-[2rem] border border-[rgba(118,92,113,0.08)] bg-gradient-to-br ${tierDetails[tier.id].accent} p-6 shadow-[0_22px_60px_rgba(220,150,170,0.14)] md:p-7`}
              >
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="eyebrow">{tierDetails[tier.id].note}</p>
                    <h3 className="display mt-3 text-3xl md:text-4xl">{tier.name}</h3>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--ink-soft)]">{tier.description}</p>
                  </div>
                  <span className="studio-chip">{tier.badge}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
