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
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
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
  const symbol = (params.get('symbol') || 'BTCUSDT').toUpperCase();
  const { tickers } = useTickers(5000);
  const { user } = useAuth();
  const ticker = tickers.find((t) => t.symbol === symbol);

  const [klines, setKlines] = useState<Kline[]>([]);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [amount, setAmount] = useState('');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [limitPrice, setLimitPrice] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);

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
    try {
      await api.post('/api/account/orders', {
        symbol,
        side,
        type: orderType,
        price: limit,
        amount: amt,
      });
      setMsg(
        orderType === 'MARKET'
          ? `✓ Simulated ${side} order for ${amt} ${assetName(symbol)} filled at $${price.toLocaleString()}`
          : `✓ ${side} limit order placed for ${amt} ${assetName(symbol)} @ $${limit.toLocaleString()}`,
      );
      setAmount('');
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
        <span className="ml-auto badge bg-brand-gold/10 text-brand-gold">Simulated execution</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_240px_300px]">
        {/* Chart */}
        <div className="card p-4">
          <div className="h-[420px] w-full">
            {klines.length > 0 ? (
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

        {/* Order book */}
        <OrderBook price={price} />

        {/* Order ticket */}
        <div className="card p-5">
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setSide('BUY')}
              className={cn('rounded-xl py-2.5 text-sm font-semibold transition', side === 'BUY' ? 'bg-brand-emerald text-white' : 'bg-white/5 text-slate-400')}
            >
              Buy
            </button>
            <button
              onClick={() => setSide('SELL')}
              className={cn('rounded-xl py-2.5 text-sm font-semibold transition', side === 'SELL' ? 'bg-red-500 text-white' : 'bg-white/5 text-slate-400')}
            >
              Sell
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

          <label className="label">Amount ({assetName(symbol)})</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            placeholder="0.00"
            className="input mb-2"
          />
          <div className="mb-4 text-xs text-slate-500">
            ≈ ${((parseFloat(amount) || 0) * (orderType === 'LIMIT' ? parseFloat(limitPrice) || price : price)).toLocaleString()} USDT
          </div>

          <button
            onClick={placeOrder}
            className={cn('w-full rounded-xl py-3 text-sm font-semibold text-white transition', side === 'BUY' ? 'bg-brand-emerald hover:brightness-110' : 'bg-red-500 hover:brightness-110')}
          >
            {side === 'BUY' ? 'Buy' : 'Sell'} {assetName(symbol)}
          </button>

          {msg && <p className="mt-3 text-center text-xs text-slate-300">{msg}</p>}
          {!user && (
            <p className="mt-3 text-center text-xs text-slate-500">
              Demo trading uses live prices with simulated fills.
            </p>
          )}
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
