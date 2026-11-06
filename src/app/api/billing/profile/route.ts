import { connection, NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';
import { billingProfileSchema } from '@/lib/nihongo/server/validation';
import { getBillingProfile, saveBillingProfile } from '@/lib/nihongo/server/services/billing';


export async function GET() {
    await connection();
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    return NextResponse.json({ profile: await getBillingProfile(context.supabase, context.user.id) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const input = await readJson(request, billingProfileSchema);
    const profile = await saveBillingProfile(context.supabase, context.user.id, input);
    return NextResponse.json({ saved: true, profile }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error); }
}
