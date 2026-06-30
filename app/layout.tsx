import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/nav/AppNav";
import { AppSidebar } from "@/components/nav/AppSidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "Crucible — Asset Studio",
  description:
    "A multi-game asset-generation studio: canon-driven generation, finishing, and CDN publish.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <div className="flex min-h-dvh">
          <AppSidebar />
          <div id="main-content" className="flex min-w-0 flex-1 flex-col">
            <AppNav />
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
