import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.query;
  const { name, email, message } = req.body;

  if (typeof slug !== 'string') {
    return res.status(400).json({ error: 'Invalid slug' });
  }

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const host = await prisma.hostAccount.findUnique({ where: { slug } });

    if (!host || host.status !== 'active') {
      return res.status(404).json({ error: 'Host not found' });
    }

    const existing = await prisma.clientAccessRequest.findUnique({
      where: { hostId_clientEmail: { hostId: host.id, clientEmail: email } },
    });

    if (existing) {
      return res.status(200).json({ message: 'Request already sent', status: existing.status });
    }

    await prisma.clientAccessRequest.create({
      data: {
        hostId: host.id,
        clientEmail: email,
        clientName: name || undefined,
        status: 'pending',
      },
    });

    console.log(`[Client] Access requested: ${email} -> host ${host.slug}${message ? ` ("${message}")` : ''}`);

    return res.status(201).json({ message: 'Access request sent' });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(200).json({ message: 'Request already sent' });
    }
    console.error('[Client] Request access error:', error);
    return res.status(500).json({ error: 'Failed to send request' });
  } finally {
    await prisma.$disconnect();
  }
}
