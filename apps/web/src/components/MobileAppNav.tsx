'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, LineChart, CandlestickChart, ListOrdered, Wallet, User } from 'lucide-react';
import { useAuth } from '@/lib/store';
import { cn } from '@/lib/utils';

// Binance-style bottom navigation for the authenticated app on phones/tablets.
// Glass-morphism bar with an active accent, safe-area aware so it never sits
// under the iOS home indicator, and comfortably above the 48px touch target.
// Mounted once globally (root layout) and self-gates: it shows only for a
// signed-in user on an in-app route, and hides on desktop (lg+) and on the
// public marketing pages, where the top nav + profile menu take over.
const ITEMS: { href: string; label: string; icon: typeof LayoutDashboard; match: (p: string) => boolean }[] = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, match: (p) => p === '/dashboard' },
  { href: '/markets', label: 'Markets', icon: LineChart, match: (p) => p.startsWith('/markets') || p.startsWith('/coins') },
  { href: '/trading', label: 'Trade', icon: CandlestickChart, match: (p) => p.startsWith('/trading') },
  { href: '/history', label: 'Orders', icon: ListOrdered, match: (p) => p.startsWith('/history') },
  { href: '/wallet', label: 'Assets', icon: Wallet, match: (p) => p.startsWith('/wallet') },
  { href: '/settings', label: 'Profile', icon: User, match: (p) => p.startsWith('/settings') },
];

// In-app route prefixes where the bottom nav belongs (keeps it off the pure
// marketing pages: '/', '/about', '/pricing', '/academy', '/news').
const APP_PREFIXES = [
  '/dashboard', '/markets', '/coins', '/trading', '/history', '/wallet',
  '/portfolio', '/settings', '/security', '/kyc', '/ai', '/copy-trading',
  '/admin', '/broker', '/deposit', '/support',
];

export function MobileAppNav() {
  const pathname = usePathname();
  const user = useAuth((s) => s.user);
  const show = !!user && APP_PREFIXES.some((pre) => pathname === pre || pathname.startsWith(pre + '/') || pathname.startsWith(pre));

  // Pad <body> while the bar is shown so page content clears it on any route.
  useEffect(() => {
    document.body.classList.toggle('has-appnav', show);
    return () => document.body.classList.remove('has-appnav');
  }, [show]);

  if (!show) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-bg-surface/80 backdrop-blur-2xl lg:hidden"
      // Consume the z-index + safe-area tokens from the design system.
      style={{ zIndex: 'var(--z-nav)', paddingBottom: 'var(--safe-bottom)' }}
    >
      <ul className="mx-auto flex max-w-xl items-stretch px-1">
        {ITEMS.map((it) => {
          const active = it.match(pathname);
          const Icon = it.icon;
          return (
            <li key={it.href} className="min-w-0 flex-1">
              <Link
                href={it.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex min-h-[3.25rem] flex-col items-center justify-center gap-1 px-0.5 pb-1.5 pt-2 text-[10px] font-medium transition-colors duration-200 active:scale-90',
                  active ? 'text-brand-blue' : 'text-ink-muted hover:text-ink',
                )}
              >
                {/* Active top accent bar */}
                <span
                  className={cn(
                    'pointer-events-none absolute inset-x-3.5 top-0 h-0.5 rounded-full bg-brand-gradient transition-opacity duration-200',
                    active ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className={cn('flex h-6 w-6 items-center justify-center transition-transform duration-200', active && '-translate-y-0.5')}>
                  <Icon size={21} strokeWidth={active ? 2.4 : 1.9} aria-hidden />
                </span>
                <span className="max-w-full truncate leading-none">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
