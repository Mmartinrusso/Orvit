/**
 * Test Utilities for Direct Handler Invocation
 *
 * Instead of spinning up an HTTP server, we create mock NextRequest objects
 * and call route handlers directly. This is faster and gives us full control
 * over cookies, headers, and request bodies.
 */
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// ============================================================================
// Request Builders
// ============================================================================

interface MockRequestOptions {
  method?: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  searchParams?: Record<string, string>;
}

/**
 * Create a mock NextRequest for testing route handlers
 */
export function createMockRequest(
  url: string,
  options: MockRequestOptions = {}
): NextRequest {
  const {
    method = 'GET',
    body,
    headers = {},
    cookies = {},
    searchParams = {},
  } = options;

  // Build URL with search params
  const urlObj = new URL(url, 'http://localhost:3000');
  for (const [key, value] of Object.entries(searchParams)) {
    urlObj.searchParams.set(key, value);
  }

  // Build headers
  const reqHeaders = new Headers(headers);
  if (body) {
    reqHeaders.set('content-type', 'application/json');
  }
  reqHeaders.set('user-agent', 'vitest/1.0 (Test Runner)');

  // Build cookie header
  const cookieStr = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  if (cookieStr) {
    reqHeaders.set('cookie', cookieStr);
  }

  const init: RequestInit = {
    method,
    headers: reqHeaders,
  };

  if (body && method !== 'GET' && method !== 'HEAD') {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(urlObj.toString(), init);
}

// ============================================================================
// JWT Token Generation
// ============================================================================

interface TokenPayload {
  userId: number;
  email?: string;
  role?: string;
  companyId?: number | null;
  sessionId?: string;
}

/**
 * Generate a valid JWT token for testing
 */
export async function generateTestToken(payload: TokenPayload): Promise<string> {
  const { userId, email = 'test@test.com', role = 'USER', companyId = null, sessionId = 'test-session' } = payload;

  return new SignJWT({
    userId,
    email,
    role,
    companyId,
    sessionId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(JWT_SECRET_KEY);
}

/**
 * Generate an expired JWT token for testing
 */
export async function generateExpiredToken(payload: TokenPayload): Promise<string> {
  const { userId, email = 'test@test.com', role = 'USER', companyId = null } = payload;

  return new SignJWT({
    userId,
    email,
    role,
    companyId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('-1h')
    .sign(JWT_SECRET_KEY);
}

/**
 * Generate a token signed with a wrong secret
 */
export async function generateInvalidToken(payload: TokenPayload): Promise<string> {
  const wrongKey = new TextEncoder().encode('wrong-secret-key');

  return new SignJWT({
    userId: payload.userId,
    email: payload.email || 'test@test.com',
    role: payload.role || 'USER',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(wrongKey);
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Parse JSON response body from a NextResponse
 */
export async function parseJsonResponse<T = any>(
  response: Response
): Promise<{ status: number; data: T; headers: Headers }> {
  const data = await response.json() as T;
  return {
    status: response.status,
    data,
    headers: response.headers,
  };
}

/**
 * Extract Set-Cookie headers from a response
 */
export function extractSetCookies(response: Response): Record<string, string> {
  const cookies: Record<string, string> = {};
  const setCookieHeaders = response.headers.getSetCookie?.() || [];

  for (const cookie of setCookieHeaders) {
    const [nameValue] = cookie.split(';');
    const [name, value] = nameValue.split('=');
    if (name && value) {
      cookies[name.trim()] = value.trim();
    }
  }

  return cookies;
}

// ============================================================================
// Authenticated Request Helpers
// ============================================================================

/**
 * Create an authenticated mock request (with JWT cookie)
 */
export async function createAuthenticatedRequest(
  url: string,
  tokenPayload: TokenPayload,
  options: Omit<MockRequestOptions, 'cookies'> & { extraCookies?: Record<string, string> } = {}
): Promise<NextRequest> {
  const token = await generateTestToken(tokenPayload);
  const { extraCookies = {}, ...restOptions } = options;

  return createMockRequest(url, {
    ...restOptions,
    cookies: {
      token,
      ...extraCookies,
    },
  });
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that a response is a JSON error with specific status
 */
export async function expectError(
  response: Response,
  status: number,
  messageContains?: string
): Promise<void> {
  const { status: resStatus, data } = await parseJsonResponse(response);
  expect(resStatus).toBe(status);
  expect(data).toHaveProperty('error');
  if (messageContains) {
    expect((data as any).error.toLowerCase()).toContain(messageContains.toLowerCase());
  }
}
