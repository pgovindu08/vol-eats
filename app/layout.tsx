import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { THEME_BOOT_SCRIPT } from "@/lib/preferences";
import "./globals.css";

// Self-hosted by next/font (no requests to Google at runtime). Exposed as CSS variables
// that app/globals.css maps to --font-display (headings, big numbers) and --font-sans (body).
const heading = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-heading", display: "swap" });
const body = DM_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_TAGLINE,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ff8200",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the inline script may add data-theme before React hydrates.
    <html lang="en" className={`h-full antialiased ${heading.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies the saved Light/Dark choice before first paint (Next "Preventing flash" guide). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full bg-bg text-text">{children}</body>
    </html>
  );
}
