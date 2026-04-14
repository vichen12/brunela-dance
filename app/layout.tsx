import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getDictionary } from "@/src/i18n/messages";

const copy = getDictionary("es");

export const metadata: Metadata = {
  title: copy.meta.title,
  description: copy.meta.description
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <div className="border-b border-black/5 bg-white/55 backdrop-blur">
          <div className="page-shell flex items-center justify-between py-4">
            <Link className="display text-2xl font-semibold tracking-tight" href="/">
              {copy.brand.name}
            </Link>

            <nav className="flex items-center gap-3 text-sm text-ink/80">
              <Link href="/sign-in">{copy.nav.signIn}</Link>
              <Link href="/dashboard">{copy.nav.dashboard}</Link>
              <Link href="/admin">{copy.nav.admin}</Link>
            </nav>
          </div>
        </div>

        {children}
      </body>
    </html>
  );
}
