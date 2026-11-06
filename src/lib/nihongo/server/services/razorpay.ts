import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError, requireEnv } from '../http';

export type RazorpayResponse = {
  id: string;
  item?: { id?: string };
  status?: string;
  amount?: number;
  currency?: string;
  method?: string | null;
  created_at?: number | string;
  invoice_id?: string | null;
  short_url?: string | null;
  order_id?: string;
  subscription_id?: string;
  current_start?: number | string;
  current_start_at?: number | string;
  start_at?: number | string;
  current_end?: number | string;
  current_end_at?: number | string;
  end_at?: number | string;
  charge_at_cycle_end?: boolean;
  captured?: boolean;
  error_code?: string | null;
  error_description?: string | null;
  [key: string]: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

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
  const payload = asRecord(await response.json().catch((): unknown => ({}))) ?? {};
  if (!response.ok) {
    console.error('[Razorpay API]', response.status, payload);
    const providerError = asRecord(payload.error);
    const description = providerError?.description;
    throw new HttpError(
      response.status >= 500 ? 502 : 400,
      typeof description === 'string' ? description : 'Payment provider request failed.',
    );
  }
  if (typeof payload.id !== 'string') {
    throw new HttpError(502, 'Payment provider returned an invalid response.');
  }
  return payload as RazorpayResponse;
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
