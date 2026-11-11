import type { Metadata, Viewport } from "next";
import { Caveat, Martian_Mono, Newsreader, Schibsted_Grotesk } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Display serif: opsz axis lets the optical size follow font-size automatically.
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
});
const schibsted = Schibsted_Grotesk({ subsets: ["latin"], weight: "variable", variable: "--font-schibsted" });
// Catalogue mono: wdth axis is set to 87.5% via `font-stretch` in globals.css.
const martian = Martian_Mono({ subsets: ["latin"], weight: "variable", axes: ["wdth"], preload: false, variable: "--font-martian" });

// Handwriting for margin notes only (never data). Not preloaded: it is used by one short note.
const caveat = Caveat({ subsets: ["latin"], weight: "variable", preload: false, variable: "--font-caveat" });

export const metadata: Metadata = {
  title: "Chess Canopy",
  description: "Explore your chess openings from your own games, entirely in your browser.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${newsreader.variable} ${schibsted.variable} ${martian.variable} ${caveat.variable}`}>
      <body>
        <ThemeProvider attribute="class" forcedTheme="light" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
