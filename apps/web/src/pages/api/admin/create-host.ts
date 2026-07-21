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

    // No email provider is configured yet (SENDGRID_API_KEY is a placeholder), so
    // generate a setup link immediately and hand it back to the admin to share
    // manually, instead of silently pretending an email was sent.
    const setupToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h, longer than the self-serve 1h reset window
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

    console.log(`[Admin] Setup link for ${email}: ${setupLink}`);

    return res.status(201).json({
      hostId: host.id,
      slug: host.slug,
      email: host.email,
      setupLink,
      message: 'Host account created. Share the setup link with them to set their password.',
    });
  } catch (error) {
    console.error('[Admin] Error creating host:', error);
    return res.status(500).json({ error: 'Failed to create host' });
  } finally {
    await prisma.$disconnect();
  }
}
