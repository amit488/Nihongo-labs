import { connection, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSentenceConstructionItem, getSentenceConstructionItems } from '@/lib/nihongo/sentence-construction-bank';
import { HttpError, assertSameOrigin, jsonError, readJson } from '@/lib/nihongo/server/http';
import { createAdminSupabase, requireUser } from '@/lib/nihongo/server/supabase';

const attemptSchema = z.object({
  sentenceId: z.string().regex(/^n[45]-\d{3}$/),
  level: z.enum(['N5', 'N4']),
  submittedTokens: z.array(z.string().min(1).max(40)).min(1).max(30),
  timeTakenMs: z.number().int().min(0).max(900_000),
}).strict();

type AttemptRow = {
  sentence_id: string;
  grammar_tags: string[] | null;
  is_correct: boolean;
  created_at: string;
};

export async function GET(request: NextRequest) {
  await connection();
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const level = request.nextUrl.searchParams.get('level') || 'N5';
    if (!['N5', 'N4'].includes(level)) throw new HttpError(400, 'Unsupported JLPT level.');

    const { data, error } = await context.supabase.from('sentence_construction_attempts')
      .select('sentence_id,grammar_tags,is_correct,created_at')
      .eq('user_id', context.user.id)
      .eq('jlpt_level', level)
      .order('created_at', { ascending: false })
      .limit(5000);
    const totalSentences = getSentenceConstructionItems(level as 'N5' | 'N4').length;
    if (error) {
      if (['42P01', 'PGRST205'].includes(error.code ?? '')) {
        return NextResponse.json({ level, totalSentences, totalAttempts: 0, correctAttempts: 0, accuracy: 0, attemptedSentences: 0, solvedSentences: 0, solvedSentenceIds: [], migrationRequired: true }, { headers: { 'Cache-Control': 'private, no-store' } });
      }
      throw new HttpError(500, 'Could not load sentence construction progress.', error.message);
    }

    const rows = (data ?? []) as AttemptRow[];
    const uniqueAttempted = new Set(rows.map((row) => row.sentence_id));
    const uniqueSolved = new Set(rows.filter((row) => row.is_correct).map((row) => row.sentence_id));
    const correctAttempts = rows.filter((row) => row.is_correct).length;
    return NextResponse.json({
      level,
      totalSentences,
      totalAttempts: rows.length,
      correctAttempts,
      accuracy: rows.length ? Math.round(correctAttempts / rows.length * 100) : 0,
      attemptedSentences: uniqueAttempted.size,
      solvedSentences: uniqueSolved.size,
      solvedSentenceIds: Array.from(uniqueSolved),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}


export async function DELETE(request: NextRequest) {
  await connection();
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);

    // Delete only the authenticated learner's sentence-construction attempts.
    // The service-role client is necessary because normal learner access is
    // intentionally limited to reading and inserting attempt history.
    const { count, error } = await createAdminSupabase()
      .from('sentence_construction_attempts')
      .delete({ count: 'exact' })
      .eq('user_id', context.user.id);

    if (error) throw new HttpError(500, 'Could not reset sentence construction progress.', error.message);

    return NextResponse.json({
      deletedAttempts: count ?? 0,
      resetLevels: ['N5', 'N4'],
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const input = await readJson(request, attemptSchema);
    const item = getSentenceConstructionItem(input.sentenceId, input.level);
    if (!item) throw new HttpError(404, 'Sentence challenge not found.');

    const isCorrect = input.submittedTokens.join('') === item.tokens.join('');
    const { error } = await createAdminSupabase().from('sentence_construction_attempts').insert({
      user_id: context.user.id,
      sentence_id: item.id,
      jlpt_level: item.level,
      grammar_tags: item.grammarTags,
      submitted_tokens: input.submittedTokens,
      is_correct: isCorrect,
      time_taken_ms: input.timeTakenMs,
    });
    if (error) throw new HttpError(500, 'Your sentence was checked but the attempt could not be saved. Apply the sentence construction migration first.', error.message);

    return NextResponse.json({
      correct: isCorrect,
      sentence: item.sentence,
      romaji: item.romaji,
      meaning: item.meaning,
      tip: item.tip,
      grammarTags: item.grammarTags,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
