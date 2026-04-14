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
    { href: "/admin/videos", label: copy.overview.cards.videos, value: videos.count ?? 0 },
    { href: "/admin/programs", label: copy.overview.cards.programs, value: programs.count ?? 0 },
    { href: "/admin/settings", label: copy.overview.cards.settings, value: settings.count ?? 0 },
    { href: "/admin/users", label: copy.overview.cards.users, value: users.count ?? 0 }
  ] as const;

  return (
    <main className="space-y-6">
      <header className="panel rounded-[36px] p-8 md:p-10">
        <p className="eyebrow mb-3">{copy.overview.title}</p>
        <h1 className="display text-4xl md:text-5xl">{copy.overview.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-ink/70">{copy.overview.description}</p>
      </header>

      <section className="panel rounded-[32px] p-8">
        <p className="eyebrow mb-3">{copy.overview.sectionTitle}</p>
        <div className="grid-cards">
          {cards.map((card) => (
            <Link
              key={card.href}
              className="rounded-[26px] border border-black/6 bg-white/76 p-6 transition hover:-translate-y-[1px]"
              href={card.href}
            >
              <p className="text-sm font-semibold text-ink/65">{card.label}</p>
              <p className="display mt-3 text-4xl">{card.value}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
