import { connection, NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';
import { getDueFlashcards } from '@/lib/nihongo/server/services/flashcards';

export async function GET(request: NextRequest) {
    await connection();
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const deckId = request.nextUrl.searchParams.get('deckId');
    if (!deckId) throw new HttpError(400, 'deckId is required.');
    const mode = request.nextUrl.searchParams.get('mode');
    const validMode = mode === 'new' || mode === 'review' || mode === 'mixed' || mode === 'custom' ? mode : 'mixed';
    return NextResponse.json(await getDueFlashcards(context.supabase, context.user.id, deckId, validMode), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return jsonError(error); }
}
