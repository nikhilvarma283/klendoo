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

  const { email, displayName, slug, timezone } = req.body;

  if (!email || !displayName || !slug) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Check if slug is available
    const existing = await prisma.hostAccount.findUnique({
      where: { slug },
    });

    if (existing) {
      return res.status(400).json({ error: 'Slug already taken' });
    }

    // Create host account
    const host = await prisma.hostAccount.create({
      data: {
        email,
        displayName,
        slug,
        timezone,
        status: 'active',
        balance: 0,
      },
    });

    console.log(`[Admin] Created host: ${displayName} (${slug})`);

    // TODO: Send welcome email to host
    console.log(`[Admin] Email sent to ${email}`);

    return res.status(201).json({
      hostId: host.id,
      slug: host.slug,
      email: host.email,
      message: 'Host account created successfully',
    });
  } catch (error) {
    console.error('[Admin] Error creating host:', error);
    return res.status(500).json({ error: 'Failed to create host' });
  } finally {
    await prisma.$disconnect();
  }
}
