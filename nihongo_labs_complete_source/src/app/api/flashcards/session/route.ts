import { NextRequest, NextResponse } from 'next/server';
import { requireUser, createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';
import { createFlashcardSessionSchema, sessionIdSchema } from '@/lib/nihongo/server/validation';
import { createFlashcardSession, finishFlashcardSession } from '@/lib/nihongo/server/services/flashcards';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const input = await readJson(request, createFlashcardSessionSchema);
    const result = await createFlashcardSession(context.supabase, createAdminSupabase(), context.user.id, input.deckId, input.mode);
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const body = await readJson(request, sessionIdSchema);
    const result = await finishFlashcardSession(createAdminSupabase(), context.user.id, body.sessionId);
    return NextResponse.json({ session: result });
  } catch (error) { return jsonError(error); }
}
