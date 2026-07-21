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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  try {
    const existingHost = await prisma.hostAccount.findUnique({ where: { email } });
    if (existingHost) {
      return res.status(400).json({
        error: 'An account with this email already exists. Try logging in or resetting your password instead.',
      });
    }

    const signupToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.hostSignupToken.create({
      data: { email, token: signupToken, expires_at: expiresAt },
    });

    const baseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.host}`;
    const verifyLink = `${baseUrl}/host/complete-signup?token=${signupToken}`;

    const emailed = await sendEmail(
      email,
      'Confirm Your Klendoo Account',
      `<p>Thanks for signing up for Klendoo.</p>
       <p><a href="${verifyLink}">Click here to confirm your email and finish setting up your account</a>.</p>
       <p>This link expires in 1 hour.</p>`
    );

    if (!emailed) {
      console.log(`[Host] Signup verification link for ${email}: ${verifyLink}`);
    }

    return res.status(200).json({
      message: emailed
        ? 'Check your email for a confirmation link to finish setting up your account.'
        : 'Account verification requested. Email delivery is not configured yet — contact the admin for your setup link.',
      emailed,
    });
  } catch (error) {
    console.error('[Host] Request signup error:', error);
    return res.status(500).json({ error: 'Failed to start signup' });
  } finally {
    await prisma.$disconnect();
  }
}
