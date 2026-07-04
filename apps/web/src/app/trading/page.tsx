'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Navbar } from '@/components/Navbar';
import { OrderBook } from '@/components/OrderBook';
import { RecentTrades } from '@/components/RecentTrades';
import TradingViewChart from '@/components/TradingViewChart';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { useMode } from '@/lib/useMode';
import { useTickers, assetName } from '@/lib/useTickers';
import { formatPercent, cn } from '@/lib/utils';

interface Kline {
  time: number;
  close: number;
  high: number;
  low: number;
}

interface OpenOrder {
  id: string;
  symbol: string;
  side: string;
  type: string;
  price: string;
  amount: string;
  status: string;
}

function TradingTerminal() {
  const params = useSearchParams();
  const { tickers } = useTickers(5000);
  const { user } = useAuth();
  const { mode } = useMode();
  const isLive = mode === 'LIVE';

  const [symbol, setSymbol] = useState((params.get('symbol') || 'BTCUSDT').toUpperCase());
  const ticker = tickers.find((t) => t.symbol === symbol);

  const [klines, setKlines] = useState<Kline[]>([]);
  const [chartSource, setChartSource] = useState<'TRADINGVIEW' | 'BASIC'>('TRADINGVIEW');
  const [market, setMarket] = useState<'SPOT' | 'FUTURES'>('SPOT');
  const [leverage, setLeverage] = useState(10);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [amount, setAmount] = useState('');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [pairQuery, setPairQuery] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [wallets, setWallets] = useState<{ asset: string; balance: string }[]>([]);

  const loadWallets = () => {
    if (!user) return;
    api.get<{ asset: string; balance: string }[]>('/api/account/wallets').then(setWallets).catch(() => {});
  };
  useEffect(loadWallets, [user, mode]);

  useEffect(() => {
    api
      .get<Kline[]>(`/api/market/klines?symbol=${symbol}&interval=1h`)
      .then(setKlines)
      .catch(() => setKlines([]));
  }, [symbol]);

  const loadOrders = () => {
    if (!user) return;
    api.get<OpenOrder[]>('/api/account/orders').then(setOpenOrders).catch(() => {});
  };
  useEffect(loadOrders, [user]);

  const cancelOrder = async (id: string) => {
    try {
      await api.del(`/api/account/orders/${id}`);
      loadOrders();
    } catch {
      /* ignore */
    }
  };

  const price = ticker?.price ?? klines.at(-1)?.close ?? 0;

  const placeOrder = async () => {
    setMsg(null);
    if (!user) {
      setMsg('Please log in to place a simulated order.');
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setMsg('Enter a valid amount.');
      return;
    }
    const limit = orderType === 'LIMIT' ? parseFloat(limitPrice) : price;
    if (orderType === 'LIMIT' && (!limit || limit <= 0)) {
      setMsg('Enter a valid limit price.');
      return;
    }
    const sl = parseFloat(stopLoss) || undefined;
    const tp = parseFloat(takeProfit) || undefined;
    try {
      await api.post('/api/account/orders', {
        symbol,
        side,
        type: orderType,
        price: limit,
        amount: amt,
        leverage: market === 'FUTURES' ? leverage : 1,
        stopLoss: sl,
        takeProfit: tp,
      });
      const lev = market === 'FUTURES' ? ` at ${leverage}x` : '';
      const dir = market === 'FUTURES' ? (side === 'BUY' ? 'LONG' : 'SHORT') : side;
      const prot = sl || tp ? ` · SL ${sl ?? '—'} / TP ${tp ?? '—'}` : '';
      setMsg(
        (orderType === 'MARKET'
          ? `✓ Simulated ${dir} order for ${amt} ${assetName(symbol)}${lev} filled at $${price.toLocaleString()}`
          : `✓ ${dir} limit order placed for ${amt} ${assetName(symbol)}${lev} @ $${limit.toLocaleString()}`) + prot,
      );
      setAmount('');
      setStopLoss('');
      setTakeProfit('');
      loadOrders();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Order failed');
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 lg:px-8">
      {/* Symbol header */}
      <div className="card mb-4 flex flex-wrap items-center gap-6 p-4">
        <div>
          <div className="text-xs text-slate-400">Pair</div>
          <div className="text-xl font-bold text-white">{assetName(symbol)}/USDT</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Price</div>
          <div className="font-mono text-xl font-semibold text-white">${price.toLocaleString()}</div>
        </div>
        {ticker && (
          <div>
            <div className="text-xs text-slate-400">24h Change</div>
            <div className={cn('font-mono font-semibold', ticker.change >= 0 ? 'text-brand-emerald' : 'text-red-400')}>
              {formatPercent(ticker.change)}
            </div>
          </div>
        )}
        {user && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">
            <div className="text-xs text-slate-400">{mode === 'DEMO' ? 'Demo' : 'Live'} Balance</div>
            <div className="font-mono text-lg font-semibold text-brand-emerald">
              ${parseFloat(wallets.find((w) => w.asset === 'USDT')?.balance ?? '0').toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
              <span className="text-xs text-slate-400">USDT</span>
            </div>
          </div>
        )}
        <span className={cn('ml-auto badge', isLive ? 'bg-brand-blue/15 text-brand-blue' : 'bg-brand-gold/10 text-brand-gold')}>
          {isLive ? 'Live Mode' : 'Simulated execution'}
        </span>
      </div>

      {isLive && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-brand-blue/30 bg-brand-blue/10 px-4 py-3 text-sm text-slate-200">
          <span className="mt-0.5 text-brand-blue">🔒</span>
          <div>
            <div className="font-semibold text-white">Live trading is not yet available</div>
            <p className="mt-0.5 text-slate-400">
              Real trading is available only after exchange integration, regulatory compliance, and
              administrator activation. Switch to Demo Mode to trade with simulated execution.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_240px_300px]">
        {/* Chart */}
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Chart</span>
            <div className="ml-auto inline-flex rounded-lg border border-white/10 bg-black/20 p-0.5 text-xs">
              {(['TRADINGVIEW', 'BASIC'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setChartSource(c)}
                  className={cn('rounded-md px-2.5 py-1 font-semibold transition', chartSource === c ? 'bg-white/10 text-white' : 'text-slate-400')}
                >
                  {c === 'TRADINGVIEW' ? 'TradingView' : 'Basic'}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[440px] w-full overflow-hidden rounded-xl">
            {chartSource === 'TRADINGVIEW' ? (
              <TradingViewChart symbol={symbol} />
            ) : klines.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={klines}>
                  <defs>
                    <linearGradient id="px" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0B6EFF" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#0B6EFF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis domain={['auto', 'auto']} orientation="right" tick={{ fill: '#64748b', fontSize: 11 }} width={60} />
                  <Tooltip
                    contentStyle={{ background: '#0F1622', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                    labelFormatter={() => ''}
                    formatter={(v: number) => [`$${v.toLocaleString()}`, 'Price']}
                  />
                  <Area type="monotone" dataKey="close" stroke="#0B6EFF" strokeWidth={2} fill="url(#px)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500">Loading chart…</div>
            )}
          </div>
        </div>

        {/* Order book + recent trades */}
        <div className="space-y-4">
          <OrderBook price={price} symbol={symbol} />
          <RecentTrades price={price} symbol={symbol} />
        </div>

        {/* Right column: pair selector + order ticket */}
        <div className="space-y-4">
        {/* Pair selector */}
        <div className="card p-0">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="mb-2 text-sm font-semibold text-white">Pairs</div>
            <input
              value={pairQuery}
              onChange={(e) => setPairQuery(e.target.value)}
              placeholder="Search…"
              className="input py-1.5 text-xs"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {tickers
              .filter((t) => assetName(t.symbol).toLowerCase().includes(pairQuery.toLowerCase()))
              .map((t) => (
                <button
                  key={t.symbol}
                  onClick={() => setSymbol(t.symbol)}
                  className={cn(
                    'flex w-full items-center justify-between px-4 py-2 text-left text-xs transition hover:bg-white/5',
                    symbol === t.symbol && 'bg-white/5',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-white">{assetName(t.symbol)}</span>
                    <span className="text-slate-500">/USDT</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-mono text-slate-300">${t.price.toLocaleString(undefined, { maximumFractionDigits: t.price < 2 ? 4 : 2 })}</span>
                    <span className={cn('block font-mono', t.change >= 0 ? 'text-brand-emerald' : 'text-red-400')}>{formatPercent(t.change)}</span>
                  </span>
                </button>
              ))}
            {tickers.length === 0 && <div className="px-4 py-6 text-center text-xs text-slate-500">Loading pairs…</div>}
          </div>
        </div>

        {/* Order ticket */}
        <div className="card p-5">
          {/* Spot / Futures */}
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-black/20 p-1">
            {(['SPOT', 'FUTURES'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMarket(m)}
                className={cn('rounded-lg py-1.5 text-xs font-semibold transition', market === m ? 'bg-white/10 text-white' : 'text-slate-400')}
              >
                {m.charAt(0) + m.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Leverage (futures only) */}
          {market === 'FUTURES' && (
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="label mb-0">Leverage</span>
                <span className="font-mono text-sm font-semibold text-brand-gold">{leverage}x</span>
              </div>
              <input
                type="range"
                min={1}
                max={125}
                value={leverage}
                onChange={(e) => setLeverage(parseInt(e.target.value, 10))}
                className="w-full accent-brand-gold"
              />
              <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                {[1, 25, 50, 75, 100, 125].map((l) => (
                  <button key={l} onClick={() => setLeverage(l)} className="hover:text-white">
                    {l}x
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setSide('BUY')}
              className={cn('rounded-xl py-2.5 text-sm font-semibold transition', side === 'BUY' ? 'bg-brand-emerald text-white' : 'bg-white/5 text-slate-400')}
            >
              {market === 'FUTURES' ? 'Long' : 'Buy'}
            </button>
            <button
              onClick={() => setSide('SELL')}
              className={cn('rounded-xl py-2.5 text-sm font-semibold transition', side === 'SELL' ? 'bg-red-500 text-white' : 'bg-white/5 text-slate-400')}
            >
              {market === 'FUTURES' ? 'Short' : 'Sell'}
            </button>
          </div>

          <label className="label">Order type</label>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {(['MARKET', 'LIMIT'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className={cn('rounded-xl py-2 text-xs font-semibold transition', orderType === t ? 'bg-brand-blue text-white' : 'bg-white/5 text-slate-400')}
              >
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {orderType === 'LIMIT' && (
            <>
              <label className="label">Limit price (USDT)</label>
              <input
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                type="number"
                placeholder={price ? price.toFixed(2) : '0.00'}
                className="input mb-3"
              />
            </>
          )}

          {(() => {
            const quoteBal = parseFloat(wallets.find((w) => w.asset === 'USDT')?.balance ?? '0');
            const baseBal = parseFloat(wallets.find((w) => w.asset === assetName(symbol))?.balance ?? '0');
            const px = orderType === 'LIMIT' ? parseFloat(limitPrice) || price : price;
            const avail = side === 'BUY' ? quoteBal : baseBal;
            const availLabel = side === 'BUY' ? 'USDT' : assetName(symbol);
            const setPct = (pct: number) => {
              const maxAmt = side === 'BUY' ? (px ? (quoteBal * pct) / px : 0) : baseBal * pct;
              setAmount(maxAmt > 0 ? maxAmt.toFixed(6) : '');
            };
            return (
              <>
                <div className="mb-1 flex items-center justify-between">
                  <label className="label mb-0">Amount ({assetName(symbol)})</label>
                  <span className="text-xs text-slate-400">
                    Avail: <span className="font-mono text-white">{avail.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span> {availLabel}
                  </span>
                </div>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder="0.00" className="input mb-2" />
                <div className="mb-2 grid grid-cols-4 gap-1.5">
                  {[0.25, 0.5, 0.75, 1].map((p) => (
                    <button key={p} onClick={() => setPct(p)} className="rounded-lg bg-white/5 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/10">
                      {p * 100}%
                    </button>
                  ))}
                </div>
                <div className="mb-4 text-xs text-slate-500">≈ ${((parseFloat(amount) || 0) * px).toLocaleString()} USDT</div>
              </>
            );
          })()}

          {/* Stop Loss / Take Profit */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div>
              <label className="label text-red-400">Stop Loss</label>
              <input
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                type="number"
                placeholder="Price"
                className="input py-2"
              />
            </div>
            <div>
              <label className="label text-brand-emerald">Take Profit</label>
              <input
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                type="number"
                placeholder="Price"
                className="input py-2"
              />
            </div>
          </div>

          {market === 'FUTURES' && (() => {
            const notional = (parseFloat(amount) || 0) * price;
            const margin = notional / leverage;
            const liq = side === 'BUY' ? price * (1 - 1 / leverage) : price * (1 + 1 / leverage);
            return (
              <div className="mb-4 space-y-1 rounded-xl bg-white/5 p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Margin required</span>
                  <span className="font-mono text-white">${margin.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Est. liquidation</span>
                  <span className="font-mono text-red-400">${liq.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            );
          })()}

          <button
            onClick={placeOrder}
            disabled={isLive}
            className={cn(
              'w-full rounded-xl py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50',
              side === 'BUY' ? 'bg-brand-emerald hover:brightness-110' : 'bg-red-500 hover:brightness-110',
            )}
          >
            {isLive
              ? 'Unavailable in Live Mode'
              : `${market === 'FUTURES' ? `${side === 'BUY' ? 'Long' : 'Short'} ${leverage}x` : side === 'BUY' ? 'Buy' : 'Sell'} ${assetName(symbol)}`}
          </button>

          {msg && <p className="mt-3 text-center text-xs text-slate-300">{msg}</p>}
          {!user && (
            <p className="mt-3 text-center text-xs text-slate-500">
              Demo trading uses live prices with simulated fills.
            </p>
          )}
        </div>
        </div>
      </div>

      {/* Open orders */}
      {user && (
        <div className="card mt-4 p-0">
          <div className="border-b border-white/10 px-5 py-3 text-sm font-semibold text-white">Open Orders</div>
          {openOrders.filter((o) => o.status === 'OPEN').length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">No open orders.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-2">Pair</th>
                    <th className="px-5 py-2">Side</th>
                    <th className="px-5 py-2">Type</th>
                    <th className="px-5 py-2 text-right">Price</th>
                    <th className="px-5 py-2 text-right">Amount</th>
                    <th className="px-5 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {openOrders
                    .filter((o) => o.status === 'OPEN')
                    .map((o) => (
                      <tr key={o.id}>
                        <td className="px-5 py-2.5 font-medium text-white">{o.symbol}</td>
                        <td className={cn('px-5 py-2.5', o.side === 'BUY' ? 'text-brand-emerald' : 'text-red-400')}>{o.side}</td>
                        <td className="px-5 py-2.5 text-slate-400">{o.type}</td>
                        <td className="px-5 py-2.5 text-right font-mono text-slate-300">${parseFloat(o.price).toLocaleString()}</td>
                        <td className="px-5 py-2.5 text-right font-mono text-slate-300">{parseFloat(o.amount)}</td>
                        <td className="px-5 py-2.5 text-right">
                          <button onClick={() => cancelOrder(o.id)} className="rounded-lg bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/25">
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      <div className="h-16" />
    </section>
  );
}

export default function TradingPage() {
  return (
    <main>
      <Navbar />
      <Suspense fallback={<div className="pt-32 text-center text-slate-500">Loading terminal…</div>}>
        <TradingTerminal />
      </Suspense>
    </main>
  );
}
