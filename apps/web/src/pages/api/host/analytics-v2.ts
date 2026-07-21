import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

function getHostId(req: NextApiRequest): string {
  const JWT_SECRET = process.env.JWT_SECRET || 'klendoo_admin_secret_key';
  const token = req.cookies.hostToken;
  if (!token) throw new Error('No session');
  const decoded = jwt.verify(token, JWT_SECRET) as any;
  if (decoded.role !== 'host') throw new Error('Not a host session');
  return decoded.hostId;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let hostId: string;
  try {
    hostId = getHostId(req);
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const grouped = await prisma.actionCostLog.groupBy({
      by: ['actionType'],
      where: { hostId },
      _sum: { costUSDC: true },
      _count: { _all: true },
    });

    const totalCost = grouped.reduce((sum, g) => sum + parseFloat(g._sum.costUSDC?.toString() || '0'), 0);

    const costBreakdown = grouped.map((g) => {
      const cost = parseFloat(g._sum.costUSDC?.toString() || '0');
      return {
        actionType: g.actionType,
        count: g._count._all,
        totalCost: cost,
        percentage: totalCost > 0 ? Math.round((cost / totalCost) * 100) : 0,
      };
    });

    return res.status(200).json({ costBreakdown });
  } catch (error) {
    console.error('[Host] Analytics fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  } finally {
    await prisma.$disconnect();
  }
}
