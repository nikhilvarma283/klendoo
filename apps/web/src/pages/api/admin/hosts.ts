import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'klendoo_admin_secret_key';

function verifyAdmin(token?: string) {
  if (!token) throw new Error('No token');
  const decoded = jwt.verify(token, JWT_SECRET) as any;
  if (decoded.role !== 'super_admin') throw new Error('Not admin');
  return decoded;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers.authorization?.split('Bearer ')[1];

  try {
    verifyAdmin(token);
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const hosts = await prisma.hostAccount.findMany({
        select: {
          id: true,
          email: true,
          displayName: true,
          slug: true,
          status: true,
          balance: true,
          totalCreditsPurchased: true,
          createdAt: true,
          _count: {
            select: {
              clients: true,
              interactions: true,
              actionCosts: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const formattedHosts = hosts.map((host) => ({
        id: host.id,
        email: host.email,
        displayName: host.displayName,
        slug: host.slug,
        status: host.status,
        balance: parseFloat(host.balance.toString()),
        clientCount: host._count.clients,
        totalBookings: host._count.interactions,
        totalCost: parseFloat(host._count.actionCosts > 0 ? '100' : '0'), // TODO: Calculate from actionCosts
        createdAt: host.createdAt.toISOString(),
      }));

      return res.status(200).json({ hosts: formattedHosts });
    } catch (error) {
      console.error('[Admin] Error fetching hosts:', error);
      return res.status(500).json({ error: 'Failed to fetch hosts' });
    } finally {
      await prisma.$disconnect();
    }
  }

  if (req.method === 'DELETE') {
    // DELETE specific host (in another route)
    return res.status(405).json({ error: 'Use /api/admin/hosts/[id] for DELETE' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
