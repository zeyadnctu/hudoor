import "./globals.css";
import { Providers } from "@/components/providers";

export const viewport = { width: "device-width", initialScale: 1, maximumScale: 1, themeColor: "#1F2A33" };
export const metadata = {
  title: "Hudoor حضور - University Attendance",
  description: "Rotating QR university attendance. امسح مرة واحدة وتسجل حضورك.",
  manifest: "/manifest.webmanifest"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen bg-chalk font-body text-ink antialiased dark:bg-inkdeep dark:text-neutral-100">
        <Providers>{children}</Providers>
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));}` }} />
      </body>
    </html>
  );
}
