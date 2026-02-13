/**
 * Rate Limiting Middleware
 */

import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let ratelimit: Ratelimit | null = null;

function getRateLimiter(): Ratelimit {
  if (!ratelimit) {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!redisUrl || !redisToken) {
      console.warn('Rate limiting disabled - Redis not configured');
      // Return mock for development
      return {
        limit: async () => ({ success: true, limit: 100, remaining: 100, reset: Date.now() }),
      } as any;
    }

    const redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });

    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
    });
  }

  return ratelimit;
}

export async function checkRateLimit(
  req: NextRequest,
  identifier: string
): Promise<NextResponse | null> {
  const limiter = getRateLimiter();
  const { success, limit, reset, remaining } = await limiter.limit(identifier);

  if (!success) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        limit,
        reset: new Date(reset).toISOString(),
      },
      { status: 429 }
    );
  }

  return null; // Allow request
}

// Different limits for different endpoints
export const rateLimits = {
  chat: { requests: 20, window: '1 m' },
  forecast: { requests: 10, window: '1 m' },
  ocr: { requests: 5, window: '1 m' },
  afip: { requests: 30, window: '1 m' },
};
