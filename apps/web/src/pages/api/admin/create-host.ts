import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const prisma = new PrismaClient();

function verifyAdmin(token?: string) {
  const JWT_SECRET = process.env.JWT_SECRET || 'klendoo_admin_secret_key';
  if (!token) throw new Error('No token');
  const decoded = jwt.verify(token, JWT_SECRET) as any;
  if (decoded.role !== 'super_admin') throw new Error('Not admin');
  return decoded;
}

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
    const existing = await prisma.hostAccount.findUnique({
      where: { slug },
    });

    if (existing) {
      return res.status(400).json({ error: 'Slug already taken' });
    }

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

    const setupToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.passwordResetToken.create({
      data: {
        email,
        user_type: 'host',
        token: setupToken,
        expires_at: expiresAt,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.host}`;
    const setupLink = `${baseUrl}/reset-password?token=${setupToken}`;

    const emailed = await sendEmail(
      email,
      'Welcome to Klendoo — Set Up Your Account',
      `<p>Hi ${displayName},</p>
       <p>An account has been created for you on Klendoo at <strong>klendoo.com/${slug}</strong>.</p>
       <p><a href="${setupLink}">Click here to set your password</a> and access your dashboard.</p>
       <p>This link expires in 24 hours.</p>`
    );

    console.log(`[Admin] Setup link for ${email}: ${setupLink}${emailed ? ' (emailed)' : ' (email not sent - not configured)'}`);

    return res.status(201).json({
      hostId: host.id,
      slug: host.slug,
      email: host.email,
      setupLink,
      emailed,
      message: emailed
        ? 'Host account created and setup email sent.'
        : 'Host account created. Email delivery is not configured — share the setup link with them directly.',
    });
  } catch (error) {
    console.error('[Admin] Error creating host:', error);
    return res.status(500).json({ error: 'Failed to create host' });
  } finally {
    await prisma.$disconnect();
  }
}
