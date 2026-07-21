import type { NextApiRequest } from 'next';
import { PrismaClient } from '@prisma/client';
import { withX402Pages, type PagesX402Result } from '../../../lib/x402/withX402Pages';
import { x402Server, resolvePayTo, AGENT_NETWORK } from '../../../lib/x402/x402-server';

const prisma = new PrismaClient();

async function bookingHandler(req: NextApiRequest): Promise<PagesX402Result> {
  const { hostSlug, clientEmail, clientName, startTime, endTime } = req.body || {};

  if (!hostSlug || !clientEmail || !startTime || !endTime) {
    return { status: 400, body: { error: 'hostSlug, clientEmail, startTime, endTime are required' } };
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

    const interaction = await prisma.$transaction(async (tx) => {
      await tx.clientAccessRequest.update({
        where: { id: accessRequest.id },
        data: { interactionUsed: { increment: 1 } },
      });

      const created = await tx.clientInteraction.create({
        data: {
          hostId: host.id,
          accessRequestId: accessRequest.id,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          actionType: 'booking',
          costUSDC: 0.05,
          status: 'confirmed',
        },
      });

      await tx.actionCostLog.create({
        data: { hostId: host.id, actionType: 'booking', costUSDC: 0.05, clientEmail },
      });

      return created;
    });

    console.log(
      `[Agent:booking] Confirmed for host ${host.slug}, client ${clientEmail}, interaction ${interaction.id}`
    );

    return {
      status: 200,
      body: {
        success: true,
        interactionId: interaction.id,
        hostSlug: host.slug,
        startTime,
        endTime,
        message: 'Booking confirmed.',
      },
    };
  } catch (error) {
    console.error('[Agent:booking] Error:', error);
    return { status: 500, body: { error: 'Failed to process booking' } };
  } finally {
    await prisma.$disconnect();
  }
}

export default withX402Pages(
  bookingHandler,
  {
    accepts: {
      scheme: 'exact',
      payTo: resolvePayTo,
      price: '$0.05',
      network: AGENT_NETWORK,
      maxTimeoutSeconds: 60,
    },
    description: 'Confirm a booking session with a Klendoo host',
    serviceName: 'Klendoo Booking Agent',
    tags: ['scheduling', 'booking'],
  },
  x402Server
);
