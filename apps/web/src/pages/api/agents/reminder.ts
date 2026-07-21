import type { NextApiRequest } from 'next';
import { PrismaClient } from '@prisma/client';
import { withX402Pages, type PagesX402Result } from '../../../lib/x402/withX402Pages';
import { x402Server, resolvePayTo, AGENT_NETWORK } from '../../../lib/x402/x402-server';

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
  if (!apiKey || !from) return false;

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
    return true;
  } catch (err) {
    console.error('[Email] Send failed:', err);
    return false;
  }
}

async function reminderHandler(req: NextApiRequest): Promise<PagesX402Result> {
  const { hostSlug, clientEmail, startTime } = req.body || {};

  if (!hostSlug || !clientEmail || !startTime) {
    return { status: 400, body: { error: 'hostSlug, clientEmail, startTime are required' } };
  }

  try {
    const host = await prisma.hostAccount.findUnique({ where: { slug: hostSlug } });
    if (!host || host.status !== 'active') {
      return { status: 404, body: { error: 'Host not found' } };
    }

    const accessRequest = await prisma.clientAccessRequest.findUnique({
      where: { hostId_clientEmail: { hostId: host.id, clientEmail } },
    });

    if (!accessRequest || accessRequest.status !== 'approved') {
      return { status: 403, body: { error: 'Client does not have approved access to this host' } };
    }

    if (accessRequest.interactionUsed >= accessRequest.interactionLimit) {
      return { status: 403, body: { error: 'Interaction limit reached for this client' } };
    }

    const sessionTime = new Date(startTime);
    const interaction = await prisma.$transaction(async (tx) => {
      await tx.clientAccessRequest.update({
        where: { id: accessRequest.id },
        data: { interactionUsed: { increment: 1 } },
      });

      const created = await tx.clientInteraction.create({
        data: {
          hostId: host.id,
          accessRequestId: accessRequest.id,
          startTime: sessionTime,
          endTime: sessionTime,
          actionType: 'reminder',
          costUSDC: 0.03,
          status: 'confirmed',
        },
      });

      await tx.actionCostLog.create({
        data: { hostId: host.id, actionType: 'reminder', costUSDC: 0.03, clientEmail },
      });

      return created;
    });

    const emailed = await sendEmail(
      clientEmail,
      `Reminder — session with ${host.displayName}`,
      `<p>This is a reminder about your upcoming session with ${host.displayName} at ${sessionTime.toISOString()}.</p>`
    );

    console.log(
      `[Agent:reminder] host ${host.slug}, client ${clientEmail}, interaction ${interaction.id}, emailed=${emailed}`
    );

    return {
      status: 200,
      body: { success: true, interactionId: interaction.id, hostSlug: host.slug, emailed, message: 'Reminder sent.' },
    };
  } catch (error) {
    console.error('[Agent:reminder] Error:', error);
    return { status: 500, body: { error: 'Failed to process reminder' } };
  } finally {
    await prisma.$disconnect();
  }
}

export default withX402Pages(
  reminderHandler,
  {
    accepts: {
      scheme: 'exact',
      payTo: resolvePayTo,
      price: '$0.03',
      network: AGENT_NETWORK,
      maxTimeoutSeconds: 60,
    },
    description: 'Send a session reminder from a Klendoo host to a client',
    serviceName: 'Klendoo Reminder Agent',
    tags: ['scheduling', 'reminder', 'email'],
  },
  x402Server
);
