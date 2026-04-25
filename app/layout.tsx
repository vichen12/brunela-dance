import type { Metadata } from "next";
import { Montserrat, Roboto } from "next/font/google";
import { Navbar } from "@/components/navbar";
import "./globals.css";

const bodyFont = Roboto({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "700", "900"] });
const displayFont = Montserrat({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700", "800", "900"] });

export const metadata: Metadata = {
  title: "Brunela Dance Trainer",
  description: "Pilates y conditioning para bailarines. Studio online con clases on demand, programas y sesiones en vivo.",
  icons: {
    icon: "/brand/isologo-icon.png",
    apple: "/brand/isologo-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${bodyFont.variable} ${displayFont.variable}`} suppressHydrationWarning>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
