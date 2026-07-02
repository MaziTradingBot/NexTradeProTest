'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, Sparkles, Send, TrendingUp, Activity, ShieldCheck } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { useTickers, assetName } from '@/lib/useTickers';
import { formatPercent, formatCurrency, cn } from '@/lib/utils';

const REF: Record<string, number> = { USDT: 1, BTC: 67000, ETH: 3500, BNB: 600, SOL: 150 };

interface Wallet {
  asset: string;
  balance: string;
}

export default function AIPage() {
  const { user } = useAuth();
  const { tickers } = useTickers(7000);
  const [fng, setFng] = useState<{ value: number; label: string } | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [messages, setMessages] = useState<{ from: 'ai' | 'me'; text: string }[]>([
    { from: 'ai', text: 'Hi — I’m the NexTradePro AI assistant. Ask me for a market summary, a portfolio health check, or trade ideas.' },
  ]);
  const [input, setInput] = useState('');

  useEffect(() => {
    api.get<{ value: number; label: string }>('/api/market/fear-greed').then(setFng).catch(() => {});
    if (user) api.get<Wallet[]>('/api/account/wallets').then(setWallets).catch(() => {});
  }, [user]);

  // Derived market insight from live data.
  const summary = useMemo(() => {
    if (tickers.length === 0) return null;
    const gainers = [...tickers].sort((a, b) => b.change - a.change);
    const avg = tickers.reduce((s, t) => s + t.change, 0) / tickers.length;
    return {
      avg,
      top: gainers[0],
      worst: gainers[gainers.length - 1],
      bias: avg > 0.5 ? 'bullish' : avg < -0.5 ? 'bearish' : 'neutral',
    };
  }, [tickers]);

  // Portfolio health score (0–100) from allocation + diversification.
  const health = useMemo(() => {
    if (wallets.length === 0) return null;
    const values = wallets
      .map((w) => ({ asset: w.asset, v: parseFloat(w.balance) * (REF[w.asset] ?? 0) }))
      .filter((x) => x.v > 0);
    const total = values.reduce((s, x) => s + x.v, 0);
    if (total === 0) return null;
    const stableShare = (values.find((x) => x.asset === 'USDT')?.v ?? 0) / total;
    const diversity = Math.min(values.length / 5, 1); // more assets → higher
    const concentration = Math.max(...values.map((x) => x.v / total));
    // Balanced portfolios (some stables, diversified, not over-concentrated) score higher.
    const score = Math.round(
      40 * diversity + 30 * (1 - Math.abs(0.3 - stableShare) / 0.7) + 30 * (1 - concentration),
    );
    return { score: Math.max(5, Math.min(100, score)), total, stableShare, values, count: values.length };
  }, [wallets]);

  const respond = (q: string): string => {
    const lower = q.toLowerCase();
    if ((lower.includes('portfolio') || lower.includes('health')) && health) {
      return `Your portfolio is worth ${formatCurrency(health.total)} across ${health.count} assets. Health score: ${health.score}/100. Stablecoin allocation is ${(health.stableShare * 100).toFixed(0)}%. ${
        health.score >= 70 ? 'Well diversified — nice balance of risk and stability.' : 'Consider diversifying further or trimming your largest position to reduce concentration risk.'
      }`;
    }
    if (lower.includes('portfolio') || lower.includes('health')) {
      return 'Log in and fund your demo wallets to get a personalized portfolio health score.';
    }
    if (summary && (lower.includes('summary') || lower.includes('market') || lower.includes('today'))) {
      return `Market bias is ${summary.bias} — the tracked basket is ${formatPercent(summary.avg)} on average over 24h. Top mover: ${assetName(summary.top.symbol)} (${formatPercent(summary.top.change)}); weakest: ${assetName(summary.worst.symbol)} (${formatPercent(summary.worst.change)}). Sentiment (Fear & Greed) is ${fng?.value ?? 50} — ${fng?.label ?? 'Neutral'}.`;
    }
    if (summary && (lower.includes('buy') || lower.includes('idea') || lower.includes('trade'))) {
      return `Not financial advice — but momentum favors ${assetName(summary.top.symbol)} (${formatPercent(summary.top.change)}) today. Always define your stop loss; try the Position Size calculator under Tools to size the trade to your risk.`;
    }
    if (summary && lower.includes('risk')) {
      return `With sentiment at ${fng?.value ?? 50} (${fng?.label ?? 'Neutral'}) and average momentum ${formatPercent(summary.avg)}, size positions conservatively. A 1% account-risk rule is a solid default.`;
    }
    return 'I can help with: “market summary”, “portfolio health”, “trade ideas”, or “risk check”. This is a demo assistant using live market data.';
  };

  const send = (preset?: string) => {
    const q = (preset ?? input).trim();
    if (!q) return;
    setMessages((m) => [...m, { from: 'me', text: q }]);
    setInput('');
    setTimeout(() => setMessages((m) => [...m, { from: 'ai', text: respond(q) }]), 500);
  };

  const suggestions = ['Give me a market summary', 'Check my portfolio health', 'Any trade ideas?', 'Risk check'];

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 pt-28 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-2xl bg-brand-gradient p-3 text-white">
            <Bot size={26} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">AI Trading Assistant</h1>
            <p className="text-slate-400">Live market intelligence, portfolio insights and trade ideas.</p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Chat */}
          <div className="card flex h-[560px] flex-col p-0">
            <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3">
              <Sparkles size={16} className="text-brand-gold" />
              <span className="text-sm font-semibold text-white">Assistant</span>
              <span className="badge ml-auto bg-brand-emerald/15 text-brand-emerald">Demo</span>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.map((m, i) => (
                <div key={i} className={m.from === 'me' ? 'text-right' : 'text-left'}>
                  <span
                    className={cn(
                      'inline-block max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
                      m.from === 'me' ? 'rounded-br-sm bg-brand-blue text-white' : 'rounded-bl-sm bg-white/5 text-slate-200',
                    )}
                  >
                    {m.text}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 p-4">
              <div className="mb-2 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 hover:bg-white/10">
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder="Ask the assistant…"
                  className="input"
                />
                <button onClick={() => send()} className="rounded-xl bg-brand-gradient p-3 text-white" aria-label="Send">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Insight cards */}
          <div className="space-y-4">
            <div className="card">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <TrendingUp size={16} className="text-brand-emerald" /> Daily Market Summary
              </div>
              {summary ? (
                <p className="text-sm text-slate-400">
                  Bias is <span className={cn('font-medium', summary.bias === 'bullish' ? 'text-brand-emerald' : summary.bias === 'bearish' ? 'text-red-400' : 'text-slate-300')}>{summary.bias}</span>, averaging{' '}
                  <span className="text-white">{formatPercent(summary.avg)}</span> over 24h. Top mover{' '}
                  <span className="text-white">{assetName(summary.top.symbol)}</span> {formatPercent(summary.top.change)}.
                </p>
              ) : (
                <div className="h-10 animate-pulse rounded bg-white/5" />
              )}
            </div>

            <div className="card">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <ShieldCheck size={16} className="text-brand-blue" /> Portfolio Health Score
              </div>
              {health ? (
                <>
                  <div className="flex items-end gap-2">
                    <span className={cn('text-4xl font-bold', health.score >= 70 ? 'text-brand-emerald' : health.score >= 45 ? 'text-brand-gold' : 'text-red-400')}>
                      {health.score}
                    </span>
                    <span className="mb-1 text-slate-500">/ 100</span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={cn('h-full rounded-full', health.score >= 70 ? 'bg-brand-emerald' : health.score >= 45 ? 'bg-brand-gold' : 'bg-red-400')}
                      style={{ width: `${health.score}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-slate-400">
                    {health.count} assets · {(health.stableShare * 100).toFixed(0)}% stablecoins · {formatCurrency(health.total)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  {user ? 'Fund your demo wallets to see your score.' : 'Log in to see your portfolio health score.'}
                </p>
              )}
            </div>

            <div className="card">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <Activity size={16} className="text-brand-gold" /> Market Sentiment
              </div>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-white">{fng?.value ?? '—'}</span>
                <span className="text-sm text-slate-400">{fng?.label ?? 'Loading…'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="h-20" />
      <Footer />
    </main>
  );
}
