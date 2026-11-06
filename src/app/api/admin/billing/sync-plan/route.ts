import { NextRequest, NextResponse } from 'next/server';
import { requireUser, createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';
import { syncPlanSchema } from '@/lib/nihongo/server/validation';
import { syncRazorpayPlan } from '@/lib/nihongo/server/services/billing';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const { data: roles, error: roleError } = await context.supabase.from('user_roles')
      .select('role').eq('user_id', context.user.id);
    if (roleError) throw new HttpError(500, 'Could not verify administrator access.', roleError.message);
    const roleRows = (roles ?? []) as Array<{ role: string }>;
    if (!roleRows.some((row) => row.role === 'super_admin' || row.role === 'admin')) {
      throw new HttpError(403, 'Administrator access required.');
    }
    const input = await readJson(request, syncPlanSchema);
    const result = await syncRazorpayPlan(createAdminSupabase(), input.planId);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error); }
}
