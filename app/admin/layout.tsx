import Link from "next/link";
import { requireAdmin } from "@/src/features/auth/guards";
import { getAdminDictionary } from "@/src/features/admin/dictionary";

const copy = getAdminDictionary("es");
export const dynamic = "force-dynamic";

const links = [
  { href: "/admin", label: copy.nav.overview },
  { href: "/admin/videos", label: copy.nav.videos },
  { href: "/admin/programs", label: copy.nav.programs },
  { href: "/admin/settings", label: copy.nav.settings },
  { href: "/admin/users", label: copy.nav.users }
] as const;

export default async function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdmin();

  return (
    <div className="page-shell grid gap-6 py-10 lg:grid-cols-[240px_1fr]">
      <aside className="panel h-fit rounded-[32px] p-5">
        <p className="eyebrow mb-4">{copy.overview.title}</p>
        <nav className="space-y-2">
          {links.map((link) => (
            <Link
              key={link.href}
              className="block rounded-2xl px-4 py-3 text-sm font-semibold text-ink/75 transition hover:bg-white hover:text-ink"
              href={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div>{children}</div>
    </div>
  );
}
