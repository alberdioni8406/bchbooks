import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const siteUrl = 'https://bchbooks.vercel.app';
const title = 'BCHBooks — Simple accounting for Bitcoin Cash';
const description =
  'Turn Bitcoin Cash transactions into simple, useful accounting records. Read-only, privacy-conscious bookkeeping for BCH businesses and freelancers. No seed phrases. Data stays in your browser.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: '%s · BCHBooks',
  },
  description: description,
  applicationName: 'BCHBooks',
  keywords: [
    'Bitcoin Cash',
    'BCH',
    'accounting',
    'bookkeeping',
    'ledger',
    'crypto accounting',
    'BCHBooks',
    'read-only',
    'privacy',
  ],
  authors: [{ name: 'BCHBooks' }],
  creator: 'BCHBooks',
  publisher: 'BCHBooks',
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-touch-icon.svg', type: 'image/svg+xml' }],
  },
  manifest: '/site.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'BCHBooks',
    title: title,
    description: description,
  },
  twitter: {
    card: 'summary_large_image',
    title: title,
    description: description,
  },
  alternates: {
    canonical: siteUrl,
  },
  category: 'finance',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={geistSans.variable + ' ' + geistMono.variable + ' h-full antialiased'}
    >
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
