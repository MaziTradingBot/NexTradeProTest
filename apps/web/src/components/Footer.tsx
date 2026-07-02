import Link from 'next/link';
import { Logo } from './Logo';

const COLUMNS = [
  {
    title: 'Platform',
    links: [
      { href: '/markets', label: 'Markets' },
      { href: '/trading', label: 'Spot Trading' },
      { href: '/trading', label: 'Futures' },
      { href: '/copy-trading', label: 'Copy Trading' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/about', label: 'Careers' },
      { href: '/about', label: 'Contact' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/news', label: 'News' },
      { href: '/tools', label: 'Calculators' },
      { href: '/about', label: 'Academy' },
      { href: '/about', label: 'Support' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/about', label: 'Privacy Policy' },
      { href: '/about', label: 'Terms of Service' },
      { href: '/about', label: 'Cookies' },
      { href: '/about', label: 'Disclosures' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          <div className="col-span-2">
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-slate-400">
              Institutional-grade crypto trading infrastructure with live market data and clearly
              labeled simulated execution.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-3 text-sm font-semibold text-white">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((l, i) => (
                  <li key={`${l.label}-${i}`}>
                    <Link href={l.href} className="text-sm text-slate-400 transition-colors hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} NexTradePro (NXP). Demo platform — not financial advice.
          </p>
          <p className="text-xs text-slate-500">
            Live prices via public market data. Trading is simulated for demonstration.
          </p>
        </div>
      </div>
    </footer>
  );
}
