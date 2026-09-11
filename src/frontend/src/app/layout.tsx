import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// NOTE: no `export const dynamic` here on purpose. A root `force-dynamic`
// opts every route (29 pages) into a per-page Vercel Function. Pages that
// need request-time data opt in locally; everything else prerenders to CDN
// and costs zero function storage.

// Canonical production origin — used for metadataBase so static og:image /
// twitter:image URLs are absolute (required for correct link previews everywhere).
const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "") ||
  "https://cognivern.persidian.com"
);

// Static social cards (public/opengraph-image.png + public/twitter-image.png)
// — no next/og ImageResponse functions, so link previews cost zero Vercel
// Function storage.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Cognivern — AI Agent Governance",
  description:
    "Every approved agent spend writes a real transaction to a governed smart contract — on-chain, auditable, verifiable.",
  openGraph: {
    type: "website",
    siteName: "Cognivern",
    title: "Cognivern — AI Agent Governance",
    description:
      "Govern every agent transaction without slowing builders down. Policy checks in under 100ms, cryptographic audit evidence, multi-chain architecture.",
    url: siteUrl,
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cognivern — AI Agent Governance",
    description:
      "Every approved agent spend writes a real transaction to a governed smart contract — on-chain, auditable, verifiable.",
    images: ["/twitter-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
