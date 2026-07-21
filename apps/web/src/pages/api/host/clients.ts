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
    const accessRequests = await prisma.clientAccessRequest.findMany({
      where: { hostId },
      orderBy: { requestedAt: 'desc' },
    });

    const requests = accessRequests.map((r) => ({
      id: r.id,
      clientName: r.clientName || r.clientEmail,
      clientEmail: r.clientEmail,
      status: r.status,
      interactionLimit: r.interactionLimit,
      interactionUsed: r.interactionUsed,
      requestedAt: r.requestedAt.toISOString(),
    }));

    return res.status(200).json({ requests });
  } catch (error) {
    console.error('[Host] Clients fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch clients' });
  } finally {
    await prisma.$disconnect();
  }
}
