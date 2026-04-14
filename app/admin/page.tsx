import Link from "next/link";
import { getAdminDictionary } from "@/src/features/admin/dictionary";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const copy = getAdminDictionary("es");

export default async function AdminOverviewPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const [videos, programs, settings, users] = await Promise.all([
    supabase.from("videos").select("*", { count: "exact", head: true }),
    supabase.from("programs").select("*", { count: "exact", head: true }),
    supabase.from("site_settings").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true })
  ]);

  const cards = [
    { href: "/admin/videos", label: copy.overview.cards.videos, value: videos.count ?? 0, note: "Catalogo editable" },
    { href: "/admin/programs", label: copy.overview.cards.programs, value: programs.count ?? 0, note: "Secuencia de dias" },
    { href: "/admin/settings", label: copy.overview.cards.settings, value: settings.count ?? 0, note: "Sin hardcoding" },
    { href: "/admin/users", label: copy.overview.cards.users, value: users.count ?? 0, note: "Roles y niveles" }
  ] as const;

  return (
    <main className="space-y-6">
      <header className="hero-stage">
        <div className="max-w-3xl">
          <p className="eyebrow">Admin atelier</p>
          <h1 className="display mt-5 text-5xl leading-none md:text-7xl">{copy.overview.title}</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-[color:var(--ink-soft)] md:text-lg">
            Un centro de mando suave en lo visual, pero firme en arquitectura. Todo lo importante se gobierna desde
            aca.
          </p>
        </div>
      </header>

      <section className="panel rounded-[2.4rem] p-7 md:p-9">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">{copy.overview.sectionTitle}</p>
            <h2 className="display mt-4 text-4xl">Modulos activos</h2>
          </div>
          <span className="studio-chip">Architecture first</span>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Link key={card.href} className="admin-metric transition hover:-translate-y-[2px]" href={card.href}>
              <p className="eyebrow">{card.note}</p>
              <p className="display mt-5 text-5xl leading-none">{card.value}</p>
              <p className="mt-4 text-sm font-semibold leading-6 text-[color:var(--ink)]">{card.label}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
