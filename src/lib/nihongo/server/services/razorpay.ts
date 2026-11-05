import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError, requireEnv } from '../http';

type RazorpayResponse = Record<string, any>;

export async function razorpayRequest(
  path: string,
  method: 'GET' | 'POST',
  body?: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): Promise<RazorpayResponse> {
  const keyId = requireEnv('RAZORPAY_KEY_ID');
  const keySecret = requireEnv('RAZORPAY_KEY_SECRET');
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('[Razorpay API]', response.status, payload);
    throw new HttpError(response.status >= 500 ? 502 : 400, payload?.error?.description || 'Payment provider request failed.');
  }
  return payload;
}

function safeHexEqual(actual: string, expected: string): boolean {
  if (!/^[a-f0-9]+$/i.test(actual) || !/^[a-f0-9]+$/i.test(expected) || actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = requireEnv('RAZORPAY_KEY_SECRET');
  const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeHexEqual(signature, expected);
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = requireEnv('RAZORPAY_WEBHOOK_SECRET');
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeHexEqual(signature, expected);
}

export function unixToIso(value: unknown): string | null {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 8_640_000_000_000) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
