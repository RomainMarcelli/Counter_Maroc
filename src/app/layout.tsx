import type { Metadata, Viewport } from "next";
import { Fraunces, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import Script from "next/script";

const bodyFont = Nunito_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const displayFont = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Marrakech Crew", template: "%s · Marrakech Crew" },
  description: "Le compteur de verres offline-first de votre séjour à Marrakech.",
  applicationName: "Marrakech Crew",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Marrakech Crew" },
  icons: { icon: [{ url: "/logo-mark.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", type: "image/png" }], apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#1E4A3A",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ENABLE_PWA !== "true" ? <Script id="clear-stale-development-pwa" strategy="beforeInteractive">{`
          if (!navigator.webdriver) {
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(function (registrations) {
                registrations.forEach(function (registration) { registration.unregister(); });
              });
            }
            if ('caches' in window) {
              caches.keys().then(function (keys) {
                keys.filter(function (key) { return key.indexOf('marrakech-crew-') === 0; })
                  .forEach(function (key) { caches.delete(key); });
              });
            }
          }
        `}</Script> : null}
      </head>
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
