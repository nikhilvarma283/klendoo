import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

function verifyAdmin(token?: string) {
  const JWT_SECRET = process.env.JWT_SECRET || 'klendoo_admin_secret_key';
  if (!token) throw new Error('No token');
  const decoded = jwt.verify(token, JWT_SECRET) as any;
  if (decoded.role !== 'super_admin') throw new Error('Not admin');
  return decoded;
}

const SETTINGS: Record<string, { secret: boolean; envFallback: string; label: string; group: string }> = {
  GOOGLE_CLIENT_ID: { secret: false, envFallback: 'GOOGLE_CLIENT_ID', label: 'Google Client ID', group: 'Google Calendar' },
  GOOGLE_CLIENT_SECRET: { secret: true, envFallback: 'GOOGLE_CLIENT_SECRET', label: 'Google Client Secret', group: 'Google Calendar' },
  SENDGRID_API_KEY: { secret: true, envFallback: 'SENDGRID_API_KEY', label: 'SendGrid API Key', group: 'Email (SendGrid)' },
  SENDGRID_FROM_EMAIL: { secret: false, envFallback: 'SENDGRID_FROM_EMAIL', label: 'From Email Address', group: 'Email (SendGrid)' },
};

const PLACEHOLDER_VALUES = new Set(['your-id', 'your-secret', 'your-key', '']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers.authorization?.split('Bearer ')[1] || req.cookies.adminToken;

  try {
    verifyAdmin(token);
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const rows = await prisma.platformSetting.findMany();
      const dbValues = new Map(rows.map((r) => [r.key, r.value]));

      const settings = Object.entries(SETTINGS).map(([key, meta]) => {
        const dbValue = dbValues.get(key);
        const envValue = process.env[meta.envFallback];
        const effectiveValue = dbValue || (envValue && !PLACEHOLDER_VALUES.has(envValue) ? envValue : undefined);

        return {
          key,
          label: meta.label,
          group: meta.group,
          secret: meta.secret,
          configured: !!effectiveValue,
          source: dbValue ? 'database' : effectiveValue ? 'environment' : 'unset',
          preview: effectiveValue
            ? meta.secret
              ? `••••••${effectiveValue.slice(-4)}`
              : effectiveValue
            : '',
        };
      });

      return res.status(200).json({ settings });
    } catch (error) {
      console.error('[Admin] Settings fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch settings' });
    } finally {
      await prisma.$disconnect();
    }
  }

  if (req.method === 'PUT') {
    const { updates } = req.body as { updates: Record<string, string> };

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Invalid request' });
    }

    try {
      const keys = Object.keys(updates).filter((k) => k in SETTINGS && updates[k]?.trim());

      await Promise.all(
        keys.map((key) =>
          prisma.platformSetting.upsert({
            where: { key },
            create: { key, value: updates[key].trim() },
            update: { value: updates[key].trim() },
          })
        )
      );

      console.log(`[Admin] Settings updated: ${keys.join(', ')}`);

      return res.status(200).json({ message: 'Settings saved', updated: keys });
    } catch (error) {
      console.error('[Admin] Settings update error:', error);
      return res.status(500).json({ error: 'Failed to save settings' });
    } finally {
      await prisma.$disconnect();
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
