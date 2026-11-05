import { NextRequest, NextResponse } from 'next/server';
import { requireUser, createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';
import { cancelSubscription } from '@/lib/nihongo/server/services/billing';
import { subscriptionIdSchema } from '@/lib/nihongo/server/validation';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const body = await readJson(request, subscriptionIdSchema);
    return NextResponse.json(await cancelSubscription(createAdminSupabase(), context.user.id, body.subscriptionId));
  } catch (error) { return jsonError(error); }
}
