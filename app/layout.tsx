import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getDictionary } from "@/src/i18n/messages";

const copy = getDictionary("es");
const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body"
});
const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"]
});

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
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <header className="site-header">
          <div className="page-shell flex items-center justify-between gap-6">
            <Link className="site-logo" href="/">
              <span className="site-logo-mark">{copy.brand.name}</span>
              <span className="site-logo-subtitle">Dance Trainer</span>
            </Link>

            <nav className="site-nav">
              <Link className="site-nav-link" href="/sign-in">
                {copy.nav.signIn}
              </Link>
              <Link className="site-nav-link" href="/dashboard">
                {copy.nav.dashboard}
              </Link>
              <Link className="site-nav-link" href="/admin">
                {copy.nav.admin}
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
