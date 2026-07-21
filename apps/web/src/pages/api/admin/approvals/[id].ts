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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { action } = req.body;

  if (typeof id !== 'string' || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const host = await prisma.hostAccount.findUnique({ where: { id } });

    if (!host || host.status !== 'pending') {
      return res.status(404).json({ error: 'Pending host not found' });
    }

    if (action === 'approve') {
      await prisma.hostAccount.update({
        where: { id },
        data: { status: 'active' },
      });
      console.log(`[Admin] Approved host: ${host.displayName} (${host.slug})`);
      return res.status(200).json({ message: 'Host approved' });
    }

    // reject
    await prisma.hostAccount.delete({ where: { id } });
    console.log(`[Admin] Rejected host signup: ${host.displayName} (${host.slug})`);
    return res.status(200).json({ message: 'Host rejected' });
  } catch (error) {
    console.error('[Admin] Error processing approval:', error);
    return res.status(500).json({ error: 'Failed to process approval' });
  } finally {
    await prisma.$disconnect();
  }
}
