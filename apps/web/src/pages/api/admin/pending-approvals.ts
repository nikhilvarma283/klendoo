import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
function verifyAdmin(token?: string) {
  const JWT_SECRET = process.env.JWT_SECRET || 'klendoo_admin_secret_key';
  if (!token) throw new Error('No token');
  const decoded = jwt.verify(token, JWT_SECRET) as any;
  if (decoded.role !== 'super_admin') throw new Error('Not admin');
  return decoded;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers.authorization?.split('Bearer ')[1] || req.cookies.adminToken;

  try {
    verifyAdmin(token);
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pendingHosts = await prisma.hostAccount.findMany({
      where: { status: 'pending' },
      select: {
        id: true,
        email: true,
        displayName: true,
        slug: true,
        timezone: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const pending = pendingHosts.map((host) => ({
      id: host.id,
      email: host.email,
      displayName: host.displayName,
      slug: host.slug,
      timezone: host.timezone,
      requestedAt: host.createdAt.toISOString(),
    }));

    return res.status(200).json({ pending });
  } catch (error) {
    console.error('[Admin] Error fetching pending approvals:', error);
    return res.status(500).json({ error: 'Failed to fetch pending approvals' });
  } finally {
    await prisma.$disconnect();
  }
}
