import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NexTradePro — Crypto Trading Platform',
    short_name: 'NexTradePro',
    description: 'Institutional-grade cryptocurrency trading platform with live market data and simulated execution.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0A0E17',
    theme_color: '#0A0E17',
    orientation: 'portrait',
    categories: ['finance', 'business'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
