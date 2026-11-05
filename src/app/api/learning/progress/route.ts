import { NextRequest, NextResponse } from 'next/server';
import { requireUser, createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, jsonError, HttpError, readJson } from '@/lib/nihongo/server/http';
import { progressSchema } from '@/lib/nihongo/server/validation';
import { saveLessonProgress } from '@/lib/nihongo/server/services/progress';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const input = await readJson(request, progressSchema);
    const result = await saveLessonProgress(context.supabase, createAdminSupabase(), context.user.id, input);
    return NextResponse.json({ progress: result });
  } catch (error) { return jsonError(error); }
}
