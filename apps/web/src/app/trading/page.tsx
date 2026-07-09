'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
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
import { useTradingAccount, liveMetrics, positionPnl, type Position } from '@/lib/useTradingAccount';
import { useLiveSync } from '@/lib/useLiveSync';
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

const usd = (v: number, d = 2) => `$${v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })}`;

function TradingTerminal() {
  const params = useSearchParams();
  const { tickers } = useTickers(5000);
  const { user } = useAuth();
  const { mode } = useMode();
  const isLive = mode === 'LIVE';
  const { summary, refresh } = useTradingAccount();
  // Live trading requires per-user admin activation. Demo is always open.
  const tradingLocked = isLive && !!user && !user.canLiveTrade;

  const [symbol, setSymbol] = useState((params.get('symbol') || 'BTCUSDT').toUpperCase());
  const ticker = tickers.find((t) => t.symbol === symbol);
  const copyFrom = params.get('copyFrom');
  const [copyPrefilled, setCopyPrefilled] = useState(false);

  const [klines, setKlines] = useState<Kline[]>([]);
  const [chartSource, setChartSource] = useState<'TRADINGVIEW' | 'BASIC'>('TRADINGVIEW');
  const [market, setMarket] = useState<'SPOT' | 'FUTURES'>('SPOT');
  const [leverage, setLeverage] = useState(10);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [amount, setAmount] = useState('');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'TRAILING_STOP'>('MARKET');
  const [limitPrice, setLimitPrice] = useState('');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [trailingPct, setTrailingPct] = useState('');
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

  // Real-time: refetch the account whenever the server signals a balance change
  // (admin funding, deposits/withdrawals, trade fills) — no refresh needed.
  useLiveSync(
    useCallback(() => {
      refresh();
      loadWallets();
      loadOrders();
    }, [refresh]),
  );

  const cancelOrder = async (id: string) => {
    try {
      await api.del(`/api/account/orders/${id}`);
      loadOrders();
    } catch {
      /* ignore */
    }
  };

  const price = ticker?.price ?? klines.at(-1)?.close ?? 0;

  // Live price lookup for any symbol from the streaming ticker feed. Positions
  // are re-valued on every tick, so the account metrics update in real time.
  const priceOf = (sym: string) => tickers.find((t) => t.symbol === sym.toUpperCase())?.price ?? 0;
  const metrics = summary ? liveMetrics(summary, priceOf) : null;

  // Copy-trading: pre-fill the order ticket from the trader's suggested setup.
  // The user still reviews and confirms — nothing is submitted automatically.
  useEffect(() => {
    if (!copyFrom) return;
    const s = params.get('side');
    if (s === 'BUY' || s === 'SELL') setSide(s);
    const lev = parseInt(params.get('leverage') || '', 10);
    if (lev) {
      setMarket('FUTURES');
      setLeverage(Math.min(125, Math.max(1, lev)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copyFrom]);

  useEffect(() => {
    if (!copyFrom || copyPrefilled || !price) return;
    const isLong = (params.get('side') ?? 'BUY') !== 'SELL';
    setStopLoss((isLong ? price * 0.97 : price * 1.03).toFixed(price < 2 ? 4 : 2));
    setTakeProfit((isLong ? price * 1.06 : price * 0.94).toFixed(price < 2 ? 4 : 2));
    const lev = parseInt(params.get('leverage') || '10', 10) || 10;
    const free = metrics?.freeMargin ?? 1000;
    const suggested = (free * 0.1 * lev) / price; // ~10% of free margin as notional
    if (suggested > 0) setAmount(suggested.toFixed(6));
    setCopyPrefilled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copyFrom, price, copyPrefilled, metrics]);
  const marginWarning =
    summary && metrics?.marginLevel != null && metrics.marginLevel <= summary.marginCallLevel;
  const stopOutClose =
    summary && metrics?.marginLevel != null && metrics.marginLevel <= summary.stopOutLevel;

  const closePosition = async (id: string) => {
    try {
      await api.post(`/api/account/orders/${id}/close`);
      refresh();
      loadWallets();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed to close position');
    }
  };

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
    const needsLimit = orderType === 'LIMIT' || orderType === 'STOP_LIMIT';
    const needsTrigger = orderType === 'STOP' || orderType === 'STOP_LIMIT';
    const limit = needsLimit ? parseFloat(limitPrice) : price;
    if (needsLimit && (!limit || limit <= 0)) {
      setMsg('Enter a valid limit price.');
      return;
    }
    const trigger = needsTrigger ? parseFloat(triggerPrice) : undefined;
    if (needsTrigger && (!trigger || trigger <= 0)) {
      setMsg('Enter a valid trigger price.');
      return;
    }
    const trail = orderType === 'TRAILING_STOP' ? parseFloat(trailingPct) : undefined;
    if (orderType === 'TRAILING_STOP' && (!trail || trail <= 0)) {
      setMsg('Enter a trailing distance (%).');
      return;
    }
    const sl = parseFloat(stopLoss) || undefined;
    const tp = parseFloat(takeProfit) || undefined;
    const lev = market === 'FUTURES' ? leverage : 1;

    // Pre-flight free-margin check for market positions (mirrors the server).
    if (orderType === 'MARKET' && metrics) {
      const marginNeeded = (price * amt) / lev;
      if (marginNeeded > metrics.freeMargin + 1e-8) {
        setMsg(`Insufficient free margin. Needs ${usd(marginNeeded)} · available ${usd(metrics.freeMargin)}.`);
        return;
      }
    }
    try {
      await api.post('/api/account/orders', {
        symbol,
        side,
        type: orderType,
        price: limit,
        amount: amt,
        leverage: lev,
        stopLoss: sl,
        takeProfit: tp,
        triggerPrice: trigger,
        trailingPercent: trail,
      });
      const levLabel = market === 'FUTURES' ? ` at ${leverage}x` : '';
      const dir = market === 'FUTURES' ? (side === 'BUY' ? 'LONG' : 'SHORT') : side;
      const label = orderType === 'MARKET' ? 'position opened' : `${orderType.replace('_', ' ').toLowerCase()} order placed`;
      setMsg(`✓ ${dir} ${label} for ${amt} ${assetName(symbol)}${levLabel}`);
      setAmount('');
      setStopLoss('');
      setTakeProfit('');
      setTriggerPrice('');
      setTrailingPct('');
      loadOrders();
      refresh();
      loadWallets();
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

      {copyFrom && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-3 text-sm text-ink-soft">
          <span className="mt-0.5">📋</span>
          <div>
            <div className="font-semibold text-ink">Copying {copyFrom}</div>
            <p className="mt-0.5">
              We&apos;ve pre-filled a suggested {side === 'BUY' ? 'long' : 'short'} order on {assetName(symbol)} — review the
              size, leverage, stop-loss and take-profit below, adjust anything you like, then confirm to place it. Nothing is
              submitted automatically.
            </p>
          </div>
        </div>
      )}

      {tradingLocked && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-brand-blue/25 bg-brand-blue/10 px-4 py-3 text-sm text-ink-soft">
          <span className="mt-0.5">🔒</span>
          <div>
            <div className="font-semibold text-ink">Live trading not yet enabled</div>
            <p className="mt-0.5">
              Live trading has not yet been enabled for your account. Please contact support or wait for
              administrator activation. You can still manage your wallet, deposits, withdrawals and settings.
            </p>
          </div>
        </div>
      )}

      {/* Account summary — professional trading metrics, live-updated */}
      {user && summary && metrics && (
        <div className="card mb-4 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{isLive ? 'Live' : 'Demo'} Trading Account</span>
            <span className={cn('badge', isLive ? 'bg-brand-blue/15 text-brand-blue' : 'bg-brand-gold/10 text-brand-gold')}>
              {isLive ? 'Live' : 'Demo'} · {summary.currency}
            </span>
            {metrics.marginLevel != null && (
              <span
                className={cn(
                  'badge ml-auto',
                  metrics.marginLevel <= summary.stopOutLevel
                    ? 'bg-red-500/15 text-red-400'
                    : metrics.marginLevel <= summary.marginCallLevel
                      ? 'bg-brand-gold/15 text-brand-gold'
                      : 'bg-brand-emerald/15 text-brand-emerald',
                )}
              >
                Margin {metrics.marginLevel.toFixed(1)}%
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: 'Balance', value: usd(metrics.balance) },
              { label: 'Equity', value: usd(metrics.equity) },
              {
                label: 'Floating P/L',
                value: `${metrics.floatingPnl >= 0 ? '+' : ''}${usd(metrics.floatingPnl)}`,
                tone: metrics.floatingPnl > 0 ? 'up' : metrics.floatingPnl < 0 ? 'down' : undefined,
              },
              { label: 'Free Margin', value: usd(metrics.freeMargin) },
              { label: 'Used Margin', value: usd(metrics.usedMargin) },
              {
                label: 'Margin Level',
                value: metrics.marginLevel != null ? `${metrics.marginLevel.toFixed(1)}%` : '—',
              },
              { label: 'Open Positions', value: String(metrics.openPositions) },
              { label: 'Total Exposure', value: usd(metrics.exposure) },
              { label: 'Available Margin', value: usd(metrics.availableMargin) },
              { label: 'Reserved', value: usd(summary.locked) },
            ].map((m) => (
              <div key={m.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">{m.label}</div>
                <div
                  className={cn(
                    'mt-0.5 font-mono text-sm font-semibold',
                    m.tone === 'up' ? 'text-brand-emerald' : m.tone === 'down' ? 'text-red-400' : 'text-white',
                  )}
                >
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {marginWarning && (
        <div
          className={cn(
            'mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm',
            stopOutClose ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-brand-gold/40 bg-brand-gold/10 text-amber-100',
          )}
        >
          <span className="mt-0.5">⚠️</span>
          <div>
            <div className="font-semibold text-white">
              {stopOutClose ? 'Stop-out imminent' : 'Margin call'}
            </div>
            <p className="mt-0.5 opacity-90">
              Your margin level is {metrics?.marginLevel?.toFixed(1)}%. Positions are force-closed at{' '}
              {summary?.stopOutLevel}%. Add funds or close positions to avoid liquidation.
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
          <div className="mb-4 grid grid-cols-3 gap-1.5">
            {([['MARKET', 'Market'], ['LIMIT', 'Limit'], ['STOP', 'Stop'], ['STOP_LIMIT', 'Stop-Limit'], ['TRAILING_STOP', 'Trailing']] as const).map(([t, lbl]) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className={cn('rounded-lg py-2 text-[11px] font-semibold transition', orderType === t ? 'bg-brand-blue text-white' : 'bg-white/5 text-slate-400 hover:text-white')}
              >
                {lbl}
              </button>
            ))}
          </div>

          {(orderType === 'STOP' || orderType === 'STOP_LIMIT') && (
            <>
              <label className="label">Trigger price (USDT)</label>
              <input
                value={triggerPrice}
                onChange={(e) => setTriggerPrice(e.target.value)}
                type="number"
                placeholder={price ? price.toFixed(2) : '0.00'}
                className="input mb-3"
              />
            </>
          )}

          {orderType === 'TRAILING_STOP' && (
            <>
              <label className="label">Trailing distance (%)</label>
              <input
                value={trailingPct}
                onChange={(e) => setTrailingPct(e.target.value)}
                type="number"
                placeholder="e.g. 2.5"
                className="input mb-3"
              />
            </>
          )}

          {(orderType === 'LIMIT' || orderType === 'STOP_LIMIT') && (
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
            disabled={tradingLocked}
            className={cn(
              'w-full rounded-xl py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50',
              side === 'BUY' ? 'bg-brand-emerald hover:brightness-110' : 'bg-red-500 hover:brightness-110',
            )}
          >
            {tradingLocked
              ? 'Live trading not enabled'
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

      {/* Open positions */}
      {user && summary && (
        <div className="card mt-4 p-0">
          <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3">
            <span className="text-sm font-semibold text-white">Open Positions</span>
            <span className="badge bg-white/5 text-slate-400">{summary.positions.length}</span>
          </div>
          {summary.positions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">No open positions. Place a market order to open one.</p>
          ) : (
            <>
              {/* Tablet / desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-2">Pair</th>
                      <th className="px-5 py-2">Side</th>
                      <th className="px-5 py-2 text-right">Size</th>
                      <th className="px-5 py-2 text-right">Entry</th>
                      <th className="px-5 py-2 text-right">Mark</th>
                      <th className="px-5 py-2 text-right">Margin</th>
                      <th className="px-5 py-2 text-right">P/L</th>
                      <th className="px-5 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {summary.positions.map((p: Position) => {
                      const mark = priceOf(p.symbol) || p.markPrice || p.entryPrice;
                      const pnl = positionPnl(p, mark);
                      const pnlPct = p.margin > 0 ? (pnl / p.margin) * 100 : 0;
                      return (
                        <tr key={p.id}>
                          <td className="px-5 py-2.5 font-medium text-white">
                            {assetName(p.symbol)}/USDT
                            {p.leverage > 1 && <span className="ml-1.5 text-[11px] text-brand-gold">{p.leverage}x</span>}
                          </td>
                          <td className={cn('px-5 py-2.5 font-semibold', p.side === 'BUY' ? 'text-brand-emerald' : 'text-red-400')}>
                            {p.side === 'BUY' ? 'Long' : 'Short'}
                          </td>
                          <td className="px-5 py-2.5 text-right font-mono text-slate-300">{p.amount}</td>
                          <td className="px-5 py-2.5 text-right font-mono text-slate-300">{usd(p.entryPrice, p.entryPrice < 2 ? 4 : 2)}</td>
                          <td className="px-5 py-2.5 text-right font-mono text-slate-300">{usd(mark, mark < 2 ? 4 : 2)}</td>
                          <td className="px-5 py-2.5 text-right font-mono text-slate-400">{usd(p.margin)}</td>
                          <td className={cn('px-5 py-2.5 text-right font-mono font-semibold', pnl >= 0 ? 'text-brand-emerald' : 'text-red-400')}>
                            {pnl >= 0 ? '+' : ''}
                            {usd(pnl)}
                            <span className="ml-1 text-[11px] opacity-70">({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)</span>
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            <button onClick={() => closePosition(p.id)} className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20">
                              Close
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Phone cards */}
              <div className="space-y-2 p-3 md:hidden">
                {summary.positions.map((p: Position) => {
                  const mark = priceOf(p.symbol) || p.markPrice || p.entryPrice;
                  const pnl = positionPnl(p, mark);
                  const pnlPct = p.margin > 0 ? (pnl / p.margin) * 100 : 0;
                  return (
                    <div key={p.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="font-semibold text-white">{assetName(p.symbol)}/USDT</span>
                          <span className={cn('text-xs font-semibold', p.side === 'BUY' ? 'text-brand-emerald' : 'text-red-400')}>{p.side === 'BUY' ? 'Long' : 'Short'}</span>
                          {p.leverage > 1 && <span className="text-[11px] text-brand-gold">{p.leverage}x</span>}
                        </span>
                        <button onClick={() => closePosition(p.id)} className="shrink-0 rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20">Close</button>
                      </div>
                      <div className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
                        <div><div className="text-slate-500">Size</div><div className="font-mono text-slate-300">{p.amount}</div></div>
                        <div><div className="text-slate-500">Entry</div><div className="font-mono text-slate-300">{usd(p.entryPrice, p.entryPrice < 2 ? 4 : 2)}</div></div>
                        <div><div className="text-slate-500">Mark</div><div className="font-mono text-slate-300">{usd(mark, mark < 2 ? 4 : 2)}</div></div>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2.5">
                        <span className="text-xs text-slate-500">Margin {usd(p.margin)}</span>
                        <span className={cn('font-mono text-sm font-semibold', pnl >= 0 ? 'text-brand-emerald' : 'text-red-400')}>{pnl >= 0 ? '+' : ''}{usd(pnl)} <span className="text-[11px] opacity-70">({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Open orders (pending limit / stop) */}
      {user && openOrders.filter((o) => o.status === 'OPEN').length > 0 && (
        <div className="card mt-4 p-0">
          <div className="border-b border-white/10 px-5 py-3 text-sm font-semibold text-white">Working Orders</div>
          {openOrders.filter((o) => o.status === 'OPEN').length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">No open orders.</p>
          ) : (
            <>
              {/* Tablet / desktop table */}
              <div className="hidden overflow-x-auto md:block">
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
              {/* Phone cards */}
              <div className="space-y-2 p-3 md:hidden">
                {openOrders
                  .filter((o) => o.status === 'OPEN')
                  .map((o) => (
                    <div key={o.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{o.symbol}</span>
                          <span className={cn('text-xs font-semibold', o.side === 'BUY' ? 'text-brand-emerald' : 'text-red-400')}>{o.side}</span>
                          <span className="text-[11px] text-slate-500">{o.type}</span>
                        </div>
                        <div className="mt-1 font-mono text-xs text-slate-300">${parseFloat(o.price).toLocaleString()} · {parseFloat(o.amount)}</div>
                      </div>
                      <button onClick={() => cancelOrder(o.id)} className="shrink-0 rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/25">Cancel</button>
                    </div>
                  ))}
              </div>
            </>
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
