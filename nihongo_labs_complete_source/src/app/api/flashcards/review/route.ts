import { NextRequest, NextResponse } from 'next/server';
import { requireUser, createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';
import { flashcardReviewSchema } from '@/lib/nihongo/server/validation';
import { reviewFlashcard } from '@/lib/nihongo/server/services/flashcards';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const input = await readJson(request, flashcardReviewSchema);
    const result = await reviewFlashcard(context.supabase, createAdminSupabase(), context.user.id, input);
    return NextResponse.json(result);
  } catch (error) { return jsonError(error); }
}
