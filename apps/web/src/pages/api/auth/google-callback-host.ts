import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

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
  const hostToken = req.cookies.hostToken;
  const { code, state, error: googleError } = req.query;

  if (googleError) {
    return res.redirect(302, '/host/dashboard-v2?calendar=error&reason=denied');
  }

  let hostId: string;
  try {
    if (!hostToken) throw new Error('No session');
    const decoded = jwt.verify(hostToken, JWT_SECRET) as any;
    if (decoded.role !== 'host') throw new Error('Not a host session');
    hostId = decoded.hostId;
  } catch (err) {
    return res.redirect(302, '/host/login');
  }

  const expectedState = req.cookies.googleOAuthState;
  res.setHeader('Set-Cookie', 'googleOAuthState=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');

  if (!state || !expectedState || state !== expectedState) {
    return res.redirect(302, '/host/dashboard-v2?calendar=error&reason=state_mismatch');
  }

  if (typeof code !== 'string') {
    return res.redirect(302, '/host/dashboard-v2?calendar=error&reason=no_code');
  }

  try {
    const clientId = await getSetting('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_ID');
    const clientSecret = await getSetting('GOOGLE_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET');
    const baseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.host}`;

    if (!clientId || !clientSecret) {
      return res.redirect(302, '/host/dashboard-v2?calendar=error&reason=not_configured');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${baseUrl}/api/auth/google-callback-host`,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('[Google OAuth] Token exchange failed:', tokenData);
      return res.redirect(302, '/host/dashboard-v2?calendar=error&reason=token_exchange_failed');
    }

    let googleId: string | undefined;
    try {
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        googleId = userInfo.id;
      }
    } catch (err) {
      console.error('[Google OAuth] Userinfo fetch failed:', err);
    }

    await prisma.hostAccount.update({
      where: { id: hostId },
      data: {
        googleId,
        googleAccessToken: tokenData.access_token,
        ...(tokenData.refresh_token ? { googleRefreshToken: tokenData.refresh_token } : {}),
        googleCalendarId: 'primary',
      },
    });

    console.log(`[Google OAuth] Calendar connected for host ${hostId}`);

    return res.redirect(302, '/host/dashboard-v2?calendar=connected');
  } catch (error) {
    console.error('[Google OAuth] Callback error:', error);
    return res.redirect(302, '/host/dashboard-v2?calendar=error&reason=unknown');
  } finally {
    await prisma.$disconnect();
  }
}
