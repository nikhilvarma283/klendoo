import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    email,
    displayName,
    slug,
    timezone,
    workingHoursStart,
    workingHoursEnd,
    workingDays,
  } = req.body;

  if (!email || !displayName || !slug) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ error: 'Slug must contain only lowercase letters, numbers, and dashes' });
  }

  try {
    const existingEmail = await prisma.hostAccount.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const host = await prisma.hostAccount.create({
      data: {
        email,
        displayName,
        slug,
        timezone: timezone || 'UTC',
        workingHoursStart: workingHoursStart || '09:00',
        workingHoursEnd: workingHoursEnd || '17:00',
        workingDaysJson: JSON.stringify(Array.isArray(workingDays) ? workingDays : [1, 2, 3, 4, 5]),
        status: 'pending',
        balance: 0,
      },
    });

    console.log(`[Host] New signup pending approval: ${displayName} (${slug})`);

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
    console.error('[Host] Error during onboarding:', error);
    return res.status(500).json({ error: 'Failed to create account' });
  } finally {
    await prisma.$disconnect();
  }
}
