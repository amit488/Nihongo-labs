import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabase, createServerSupabase } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';

const contactMessageSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  subject: z.enum(['Suggestion', 'Complaint', 'Bug report', 'Other']),
  message: z.string().trim().min(5).max(10000),
  website: z.string().max(200).optional(),
}).strict();

function getClientAddress(request: Request): string {
  // Prefer headers supplied by the trusted edge proxy. The final X-Forwarded-For
  // element is used as the proxy-appended client hop; ingress must overwrite or
  // append this header rather than pass arbitrary client input through unchanged.
  const forwarded = request.headers.get('x-forwarded-for');
  const forwardedAddress = forwarded?.split(',').map((value) => value.trim()).filter(Boolean).at(-1);
  return request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || forwardedAddress
    || 'unknown';
}

async function enforceContactRateLimit(request: Request): Promise<void> {
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new HttpError(503, 'Contact form is temporarily unavailable.');
  const bucketKey = createHmac('sha256', secret)
    .update(`contact:${getClientAddress(request)}`)
    .digest('hex');
  const { data, error } = await createAdminSupabase().rpc('consume_api_rate_limit', {
    _bucket_key: bucketKey,
    _max_hits: 5,
    _window_seconds: 3600,
  });
  if (error) {
    console.error('[Nihongo Labs contact rate limit]', error);
    throw new HttpError(503, 'Contact form is temporarily unavailable.');
  }
  if (data !== true) throw new HttpError(429, 'Too many messages. Please try again later.');
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await enforceContactRateLimit(request);
    const input = await readJson(request, contactMessageSchema, 16 * 1024);

    // Quietly accept honeypot submissions without storing them.
    if (input.website) return NextResponse.json({ ok: true });

    const supabase = await createServerSupabase();
    const { data: authData } = await supabase.auth.getUser();
    const record = {
      name: input.name,
      email: input.email,
      subject: input.subject,
      message: input.message,
      ...(authData.user ? { user_id: authData.user.id } : {}),
    };
    const { error } = await supabase.from('contact_messages').insert(record);
    if (error) {
      console.error('[Nihongo Labs contact submission]', error);
      throw new HttpError(500, 'We could not send your message right now. Please try again.');
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
