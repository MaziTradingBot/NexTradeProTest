import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /api/content/announcements — published announcements for the public news page
router.get('/announcements', async (req, res) => {
  const category = req.query.category as string | undefined;
  const items = await prisma.announcement.findMany({
    where: {
      published: true,
      ...(category && category !== 'ALL' ? { category: category as never } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, title: true, body: true, category: true, createdAt: true },
  });
  res.json(items);
});

export default router;
