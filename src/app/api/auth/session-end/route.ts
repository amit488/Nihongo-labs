import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { requireUser, createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { KEEP_SIGNED_IN_COOKIE } from '@/lib/nihongo/auth-session';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';
import { getUserTimeZone } from '@/lib/nihongo/server/activity';
import { localDateKey } from '@/lib/nihongo/server/date';
import { z } from 'zod';

const sessionEndSchema = z.object({
  endSession: z.boolean().default(true),
  seconds: z.number().int().min(1).max(3600).optional(),
  requestId: z.string().uuid().optional(),
  requestCreatedAt: z.string().datetime({ offset: true }).optional(),
}).strict().superRefine((value, context) => {
  const heartbeatFields = [
    value.seconds !== undefined,
    value.requestId !== undefined,
    value.requestCreatedAt !== undefined,
  ];
  const suppliedHeartbeatFields = heartbeatFields.filter(Boolean).length;
  if (suppliedHeartbeatFields !== 0 && suppliedHeartbeatFields !== 3) {
    context.addIssue({
      code: 'custom',
      message: 'A final heartbeat requires seconds, requestId and requestCreatedAt together.',
    });
  }
});

/**
 * Called with fetch keepalive when a site document closes. It can record the
 * final pending heartbeat and revoke a non-remembered Supabase session in one
 * request, avoiding a race between separate unload-time network calls.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const payload = await readJson(request, sessionEndSchema);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);

    let creditedSeconds = 0;
    let activityDate: string | null = null;
    let activityWarning: string | null = null;

    if (payload.seconds !== undefined && payload.requestId && payload.requestCreatedAt) {
      const admin = createAdminSupabase();
      const timezone = await getUserTimeZone(admin, context.user.id);
      activityDate = localDateKey(new Date(), timezone);
      const { data: credited, error } = await admin.rpc('record_user_heartbeat', {
        _user_id: context.user.id,
        _activity_date: activityDate,
        _observed_seconds: payload.seconds,
        _request_id: payload.requestId,
        _request_created_at: payload.requestCreatedAt,
      });

      if (error?.message.includes('HEARTBEAT_REQUEST_EXPIRED')) {
        activityWarning = 'HEARTBEAT_REQUEST_EXPIRED';
      } else if (error) {
        activityWarning = 'STUDY_TIME_NOT_RECORDED';
        console.error('[Nihongo Labs final study heartbeat]', error);
      } else {
        creditedSeconds = Math.max(0, Math.min(payload.seconds, Number(credited ?? 0)));
      }
    }

    if (payload.endSession) {
      const { error } = await context.supabase.auth.signOut();
      if (error) throw new HttpError(500, 'Could not end the Supabase session.');

      const cookieStore = await cookies();
      cookieStore.set(KEEP_SIGNED_IN_COOKIE, '', {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 0,
      });
    }

    return NextResponse.json(
      {
        saved: creditedSeconds > 0,
        creditedSeconds,
        activityDate,
        signedOut: payload.endSession,
        activityWarning,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
