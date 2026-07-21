import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    token,
    displayName,
    slug,
    timezone,
    workingHoursStart,
    workingHoursEnd,
    workingDays,
    password,
  } = req.body;

  if (!token || !displayName || !slug || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ error: 'Slug must contain only lowercase letters, numbers, and dashes' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const signupRecord = await prisma.hostSignupToken.findFirst({
      where: { token, used: false, expires_at: { gt: new Date() } },
    });

    if (!signupRecord) {
      return res.status(401).json({ error: 'Invalid or expired signup link' });
    }

    const existingHost = await prisma.hostAccount.findUnique({ where: { email: signupRecord.email } });
    if (existingHost) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const host = await prisma.hostAccount.create({
      data: {
        email: signupRecord.email,
        displayName,
        slug,
        password_hash: passwordHash,
        timezone: timezone || 'UTC',
        workingHoursStart: workingHoursStart || '09:00',
        workingHoursEnd: workingHoursEnd || '17:00',
        workingDaysJson: JSON.stringify(Array.isArray(workingDays) ? workingDays : [1, 2, 3, 4, 5]),
        status: 'pending',
        balance: 0,
      },
    });

    await prisma.hostSignupToken.update({
      where: { id: signupRecord.id },
      data: { used: true },
    });

    console.log(`[Host] Signup completed, pending approval: ${displayName} (${slug})`);

    return res.status(201).json({
      hostId: host.id,
      slug: host.slug,
      status: host.status,
      message: 'Account created. An admin will review and approve your account shortly.',
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(400).json({ error: 'This slug is already taken' });
    }
    console.error('[Host] Complete signup error:', error);
    return res.status(500).json({ error: 'Failed to complete signup' });
  } finally {
    await prisma.$disconnect();
  }
}
