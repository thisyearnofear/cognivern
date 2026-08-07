import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

// Canonical production origin — used for metadataBase so generated og:image /
// twitter:image URLs are absolute (required for correct link previews everywhere).
const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "") ||
  "https://cognivern.persidian.com"
);

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
  },
  twitter: {
    card: "summary_large_image",
    title: "Cognivern — AI Agent Governance",
    description:
      "Every approved agent spend writes a real transaction to a governed smart contract — on-chain, auditable, verifiable.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
