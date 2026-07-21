import type { NextApiRequest, NextApiResponse } from 'next';
import {
  x402HTTPResourceServer,
  type HTTPAdapter,
  type HTTPRequestContext,
  type RouteConfig,
  type x402ResourceServer,
} from '@x402/core/server';

/**
 * Adapts a Next.js Pages Router API request to the framework-agnostic HTTPAdapter
 * interface @x402/core expects. Mirrors @x402/next's NextAdapter and @x402/express's
 * ExpressAdapter (verified against their compiled source) — same contract, different
 * request object, since @x402/next itself only supports App Router (requires Next >=16,
 * this app is on 14) and Express doesn't apply to a Next.js app at all.
 */
class PagesApiAdapter implements HTTPAdapter {
  constructor(private req: NextApiRequest) {}

  getHeader(name: string): string | undefined {
    const value = this.req.headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }

  getMethod(): string {
    return this.req.method || 'GET';
  }

  getPath(): string {
    return (this.req.url || '/').split('?')[0];
  }

  getUrl(): string {
    const proto = this.getHeader('x-forwarded-proto') || 'https';
    const host = this.getHeader('host') || 'localhost';
    return `${proto}://${host}${this.req.url || ''}`;
  }

  getAcceptHeader(): string {
    return this.getHeader('accept') || '';
  }

  getUserAgent(): string {
    return this.getHeader('user-agent') || '';
  }

  getQueryParams(): Record<string, string | string[]> {
    return this.req.query as Record<string, string | string[]>;
  }

  getQueryParam(name: string): string | string[] | undefined {
    return this.req.query[name];
  }

  getBody(): unknown {
    return this.req.body;
  }
}

/**
 * Result contract for handlers wrapped with withX402Pages. Handlers return a plain
 * {status, body} instead of calling res.json() directly, because settlement must
 * happen (and its response headers get merged in) BEFORE anything is written to the
 * client — Pages Router's res.json() sends immediately, so header mutation after the
 * fact isn't possible the way it is with App Router's lazily-finalized NextResponse.
 */
export type PagesX402Result = { status: number; body: unknown };

export function withX402Pages(
  handler: (req: NextApiRequest) => Promise<PagesX402Result>,
  routeConfig: RouteConfig,
  server: x402ResourceServer
) {
  const httpServer = new x402HTTPResourceServer(server, { '*': routeConfig });
  let initPromise: Promise<void> | null = null;

  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (!initPromise) initPromise = httpServer.initialize();
    await initPromise;

    const adapter = new PagesApiAdapter(req);
    const context: HTTPRequestContext = {
      adapter,
      path: adapter.getPath(),
      method: adapter.getMethod(),
      paymentHeader: adapter.getHeader('payment-signature') || adapter.getHeader('x-payment'),
    };

    let result;
    try {
      result = await httpServer.processHTTPRequest(context);
    } catch (err) {
      console.error('[x402] processHTTPRequest failed:', err);
      return res.status(503).json({
        error: 'Payment configuration unavailable',
        detail: err instanceof Error ? err.message : String(err),
      });
    }

    if (result.type === 'payment-error') {
      const { status, headers, body } = result.response;
      Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
      return res.status(status).json(body ?? {});
    }

    if (result.type === 'no-payment-required') {
      const { status, body } = await handler(req);
      return res.status(status).json(body);
    }

    // payment-verified: run the actual handler, then settle only if it succeeded.
    try {
      const { status, body } = await handler(req);

      if (status >= 400) {
        await result.cancellationDispatcher.cancel({ reason: 'handler_failed', responseStatus: status });
        return res.status(status).json(body);
      }

      const settlement = await httpServer.processSettlement(
        result.paymentPayload,
        result.paymentRequirements,
        result.declaredExtensions,
        { request: context }
      );

      if (!settlement.success) {
        const { response } = settlement;
        Object.entries(response.headers).forEach(([key, value]) => res.setHeader(key, value));
        return res.status(response.status).json(response.body ?? {});
      }

      Object.entries(settlement.headers).forEach(([key, value]) => res.setHeader(key, value));
      return res.status(status).json(body);
    } catch (err) {
      await result.cancellationDispatcher.cancel({ reason: 'handler_threw', error: err });
      throw err;
    }
  };
}
