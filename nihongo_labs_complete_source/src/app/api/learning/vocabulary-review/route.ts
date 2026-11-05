import { NextRequest, NextResponse } from 'next/server';
import { requireUser, createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';
import { vocabularyReviewSchema } from '@/lib/nihongo/server/validation';
import { reviewVocabulary } from '@/lib/nihongo/server/services/vocabulary';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const body = await readJson(request, vocabularyReviewSchema);
    const result = await reviewVocabulary(createAdminSupabase(), context.user.id, body.vocabularyId, body.quality);
    return NextResponse.json({ state: result });
  } catch (error) { return jsonError(error); }
}
