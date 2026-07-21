import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RESERVED_SLUGS = ['admin', 'api', 'host', 'client', 'auth', 'forgot-password', 'reset-password', 'www'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.query;

  if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ available: false, error: 'Invalid slug format' });
  }

  if (RESERVED_SLUGS.includes(slug)) {
    return res.status(200).json({ available: false });
  }

  try {
    const existing = await prisma.hostAccount.findUnique({ where: { slug } });
    return res.status(200).json({ available: !existing });
  } catch (error) {
    console.error('[Host] Error checking slug:', error);
    return res.status(500).json({ error: 'Failed to check slug' });
  } finally {
    await prisma.$disconnect();
  }
}
