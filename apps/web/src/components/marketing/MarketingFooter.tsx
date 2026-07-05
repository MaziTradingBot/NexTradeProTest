import Link from 'next/link';

const COLUMNS = [
  { title: 'Platform', links: [['Markets', '/markets'], ['Copy Trading', '/copy-trading'], ['AI Assistant', '/ai'], ['Calculators', '/tools']] },
  { title: 'Learn', links: [['Academy', '/academy'], ['News', '/news'], ['Economic Calendar', '/calendar'], ['Pricing', '/pricing']] },
  { title: 'Company', links: [['About', '/about'], ['Careers', '/about'], ['Partners', '/about'], ['Contact', '/about']] },
  { title: 'Legal', links: [['Terms', '/about'], ['Privacy', '/about'], ['Risk Disclosure', '/about'], ['Cookies', '/about']] },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-brand-blue/10 bg-bg-darker">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          <div className="col-span-2">
            <span className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue to-brand-cyan text-base font-black text-white shadow-glow">N</span>
              <span className="font-display text-xl font-bold uppercase tracking-wide text-ink">
                NexTrade<span className="text-brand-blue">Pro</span>
              </span>
            </span>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-muted">
              An institutional-grade crypto trading platform with live market data and clearly labeled simulated execution.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-3 text-sm font-semibold text-ink">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="text-sm text-ink-muted transition-colors hover:text-brand-blue">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-brand-blue/10 pt-6 sm:flex-row">
          <p className="text-xs text-ink-faint">© {new Date().getFullYear()} NexTradePro. Demo platform — not financial advice.</p>
          <p className="text-xs text-ink-faint">Live prices via public market data. Trading is simulated for demonstration.</p>
        </div>
      </div>
    </footer>
  );
}
