import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token required' });
  }

  try {
    const resetRecord = await prisma.passwordResetToken.findFirst({
      where: {
        token,
        used: false,
        expires_at: { gt: new Date() },
      },
    });

    if (!resetRecord) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    return res.status(200).json({
      valid: true,
      email: resetRecord.email,
      userType: resetRecord.user_type,
    });
  } catch (error) {
    console.error('[Auth] Token validation error:', error);
    return res.status(500).json({ error: 'An error occurred' });
  } finally {
    await prisma.$disconnect();
  }
}
