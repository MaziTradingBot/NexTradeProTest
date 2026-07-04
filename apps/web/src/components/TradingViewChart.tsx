'use client';

import { memo, useEffect, useRef } from 'react';

// Embeds TradingView's Advanced Chart widget. Loads from TradingView's CDN in
// the user's browser (fine on Vercel — CSP only restricts sandboxed artifacts).
function TradingViewChart({ symbol, exchange = 'BINANCE' }: { symbol: string; exchange?: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    const theme =
      typeof document !== 'undefined' && document.documentElement.classList.contains('light') ? 'light' : 'dark';

    el.innerHTML = '<div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: `${exchange}:${symbol}`,
      interval: '60',
      timezone: 'Etc/UTC',
      theme,
      style: '1',
      locale: 'en',
      backgroundColor: theme === 'dark' ? 'rgba(15, 22, 34, 1)' : 'rgba(255,255,255,1)',
      gridColor: 'rgba(255, 255, 255, 0.06)',
      allow_symbol_change: true,
      hide_side_toolbar: false,
      details: false,
      support_host: 'https://www.tradingview.com',
    });
    el.appendChild(script);

    return () => {
      el.innerHTML = '';
    };
  }, [symbol, exchange]);

  return <div ref={container} className="tradingview-widget-container h-full w-full" style={{ height: '100%', width: '100%' }} />;
}

export default memo(TradingViewChart);
