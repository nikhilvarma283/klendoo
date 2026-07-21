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

async function followUpHandler(req: NextApiRequest): Promise<PagesX402Result> {
  const { hostSlug, clientEmail, message } = req.body || {};

  if (!hostSlug || !clientEmail) {
    return { status: 400, body: { error: 'hostSlug and clientEmail are required' } };
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

    const now = new Date();
    const interaction = await prisma.$transaction(async (tx) => {
      await tx.clientAccessRequest.update({
        where: { id: accessRequest.id },
        data: { interactionUsed: { increment: 1 } },
      });

      const created = await tx.clientInteraction.create({
        data: {
          hostId: host.id,
          accessRequestId: accessRequest.id,
          startTime: now,
          endTime: now,
          actionType: 'follow-up',
          costUSDC: 0.02,
          status: 'confirmed',
        },
      });

      await tx.actionCostLog.create({
        data: { hostId: host.id, actionType: 'follow-up', costUSDC: 0.02, clientEmail },
      });

      return created;
    });

    const emailed = await sendEmail(
      clientEmail,
      `Following up — ${host.displayName}`,
      `<p>${message ? message : `${host.displayName} wanted to follow up with you.`}</p>`
    );

    console.log(
      `[Agent:follow-up] host ${host.slug}, client ${clientEmail}, interaction ${interaction.id}, emailed=${emailed}`
    );

    return {
      status: 200,
      body: { success: true, interactionId: interaction.id, hostSlug: host.slug, emailed, message: 'Follow-up sent.' },
    };
  } catch (error) {
    console.error('[Agent:follow-up] Error:', error);
    return { status: 500, body: { error: 'Failed to process follow-up' } };
  } finally {
    await prisma.$disconnect();
  }
}

export default withX402Pages(
  followUpHandler,
  {
    accepts: {
      scheme: 'exact',
      payTo: resolvePayTo,
      price: '$0.02',
      network: AGENT_NETWORK,
      maxTimeoutSeconds: 60,
    },
    description: 'Send a follow-up message from a Klendoo host to a client',
    serviceName: 'Klendoo Follow-up Agent',
    tags: ['scheduling', 'follow-up', 'email'],
  },
  x402Server
);
