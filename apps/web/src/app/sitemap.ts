import type { MetadataRoute } from 'next';

const BASE = 'https://nextradepro.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/markets', '/trading', '/copy-trading', '/tools', '/news', '/pricing', '/about', '/login', '/register'];
  return routes.map((r) => ({
    url: `${BASE}${r}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: r === '' ? 1 : 0.7,
  }));
}
