import type { Metadata } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getDictionary } from "@/src/i18n/messages";

const copy = getDictionary("es");
const bodyFont = Montserrat({
  subsets: ["latin"],
  variable: "--font-body"
});
const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"]
});

const navigation = [
  { href: "/#about", label: "About" },
  { href: "/#studio", label: "Studio" },
  { href: "/#plans", label: "Plans" },
  { href: "/#live", label: "Live" },
  { href: "/#media", label: "Media" },
  { href: "/#contact", label: "Contact" }
] as const;

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
          <div className="page-shell site-header-inner">
            <Link className="site-logo" href="/">
              <span className="site-logo-mark">{copy.brand.name}</span>
              <span className="site-logo-subtitle">Dance Trainer</span>
            </Link>

            <nav className="site-nav">
              {navigation.map((item) => (
                <Link key={item.href} className="site-nav-link" href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="site-header-actions">
              <Link className="button-ghost" href="/sign-in">
                Member login
              </Link>
              <Link className="button-primary" href="/#plans">
                Start free trial
              </Link>
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
