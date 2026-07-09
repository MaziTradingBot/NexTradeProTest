import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SupportButton } from '@/components/SupportButton';
import { WelcomeTour } from '@/components/WelcomeTour';
import { MaintenanceGate } from '@/components/MaintenanceGate';
import { ModeBadge } from '@/components/ModeBadge';
import { MobileAppNav } from '@/components/MobileAppNav';

export const metadata: Metadata = {
  metadataBase: new URL('https://nextradepro.vercel.app'),
  title: {
    default: 'NexTradePro — Institutional Crypto Trading Platform',
    template: '%s · NexTradePro',
  },
  description:
    'NexTradePro (NXP) is an enterprise-grade cryptocurrency trading platform with live market data, advanced charts, copy trading, AI insights and simulated execution.',
  keywords: ['crypto trading', 'bitcoin', 'exchange', 'trading platform', 'NexTradePro', 'copy trading'],
  authors: [{ name: 'NexTradePro' }],
  openGraph: {
    title: 'NexTradePro — Institutional Crypto Trading Platform',
    description: 'Trade smarter with live data, pro charts and simulated execution.',
    type: 'website',
    siteName: 'NexTradePro',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NexTradePro',
    description: 'Institutional-grade crypto trading platform.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0A0E17',
  width: 'device-width',
  initialScale: 1,
  // Let content extend into the notch / Dynamic Island / home-indicator region
  // so our safe-area padding tokens (env(safe-area-inset-*)) take effect.
  viewportFit: 'cover',
};

// Runs before paint to apply the saved theme and avoid a flash.
const themeScript = `(function(){try{var t=localStorage.getItem('nxp-theme')||'dark';document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Figtree:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">
        <ModeBadge />
        <MaintenanceGate>{children}</MaintenanceGate>
        <MobileAppNav />
        <SupportButton />
        <WelcomeTour />
      </body>
    </html>
  );
}
