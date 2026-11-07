import { NextRequest, NextResponse } from 'next/server';
import { requireUser, createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';
import { getUserTimeZone } from '@/lib/nihongo/server/activity';
import { localDateKey } from '@/lib/nihongo/server/date';
import { z } from 'zod';

// The client can submit only the time it measured locally. PostgreSQL independently
// caps the credit against elapsed server time and serializes requests per account.
const activitySchema = z.object({
  seconds: z.number().int().min(1).max(3600),
}).strict();

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);

    const { seconds } = await readJson(request, activitySchema);
    const admin = createAdminSupabase();
    const timezone = await getUserTimeZone(admin, context.user.id);
    const activityDate = localDateKey(new Date(), timezone);
    const { data: credited, error } = await admin.rpc('record_user_heartbeat', {
      _user_id: context.user.id,
      _activity_date: activityDate,
      _observed_seconds: seconds,
    });

    if (error) {
      throw new HttpError(
        500,
        'Could not record study heartbeat. Apply the latest study-time migration.',
        error.message,
      );
    }

    const creditedSeconds = Math.max(0, Math.min(seconds, Number(credited ?? 0)));
    return NextResponse.json(
      { saved: creditedSeconds > 0, creditedSeconds, activityDate },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
