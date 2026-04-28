import type { Metadata } from "next";
import { Great_Vibes, Montserrat, Roboto } from "next/font/google";
import { Navbar } from "@/components/navbar";
import { PublicLanguageProvider } from "@/components/language-provider";
import "./globals.css";

const bodyFont = Roboto({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "700", "900"] });
const displayFont = Montserrat({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700", "800", "900"] });
const scriptFont = Great_Vibes({ subsets: ["latin"], variable: "--font-script", weight: "400" });

export const metadata: Metadata = {
  title: "Brunela Dance Trainer",
  description: "Pilates y acondicionamiento para bailarines. Estudio online con clases a demanda, programas y sesiones en vivo.",
  icons: {
    icon: "/brand/isologo-icon.png",
    apple: "/brand/isologo-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${bodyFont.variable} ${displayFont.variable} ${scriptFont.variable}`} suppressHydrationWarning>
        <PublicLanguageProvider>
          <Navbar />
          {children}
        </PublicLanguageProvider>
      </body>
    </html>
  );
}
