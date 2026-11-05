import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 30)));
    const [{ data: words, error: wordsError }, { data: states, error: statesError }] = await Promise.all([
      context.supabase.from('vocabulary_entries').select('id,word,kana,romaji,meaning,part_of_speech,example_sentence,example_reading,example_translation').eq('jlpt_level', 'N5').eq('publication_status', 'published').order('word').limit(1000),
      context.supabase.from('vocabulary_review_state').select('vocabulary_id,due_at,repetitions,interval_days,last_rating').eq('user_id', context.user.id).limit(5000),
    ]);
    if (wordsError || statesError) throw new HttpError(500, 'Could not load vocabulary revision queue.', wordsError?.message || statesError?.message);
    const byId = new Map((states ?? []).map((state) => [state.vocabulary_id, state]));
    const now = Date.now();
    const due = (words ?? []).filter((word) => {
      const state = byId.get(word.id);
      return !state || new Date(state.due_at).getTime() <= now;
    }).slice(0, limit).map((word) => ({ ...word, reviewState: byId.get(word.id) ?? null }));
    return NextResponse.json({ items: due, dueCount: due.length, totalUnreviewed: (words ?? []).filter((word) => !byId.has(word.id)).length }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return jsonError(error); }
}
