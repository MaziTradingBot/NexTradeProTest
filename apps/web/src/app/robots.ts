import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/dashboard'] },
    sitemap: 'https://nextradepro.vercel.app/sitemap.xml',
  };
}
