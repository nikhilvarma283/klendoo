import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function sendPasswordResetEmail(email: string, resetToken: string) {
  const resetLink = `${process.env.NEXTAUTH_URL || 'https://klendoo.com'}/reset-password?token=${resetToken}`;
  console.log(`[Auth] Password reset link for ${email}: ${resetLink}`);
  // TODO: wire SendGrid using process.env.SENDGRID_API_KEY
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, userType } = req.body;

  if (!email || !userType || !['host', 'client'].includes(userType)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    if (userType === 'host') {
      const host = await prisma.hostAccount.findUnique({ where: { email } });

      if (host) {
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        await prisma.passwordResetToken.create({
          data: {
            email,
            user_type: userType,
            token: resetToken,
            expires_at: expiresAt,
          },
        });

        await sendPasswordResetEmail(email, resetToken);
      }
    }
    // client accounts don't exist yet in this deployment; intentionally no-op,
    // still return the generic success message below to avoid email enumeration.

    return res.status(200).json({
      message: 'If an account with that email exists, a password reset link has been sent',
    });
  } catch (error) {
    console.error('[Auth] Forgot password error:', error);
    return res.status(500).json({ error: 'An error occurred' });
  } finally {
    await prisma.$disconnect();
  }
}
