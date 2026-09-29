import type { Metadata, Viewport } from "next";
import { Public_Sans, Tinos } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

const tinos = Tinos({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-tinos",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Magistra – Semplicemente Magistrale",
    template: "%s · Magistra – Semplicemente Magistrale",
  },
  description: "Portale ordini per farmacie e privati di Sagè Pharma e Bioeleva.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#15191b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${publicSans.variable} ${tinos.variable}`}>
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
