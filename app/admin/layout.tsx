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
    <div className="page-shell admin-shell py-8 md:py-10 lg:grid-cols-[260px_1fr] lg:items-start">
      <aside className="admin-sidebar p-5 md:p-6">
        <div className="rounded-[1.7rem] bg-[linear-gradient(135deg,#fffdfd,#ffe9ef)] p-5 shadow-[0_16px_40px_rgba(220,150,170,0.14)]">
          <p className="eyebrow">Backstage</p>
          <h2 className="display mt-4 text-4xl">{copy.overview.title}</h2>
          <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">
            Gestion de contenido, settings y accesos desde una base limpia y escalable.
          </p>
        </div>

        <nav className="mt-5 space-y-2">
          {links.map((link) => (
            <Link key={link.href} className="admin-link" href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div>{children}</div>
    </div>
  );
}
