import "./globals.css";
import { Providers } from "@/components/providers";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Readex_Pro, IBM_Plex_Sans_Arabic } from "next/font/google";

/* Display = Readex Pro, body = IBM Plex Sans Arabic; Arabic + Latin subsets,
   swap display, self-hosted. Tabular numerals are applied per element via .tnum */
const readex = Readex_Pro({
  subsets: ["arabic", "latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-readex"
});
const plexAr = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-ar"
});

export const viewport = { width: "device-width", initialScale: 1, maximumScale: 1, themeColor: "#F4F5F1" };
export const metadata = {
  title: "Hudoor حضور - University Attendance",
  description: "Rotating QR university attendance. امسح مرة واحدة وتسجل حضورك.",
  manifest: "/manifest.webmanifest"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={`${readex.variable} ${plexAr.variable}`}
    >
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen bg-background font-body text-foreground antialiased">
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
