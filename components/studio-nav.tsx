import Link from "next/link";
import { dashboardSections } from "@/src/features/studio/helpers";

type StudioNavProps = {
  current: (typeof dashboardSections)[number]["key"];
};

export function StudioNav({ current }: StudioNavProps) {
  return (
    <nav aria-label="Navegacion del estudio" className="mb-6 flex flex-wrap gap-3">
      {dashboardSections.map((section) => {
        const isCurrent = section.key === current;

        return (
          <Link
            key={section.href}
            className={
              isCurrent
                ? "rounded-full border border-[rgba(var(--brand-accent),0.24)] bg-[rgba(255,239,243,0.95)] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--accent)] shadow-[0_14px_30px_rgba(217,105,119,0.12)]"
                : "rounded-full border border-[rgba(var(--border-rgb),0.42)] bg-[rgba(255,255,255,0.88)] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--ink-soft)] transition hover:-translate-y-[1px] hover:border-[rgba(var(--brand-accent),0.24)] hover:text-[color:var(--accent)]"
            }
            href={section.href}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
