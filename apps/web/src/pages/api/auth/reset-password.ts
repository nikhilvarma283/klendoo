import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
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
      return res.status(401).json({ error: 'Invalid or expired reset token' });
    }

    if (resetRecord.user_type !== 'host') {
      return res.status(400).json({ error: 'Client password login is not available yet' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.hostAccount.update({
      where: { email: resetRecord.email },
      data: { password_hash: hashedPassword },
    });

    await prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { used: true },
    });

    console.log(`[Auth] Password reset successful for ${resetRecord.email}`);

    return res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('[Auth] Reset password error:', error);
    return res.status(500).json({ error: 'An error occurred' });
  } finally {
    await prisma.$disconnect();
  }
}
