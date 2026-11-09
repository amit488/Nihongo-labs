import { connection, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';

function relation<T>(value: T | T[] | null): T | null {\n  return Array.isArray(value) ? (value[0] as T | undefined) ?? null : value as T | null;\n}

export async function GET(request: NextRequest) {
  await connection();
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const parsed = z.enum(['N5', 'N4']).safeParse(request.nextUrl.searchParams.get('level') || 'N5');
    if (!parsed.success) throw new HttpError(400, 'Choose N5 or N4.');
    const level = parsed.data;

    const [{ data, error }, { data: learned, error: learnedError }, { data: quickStates, error: quickError }] = await Promise.all([
      context.supabase.from('vocabulary_review_state')
        .select('vocabulary_id,due_at,repetitions,interval_days,ease_factor,last_rating,last_reviewed_at,vocabulary_entries!inner(id,jlpt_level,word,kana,romaji,meaning,part_of_speech,example_sentence,example_reading,example_translation)')
        .eq('user_id', context.user.id)
        .eq('vocabulary_entries.jlpt_level', level)
        .eq('vocabulary_entries.publication_status', 'published')
        .order('due_at', { ascending: true })
        .limit(2000),
      context.supabase.from('user_vocabulary_progress').select('vocabulary_id')
        .eq('user_id', context.user.id).limit(3000),
      context.supabase.from('quick_revision_state')
        .select('content_id,total_attempts,correct_attempts,incorrect_attempts,last_is_correct,next_review_at')
        .eq('user_id', context.user.id).eq('content_type', 'vocabulary').limit(3000),
    ]);
    if (error || learnedError || quickError) throw new HttpError(500, 'Could not load vocabulary intelligence.', error?.message || learnedError?.message || quickError?.message);

    const now = Date.now();
    const quickIds = [...new Set((quickStates ?? []).map((row) => row.content_id))];
    const quickEntries = new Map<string, { word: string; kana: string; romaji: string | null; meaning: string; part_of_speech: string | null; example_sentence: string | null; example_reading: string | null; example_translation: string | null }>();
    if (quickIds.length) {
      const { data: quickWords, error: quickWordsError } = await context.supabase.from('vocabulary_entries')
        .select('id,word,kana,romaji,meaning,part_of_speech,example_sentence,example_reading,example_translation')
        .eq('jlpt_level', level).eq('publication_status', 'published').in('id', quickIds);
      if (quickWordsError) throw new HttpError(500, 'Could not resolve Quick Revision vocabulary items.', quickWordsError.message);
      for (const word of quickWords ?? []) quickEntries.set(word.id, word);
    }
    const items = (data ?? []).flatMap((row) => {
      const word = relation(row.vocabulary_entries as unknown as {
        id: string; jlpt_level: string; word: string; kana: string; romaji: string | null;
        meaning: string; part_of_speech: string | null; example_sentence: string | null;
        example_reading: string | null; example_translation: string | null;
      } | Array<{
        id: string; jlpt_level: string; word: string; kana: string; romaji: string | null;
        meaning: string; part_of_speech: string | null; example_sentence: string | null;
        example_reading: string | null; example_translation: string | null;
      }> | null);
      if (!word) return [];
      const dueAt = Date.parse(row.due_at);
      const due = Number.isFinite(dueAt) && dueAt <= now;
      const lastRating = typeof row.last_rating === 'number' ? row.last_rating : null;
      const atRisk = lastRating !== null && lastRating <= 2 || due && Number(row.repetitions) < 2;
      const mastered = Number(row.repetitions) >= 3 && !due && lastRating !== null && lastRating >= 3;
      return [{
        id: word.id, word: word.word, kana: word.kana, romaji: word.romaji,
        meaning: word.meaning, partOfSpeech: word.part_of_speech,
        example: word.example_sentence, exampleReading: word.example_reading,
        exampleMeaning: word.example_translation,
        dueAt: row.due_at, repetitions: Number(row.repetitions),
        intervalDays: Number(row.interval_days), lastRating,
        due, atRisk, mastered,
      }];
    });
    const itemsById = new Map(items.map((item) => [item.id, item]));
    for (const state of quickStates ?? []) {
      const word = quickEntries.get(state.content_id);
      if (!word) continue;
      const dueAt = state.next_review_at;
      const due = Date.parse(dueAt) <= now;
      const atRisk = Number(state.incorrect_attempts) >= 2 || state.last_is_correct === false;
      const quickItem = {
        id: state.content_id, word: word.word, kana: word.kana, romaji: word.romaji,
        meaning: word.meaning, partOfSpeech: word.part_of_speech,
        example: word.example_sentence, exampleReading: word.example_reading, exampleMeaning: word.example_translation,
        dueAt, repetitions: Number(state.total_attempts), intervalDays: 0,
        lastRating: state.last_is_correct === false ? 1 : state.last_is_correct === true ? 4 : null,
        due, atRisk, mastered: Number(state.correct_attempts) >= 3 && Number(state.incorrect_attempts) === 0 && !due,
      };
      const existing = itemsById.get(quickItem.id);
      if (existing) {
        existing.due = existing.due || quickItem.due;
        existing.atRisk = existing.atRisk || quickItem.atRisk;
        existing.mastered = existing.mastered || quickItem.mastered;
        if (quickItem.atRisk && (existing.lastRating === null || existing.lastRating > 1)) existing.lastRating = 1;
      } else itemsById.set(quickItem.id, quickItem);
    }
    const unifiedItems = [...itemsById.values()];
    const dueItems = unifiedItems.filter((item) => item.due);
    const riskItems = unifiedItems.filter((item) => item.atRisk)
      .sort((a, b) => (a.lastRating ?? 5) - (b.lastRating ?? 5) || Date.parse(a.dueAt) - Date.parse(b.dueAt));
    const masteredCount = unifiedItems.filter((item) => item.mastered).length;
    return NextResponse.json({
      level,
      learnedCount: (learned ?? []).length,
      trackedCount: unifiedItems.length,
      dueCount: dueItems.length,
      atRiskCount: riskItems.length,
      masteredCount,
      items: [...riskItems, ...dueItems.filter((item) => !item.atRisk)].slice(0, 10),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
