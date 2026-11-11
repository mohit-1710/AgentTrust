import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PUBLIC_LINKS } from "@/data/links";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_LINKS.site),
  title: "AgentTrust",
  description:
    "AgentTrust verifies identity, policy, and feedback before AI-agent payments settle on Solana.",
  alternates: {
    canonical: PUBLIC_LINKS.site,
  },
  openGraph: {
    description:
      "AgentTrust verifies identity, policy, and feedback before AI-agent payments settle on Solana.",
    siteName: "AgentTrust",
    title: "AgentTrust",
    type: "website",
    url: PUBLIC_LINKS.site,
  },
  twitter: {
    card: "summary_large_image",
    description:
      "AgentTrust verifies identity, policy, and feedback before AI-agent payments settle on Solana.",
    title: "AgentTrust",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
