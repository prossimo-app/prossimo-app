import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import { cookies, headers } from "next/headers";

import "./globals.css";

// TODO: Add later
// import { ConsentManager } from "~/components/consent-manager";
import { languageCookieName } from "~/utils/language-cookie";
import { resolveRequestLanguage } from "./request-language";

const instrumentSans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://prossimo.app",
  ),
  applicationName: "Prossimo",
  title: {
    default: "Prossimo | Turin transit, live",
    template: "%s | Prossimo",
  },
  description:
    "Prossimo helps you check live Turin public transport arrivals, nearby stops, buses, trams, and metro connections.",
  keywords: [
    "Prossimo",
    "Prossimo Torino",
    "Turin transit",
    "Turin public transport",
    "Torino public transport",
    "GTT Torino",
    "Turin bus",
    "Turin tram",
    "Turin metro",
    "live transit Turin",
    "real-time transit Turin",
    "transport app Turin",
    "trasporti Torino",
    "mezzi pubblici Torino",
    "autobus Torino",
    "tram Torino",
    "metro Torino",
    "orari GTT",
    "fermate Torino",
  ],
  authors: [{ name: "Prossimo" }],
  creator: "Prossimo",
  publisher: "Prossimo",
  alternates: {
    canonical: "/",
    languages: {
      en: "/",
      it: "/",
    },
  },
  manifest: "/favicon/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "any" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      {
        url: "/favicon/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Prossimo",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Prossimo",
    title: "Prossimo | Turin transit, live",
    description:
      "Check nearby stops, follow your bus or tram, and know when to leave in Turin.",
    locale: "en_US",
    alternateLocale: ["it_IT"],
    images: [
      {
        url: "/favicon/android-chrome-512x512.png",
        width: 512,
        height: 512,
        alt: "Prossimo app icon",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Prossimo | Turin transit, live",
    description:
      "Live Turin public transport arrivals, nearby stops, buses, trams, and metro connections.",
    images: ["/favicon/android-chrome-512x512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "transportation",
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const requestCookies = await cookies();
  const language = resolveRequestLanguage(
    requestHeaders.get("accept-language"),
    requestCookies.get(languageCookieName)?.value ?? null,
  );

  return (
    <html
      lang={language}
      className={`${instrumentSans.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="bg-background selection:bg-secondary flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
