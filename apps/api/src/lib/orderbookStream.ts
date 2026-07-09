// Live L2 order-book relay. Maintains a single upstream Binance depth websocket
// per symbol and fans its updates out to any number of SSE subscribers, so the
// browser gets a real streaming order book without ever connecting to an
// exchange directly (see docs/07-Market-Data-Service.md). Falls back silently:
// if the runtime has no WebSocket or the upstream is unreachable, no events are
// pushed and the client keeps using the REST snapshot / simulated book.

import type { Response } from 'express';

const BINANCE_WS = 'wss://stream.binance.com:9443/ws';

export interface DepthLevel {
  price: number;
  size: number;
}
interface Book {
  bids: DepthLevel[];
  asks: DepthLevel[];
}
interface SymbolStream {
  ws: WebSocket | null;
  latest: Book | null;
  subs: Set<Response>;
  reconnectTimer?: ReturnType<typeof setTimeout>;
  closing: boolean;
}

const streams = new Map<string, SymbolStream>();

function toLevels(rows: unknown): DepthLevel[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => {
      const [p, q] = r as [string, string];
      return { price: +p, size: +q };
    })
    .filter((l) => Number.isFinite(l.price) && l.size > 0)
    .slice(0, 14);
}

function broadcast(st: SymbolStream, book: Book) {
  const payload = `event: depth\ndata: ${JSON.stringify(book)}\n\n`;
  for (const res of st.subs) {
    try {
      res.write(payload);
    } catch {
      /* dead connection; cleaned up on its own close */
    }
  }
}

function connect(symbol: string, st: SymbolStream) {
  if (typeof WebSocket === 'undefined') return; // no WS runtime → REST/sim fallback
  try {
    // depth20@100ms = top-20 partial book snapshots, ~10/s.
    const ws = new WebSocket(`${BINANCE_WS}/${symbol.toLowerCase()}@depth20@100ms`);
    st.ws = ws;
    ws.addEventListener('message', (ev: MessageEvent) => {
      try {
        const raw = typeof ev.data === 'string' ? ev.data : String(ev.data);
        const msg = JSON.parse(raw) as { bids?: unknown; asks?: unknown };
        const book: Book = { bids: toLevels(msg.bids), asks: toLevels(msg.asks) };
        if (!book.bids.length && !book.asks.length) return;
        st.latest = book;
        broadcast(st, book);
      } catch {
        /* ignore malformed frame */
      }
    });
    ws.addEventListener('close', () => scheduleReconnect(symbol, st));
    ws.addEventListener('error', () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    });
  } catch {
    scheduleReconnect(symbol, st);
  }
}

function scheduleReconnect(symbol: string, st: SymbolStream) {
  if (st.closing || st.subs.size === 0 || st.reconnectTimer) return;
  st.reconnectTimer = setTimeout(() => {
    st.reconnectTimer = undefined;
    if (!st.closing && st.subs.size > 0) connect(symbol, st);
  }, 3000);
}

/** Subscribe an SSE response to a symbol's live depth. Returns an unsubscribe. */
export function subscribeOrderBook(symbol: string, res: Response): () => void {
  const sym = symbol.toUpperCase();
  let st = streams.get(sym);
  if (!st) {
    st = { ws: null, latest: null, subs: new Set(), closing: false };
    streams.set(sym, st);
    connect(sym, st);
  }
  st.subs.add(res);
  // Send the last-known book immediately so a new client isn't blank.
  if (st.latest) {
    try {
      res.write(`event: depth\ndata: ${JSON.stringify(st.latest)}\n\n`);
    } catch {
      /* ignore */
    }
  }
  return () => {
    const s = streams.get(sym);
    if (!s) return;
    s.subs.delete(res);
    if (s.subs.size === 0) {
      s.closing = true;
      if (s.reconnectTimer) clearTimeout(s.reconnectTimer);
      try {
        s.ws?.close();
      } catch {
        /* ignore */
      }
      streams.delete(sym);
    }
  };
}
