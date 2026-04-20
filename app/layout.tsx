import type { Metadata } from "next";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import { Navbar } from "@/components/navbar";
import "./globals.css";

const bodyFont = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-body" });
const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Brunela Dance Trainer",
  description: "Pilates y conditioning para bailarines. Studio online con clases on demand, programas y sesiones en vivo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
