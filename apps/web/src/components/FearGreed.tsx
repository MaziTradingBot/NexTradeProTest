'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function FearGreed() {
  const [data, setData] = useState<{ value: number; label: string } | null>(null);

  useEffect(() => {
    api.get<{ value: number; label: string }>('/api/market/fear-greed').then(setData).catch(() => {});
  }, []);

  const value = data?.value ?? 50;
  // Semicircle gauge: -90deg (0) → +90deg (100)
  const angle = -90 + (value / 100) * 180;
  const color = value < 25 ? '#FF6B6B' : value < 45 ? '#F5B301' : value < 55 ? '#94a3b8' : value < 75 ? '#00C896' : '#0B6EFF';

  return (
    <div className="card">
      <h3 className="mb-1 text-sm font-semibold text-white">Fear &amp; Greed Index</h3>
      <p className="mb-3 text-xs text-slate-500">Market sentiment</p>
      <div className="flex items-center gap-5">
        <div className="relative h-20 w-40">
          <svg viewBox="0 0 100 55" className="h-full w-full">
            <path d="M5 50 A45 45 0 0 1 95 50" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" strokeLinecap="round" />
            <path
              d="M5 50 A45 45 0 0 1 95 50"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(value / 100) * 141} 141`}
            />
            <line
              x1="50"
              y1="50"
              x2={50 + 34 * Math.cos((angle - 90) * (Math.PI / 180))}
              y2={50 + 34 * Math.sin((angle - 90) * (Math.PI / 180))}
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="50" cy="50" r="3" fill="white" />
          </svg>
        </div>
        <div>
          <div className="text-3xl font-bold" style={{ color }}>
            {value}
          </div>
          <div className="text-sm text-slate-400">{data?.label ?? 'Neutral'}</div>
        </div>
      </div>
    </div>
  );
}
