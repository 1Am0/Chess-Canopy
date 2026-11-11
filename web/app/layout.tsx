import type { Metadata, Viewport } from "next";
import { Martian_Mono, Schibsted_Grotesk } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const schibsted = Schibsted_Grotesk({ subsets: ["latin"], weight: "variable", variable: "--font-schibsted" });
// Mono for moves, codes and tabular numbers. The wdth axis is set to 87.5% via `font-stretch` in globals.css.
const martian = Martian_Mono({ subsets: ["latin"], weight: "variable", axes: ["wdth"], preload: false, variable: "--font-martian" });

const title = "Chess Canopy: opening explorer for your own games";
const description = "Import your games from Chess.com or Lichess and see which openings you play and how they score.";

// Absolute OG image URLs need a base. Vercel exposes the production host at build time;
// elsewhere set NEXT_PUBLIC_SITE_URL. Without either, the preview image is omitted.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    siteName: "Chess Canopy",
    ...(siteUrl ? { images: [{ url: "/og.png", width: 1200, height: 630, alt: "Chess Canopy" }] } : {}),
  },
  twitter: { card: siteUrl ? "summary_large_image" : "summary", title, description, ...(siteUrl ? { images: ["/og.png"] } : {}) },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${schibsted.variable} ${martian.variable}`}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
