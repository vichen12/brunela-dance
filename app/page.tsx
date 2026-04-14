import Link from "next/link";

const disciplineTags = [
  "Progressing Ballet Technique",
  "Progressing Contemporary Technique",
  "Ballet",
  "Stretching",
  "Pilates Reformer",
  "Pilates Mat"
];

const studioCollections = [
  {
    type: "Class",
    level: "All levels",
    meta: "Pilates mat - 32 min",
    title: "Core placement for dancers",
    body: "A softer but precise mat session to build stability, breath and control before technique work."
  },
  {
    type: "Class",
    level: "Beginner friendly",
    meta: "Stretching - 24 min",
    title: "Recovery for hips, hamstrings and feet",
    body: "A guided reset designed for dancers who need mobility without losing structure or line quality."
  },
  {
    type: "Program",
    level: "14 day method",
    meta: "Sequenced path",
    title: "Strength and alignment reset",
    body: "A two-week progression that blends mobility, center work and conditioning into a clean weekly rhythm."
  },
  {
    type: "Live",
    level: "Member session",
    meta: "Weekly booking",
    title: "Corrections in real time",
    body: "Live sessions with a more personal atmosphere, space for questions and a stronger sense of studio."
  },
  {
    type: "Course",
    level: "Technique focus",
    meta: "Detailed breakdown",
    title: "Turnout, rotation and clean lines",
    body: "A deeper format for dancers who want context, not just random videos stacked together."
  },
  {
    type: "Private",
    level: "1:1 support",
    meta: "Tailored coaching",
    title: "Personal feedback and direction",
    body: "A more bespoke layer for dancers who need accountability, structure and individual attention."
  }
] as const;

const membershipPlans = [
  {
    name: "Corps de Ballet",
    note: "For steady weekly practice",
    price: "EUR 19",
    accent: "Foundation",
    description: "The essential library for dancers who want elegant, repeatable training at home.",
    features: [
      "On-demand class library",
      "Resume where you left off",
      "Tags by level, focus and equipment",
      "A soft entry point for daily consistency"
    ]
  },
  {
    name: "Solista",
    note: "Most balanced path",
    price: "EUR 39",
    accent: "Signature",
    description: "Adds structure for dancers who want more direction, better pacing and measurable progress.",
    features: [
      "Everything in Corps de Ballet",
      "14 day guided programs",
      "Progress checkpoints and retention milestones",
      "Deeper technique and conditioning pathways"
    ]
  },
  {
    name: "Principal",
    note: "Closest to private studio support",
    price: "EUR 69",
    accent: "High touch",
    description: "For dancers who want the full ecosystem: live access, premium guidance and a tighter rhythm.",
    features: [
      "Everything in Solista",
      "Member live sessions with booking",
      "Priority access to special formats",
      "A more direct coaching experience"
    ]
  }
] as const;

const specialFormats = [
  {
    label: "Intensives",
    title: "Focused weeks around one clear goal",
    body: "Ideal for dancers who want a short but immersive block around lines, core strength, pointe prep or recovery."
  },
  {
    label: "Member live sessions",
    title: "Weekly touch points with real presence",
    body: "A better answer for dancers who miss accountability, corrections and the feeling of training with someone live."
  },
  {
    label: "1:1 coaching",
    title: "A tailor-made layer for your current stage",
    body: "Useful when you need an outside eye on placement, routine design or the next step in your training."
  },
  {
    label: "Sunday reset",
    title: "A softer ritual for body care and continuity",
    body: "Mobility, breath and restoration sessions to close the week without disconnecting from your practice."
  }
] as const;

const journalEntries = [
  {
    category: "Technique notes",
    title: "How Pilates changes your adage quality",
    body: "A journal format exploring why control, breath and timing matter just as much as flexibility."
  },
  {
    category: "Behind the studio",
    title: "What to train when rehearsal weeks get heavy",
    body: "A calmer editorial approach to recovery, maintenance and staying connected to your body under pressure."
  },
  {
    category: "Dancer education",
    title: "From class-taking to intelligent training",
    body: "A more mature conversation about choosing the right workload, sequence and support for your current level."
  }
] as const;

const pathways = [
  {
    title: "Adult dancers",
    body: "For dancers returning to class, rebuilding confidence or finally wanting a routine that feels clear and elegant."
  },
  {
    title: "Pre-professional students",
    body: "For students who need extra conditioning outside the academy without turning every session into overload."
  },
  {
    title: "Teachers and movers",
    body: "For professionals who want a refined cross-training space they can trust and revisit consistently."
  }
] as const;

const footerColumns = [
  {
    title: "Studio",
    links: [
      { href: "/#studio", label: "Classes" },
      { href: "/#studio", label: "Programs" },
      { href: "/#live", label: "Live sessions" }
    ]
  },
  {
    title: "Explore",
    links: [
      { href: "/#about", label: "About Brunela" },
      { href: "/#plans", label: "Memberships" },
      { href: "/#media", label: "Media and journal" }
    ]
  },
  {
    title: "Access",
    links: [
      { href: "/sign-in", label: "Member sign in" },
      { href: "/dashboard", label: "Studio dashboard" },
      { href: "/admin", label: "Admin access" }
    ]
  }
] as const;

export default function HomePage() {
  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell">
        <div className="hero-layout">
          <div className="hero-stage">
            <p className="eyebrow">Online ballet conditioning</p>
            <h1 className="hero-wordmark mt-8">BRUNELA</h1>
            <span className="hero-submark">dance trainer</span>
            <p className="hero-copy">
              A premium online studio for dancers who want more than random classes: better structure, better
              continuity and a training rhythm that feels elegant from the first session.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="button-primary" href="/#plans">
                Start your free trial
              </Link>
              <Link className="button-secondary" href="/sign-in">
                Member sign in
              </Link>
            </div>

            <div className="hero-tag-cloud mt-10">
              {disciplineTags.map((tag) => (
                <span key={tag} className="detail-tag">
                  {tag}
                </span>
              ))}
            </div>

            <div className="hero-metrics mt-10">
              <div className="soft-stat p-5">
                <p className="eyebrow">Method</p>
                <p className="display mt-4 text-4xl leading-none">100+</p>
                <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">
                  Lessons, class ideas and training combinations ready to grow with the studio.
                </p>
              </div>
              <div className="soft-stat p-5">
                <p className="eyebrow">Formats</p>
                <p className="display mt-4 text-4xl leading-none">6</p>
                <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">
                  Ballet, stretching, mat work, reformer language and progressive dancer conditioning.
                </p>
              </div>
              <div className="soft-stat p-5">
                <p className="eyebrow">Entry</p>
                <p className="display mt-4 text-4xl leading-none">7 days</p>
                <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">
                  Trial access with a gentler path into the studio and room to understand your level.
                </p>
              </div>
            </div>
          </div>

          <aside className="panel hero-aside">
            <div className="story-chip">From Argentina to Barcelona</div>
            <h2 className="display mt-6 text-4xl leading-none md:text-5xl">Brunela brings a dancer&apos;s eye to training.</h2>
            <p className="mt-5 text-sm leading-7 text-[color:var(--ink-soft)]">
              Ballet teacher, choreographer and dancer, Brunela has built her work around helping dancers perform with
              more control, more clarity and less noise.
            </p>

            <div className="mt-8 space-y-4">
              <div className="editorial-card p-5">
                <p className="eyebrow">Get to know the studio</p>
                <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">
                  The approach is cross-disciplinary: technique support, mobility, conditioning and intelligent
                  programming for different moments in a dancer&apos;s season.
                </p>
              </div>

              <div className="editorial-card p-5">
                <p className="eyebrow">Online classes</p>
                <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">
                  If schedule is the problem, the studio becomes the solution: structured lessons, flexible access and
                  a softer bridge into regular training.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="page-shell mt-10 md:mt-14" id="studio">
        <div className="section-shell">
          <div className="section-copy">
            <p className="eyebrow">Inside the online studio</p>
            <h2 className="section-title">Classes, programs and live support built around real dancer needs.</h2>
            <p className="section-lead">
              Instead of a thin landing page, Brunela now reads like a full studio: multiple formats, richer context
              and a stronger sense of what actually happens once someone joins.
            </p>
          </div>

          <div className="studio-grid mt-8">
            {studioCollections.map((item) => (
              <article key={item.title} className="studio-card">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="card-kicker">{item.type}</span>
                  <span className="card-meta">{item.level}</span>
                </div>
                <h3 className="display mt-5 text-3xl">{item.title}</h3>
                <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
                  {item.meta}
                </p>
                <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="page-shell mt-10 md:mt-14" id="about">
        <div className="section-split">
          <div className="panel story-sheet">
            <p className="eyebrow">About Brunela</p>
            <h2 className="section-title mt-4">A ballet teacher, choreographer and dancer shaping a more intelligent training space.</h2>
            <p className="section-lead mt-5">
              Brunela is from Argentina and currently based in Barcelona. The studio grows from years of dedicated
              practice and a clear mission: help dancers reach stronger performance through cleaner support work behind
              the scenes.
            </p>
            <p className="mt-5 text-sm leading-7 text-[color:var(--ink-soft)]">
              The promise is not just beautiful branding. It is a complete training environment that supports
              technique, recovery, consistency and a calmer relationship with progress.
            </p>
          </div>

          <div className="panel story-sheet">
            <p className="eyebrow">Training paths</p>
            <div className="mt-6 space-y-4">
              {pathways.map((path) => (
                <div key={path.title} className="feature-tile">
                  <h3 className="display text-3xl">{path.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">{path.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell mt-10 md:mt-14" id="plans">
        <div className="section-shell">
          <div className="section-copy">
            <p className="eyebrow">Memberships</p>
            <h2 className="section-title">Three levels, each one clearer and more desirable than the last.</h2>
            <p className="section-lead">
              The names match the architecture already built underneath the product: Corps de Ballet, Solista and
              Principal. Prices are placeholders for now, but the offer is intentionally positioned.
            </p>
          </div>

          <div className="plan-grid mt-8">
            {membershipPlans.map((plan, index) => (
              <article key={plan.name} className={`plan-card${index === 1 ? " plan-card-featured" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow">{plan.accent}</p>
                    <h3 className="display mt-4 text-4xl">{plan.name}</h3>
                  </div>
                  <span className="plan-note">{plan.note}</span>
                </div>

                <div className="plan-price">{plan.price}</div>
                <p className="text-sm leading-7 text-[color:var(--ink-soft)]">{plan.description}</p>

                <ul className="feature-list mt-6">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>

                <Link className="button-secondary mt-8" href="/sign-in">
                  Choose {plan.name}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="page-shell mt-10 md:mt-14" id="live">
        <div className="section-shell">
          <div className="section-copy">
            <p className="eyebrow">Live and special formats</p>
            <h2 className="section-title">More than a library: intensives, coaching and sessions with real rhythm.</h2>
            <p className="section-lead">
              The reference site works because it feels alive. Brunela needs that same feeling of movement, but with
              its own voice and a more dancer-conditioning point of view.
            </p>
          </div>

          <div className="studio-grid mt-8">
            {specialFormats.map((item) => (
              <article key={item.title} className="studio-card">
                <p className="card-kicker">{item.label}</p>
                <h3 className="display mt-5 text-3xl">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="page-shell mt-10 md:mt-14" id="media">
        <div className="section-shell">
          <div className="section-copy">
            <p className="eyebrow">Media and journal</p>
            <h2 className="section-title">Editorial content gives the brand a longer voice.</h2>
            <p className="section-lead">
              Interviews, notes, video essays and dancer education pieces help the site feel layered, premium and alive
              even when a visitor is not yet ready to buy.
            </p>
          </div>

          <div className="journal-grid mt-8">
            {journalEntries.map((entry) => (
              <article key={entry.title} className="journal-card">
                <p className="card-kicker">{entry.category}</p>
                <h3 className="display mt-5 text-3xl">{entry.title}</h3>
                <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">{entry.body}</p>
                <span className="journal-link">Coming soon</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="page-shell mt-10 md:mt-14" id="contact">
        <div className="footer-shell">
          <div className="newsletter-panel">
            <p className="eyebrow">Start today</p>
            <h2 className="section-title mt-4">A more complete studio, a calmer palette and a stronger sense of value.</h2>
            <p className="section-lead mt-5">
              This version already gives Brunela much more of the feeling your reference has: depth, aspiration and a
              fuller studio ecosystem instead of one soft hero and not much else.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="button-primary" href="/#plans">
                Explore memberships
              </Link>
              <Link className="button-secondary" href="/sign-in">
                Enter the studio
              </Link>
            </div>
          </div>

          <footer className="footer-grid">
            <div>
              <Link className="site-logo" href="/">
                <span className="site-logo-mark">Brunela</span>
                <span className="site-logo-subtitle">Dance Trainer</span>
              </Link>
              <p className="mt-5 max-w-sm text-sm leading-7 text-[color:var(--ink-soft)]">
                Ballet conditioning, pilates and structured support for dancers training from beginner to professional
                level.
              </p>
            </div>

            {footerColumns.map((column) => (
              <div key={column.title}>
                <p className="footer-label">{column.title}</p>
                <div className="footer-link-stack">
                  {column.links.map((link) => (
                    <Link key={link.label} className="footer-link" href={link.href}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </footer>
        </div>
      </section>
    </main>
  );
}
