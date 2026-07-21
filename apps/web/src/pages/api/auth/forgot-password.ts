import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const PLACEHOLDER_VALUES = new Set(['your-id', 'your-secret', 'your-key', '']);

async function getSetting(key: string, envKey: string): Promise<string | undefined> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  if (row?.value) return row.value;
  const envValue = process.env[envKey];
  return envValue && !PLACEHOLDER_VALUES.has(envValue) ? envValue : undefined;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = await getSetting('SENDGRID_API_KEY', 'SENDGRID_API_KEY');
  const from = await getSetting('SENDGRID_FROM_EMAIL', 'SENDGRID_FROM_EMAIL');

  if (!apiKey || !from) {
    console.log(`[Email] SendGrid not configured, skipping send to ${to}: ${subject}`);
    return false;
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });

    if (!response.ok) {
      console.error(`[Email] SendGrid error (${response.status}):`, await response.text());
      return false;
    }

    console.log(`[Email] Sent to ${to}: ${subject}`);
    return true;
  } catch (err) {
    console.error('[Email] Send failed:', err);
    return false;
  }
}

async function sendPasswordResetEmail(email: string, resetToken: string) {
  const resetLink = `${process.env.NEXTAUTH_URL || 'https://klendoo.com'}/reset-password?token=${resetToken}`;
  const sent = await sendEmail(
    email,
    'Reset Your Klendoo Password',
    `<p>You requested to reset your password.</p>
     <p><a href="${resetLink}">Click here to reset it</a></p>
     <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`
  );
  if (!sent) {
    console.log(`[Auth] Password reset link for ${email}: ${resetLink}`);
  }
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
