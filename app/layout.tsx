import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="min-h-dvh bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
