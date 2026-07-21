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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let hostId: string;
  try {
    hostId = getHostId(req);
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;
  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid request id' });
  }

  try {
    const accessRequest = await prisma.clientAccessRequest.findUnique({ where: { id } });

    if (!accessRequest || accessRequest.hostId !== hostId) {
      return res.status(404).json({ error: 'Request not found' });
    }

    await prisma.clientAccessRequest.update({
      where: { id },
      data: { status: 'rejected' },
    });

    return res.status(200).json({ message: 'Client rejected' });
  } catch (error) {
    console.error('[Host] Reject client error:', error);
    return res.status(500).json({ error: 'Failed to reject client' });
  } finally {
    await prisma.$disconnect();
  }
}
