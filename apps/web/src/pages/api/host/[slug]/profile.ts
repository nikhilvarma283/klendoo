import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.query;

  if (typeof slug !== 'string') {
    return res.status(400).json({ error: 'Invalid slug' });
  }

  try {
    const host = await prisma.hostAccount.findUnique({ where: { slug } });

    if (!host || host.status !== 'active') {
      return res.status(404).json({ error: 'Host not found' });
    }

    return res.status(200).json({
      id: host.id,
      displayName: host.displayName,
      slug: host.slug,
      timezone: host.timezone,
      workingHoursStart: host.workingHoursStart,
      workingHoursEnd: host.workingHoursEnd,
      profileImage: host.profileImage || undefined,
    });
  } catch (error) {
    console.error('[Host] Public profile fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  } finally {
    await prisma.$disconnect();
  }
}
