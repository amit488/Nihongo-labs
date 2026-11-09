import { randomUUID } from 'node:crypto';
import { connection, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireUser, createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';

type ContentType = 'vocabulary' | 'kanji' | 'grammar';
type Candidate = {
  contentType: ContentType;
  contentId: string;
  level: string;
  prompt: string;
  question: string;
  answer: string;
  explanation: string;
};
type RevisionState = {
  content_type: ContentType;
  content_id: string;
  total_attempts: number;
  correct_attempts: number;
  incorrect_attempts: number;
  correct_streak: number;
  last_is_correct: boolean | null;
  last_reviewed_at: string | null;
  next_review_at: string;
};

const submitSchema = z.object({
  contentType: z.enum(['vocabulary', 'kanji', 'grammar']),
  contentId: z.string().uuid(),
  selectedOption: z.string().trim().min(1).max(500).nullable(),
  didNotRemember: z.boolean(),
  responseTimeMs: z.number().int().min(0).max(3_600_000).optional(),
}).strict().superRefine((value, context) => {
  if (value.didNotRemember && value.selectedOption !== null) {
    context.addIssue({ code: 'custom', message: 'A forgotten answer cannot contain a selected option.', path: ['selectedOption'] });
  }
  if (!value.didNotRemember && !value.selectedOption) {
    context.addIssue({ code: 'custom', message: 'Choose an answer or select “I don’t remember”.', path: ['selectedOption'] });
  }
});

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function normalize(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
}

function selectionWeight(state: RevisionState | undefined, now: number): number {
  if (!state) return 7; // Never-tested learned items should get an early opportunity.
  const dueAt = Date.parse(state.next_review_at);
  if (!Number.isFinite(dueAt) || dueAt <= now) return state.last_is_correct === false ? 12 + Math.min(5, state.incorrect_attempts) : 6;
  if (state.last_is_correct === false) return 0; // Wait until the short retry interval expires.\n  const hoursUntilDue = (dueAt - now) / 3_600_000;
  const recentlySeen = state.last_reviewed_at && now - Date.parse(state.last_reviewed_at) < 5 * 60_000;
  // Correctly recalled items fade into the background, but stay eligible as a
  // low-probability fallback so a small learning pool can still be revised.
  return recentlySeen ? 0.15 : Math.max(0.25, 3 / (1 + hoursUntilDue / 24));
}

function weightedPick<T>(items: Array<{ item: T; weight: number }>): T | null {
  const total = items.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (!items.length || total <= 0) return null;
  let cursor = Math.random() * total;
  for (const entry of items) {
    cursor -= Math.max(0, entry.weight);
    if (cursor <= 0) return entry.item;
  }
  return items[items.length - 1].item;
}

async function getLearnedCandidates(userClient: SupabaseClient, userId: string): Promise<Candidate[]> {
  const [vocabularyResult, kanjiResult, grammarResult] = await Promise.all([
    userClient.from('user_vocabulary_progress')
      .select('vocabulary_id,vocabulary_entries!inner(id,jlpt_level,word,kana,meaning,publication_status)')
      .eq('user_id', userId)
      .eq('vocabulary_entries.publication_status', 'published')
      .limit(1000),
    userClient.from('kanji_review_state')
      .select('kanji_id,kanji_entries!inner(id,jlpt_level,character,meaning,publication_status)')
      .eq('user_id', userId).eq('status', 'known')
      .eq('kanji_entries.publication_status', 'published')
      .limit(1000),
    userClient.from('user_grammar_progress')
      .select('grammar_id,grammar_points!inner(id,jlpt_level,title,pattern,explanation,publication_status)')
      .eq('user_id', userId)
      .eq('grammar_points.publication_status', 'published')
      .limit(1000),
  ]);

  const firstError = vocabularyResult.error || kanjiResult.error || grammarResult.error;
  if (firstError) throw new HttpError(500, 'Could not load your learned revision items.', firstError.message);

  const vocabulary = (vocabularyResult.data ?? []).flatMap((row) => {
    const item = relation(row.vocabulary_entries as unknown as {
      id: string; jlpt_level: string; word: string; kana: string; meaning: string; publication_status: string;
    } | Array<{
      id: string; jlpt_level: string; word: string; kana: string; meaning: string; publication_status: string;
    }> | null);
    return item ? [{
      contentType: 'vocabulary' as const, contentId: item.id, level: item.jlpt_level,
      prompt: item.kana && item.kana !== item.word ? `${item.word}（${item.kana}）` : item.word,
      question: 'What is the correct meaning of this word?',
      answer: item.meaning,
      explanation: `${item.word}（${item.kana}） means ${item.meaning}.`,
    }] : [];
  });

  const kanji = (kanjiResult.data ?? []).flatMap((row) => {
    const item = relation(row.kanji_entries as unknown as {
      id: string; jlpt_level: string; character: string; meaning: string; publication_status: string;
    } | Array<{
      id: string; jlpt_level: string; character: string; meaning: string; publication_status: string;
    }> | null);
    return item ? [{
      contentType: 'kanji' as const, contentId: item.id, level: item.jlpt_level,
      prompt: item.character,
      question: 'What is the correct meaning of this kanji?',
      answer: item.meaning,
      explanation: `${item.character} means ${item.meaning}.`,
    }] : [];
  });

  const grammar = (grammarResult.data ?? []).flatMap((row) => {
    const item = relation(row.grammar_points as unknown as {
      id: string; jlpt_level: string; title: string; pattern: string; explanation: string; publication_status: string;
    } | Array<{
      id: string; jlpt_level: string; title: string; pattern: string; explanation: string; publication_status: string;
    }> | null);
    return item ? [{
      contentType: 'grammar' as const, contentId: item.id, level: item.jlpt_level,
      prompt: item.explanation,
      question: 'Which grammar pattern matches this explanation?',
      answer: item.pattern,
      explanation: `${item.pattern} — ${item.explanation}`,
    }] : [];
  });

  return [...vocabulary, ...kanji, ...grammar];
}

async function getOptions(userClient: SupabaseClient, candidate: Candidate): Promise<string[]> {
  let rows: Array<{ id: string; answer: string }> = [];
  if (candidate.contentType === 'vocabulary') {
    const { data, error } = await userClient.from('vocabulary_entries')
      .select('id,meaning').eq('jlpt_level', candidate.level)
      .eq('publication_status', 'published').limit(500);
    if (error) throw new HttpError(500, 'Could not build revision answer choices.', error.message);
    rows = (data ?? []).map((row) => ({ id: row.id, answer: row.meaning }));
  } else if (candidate.contentType === 'kanji') {
    const { data, error } = await userClient.from('kanji_entries')
      .select('id,meaning').eq('jlpt_level', candidate.level)
      .eq('publication_status', 'published').limit(500);
    if (error) throw new HttpError(500, 'Could not build revision answer choices.', error.message);
    rows = (data ?? []).map((row) => ({ id: row.id, answer: row.meaning }));
  } else {
    const { data, error } = await userClient.from('grammar_points')
      .select('id,pattern').eq('jlpt_level', candidate.level)
      .eq('publication_status', 'published').limit(500);
    if (error) throw new HttpError(500, 'Could not build revision answer choices.', error.message);
    rows = (data ?? []).map((row) => ({ id: row.id, answer: row.pattern }));
  }

  const correct = candidate.answer;
  const distractors = [...new Set(rows
    .filter((row) => row.id !== candidate.contentId)
    .map((row) => row.answer)
    .filter((value) => typeof value === 'string' && normalize(value) !== normalize(correct)))];
  const selected = shuffle(distractors).slice(0, 3);
  return shuffle([correct, ...selected]);
}

async function getStats(userClient: SupabaseClient, userId: string) {
  const { data, error } = await userClient.from('quick_revision_state')
    .select('content_type,content_id,total_attempts,correct_attempts,incorrect_attempts,correct_streak,last_is_correct,last_reviewed_at,next_review_at')
    .eq('user_id', userId).limit(5000);
  if (error) throw new HttpError(500, 'Could not load your revision statistics.', error.message);

  const states = (data ?? []) as RevisionState[];
  const totals = states.reduce((acc, state) => ({
    attempts: acc.attempts + state.total_attempts,
    correct: acc.correct + state.correct_attempts,
  }), { attempts: 0, correct: 0 });
  const needsWork = states.filter((state) => state.last_is_correct === false || state.incorrect_attempts > state.correct_attempts);
  const byType = {
    vocabulary: { items: 0, attempts: 0, correct: 0 },
    kanji: { items: 0, attempts: 0, correct: 0 },
    grammar: { items: 0, attempts: 0, correct: 0 },
  };
  for (const state of states) {
    const bucket = byType[state.content_type];
    bucket.items += 1;
    bucket.attempts += state.total_attempts;
    bucket.correct += state.correct_attempts;
  }

  const grouped: Record<ContentType, string[]> = { vocabulary: [], kanji: [], grammar: [] };
  for (const state of needsWork) grouped[state.content_type].push(state.content_id);
  const [vocabularyRows, kanjiRows, grammarRows] = await Promise.all([
    grouped.vocabulary.length ? userClient.from('vocabulary_entries').select('id,word,kana,jlpt_level').in('id', grouped.vocabulary) : Promise.resolve({ data: [], error: null }),
    grouped.kanji.length ? userClient.from('kanji_entries').select('id,character,jlpt_level').in('id', grouped.kanji) : Promise.resolve({ data: [], error: null }),
    grouped.grammar.length ? userClient.from('grammar_points').select('id,title,pattern,jlpt_level').in('id', grouped.grammar) : Promise.resolve({ data: [], error: null }),
  ]);
  const lookupError = vocabularyRows.error || kanjiRows.error || grammarRows.error;
  if (lookupError) throw new HttpError(500, 'Could not load concepts that need revision.', lookupError.message);

  const labels = [
    ...(vocabularyRows.data ?? []).map((row) => ({ contentType: 'vocabulary' as const, label: row.word, detail: row.kana, level: row.jlpt_level })),
    ...(kanjiRows.data ?? []).map((row) => ({ contentType: 'kanji' as const, label: row.character, detail: row.character, level: row.jlpt_level })),
    ...(grammarRows.data ?? []).map((row) => ({ contentType: 'grammar' as const, label: row.title || row.pattern, detail: row.pattern, level: row.jlpt_level })),
  ];

  return {
    totalAttempts: totals.attempts,
    itemsTested: states.length,
    correctAttempts: totals.correct,
    accuracy: totals.attempts ? Math.round((totals.correct / totals.attempts) * 100) : 0,
    needsWorkCount: needsWork.length,
    needsWork: labels.slice(0, 12),
    byType,
  };
}

export async function GET(request: NextRequest) {
  await connection();
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const view = request.nextUrl.searchParams.get('view') || 'question';

    if (view === 'stats') {
      return NextResponse.json(await getStats(context.supabase, context.user.id), {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    if (view !== 'question') throw new HttpError(400, 'Unsupported quick revision view.');

    const candidates = await getLearnedCandidates(context.supabase, context.user.id);
    if (!candidates.length) {
      return NextResponse.json({ available: false, reason: 'no-learned-items' }, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    const { data: states, error: stateError } = await context.supabase.from('quick_revision_state')
      .select('content_type,content_id,total_attempts,correct_attempts,incorrect_attempts,correct_streak,last_is_correct,last_reviewed_at,next_review_at')
      .eq('user_id', context.user.id).limit(5000);
    if (stateError) throw new HttpError(500, 'Could not load your revision history.', stateError.message);

    const stateMap = new Map((states ?? []).map((state) => [
      `${state.content_type}:${state.content_id}`,
      state as RevisionState,
    ]));
    const now = Date.now();
    const selected = weightedPick(candidates.map((item) => ({
      item,
      weight: selectionWeight(stateMap.get(`${item.contentType}:${item.contentId}`), now),
    })));
    if (!selected) return NextResponse.json({ available: false }, { headers: { 'Cache-Control': 'private, no-store' } });

    const options = await getOptions(context.supabase, selected);
    if (options.length < 2) {
      return NextResponse.json({ available: false, reason: 'not-enough-choice-options' }, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    return NextResponse.json({
      available: true,
      question: {
        contentType: selected.contentType,
        contentId: selected.contentId,
        level: selected.level,
        question: selected.question,
        prompt: selected.prompt,
        options,
      },
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
    const input = await readJson(request, submitSchema);
    const userId = context.user.id;
    const userClient = context.supabase;

    let correctAnswer = '';
    let explanation = '';

    if (input.contentType === 'vocabulary') {
      const [{ data: progress, error: progressError }, { data: item, error: itemError }] = await Promise.all([
        userClient.from('user_vocabulary_progress').select('vocabulary_id')
          .eq('user_id', userId).eq('vocabulary_id', input.contentId).maybeSingle(),
        userClient.from('vocabulary_entries').select('word,kana,meaning')
          .eq('id', input.contentId).eq('publication_status', 'published').maybeSingle(),
      ]);
      if (progressError || itemError) throw new HttpError(500, 'Could not validate this vocabulary answer.', progressError?.message || itemError?.message);
      if (!progress || !item) throw new HttpError(403, 'This vocabulary item is not in your learned list.');
      correctAnswer = item.meaning;
      explanation = `${item.word}（${item.kana}） means ${item.meaning}.`;
    } else if (input.contentType === 'kanji') {
      const [{ data: progress, error: progressError }, { data: item, error: itemError }] = await Promise.all([
        userClient.from('kanji_review_state').select('kanji_id')
          .eq('user_id', userId).eq('kanji_id', input.contentId).eq('status', 'known').maybeSingle(),
        userClient.from('kanji_entries').select('character,meaning')
          .eq('id', input.contentId).eq('publication_status', 'published').maybeSingle(),
      ]);
      if (progressError || itemError) throw new HttpError(500, 'Could not validate this kanji answer.', progressError?.message || itemError?.message);
      if (!progress || !item) throw new HttpError(403, 'This kanji item is not in your known list.');
      correctAnswer = item.meaning;
      explanation = `${item.character} means ${item.meaning}.`;
    } else {
      const [{ data: progress, error: progressError }, { data: item, error: itemError }] = await Promise.all([
        userClient.from('user_grammar_progress').select('grammar_id')
          .eq('user_id', userId).eq('grammar_id', input.contentId).maybeSingle(),
        userClient.from('grammar_points').select('title,pattern,explanation')
          .eq('id', input.contentId).eq('publication_status', 'published').maybeSingle(),
      ]);
      if (progressError || itemError) throw new HttpError(500, 'Could not validate this grammar answer.', progressError?.message || itemError?.message);
      if (!progress || !item) throw new HttpError(403, 'This grammar point is not in your understood list.');
      correctAnswer = item.pattern;
      explanation = `${item.pattern} — ${item.explanation}`;
    }

    const isCorrect = !input.didNotRemember && normalize(input.selectedOption ?? '') === normalize(correctAnswer);
    const admin = createAdminSupabase();
    const { data, error } = await admin.rpc('persist_quick_revision_attempt', {
      _attempt_id: randomUUID(),
      _user_id: userId,
      _content_type: input.contentType,
      _content_id: input.contentId,
      _selected_answer: input.selectedOption,
      _correct_answer: correctAnswer,
      _is_correct: isCorrect,
      _did_not_remember: input.didNotRemember,
      _response_time_ms: input.responseTimeMs ?? null,
    });
    if (error) throw new HttpError(500, 'Could not save your quick revision result. Apply the Quick Revision migration first.', error.message);

    return NextResponse.json({
      isCorrect,
      didNotRemember: input.didNotRemember,
      correctAnswer,
      explanation,
      nextReviewAt: typeof data === 'object' && data !== null ? (data as { nextReviewAt?: string }).nextReviewAt ?? null : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
