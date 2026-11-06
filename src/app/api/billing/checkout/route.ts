import { NextRequest, NextResponse } from 'next/server';
import { requireUser, createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';
import { checkoutSchema } from '@/lib/nihongo/server/validation';
import { createCheckout } from '@/lib/nihongo/server/services/billing';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const input = await readJson(request, checkoutSchema);
    const result = await createCheckout(createAdminSupabase(), context.user.id, input.planCode, input.idempotencyKey);
    return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error); }
}
