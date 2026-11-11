import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Fraunces, Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
});

export const metadata: Metadata = {
  title: {
    default: 'AgentTrust Docs',
    template: '%s - AgentTrust Docs',
  },
  description: "AgentTrust documentation for Solana x402 policy gates and ERC-8004 trust data.",
  metadataBase: new URL('http://localhost:3001'),
  icons: {
    icon: '/favicon.svg',
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen">
        <RootProvider i18n={{ translations: { search: 'Search...' } }}>{children}</RootProvider>
        <Analytics />
      </body>
    </html>
  );
}
