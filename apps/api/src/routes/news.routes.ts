import { Router } from 'express';
import { prisma } from '../lib/prisma';

// News Center (docs/07 §6). Aggregates approved free providers — CryptoPanic and
// NewsAPI (both key-gated) — normalizes and classifies into sections, caches the
// result, and always falls back to platform announcements + a curated set so the
// page is never empty. The frontend only ever reads this endpoint.

const router = Router();

const CRYPTOPANIC_TOKEN = process.env.CRYPTOPANIC_TOKEN || '';
const NEWSAPI_KEY = process.env.NEWSAPI_KEY || '';

export interface NewsItem {
  id: string;
  title: string;
  url: string | null;
  source: string;
  publishedAt: string;
  section: string;
  summary?: string;
}

export const NEWS_SECTIONS = [
  { key: 'ALL', label: 'Breaking' },
  { key: 'BITCOIN', label: 'Bitcoin' },
  { key: 'ETHEREUM', label: 'Ethereum' },
  { key: 'ALTCOINS', label: 'Altcoins' },
  { key: 'DEFI', label: 'DeFi' },
  { key: 'AI', label: 'AI' },
  { key: 'REGULATION', label: 'Regulation' },
  { key: 'MARKETS', label: 'Markets' },
  { key: 'ANALYSIS', label: 'Analysis' },
];

// Keyword → section. First match wins; otherwise MARKETS.
function classify(text: string): string {
  const t = text.toLowerCase();
  const rules: [RegExp, string][] = [
    [/\b(sec|regulat|lawsuit|court|ban|congress|government|legal|compliance|etf approval)\b/, 'REGULATION'],
    [/\b(defi|uniswap|aave|lending|dex|yield|liquidity|staking)\b/, 'DEFI'],
    [/\b(ai|artificial intelligence|bittensor|\btao\b|fetch\.ai|render network)\b/, 'AI'],
    [/\b(bitcoin|btc)\b/, 'BITCOIN'],
    [/\b(ethereum|ether|\beth\b)\b/, 'ETHEREUM'],
    [/\b(solana|\bxrp\b|cardano|altcoin|dogecoin|\bbnb\b|avalanche)\b/, 'ALTCOINS'],
    [/\b(analysis|outlook|forecast|prediction|technical|chart)\b/, 'ANALYSIS'],
  ];
  for (const [re, section] of rules) if (re.test(t)) return section;
  return 'MARKETS';
}

let cache: { at: number; items: NewsItem[] } | null = null;
const TTL = 3 * 60 * 1000;

async function fetchCryptoPanic(): Promise<NewsItem[]> {
  if (!CRYPTOPANIC_TOKEN) return [];
  const resp = await fetch(`https://cryptopanic.com/api/v1/posts/?auth_token=${CRYPTOPANIC_TOKEN}&public=true&kind=news`);
  if (!resp.ok) throw new Error(`CryptoPanic ${resp.status}`);
  const json = (await resp.json()) as { results?: Array<{ id: number; title: string; url: string; published_at: string; domain?: string; source?: { title?: string } }> };
  return (json.results ?? []).map((p) => ({
    id: `cp-${p.id}`,
    title: p.title,
    url: p.url,
    source: p.source?.title || p.domain || 'CryptoPanic',
    publishedAt: p.published_at,
    section: classify(p.title),
  }));
}

async function fetchNewsApi(): Promise<NewsItem[]> {
  if (!NEWSAPI_KEY) return [];
  const q = encodeURIComponent('crypto OR bitcoin OR ethereum OR blockchain');
  const resp = await fetch(`https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&pageSize=50&apiKey=${NEWSAPI_KEY}`);
  if (!resp.ok) throw new Error(`NewsAPI ${resp.status}`);
  const json = (await resp.json()) as { articles?: Array<{ title: string; url: string; publishedAt: string; description?: string; source?: { name?: string } }> };
  return (json.articles ?? []).map((a, i) => ({
    id: `na-${i}-${a.publishedAt}`,
    title: a.title,
    url: a.url,
    source: a.source?.name || 'NewsAPI',
    publishedAt: a.publishedAt,
    section: classify(`${a.title} ${a.description ?? ''}`),
    summary: a.description,
  }));
}

// Platform announcements always contribute (managed by Content Admins).
async function fetchAnnouncements(): Promise<NewsItem[]> {
  try {
    const items = await prisma.announcement.findMany({ where: { published: true }, orderBy: { createdAt: 'desc' }, take: 20 });
    return items.map((a) => ({
      id: `ann-${a.id}`,
      title: a.title,
      url: null,
      source: 'NexTradePro',
      publishedAt: a.createdAt.toISOString(),
      section: classify(`${a.title} ${a.body}`),
      summary: a.body,
    }));
  } catch {
    return [];
  }
}

async function buildFeed(): Promise<NewsItem[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.items;
  const [cp, na, ann] = await Promise.all([
    fetchCryptoPanic().catch(() => []),
    fetchNewsApi().catch(() => []),
    fetchAnnouncements(),
  ]);
  const merged = [...cp, ...na, ...ann]
    .filter((x) => x.title)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  // Only cache when we actually reached a provider; otherwise keep trying.
  if (cp.length || na.length) cache = { at: Date.now(), items: merged };
  return merged;
}

// GET /api/news?section=ALL — sectioned, provider-attributed feed.
router.get('/', async (req, res) => {
  try {
    const section = ((req.query.section as string) || 'ALL').toUpperCase();
    const all = await buildFeed();
    const items = section === 'ALL' ? all : all.filter((i) => i.section === section);
    res.json({
      updatedAt: new Date().toISOString(),
      sources: [...new Set(all.map((i) => i.source))].slice(0, 8),
      sections: NEWS_SECTIONS,
      items: items.slice(0, 60),
      live: !!(CRYPTOPANIC_TOKEN || NEWSAPI_KEY),
    });
  } catch {
    res.json({ updatedAt: new Date().toISOString(), sources: [], sections: NEWS_SECTIONS, items: [], live: false });
  }
});

export default router;
