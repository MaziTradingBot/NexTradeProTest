'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Star, Plus, Trash2, Pencil, Check, X, Search, TrendingUp, TrendingDown } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AuthGuard } from '@/components/AuthGuard';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface WList { id: string; name: string; emoji: string | null; isDefault: boolean; symbols: string[] }
interface Ticker { symbol: string; price: number; change: number }
interface CoinHit { symbol: string; pair: string; name: string }

const fmtPrice = (p: number) => (p >= 1 ? p.toLocaleString(undefined, { maximumFractionDigits: 2 }) : p.toLocaleString(undefined, { maximumFractionDigits: 6 }));

function WatchlistsInner() {
  const [lists, setLists] = useState<WList[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, Ticker>>({});
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('⭐');
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<CoinHit[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await api.get<WList[]>('/api/account/watchlists');
      setLists(res);
      setActiveId((cur) => cur && res.some((l) => l.id === cur) ? cur : res[0]?.id ?? null);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Price map for the symbols in view.
  useEffect(() => {
    const loadPrices = () => api.get<Ticker[]>('/api/market/tickers?limit=100')
      .then((t) => setPrices(Object.fromEntries(t.map((x) => [x.symbol, x]))))
      .catch(() => {});
    loadPrices();
    const id = setInterval(loadPrices, 15000);
    return () => clearInterval(id);
  }, []);

  // Search coins to add.
  useEffect(() => {
    if (!q.trim()) { setHits([]); return; }
    const t = setTimeout(() => {
      api.get<{ coins: CoinHit[] }>(`/api/market/coins?search=${encodeURIComponent(q)}&limit=8`)
        .then((r) => setHits(r.coins)).catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const active = useMemo(() => lists.find((l) => l.id === activeId) ?? null, [lists, activeId]);

  const createList = async () => {
    if (!newName.trim()) return;
    try {
      const l = await api.post<WList>('/api/account/watchlists', { name: newName.trim(), emoji: newEmoji });
      setCreating(false); setNewName(''); setNewEmoji('⭐');
      await load(); setActiveId(l.id);
    } catch { /* ignore */ }
  };
  const rename = async () => {
    if (!active || !renameVal.trim()) return;
    await api.patch(`/api/account/watchlists/${active.id}`, { name: renameVal.trim() }).catch(() => {});
    setRenaming(false); load();
  };
  const deleteList = async () => {
    if (!active || active.isDefault) return;
    await api.del(`/api/account/watchlists/${active.id}`).catch(() => {});
    setActiveId(null); load();
  };
  const addSymbol = async (pair: string) => {
    if (!active) return;
    await api.post(`/api/account/watchlists/${active.id}/items`, { symbol: pair }).catch(() => {});
    setQ(''); setHits([]); load();
  };
  const removeSymbol = async (pair: string) => {
    if (!active) return;
    await api.del(`/api/account/watchlists/${active.id}/items/${pair}`).catch(() => {});
    load();
  };

  return (
    <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-2xl bg-brand-gradient p-3 text-white"><Star size={22} /></div>
        <div>
          <h1 className="text-2xl font-bold text-white">Watchlists</h1>
          <p className="text-slate-400">Organize the markets you follow into private lists.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[260px_1fr]">
        {/* Lists */}
        <div className="card h-fit">
          <div className="space-y-1">
            {lists.map((l) => (
              <button key={l.id} onClick={() => { setActiveId(l.id); setRenaming(false); }} className={cn('flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition', activeId === l.id ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5')}>
                <span className="flex items-center gap-2 truncate"><span>{l.emoji ?? '⭐'}</span><span className="truncate">{l.name}</span></span>
                <span className="shrink-0 text-xs text-slate-500">{l.symbols.length}</span>
              </button>
            ))}
          </div>
          {creating ? (
            <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex gap-2">
                <input value={newEmoji} onChange={(e) => setNewEmoji(e.target.value.slice(0, 2))} className="input w-14 text-center" />
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="List name" className="input" autoFocus onKeyDown={(e) => e.key === 'Enter' && createList()} />
              </div>
              <div className="flex gap-2">
                <button onClick={createList} className="btn-primary flex-1 py-1.5 text-xs">Create</button>
                <button onClick={() => setCreating(false)} className="btn-ghost py-1.5 text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setCreating(true)} className="btn-ghost mt-3 w-full text-sm"><Plus size={15} /> New list</button>
          )}
        </div>

        {/* Active list */}
        <div className="card">
          {active ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                {renaming ? (
                  <div className="flex items-center gap-2">
                    <input value={renameVal} onChange={(e) => setRenameVal(e.target.value)} className="input" autoFocus onKeyDown={(e) => e.key === 'Enter' && rename()} />
                    <button onClick={rename} className="rounded-lg p-2 text-brand-emerald hover:bg-white/5"><Check size={16} /></button>
                    <button onClick={() => setRenaming(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5"><X size={16} /></button>
                  </div>
                ) : (
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><span>{active.emoji ?? '⭐'}</span> {active.name} {active.isDefault && <span className="badge bg-brand-blue/15 text-brand-blue">Default</span>}</h2>
                )}
                {!renaming && (
                  <div className="flex gap-1.5">
                    <button onClick={() => { setRenaming(true); setRenameVal(active.name); }} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"><Pencil size={15} /></button>
                    {!active.isDefault && <button onClick={deleteList} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-red-400"><Trash2 size={15} /></button>}
                  </div>
                )}
              </div>

              {/* Add symbol */}
              <div className="relative mt-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a coin…" className="input pl-9" />
                {hits.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-bg-elevated shadow-card">
                    {hits.map((h) => (
                      <button key={h.symbol} onClick={() => addSymbol(h.pair)} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-white/5">
                        <span className="text-white">{h.name} <span className="text-slate-500">{h.symbol}</span></span>
                        <Plus size={14} className="text-brand-blue" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Symbols */}
              <div className="mt-4 divide-y divide-white/5">
                {active.symbols.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">This list is empty. Search above to add coins.</p>
                ) : active.symbols.map((sym) => {
                  const t = prices[sym];
                  return (
                    <div key={sym} className="flex items-center justify-between gap-3 py-3">
                      <Link href={`/coins/${sym.replace('USDT', '')}`} className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-xs font-bold text-brand-blue">{sym.replace('USDT', '').slice(0, 3)}</div>
                        <div className="font-medium text-white">{sym.replace('USDT', '')}<span className="ml-1 text-xs text-slate-500">{sym}</span></div>
                      </Link>
                      <div className="flex items-center gap-4">
                        {t ? (
                          <div className="text-right">
                            <div className="font-mono text-sm text-white">${fmtPrice(t.price)}</div>
                            <div className={cn('flex items-center justify-end gap-1 text-xs font-semibold', t.change >= 0 ? 'text-brand-emerald' : 'text-red-400')}>
                              {t.change >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{Math.abs(t.change).toFixed(2)}%
                            </div>
                          </div>
                        ) : <span className="text-xs text-slate-600">—</span>}
                        <button onClick={() => removeSymbol(sym)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-red-400"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="py-12 text-center text-slate-500">Select or create a watchlist.</p>
          )}
        </div>
      </div>
      <div className="h-16" />
    </section>
  );
}

export default function WatchlistsPage() {
  return (
    <main>
      <Navbar />
      <AuthGuard>
        <WatchlistsInner />
      </AuthGuard>
    </main>
  );
}
