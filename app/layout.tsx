import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin", "cyrillic"], display: "swap", variable: "--font-sans" });
const cormorant = Cormorant_Garamond({ subsets: ["latin", "cyrillic"], weight: ["500", "600"], display: "swap", variable: "--font-display" });

export const metadata: Metadata = {
  title: "Clinic Mini App",
  description: "Universal Telegram Mini App template for clinics",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F7F5F0",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body className={`${manrope.variable} ${cormorant.variable}`}>{children}</body></html>;
}
