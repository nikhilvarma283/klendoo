import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const JWT_SECRET = process.env.JWT_SECRET || 'klendoo_admin_secret_key';
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const host = await prisma.hostAccount.findUnique({ where: { email } });

    if (!host || !host.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, host.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (host.status !== 'active') {
      return res.status(403).json({
        error:
          host.status === 'pending'
            ? 'Your account is still pending admin approval'
            : 'Your account is not active',
      });
    }

    const token = jwt.sign(
      { hostId: host.id, email: host.email, role: 'host' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const maxAge = 60 * 60 * 24;
    res.setHeader(
      'Set-Cookie',
      `hostToken=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
    );

    console.log(`[Host] Login successful: ${email}`);

    return res.status(200).json({ hostId: host.id, slug: host.slug, displayName: host.displayName });
  } catch (error) {
    console.error('[Host] Login error:', error);
    return res.status(500).json({ error: 'An error occurred' });
  } finally {
    await prisma.$disconnect();
  }
}
