import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const prisma = new PrismaClient();

const PLACEHOLDER_VALUES = new Set(['your-id', 'your-secret', 'your-key', '']);

async function getSetting(key: string, envKey: string): Promise<string | undefined> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  if (row?.value) return row.value;
  const envValue = process.env[envKey];
  return envValue && !PLACEHOLDER_VALUES.has(envValue) ? envValue : undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const JWT_SECRET = process.env.JWT_SECRET || 'klendoo_admin_secret_key';
  const token = req.cookies.hostToken;

  if (!token) {
    return res.redirect(302, '/host/login');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'host') throw new Error('Not a host session');
  } catch (err) {
    return res.redirect(302, '/host/login');
  }

  try {
    const clientId = await getSetting('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_ID');
    const baseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.host}`;

    if (!clientId) {
      return res.redirect(302, '/host/dashboard-v2?calendar=error&reason=not_configured');
    }

    const state = crypto.randomBytes(16).toString('hex');
    res.setHeader(
      'Set-Cookie',
      `googleOAuthState=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
    );

    const redirectUri = `${baseUrl}/api/auth/google-callback-host`;
    const scope = 'openid email profile https://www.googleapis.com/auth/calendar';

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${state}`;

    return res.redirect(302, authUrl);
  } finally {
    await prisma.$disconnect();
  }
}
