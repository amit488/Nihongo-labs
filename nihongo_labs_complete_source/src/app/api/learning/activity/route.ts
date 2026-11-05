import { NextRequest, NextResponse } from 'next/server';
import { requireUser, createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';
import { getUserTimeZone } from '@/lib/nihongo/server/activity';
import { localDateKey } from '@/lib/nihongo/server/date';
import { z } from 'zod';

// The client supplies a liveness ping, never an amount of study time to credit.
const activitySchema = z.object({ seconds: z.literal(60) }).strict();
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    await readJson(request, activitySchema);
    const admin = createAdminSupabase();
    const timezone = await getUserTimeZone(admin, context.user.id);
    const activityDate = localDateKey(new Date(), timezone);
    const { data: accepted, error } = await admin.rpc('record_user_heartbeat', {
      _user_id: context.user.id,
      _activity_date: activityDate,
    });
    if (error) throw new HttpError(500, 'Could not record study heartbeat. Run sql/011_backend_rpc.sql first.', error.message);
    return NextResponse.json({ saved: Boolean(accepted), activityDate }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error); }
}
