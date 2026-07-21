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
  const token = req.headers.authorization?.split('Bearer ')[1];

  try {
    verifyAdmin(token);
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid host id' });
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const host = await prisma.hostAccount.findUnique({ where: { id } });

    if (!host) {
      return res.status(404).json({ error: 'Host not found' });
    }

    await prisma.hostAccount.delete({ where: { id } });

    console.log(`[Admin] Deleted host: ${host.displayName} (${host.slug})`);

    return res.status(200).json({ message: 'Host deleted' });
  } catch (error) {
    console.error('[Admin] Error deleting host:', error);
    return res.status(500).json({ error: 'Failed to delete host' });
  } finally {
    await prisma.$disconnect();
  }
}
