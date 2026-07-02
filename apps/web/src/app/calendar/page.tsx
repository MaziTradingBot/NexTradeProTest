'use client';

import { useMemo, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { cn } from '@/lib/utils';

type Impact = 'HIGH' | 'MEDIUM' | 'LOW';

interface EventItem {
  time: string;
  country: string;
  flag: string;
  title: string;
  impact: Impact;
  forecast: string;
  previous: string;
  dayOffset: number;
}

// Representative economic events (demo data).
const EVENTS: EventItem[] = [
  { dayOffset: 0, time: '08:30', country: 'US', flag: '🇺🇸', title: 'Core CPI (MoM)', impact: 'HIGH', forecast: '0.3%', previous: '0.4%' },
  { dayOffset: 0, time: '10:00', country: 'US', flag: '🇺🇸', title: 'Fed Chair Speech', impact: 'HIGH', forecast: '—', previous: '—' },
  { dayOffset: 0, time: '14:00', country: 'EU', flag: '🇪🇺', title: 'ECB Interest Rate Decision', impact: 'HIGH', forecast: '4.25%', previous: '4.25%' },
  { dayOffset: 1, time: '00:30', country: 'JP', flag: '🇯🇵', title: 'BoJ Policy Statement', impact: 'MEDIUM', forecast: '—', previous: '—' },
  { dayOffset: 1, time: '08:30', country: 'US', flag: '🇺🇸', title: 'Initial Jobless Claims', impact: 'MEDIUM', forecast: '220K', previous: '218K' },
  { dayOffset: 1, time: '09:45', country: 'GB', flag: '🇬🇧', title: 'Manufacturing PMI', impact: 'LOW', forecast: '49.8', previous: '49.5' },
  { dayOffset: 2, time: '08:30', country: 'US', flag: '🇺🇸', title: 'Non-Farm Payrolls', impact: 'HIGH', forecast: '185K', previous: '199K' },
  { dayOffset: 2, time: '08:30', country: 'US', flag: '🇺🇸', title: 'Unemployment Rate', impact: 'HIGH', forecast: '3.9%', previous: '3.9%' },
  { dayOffset: 2, time: '10:00', country: 'CA', flag: '🇨🇦', title: 'Ivey PMI', impact: 'LOW', forecast: '54.2', previous: '53.9' },
  { dayOffset: 3, time: '05:00', country: 'EU', flag: '🇪🇺', title: 'Retail Sales (MoM)', impact: 'MEDIUM', forecast: '0.2%', previous: '-0.5%' },
  { dayOffset: 3, time: '15:30', country: 'US', flag: '🇺🇸', title: 'Crude Oil Inventories', impact: 'LOW', forecast: '-1.2M', previous: '0.7M' },
];

const IMPACT_STYLES: Record<Impact, string> = {
  HIGH: 'bg-red-500/15 text-red-400',
  MEDIUM: 'bg-brand-gold/15 text-brand-gold',
  LOW: 'bg-slate-500/15 text-slate-400',
};

function dateLabel(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function CalendarPage() {
  const [filter, setFilter] = useState<'ALL' | Impact>('ALL');

  const grouped = useMemo(() => {
    const rows = EVENTS.filter((e) => filter === 'ALL' || e.impact === filter);
    const map = new Map<number, EventItem[]>();
    rows.forEach((e) => {
      const arr = map.get(e.dayOffset) ?? [];
      arr.push(e);
      map.set(e.dayOffset, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [filter]);

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-5xl px-4 pt-28 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">Economic Calendar</h1>
        <p className="mt-2 text-slate-400">High-impact macro events that move crypto and global markets.</p>

        <div className="mt-6 flex flex-wrap gap-2">
          {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-medium transition',
                filter === f ? 'bg-brand-gradient text-white' : 'bg-white/5 text-slate-400 hover:text-white',
              )}
            >
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase() + ' impact'}
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-8">
          {grouped.map(([offset, rows]) => (
            <div key={offset}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{dateLabel(offset)}</h2>
              <div className="card overflow-hidden p-0">
                <div className="divide-y divide-white/5">
                  {rows.map((e, i) => (
                    <div key={i} className="grid grid-cols-12 items-center gap-3 px-5 py-3.5">
                      <div className="col-span-2 font-mono text-sm text-slate-300">{e.time}</div>
                      <div className="col-span-1 text-lg">{e.flag}</div>
                      <div className="col-span-5">
                        <div className="text-sm font-medium text-white">{e.title}</div>
                        <div className="text-xs text-slate-500">{e.country}</div>
                      </div>
                      <div className="col-span-2 text-right text-xs text-slate-400">
                        <div>F: {e.forecast}</div>
                        <div>P: {e.previous}</div>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className={cn('badge', IMPACT_STYLES[e.impact])}>{e.impact}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="h-20" />
      <Footer />
    </main>
  );
}
