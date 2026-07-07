'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, LineChart, CandlestickChart, Wallet, PieChart } from 'lucide-react';
import { cn } from '@/lib/utils';

// Bottom navigation for the authenticated app on mobile/tablet. The full set of
// dashboard/account features lives in the profile menu; this surfaces the most
// common destinations for one-tap access. Hidden on desktop (lg+).
const ITEMS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/markets', label: 'Markets', icon: LineChart },
  { href: '/trading', label: 'Trade', icon: CandlestickChart },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/portfolio', label: 'Portfolio', icon: PieChart },
];

export function MobileAppNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-white/10 bg-bg-surface/95 backdrop-blur-xl lg:hidden" aria-label="App navigation">
      {ITEMS.map((it) => {
        const active = pathname === it.href;
        return (
          <Link key={it.href} href={it.href} aria-current={active ? 'page' : undefined} className={cn('flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition', active ? 'text-brand-blue' : 'text-slate-400 hover:text-white')}>
            <it.icon size={20} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
