import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { ExactAvmScheme } from '@x402/avm/exact/server';
import { ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2 } from '@x402/avm';
import { bazaarResourceServerExtension } from '@x402/extensions/bazaar';
import { PrismaClient } from '@prisma/client';
import type { HTTPRequestContext } from '@x402/core/server';

const prisma = new PrismaClient();

const PLACEHOLDER_VALUES = new Set(['your-id', 'your-secret', 'your-key', '']);

async function getSetting(key: string, envKey: string): Promise<string | undefined> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  if (row?.value) return row.value;
  const envValue = process.env[envKey];
  return envValue && !PLACEHOLDER_VALUES.has(envValue) ? envValue : undefined;
}

// Network is fixed at process start (the SDK registers a scheme against one network at
// construction time). Switching testnet <-> mainnet requires updating ALGORAND_NETWORK in
// .env and restarting — the wallet ADDRESS itself is still resolved fresh from the DB on
// every request below, so rotating that never needs a restart.
const NETWORK_ENV = (process.env.ALGORAND_NETWORK || 'testnet').toLowerCase();
export const AGENT_NETWORK = NETWORK_ENV === 'mainnet' ? ALGORAND_MAINNET_CAIP2 : ALGORAND_TESTNET_CAIP2;

const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL || 'https://facilitator.goplausible.xyz',
});

export const x402Server = new x402ResourceServer(facilitatorClient)
  .register(AGENT_NETWORK, new ExactAvmScheme())
  .registerExtension(bazaarResourceServerExtension);

/**
 * Resolves the payout wallet address fresh from platform settings on every request,
 * so rotating it via /admin/settings takes effect immediately with no restart.
 */
export async function resolvePayTo(_context: HTTPRequestContext): Promise<string> {
  const address = await getSetting('ALGORAND_WALLET_ADDRESS', 'ALGORAND_WALLET_ADDRESS');
  if (!address) {
    throw new Error('ALGORAND_WALLET_ADDRESS is not configured in /admin/settings');
  }
  return address;
}
